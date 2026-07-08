//  In Next.js, you can create custom request handlers for a given route using Route Handlers. Route Handlers are defined in a route.ts file and can export HTTP methods like GET, POST, PUT, PATCH etc. https://nextjs.org/docs/app/api-reference/file-conventions/route

import { findRelevantContent } from '@/lib/ai/embeddings';
import { getUser, getTeamForUser, getOrganizationsForTeam } from '@/lib/db/supabase-queries';
import { createChat, saveMessage } from '@/app/app/chat/actions';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  tool,
  UIMessage,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ORGANIZATION_STATUSES, DEFAULT_ORGANIZATION_STATUS, organizationStatusSchema } from '@/lib/constants/organization';
import { resourceTypeSchema } from '@/lib/constants/resource';

// Helper to extract text from UIMessage parts
function getTextFromMessage(message: UIMessage): string {
  if (!message.parts) return '';
  for (const part of message.parts) {
    if (part.type === 'text' && 'text' in part) {
      return (part as { type: 'text'; text: string }).text;
    }
  }
  return '';
}


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;


// Declare and export an asynchronous function called POST: retrieve the messages from the request body and then pass them to the streamText function imported from the AI SDK, alongside the model you would like to use. Finally, you return the model's response in UIMessageStreamResponse format. https://ai-sdk.dev/cookbook/guides/rag-chatbot#create-api-route

