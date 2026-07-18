'use client';

import { useChat } from '@ai-sdk/react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import { History, SquarePen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteChat,
  confirmEditCollection,
  confirmAddCollectionResource,
  confirmAddBlock,
  confirmEditBlock,
  confirmAddOrganization,
  confirmEditOrganization,
  confirmDeleteOrganization,
  confirmSaveAudienceSegment,
  confirmCreateCampaignDraft,
  saveConfirmationFollowUp,
} from './actions';
import type { UIMessage } from 'ai';
import type { ConfirmationType, ConfirmationStatus } from '@/components/chat/confirmation-display';

interface Chat {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface DBMessage {
  id: number;
  chat_id: number;
  role: string;
  content: string;
  created_at: string;
}

interface ChatInterfaceProps {
  chats: Chat[];
  currentChatId?: number;
  initialMessages?: DBMessage[];
}

export function ChatInterface({ chats, currentChatId, initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);
  const chatIdRef = React.useRef(currentChatId);
  const prevChatIdRef = React.useRef(currentChatId);

  // Track confirmation states for product library management tools
  const [confirmationStates, setConfirmationStates] = useState<
    Record<string, { status: ConfirmationStatus; error?: string }>
  >({});

  // Convert DB messages to UI messages format
  const convertToUIMessages = (dbMessages: DBMessage[]): UIMessage[] => {
    return dbMessages.map(msg => ({
      id: msg.id.toString(),
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(msg.created_at),
    }));
  };

  // Intercept fetch to inject chatId into requests AND extract from responses
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url.includes('/api/chat')) {
        // Parse and inject chatId into request body
        let body: Record<string, unknown> = {};
        try {
          body = init?.body ? JSON.parse(init.body as string) : {};
        } catch {
          // If body isn't JSON, pass through original request
          return originalFetch(input, init);
        }
        body.chatId = chatIdRef.current;

        // Call original fetch with modified body
        const response = await originalFetch(input, {
          ...init,
          body: JSON.stringify(body),
        });

        // Extract chatId from response header
        const newChatId = response.headers.get('X-Chat-Id');
        if (newChatId && !chatIdRef.current) {
          chatIdRef.current = parseInt(newChatId, 10);
          window.history.pushState({}, '', `/app/chat?id=${newChatId}`);
        }

        return response;
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const { messages, sendMessage, setMessages } = useChat({
    messages: convertToUIMessages(initialMessages),
    experimental_throttle: 50,
  });

  // Reset chatIdRef and messages when navigating to new chat or switching chats
  useEffect(() => {
    // Only update if the chat actually changed
    if (currentChatId !== prevChatIdRef.current) {
      prevChatIdRef.current = currentChatId;
      chatIdRef.current = currentChatId;

      if (currentChatId === undefined) {
        // New chat - clear messages
        setMessages([]);
      } else {
        // Switching to existing chat - load its messages
        setMessages(convertToUIMessages(initialMessages));
      }
    }
  }, [currentChatId, initialMessages, setMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handleSelectChat = (chatId: number) => {
    router.push(`/app/chat?id=${chatId}`);
  };

  const handleNewChat = () => {
    router.push('/app/chat?new=true');
    router.refresh();
  };

  const handleDeleteChat = async () => {
    if (chatToDelete === null) return;

    try {
      await deleteChat(chatToDelete);
      if (chatToDelete === currentChatId) {
        router.push('/app/chat?new=true');
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }

    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  const confirmDelete = (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  // Generate a follow-up message after a confirmation action succeeds
  const getConfirmationFollowUp = (type: ConfirmationType, data: Record<string, any>): string => {
    switch (type) {
      case 'edit_collection':
        return `Done — updated **${data.newName || 'the collection'}**. Anything else?`;
      case 'add_resource':
        return `Done — added **${data.label}** to the collection. Anything else?`;
      case 'add_block':
        return `Done — added **${data.title}** to the collection. Anything else?`;
      case 'edit_block':
        return `Done — updated the block. Anything else?`;
      case 'add_organization':
        return `Done — **${data.name}** has been added. Anything else?`;
      case 'edit_organization':
        return `Done — updated the organization. Anything else?`;
      case 'delete_organization':
        return `Done — **${data.name}** has been deleted. Anything else?`;
      case 'save_audience_segment':
        return `Done — saved audience segment **${data.name}**. You can reference it in future campaigns.`;
      case 'draft_audience_message':
        return `Done — message draft is ready. You can create a campaign draft to send it.`;
      case 'create_campaign_draft':
        return `Done — campaign draft created. It won't be sent until you explicitly approve it.`;
      case 'sync_to_action_network':
        return `Done — contacts synced to Action Network with tag **${data.tagName}**.`;
      default:
        return `Done! Anything else?`;
    }
  };

  // Handle confirmation for product library management tools
  const handleConfirm = async (
    confirmationId: string,
    type: ConfirmationType,
    data: Record<string, any>
  ) => {
    setConfirmationStates(prev => ({
      ...prev,
      [confirmationId]: { status: 'loading' },
    }));

    try {
      let result;

      switch (type) {
        case 'edit_collection':
          result = await confirmEditCollection({
            collectionId: data.collectionId,
            name: data.newName,
            owner: data.newOwner,
            description: data.newDescription,
          });
          break;
        case 'add_resource':
          result = await confirmAddCollectionResource({
            collectionId: data.collectionId,
            label: data.label,
            url: data.url,
            type: data.type,
          });
          break;
        case 'add_block':
          result = await confirmAddBlock({
            collectionId: data.collectionId,
            title: data.title,
            category: data.category,
            description: data.description,
          });
          break;
        case 'edit_block':
          result = await confirmEditBlock({
            blockId: data.blockId,
            title: data.title,
            category: data.category,
            description: data.description,
          });
          break;
        case 'add_organization':
          result = await confirmAddOrganization({
            name: data.name,
            description: data.description,
            website: data.website,
            type: data.type,
            size: data.size,
            status: data.status,
          });
          break;
        case 'edit_organization':
          result = await confirmEditOrganization({
            organizationId: data.organizationId,
            name: data.newName,
            description: data.newDescription,
            website: data.newWebsite,
            type: data.newType,
            size: data.newSize,
            status: data.newStatus,
          });
          break;
        case 'delete_organization':
          result = await confirmDeleteOrganization({
            organizationId: data.organizationId,
          });
          break;
        case 'save_audience_segment':
          result = await confirmSaveAudienceSegment({
            name: data.name,
            description: data.description,
            filters: data.filters,
            estimatedCount: data.estimatedCount,
            contactableEmail: data.contactableEmail,
            contactableSms: data.contactableSms,
            excludedCount: data.excludedCount,
          });
          break;
        case 'create_campaign_draft':
          result = await confirmCreateCampaignDraft({
            audienceSegmentId: data.segmentId,
            channel: data.channel,
            subject: data.subject,
            messageBody: data.messageBody,
            tone: data.tone,
            callToAction: data.callToAction,
            districtContext: data.districtContext,
          });
          break;
        case 'draft_audience_message':
          result = { success: true };
          break;
        case 'sync_to_action_network':
          result = { error: 'Action Network sync must be triggered from the server. This feature is coming soon.' };
          break;
        default:
          result = { error: 'Unknown confirmation type' };
      }

      if (result?.error) {
        setConfirmationStates(prev => ({
          ...prev,
          [confirmationId]: { status: 'error', error: result.error },
        }));
      } else {
        setConfirmationStates(prev => ({
          ...prev,
          [confirmationId]: { status: 'confirmed' },
        }));

        // Append a synthetic assistant follow-up message (no fake user bubble)
        const followUp = getConfirmationFollowUp(type, data);
        setMessages(prev => [
          ...prev,
          {
            id: `confirm-${confirmationId}`,
            role: 'assistant' as const,
            parts: [{ type: 'text' as const, text: followUp }],
            createdAt: new Date(),
          },
        ]);

        // Persist the follow-up to DB so it survives page reload
        if (chatIdRef.current) {
          saveConfirmationFollowUp(chatIdRef.current, followUp).catch(console.error);
        }
      }
    } catch (error) {
      setConfirmationStates(prev => ({
        ...prev,
        [confirmationId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to execute',
        },
      }));
    }
  };

  const handleCancel = (confirmationId: string) => {
    setConfirmationStates(prev => ({
      ...prev,
      [confirmationId]: { status: 'cancelled' },
    }));
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="h-[100dvh] flex flex-col">
      {isEmpty ? (
        /* Empty state - full screen centered UI */
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-xl space-y-8">
            {/* Branding */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                <span className="text-primary">sage</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Your AI assistant
              </p>
            </div>

            {/* Centered input */}
            <div className="w-full space-y-2">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                placeholder="Ask sage anything..."
                size="large"
              />
              
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Tell me about our collections',
                'Show me our organizations',
                'Add a new organization called Acme Corp',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage({ text: suggestion })}
                  className="px-3 py-1.5 text-xs rounded-full border border-border/60 bg-card/50 hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* History section - only if there are chats */}
            {chats.length > 0 && (
              <div className="pt-4 border-t border-border/30">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <History className="w-3 h-3" />
                  <DropdownMenu>
                    <DropdownMenuTrigger className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
                      Continue a previous conversation
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-64">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Recent chats
                      </div>
                      <DropdownMenuSeparator />
                      <div className="max-h-48 overflow-y-auto">
                        {chats.slice(0, 10).map((chat) => (
                          <DropdownMenuItem
                            key={chat.id}
                            className="group flex items-center justify-between gap-2 cursor-pointer"
                            onClick={() => handleSelectChat(chat.id)}
                          >
                            <span className="truncate flex-1 text-sm">
                              {chat.title || 'Untitled chat'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                              onClick={(e) => confirmDelete(chat.id, e)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active chat - minimal header with messages */
        <>
          {/* Compact header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-primary">sage</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                · AI assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              {chats.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Chat history">
                      <History className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Recent chats
                    </div>
                    <DropdownMenuSeparator />
                    <div className="max-h-48 overflow-y-auto">
                      {chats.map((chat) => (
                        <DropdownMenuItem
                          key={chat.id}
                          className={`group flex items-center justify-between gap-2 cursor-pointer ${
                            chat.id === currentChatId ? 'bg-accent' : ''
                          }`}
                          onClick={() => handleSelectChat(chat.id)}
                        >
                          <span className="truncate flex-1 text-sm">
                            {chat.title || 'Untitled chat'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive flex-shrink-0 transition-opacity"
                            onClick={(e) => confirmDelete(chat.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                className="h-8 w-8"
                title="New chat"
              >
                <SquarePen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <ChatMessages
                messages={messages}
                confirmationStates={confirmationStates}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            </div>
          </div>

          {/* Input at bottom */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-6 sm:pb-8 border-t border-border/30">
            <div className="max-w-3xl mx-auto space-y-2">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                placeholder="Type a message..."
              />
              <p className="text-[11px] text-muted-foreground/60 text-center">
                sage is AI and can make mistakes. Please verify important information.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