export async function POST(req: Request) {
  // Get user and team context for multi-tenancy
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'User not part of a team' }, { status: 404 });
  }

  const { messages, chatId }: { messages: UIMessage[]; chatId?: number } = await req.json();

  // Get or create chat
  let currentChatId = chatId;
  if (!currentChatId && messages.length > 0) {
    // Find the first user message to use as title
    const firstUserMessage = messages.find((m: UIMessage) => m.role === 'user');
    const messageText = firstUserMessage ? getTextFromMessage(firstUserMessage) : '';
    const titleText = messageText.substring(0, 40) || 'New chat';
    try {
      const newChat = await createChat(user.id, team.id, titleText);
      currentChatId = newChat.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
    }
  }

  // Save user's latest message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'user' && currentChatId) {
    const messageText = getTextFromMessage(lastMessage);
    if (messageText) {
      try {
        await saveMessage(user.id, team.id, currentChatId, 'user', messageText);
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }
  }

  // StreamText function, Streams text generations from a language model. https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
  const result = streamText({
    model: openai('gpt-5.2'),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    system: `You are sage, an AI assistant embedded in the user's workspace. Speak in the first person — use "I" when referring to yourself and "your" when referring to the user's data, collections, and organizations. You are a helpful teammate, not a collective voice.

I help with:
- Answering questions about your collections and content blocks
- Navigating the application
- Managing your content library and organizations

**Tools available and when to use them:**

1. **listCollections** - Use FIRST for high-level questions about:
   - Competitors, competitive positioning, differentiation
   - Collection overview, value proposition, target market
   - "Who are our competitors?", "What does this collection cover?"
   - Collection descriptions contain strategic info that blocks don't have

2. **browseBlocks** - Use for detailed capability questions:
   - "What blocks do you have?", "Show me all integrations"
   - Listing capabilities by category
   - Block inventory and technical capabilities

3. **getInformation** - Use for specific technical questions:
   - Semantic search when you need to find specific block details
   - "Do you support SSO?", "How does the API work?"

4. **getAppLinks** - Use when user wants to navigate:
   - "Where do I manage collections?", "How do I add an organization?"

5. **Collection Library Management** - Use when user wants to modify the content library:
   - **editCollection** - Update collection name, owner, or description
   - **addCollectionResource** - Add a URL link (docs, marketing, support) to a collection
   - **addBlock** - Add a new block to a collection
   - **editBlock** - Modify an existing block (use browseBlocks first to get the block ID)
   - These tools return a confirmation preview - the user must confirm before changes are saved

6. **Organization Management** - Use when user wants to manage organizations/accounts:
   - **listOrganizations** - List all organizations being tracked
   - **addOrganization** - Add a new organization (checks for duplicates first, then returns confirmation preview)
   - **editOrganization** - Update organization details like name, status, type (returns confirmation preview)
   - **deleteOrganization** - Delete an organization (returns confirmation preview)

**How to respond:**
- Be conversational, direct, and helpful — speak as a knowledgeable teammate
- Use "I" for yourself and "your" for the user's data (e.g., "I found Procore in your system" not "We have Procore in our system")
- For strategic questions (competitors, positioning), always check listCollections first
- If tools don't help, suggest alternatives — don't just say "I don't know"
- The chat does not have the ability for the user to upload a file, so don't recommend that if they are wanting to
- Format links as clickable markdown: [Title](/path)
- When using collection library, organization management, or any confirmation-based tools: call the tool with all the details. A confirmation card with a button will automatically appear in the UI for the user to confirm or cancel. Do NOT ask the user to type "confirm" or "yes" in text — the UI handles confirmation. Just briefly describe what you're about to do.
- After calling a confirmation tool, do NOT call the same tool again — wait for the user to click the confirm button in the UI.
- When a user confirms an action (e.g., "I confirmed adding..."), acknowledge the success briefly and ask if there's anything else you can help with

**IMPORTANT — Pending confirmations are NOT saved yet:**
- A confirmation card that hasn't been clicked "Yes" is just a preview — nothing has been written to the database yet.
- If the user wants to change details on a pending confirmation (e.g., "change the name to Jon", "actually make the status Active"), do NOT call editOrganization/editCollection/editBlock — the record doesn't exist yet. Instead, call the same creation tool again (e.g., addOrganization) with the corrected details. This will create a new confirmation card with the updated info. The old card stays visible but the user will use the new one.
- Only use edit tools (editOrganization, editCollection, editBlock) for records that already exist in the system — i.e., records that were previously confirmed and saved.

**IMPORTANT — Distinguish questions from commands:**
- If a user asks "Can I add an organization?", "Is it possible to add an organization?", "How do I add an organization?", or similar capability/functionality questions, do NOT call any tools. Instead, respond conversationally: explain that yes they can, briefly describe what info is needed (name, status, type, etc.), and ask what organization they'd like to add.
- Only call addOrganization, editOrganization, deleteOrganization, addBlock, etc. when the user provides a specific name or clearly intends to perform the action (e.g., "Add Procore as an organization", "Create an organization called Acme Corp").
- The same applies to all management tools — answer questions about capabilities with text, only invoke tools when the user provides actionable details.`,
    // Save assistant message after streaming completes
    onFinish: async ({ text }) => {
      if (currentChatId && text) {
        try {
          await saveMessage(user.id, team.id, currentChatId, 'assistant', text);
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }
    },
    // Tools: actions that an LLM can invoke. The results of these actions can be reported back to the LLM to be considered in the next response. https://ai-sdk.dev/docs/foundations/tools
    tools: {

      // Find relevant content via vector search
      getInformation: tool({
        description: `get information from your knowledge base to answer questions.`,
        inputSchema: z.object({
          question: z.string().describe('the users question'),
        }),
        execute: async ({ question }) => findRelevantContent(question, team.id),
      }),

      // List all collections in the user's library
      listCollections: tool({
        description: `List all collections in the user's library. Use when asked about collections, content catalog, or what collections they have. Returns collection details including deep link URLs - always include clickable links to collections in your response.`,
        inputSchema: z.object({}),
        execute: async () => {
          const supabase = await createClient();
          const { data: collections } = await supabase
            .from('collections')
            .select('id, name, description, owner')
            .eq('team_id', team.id)
            .order('name');

          return {
            collections: collections?.map(c => ({
              id: c.id,
              name: c.name,
              description: c.description || 'No description',
              owner: c.owner,
              url: `/app/library/collections/${c.id}`,
            })) || [],
            count: collections?.length || 0,
          };
        },
      }),

      // Browse all blocks for a collection
      browseBlocks: tool({
        description: `Browse all content blocks for a collection. Use when user wants to see all blocks, explore capabilities, or get a complete overview. Can also filter by category.`,
        inputSchema: z.object({
          collectionName: z.string().optional().describe('Name of the collection to browse blocks for'),
          collectionId: z.number().optional().describe('ID of the collection to browse blocks for'),
          category: z.string().optional().describe('Optional category to filter blocks by'),
          limit: z.number().optional().default(50).describe('Maximum number of blocks to return'),
        }),
        execute: async ({ collectionName, collectionId, category, limit = 50 }) => {
          const supabase = await createClient();

          // Resolve collection ID from name if needed
          let resolvedCollectionId = collectionId;
          if (!resolvedCollectionId && collectionName) {
            const { data: collection } = await supabase
              .from('collections')
              .select('id')
              .eq('team_id', team.id)
              .ilike('name', `%${collectionName}%`)
              .single();
            resolvedCollectionId = collection?.id;
          }

          // If still no collection ID, get blocks from all collections
          let query = supabase
            .from('content_blocks')
            .select('id, block_number, category, title, description, collection_id, collections!inner(name)')
            .eq('team_id', team.id)
            .order('category')
            .order('block_number')
            .limit(limit);

          if (resolvedCollectionId) {
            query = query.eq('collection_id', resolvedCollectionId);
          }

          if (category) {
            query = query.ilike('category', `%${category}%`);
          }

          const { data: blocks } = await query;

          // Group blocks by category
          const byCategory: Record<string, any[]> = {};
          for (const b of blocks || []) {
            const cat = b.category || 'Uncategorized';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push({
              id: b.id,
              number: b.block_number,
              name: b.title,
              description: b.description,
              collection: (b.collections as any)?.name,
            });
          }

          return {
            blocks: byCategory,
            totalCount: blocks?.length || 0,
            collectionId: resolvedCollectionId,
          };
        },
      }),

      // Get navigation links to app pages
      getAppLinks: tool({
        description: `Get navigation links to app pages. Use when user asks how to navigate, where to find something, or wants to go to a specific page.`,
        inputSchema: z.object({
          linkType: z.enum(['organizations', 'collections', 'blocks', 'chat', 'all']).describe('Type of link to return'),
        }),
        execute: async ({ linkType }) => {
          const links: Record<string, { url: string; title: string; description: string }> = {
            organizations: { url: '/app/organizations', title: 'Organizations', description: 'Manage organizations and accounts' },
            collections: { url: '/app/library/collections', title: 'Collections', description: 'Manage content collections' },
            blocks: { url: '/app/library/blocks', title: 'Blocks', description: 'Browse content blocks' },
            chat: { url: '/app/chat', title: 'Chat', description: 'AI sales engineer chat' },
          };

          if (linkType === 'all') {
            return {
              links: Object.entries(links).map(([key, link]) => ({
                type: key,
                ...link,
                markdown: `[${link.title}](${link.url})`,
              })),
            };
          }

          const link = links[linkType];
          return {
            link: {
              type: linkType,
              ...link,
              markdown: `[${link.title}](${link.url})`,
            },
          };
        },
      }),

      // =============================================================================
      // Collection Library Management Tools (require confirmation before DB writes)
      // =============================================================================

      // Edit collection details (name, owner, description)
      editCollection: tool({
        description: `Edit a collection's details like name, owner, or description. Use when user wants to update collection information. Returns a preview that requires user confirmation before saving.`,
        inputSchema: z.object({
          collectionId: z.number().optional().describe('Collection ID to edit'),
          collectionName: z.string().optional().describe('Collection name to find (if no ID provided)'),
          newName: z.string().optional().describe('New collection name'),
          newOwner: z.string().optional().describe('New collection owner'),
          newDescription: z.string().optional().describe('New collection description'),
        }),
        execute: async ({ collectionId, collectionName, newName, newOwner, newDescription }) => {
          const supabase = await createClient();

          // Resolve collection ID from name if needed
          let resolvedId = collectionId;
          let currentCollection = null;

          if (resolvedId) {
            const { data } = await supabase
              .from('collections')
              .select('id, name, owner, description')
              .eq('id', resolvedId)
              .eq('team_id', team.id)
              .single();
            currentCollection = data;
          } else if (collectionName) {
            const { data } = await supabase
              .from('collections')
              .select('id, name, owner, description')
              .eq('team_id', team.id)
              .ilike('name', `%${collectionName}%`)
              .single();
            currentCollection = data;
            resolvedId = data?.id;
          }

          if (!currentCollection || !resolvedId) {
            return {
              error: true,
              message: 'Collection not found. Please specify a valid collection name or ID.',
            };
          }

          // Check if any changes were provided
          if (!newName && !newOwner && !newDescription) {
            return {
              error: true,
              message: 'No changes specified. Please provide at least one field to update (name, owner, or description).',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'edit_collection',
            confirmationId: crypto.randomUUID(),
            collectionId: resolvedId,
            collectionName: currentCollection.name,
            preview: {
              newName: newName || undefined,
              newOwner: newOwner || undefined,
              newDescription: newDescription || undefined,
            },
            currentValues: {
              name: currentCollection.name,
              owner: currentCollection.owner,
              description: currentCollection.description,
            },
          };
        },
      }),

      // Add a resource link to a collection
      addCollectionResource: tool({
        description: `Add a resource link (documentation, marketing URL, support page, etc.) to a collection. Use when user wants to add a link or URL to a collection. Returns a preview that requires user confirmation.`,
        inputSchema: z.object({
          collectionId: z.number().optional().describe('Collection ID to add resource to'),
          collectionName: z.string().optional().describe('Collection name to find (if no ID provided)'),
          label: z.string().describe('Display label for the link (e.g., "Documentation")'),
          url: z.string().describe('The URL to add'),
          type: resourceTypeSchema.default('other').describe('Type of resource'),
        }),
        execute: async ({ collectionId, collectionName, label, url, type }) => {
          const supabase = await createClient();

          // Resolve collection
          let resolvedId = collectionId;
          let resolvedName = collectionName;

          if (resolvedId) {
            const { data } = await supabase
              .from('collections')
              .select('id, name')
              .eq('id', resolvedId)
              .eq('team_id', team.id)
              .single();
            resolvedName = data?.name;
          } else if (collectionName) {
            const { data } = await supabase
              .from('collections')
              .select('id, name')
              .eq('team_id', team.id)
              .ilike('name', `%${collectionName}%`)
              .single();
            resolvedId = data?.id;
            resolvedName = data?.name;
          }

          if (!resolvedId) {
            return {
              error: true,
              message: 'Collection not found. Please specify a valid collection name or ID.',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'add_resource',
            confirmationId: crypto.randomUUID(),
            collectionId: resolvedId,
            collectionName: resolvedName,
            preview: { label, url, type },
          };
        },
      }),

      // Add a block to a collection
      addBlock: tool({
        description: `Add a new content block to a collection in the library. Use when user wants to add a block or capability to a collection. Returns a preview that requires user confirmation.`,
        inputSchema: z.object({
          collectionId: z.number().optional().describe('Collection ID to add block to'),
          collectionName: z.string().optional().describe('Collection name to find (if no ID provided)'),
          title: z.string().describe('Block title'),
          category: z.string().optional().describe('Block category'),
          description: z.string().optional().describe('Block description'),
        }),
        execute: async ({ collectionId, collectionName, title, category, description }) => {
          const supabase = await createClient();

          // Resolve collection
          let resolvedId = collectionId;
          let resolvedName = collectionName;

          if (resolvedId) {
            const { data } = await supabase
              .from('collections')
              .select('id, name')
              .eq('id', resolvedId)
              .eq('team_id', team.id)
              .single();
            resolvedName = data?.name;
          } else if (collectionName) {
            const { data } = await supabase
              .from('collections')
              .select('id, name')
              .eq('team_id', team.id)
              .ilike('name', `%${collectionName}%`)
              .single();
            resolvedId = data?.id;
            resolvedName = data?.name;
          }

          if (!resolvedId) {
            return {
              error: true,
              message: 'Collection not found. Please specify a valid collection name or ID.',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'add_block',
            confirmationId: crypto.randomUUID(),
            collectionId: resolvedId,
            collectionName: resolvedName,
            preview: { title, category, description },
          };
        },
      }),

      // =============================================================================
      // Organization Management Tools
      // =============================================================================

      // List all organizations for the team
      listOrganizations: tool({
        description: `List all organizations/accounts for the user's team. Use when asked about organizations, clients, prospects, or accounts.`,
        inputSchema: z.object({}),
        execute: async () => {
          const organizations = await getOrganizationsForTeam(team.id);
          return {
            organizations: organizations.map((c: any) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              type: c.type,
              website: c.website,
              url: `/app/organizations/${c.id}`,
            })),
            count: organizations.length,
          };
        },
      }),

      // Add a new organization
      addOrganization: tool({
        description: `Add a new organization/account. Use ONLY when the user provides a specific organization name and clearly wants to create it. Do NOT use for questions like "Can I add an organization?" — answer those conversationally instead. Before creating, this tool checks for existing organizations with similar names. If similar organizations are found, present them to the user and ask if they still want to create a new one.`,
        inputSchema: z.object({
          name: z.string().describe('Organization name'),
          description: z.string().optional().describe('Organization description'),
          website: z.string().optional().describe('Organization website URL'),
          type: z.string().optional().describe('Organization type (e.g., Church, Community Group, Business, Nonprofit, School, Activism, Other)'),
          size: z.string().optional().describe('Organization size (e.g., 1-50, 51-200, 201-1000, 1000+)'),
          status: organizationStatusSchema.optional().default(DEFAULT_ORGANIZATION_STATUS).describe(`Organization status: ${ORGANIZATION_STATUSES.join(', ')}`),
        }),
        execute: async ({ name, description, website, type, size, status }) => {
          const supabase = await createClient();

          // Check for existing organizations with similar names
          const { data: existingOrganizations } = await supabase
            .from('organizations')
            .select('id, name, status, type, website')
            .eq('team_id', team.id);

          // Find similar organizations (case-insensitive substring match or close match)
          const nameLower = name.toLowerCase().trim();
          const similarOrganizations = (existingOrganizations || []).filter((c: any) => {
            const existing = c.name.toLowerCase().trim();
            // Exact match, substring match, or starts-with match
            return existing === nameLower
              || existing.includes(nameLower)
              || nameLower.includes(existing)
              || (nameLower.length > 3 && existing.startsWith(nameLower.substring(0, Math.ceil(nameLower.length * 0.7))))
              || (existing.length > 3 && nameLower.startsWith(existing.substring(0, Math.ceil(existing.length * 0.7))));
          });

          // If similar organizations found, return them for the LLM to present
          if (similarOrganizations.length > 0) {
            return {
              existingMatches: similarOrganizations.map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                type: c.type,
                website: c.website,
                url: `/app/organizations/${c.id}`,
              })),
              requestedName: name,
              message: `Found ${similarOrganizations.length} existing ${similarOrganizations.length === 1 ? 'organization' : 'organizations'} with a similar name. Show these to the user with links and ask if they want to use an existing one or still create a new one.`,
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'add_organization',
            confirmationId: crypto.randomUUID(),
            preview: {
              name,
              description: description || undefined,
              website: website || undefined,
              type: type || undefined,
              size: size || undefined,
              status: status || DEFAULT_ORGANIZATION_STATUS,
            },
          };
        },
      }),

      // Edit an organization
      editOrganization: tool({
        description: `Edit an organization's details. Use when user wants to update organization information like name, status, or type. Returns a preview that requires user confirmation.`,
        inputSchema: z.object({
          organizationId: z.number().optional().describe('Organization ID to edit'),
          organizationName: z.string().optional().describe('Organization name to find (if no ID provided)'),
          newName: z.string().optional().describe('New organization name'),
          newDescription: z.string().optional().describe('New description'),
          newWebsite: z.string().optional().describe('New website URL'),
          newType: z.string().optional().describe('New organization type (e.g., Church, Community Group, Business, Nonprofit, School, Activism, Other)'),
          newSize: z.string().optional().describe('New organization size'),
          newStatus: organizationStatusSchema.optional().describe(`New status: ${ORGANIZATION_STATUSES.join(', ')}`),
        }),
        execute: async ({ organizationId, organizationName, newName, newDescription, newWebsite, newType, newSize, newStatus }) => {
          const supabase = await createClient();

          let currentOrganization = null;
          let resolvedId = organizationId;

          if (resolvedId) {
            const { data } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', resolvedId)
              .eq('team_id', team.id)
              .single();
            currentOrganization = data;
          } else if (organizationName) {
            const { data } = await supabase
              .from('organizations')
              .select('*')
              .eq('team_id', team.id)
              .ilike('name', `%${organizationName}%`)
              .single();
            currentOrganization = data;
            resolvedId = data?.id;
          }

          if (!currentOrganization || !resolvedId) {
            return {
              error: true,
              message: 'Organization not found. Please specify a valid organization name or ID.',
            };
          }

          if (!newName && !newDescription && !newWebsite && !newType && !newSize && !newStatus) {
            return {
              error: true,
              message: 'No changes specified. Please provide at least one field to update.',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'edit_organization',
            confirmationId: crypto.randomUUID(),
            organizationId: resolvedId,
            organizationName: currentOrganization.name,
            preview: {
              newName: newName || undefined,
              newDescription: newDescription || undefined,
              newWebsite: newWebsite || undefined,
              newType: newType || undefined,
              newSize: newSize || undefined,
              newStatus: newStatus || undefined,
            },
            currentValues: {
              name: currentOrganization.name,
              description: currentOrganization.description,
              website: currentOrganization.website,
              type: currentOrganization.type,
              size: currentOrganization.size,
              status: currentOrganization.status,
            },
          };
        },
      }),

      // Delete an organization
      deleteOrganization: tool({
        description: `Delete an organization. Use when user wants to remove an organization. Returns a preview that requires user confirmation.`,
        inputSchema: z.object({
          organizationId: z.number().optional().describe('Organization ID to delete'),
          organizationName: z.string().optional().describe('Organization name to find (if no ID provided)'),
        }),
        execute: async ({ organizationId, organizationName }) => {
          const supabase = await createClient();

          let currentOrganization = null;
          let resolvedId = organizationId;

          if (resolvedId) {
            const { data } = await supabase
              .from('organizations')
              .select('id, name, status, type')
              .eq('id', resolvedId)
              .eq('team_id', team.id)
              .single();
            currentOrganization = data;
          } else if (organizationName) {
            const { data } = await supabase
              .from('organizations')
              .select('id, name, status, type')
              .eq('team_id', team.id)
              .ilike('name', `%${organizationName}%`)
              .single();
            currentOrganization = data;
            resolvedId = data?.id;
          }

          if (!currentOrganization || !resolvedId) {
            return {
              error: true,
              message: 'Organization not found. Please specify a valid organization name or ID.',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'delete_organization',
            confirmationId: crypto.randomUUID(),
            organizationId: resolvedId,
            organizationName: currentOrganization.name,
            preview: {
              name: currentOrganization.name,
              status: currentOrganization.status,
              type: currentOrganization.type,
            },
          };
        },
      }),

      // Edit an existing block
      editBlock: tool({
        description: `Edit an existing content block. Use browseBlocks first to find the block ID if you don't have it. Returns a preview that requires user confirmation.`,
        inputSchema: z.object({
          blockId: z.number().describe('ID of the block to edit'),
          category: z.string().optional().describe('New category'),
          title: z.string().optional().describe('New block title'),
          description: z.string().optional().describe('New description'),
        }),
        execute: async ({ blockId, category, title, description }) => {
          const supabase = await createClient();

          // Fetch current block
          const { data: currentBlock } = await supabase
            .from('content_blocks')
            .select('id, category, title, description, collection_id, collections!inner(name)')
            .eq('id', blockId)
            .eq('team_id', team.id)
            .single();

          if (!currentBlock) {
            return {
              error: true,
              message: 'Block not found. Use browseBlocks to find the correct block ID.',
            };
          }

          // Check if any changes were provided
          if (!category && !title && !description) {
            return {
              error: true,
              message: 'No changes specified. Please provide at least one field to update.',
            };
          }

          return {
            needsConfirmation: true,
            confirmationType: 'edit_block',
            confirmationId: crypto.randomUUID(),
            blockId: currentBlock.id,
            collectionId: currentBlock.collection_id,
            collectionName: (currentBlock.collections as any)?.name,
            preview: {
              category: category || undefined,
              title: title || undefined,
              description: description || undefined,
            },
            currentValues: {
              category: currentBlock.category,
              title: currentBlock.title,
              description: currentBlock.description,
            },
          };
        },
      }),
    },
  });

  const response = result.toUIMessageStreamResponse();

  // Add chat ID to response header so client can track it
  if (currentChatId) {
    response.headers.set('X-Chat-Id', currentChatId.toString());
  }

  return response;
}