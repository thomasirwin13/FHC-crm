# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an generic CRM boilerplate with agentic interaction built with Next.js, Next.js 15.4 (canary) with React 19.1 and the App Router.

## Key Commands

### Development
```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Build for production
```

### Database Management
```bash
pnpm db:setup     # Initial database setup (creates .env file)
pnpm db:migrate   # Run database migrations
pnpm db:seed      # Seed database with test data (test@test.com / admin123)
pnpm db:generate  # Generate new migrations from schema changes
npx supabase db push  # Push migrations to Supabase (preferred for RLS)
```

**IMPORTANT**: After pushing database changes to Supabase, regenerate TypeScript types:
```bash
npx supabase gen types typescript --project-id "YOUR_PROJECT_ID" --schema public > lib/db/database.types.ts
```
This ensures the `database.types.ts` file stays in sync with the database schema. The `Database` type is re-exported from `lib/db/schema.ts` for convenience.

### Stripe Development
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook  # Listen for webhooks locally
```

### Testing
```bash
pnpm test          # Run Jest unit tests
pnpm test:e2e      # Run Playwright E2E tests (59 tests, ~5 min)
```

**E2E Test Architecture:**
- Uses Playwright with custom fixtures for database manipulation
- Fixtures use admin Supabase client to bypass RLS for test setup
- Tests run serially (`workers: 1`) to prevent data conflicts
- Simulates Stripe checkout via database updates (Stripe UI cannot be automated)

**Key files:**
- `__tests__/e2e/fixtures/billing-fixtures.ts` - Database manipulation utilities
- `__tests__/e2e/billing/*.spec.ts` - Billing limit and flow tests
- `playwright.config.ts` - Playwright configuration

See `__tests__/README.md` for detailed testing documentation.


### Local Development
1. Use sandbox keys in `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_... (from CLI)
   ```

2. Run the webhook listener (required for subscription updates):
   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

3. Test with card: `4242 4242 4242 4242`, any future expiry, any CVC

### Production Setup
1. Use live keys in production environment:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (from dashboard webhook endpoint)
   ```

2. Webhook endpoint configured in Stripe Dashboard:
   - URL: 
   - Events: `customer.subscription.updated`, `customer.subscription.deleted`
   - **Important**: The signing secret is different from the CLI secret!

### Webhook Signing Secrets
Each environment has its own signing secret:

| Environment | Source | Secret |
|-------------|--------|--------|
| Local dev | `stripe listen` output | `whsec_...` (from CLI output) |
| Production | Stripe Dashboard → Webhooks → endpoint | `whsec_...` (from dashboard) |

### Key Files
- `lib/payments/stripe.ts` - Stripe client, checkout, portal, webhook handler
- `app/api/stripe/webhook/route.ts` - Webhook endpoint
- `app/api/stripe/checkout/route.ts` - Checkout success handler
- `app/(dashboard)/pricing/page.tsx` - Pricing page
- `lib/plans/limits.ts` - Plan limits configuration

## Architecture Overview

### Directory Structure
- `/app`: Next.js App Router pages and API routes
  - `(dashboard)`: Protected dashboard routes requiring authentication
  - `(login)`: Public authentication pages  
  - `api/`: API endpoints for various services
    - `embeddings/`: Generate embeddings for the library
    - `stripe/`: Payment processing webhooks
  - `app/`: Main application routes
    - `chat/`: AI chat interface with conversation history
      - `page.tsx`: Server component that fetches chats/messages
      - `chat-interface.tsx`: Client component with useChat hook
      - `chat-dropdown.tsx`: UI for selecting/creating/deleting chats
      - `actions.ts`: Server actions for chat CRUD
    - `organizations/`: Organization management
    - `library/`: Library management for content
    - `models/`: AI model configuration
    - `prompts/`: Prompt engineering interface
- `/components`: Reusable UI components using shadcn/ui
- `/lib`: Core application logic
  - `ai/`: Embeddings generation using OpenAI
  - `auth/`: Authentication middleware and session handling
  - `db/`: Supabase PostgreSQL with pgvector
    - Schema includes: users, teams, organizations, contacts, collections, content_blocks, embeddings
    - Vector search capabilities for semantic matching
  - `payments/`: Stripe integration for subscriptions

### Key Technologies
- **Database**: Supabase PostgreSQL with pgvector for embeddings
- **AI/ML**: OpenAI embeddings for semantic search and matching
- **Authentication**: Supabase Auth with SSR cookie handling
- **Payments**: Stripe Checkout and Customer Portal
- **UI**: Tailwind CSS 4.1 with shadcn/ui components
- **State**: SWR for data fetching
- **Validation**: Zod schemas with Server Actions
- **File Processing**: CSV upload and parsing for bulk data import

### Important Patterns
1. **Authentication**: Supabase Auth with route protection via Next.js middleware. Supabase clients in `lib/supabase/`.
2. **Database**: Types defined in `lib/db/schema.ts` (re-exported from `database.types.ts`). Use Supabase migrations for schema changes.
3. **Server Actions**: Protected with `validatedAction` and `validatedActionWithUser` middleware for Zod validation and auth.
4. **Activity Logging**: Built-in system for tracking user events in `lib/db/supabase-queries.ts`.
5. **RBAC**: Basic roles (Owner/Member) implemented for teams.
6. **Semantic Search**: Content is embedded using OpenAI, stored as vectors in PostgreSQL

### Email Confirmation Flow (Supabase Auth)

The app uses Supabase Auth with a server-side email confirmation flow. This ensures the session is established server-side rather than via URL fragments.

**How it works:**
1. User signs up at `/sign-up`
2. Supabase sends confirmation email with link: `https://[yourdomain.com]/auth/callback?token_hash=xxx&type=signup&next=/app`
3. User clicks link, hits `/auth/callback`
4. Server calls `verifyOtp({ token_hash, type })` - session established server-side
5. Redirects to `/app` (dashboard) - user is authenticated

**Key file:** `app/auth/callback/route.ts`
- Handles `token_hash` (email confirmation) via `verifyOtp()`
- Handles `code` (password reset, magic link) via `exchangeCodeForSession()`

**Supabase Dashboard configuration required:**

1. **Email Templates** (Authentication > Email Templates > "Confirm signup"):
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/app">
     Confirm your email
   </a>
   ```

2. **URL Configuration** (Authentication > URL Configuration):
   - Add `https://[yourdomain.com]/auth/callback` to "Redirect URLs"

**Why this approach?** The default Supabase flow redirects to the site root with a URL fragment (`#access_token=...`), which requires client-side JavaScript to process. By using `token_hash` with a custom email template, the token is passed as a query parameter that the server can process directly.

### AI SDK Streaming with Chat Persistence

The chat feature uses `@ai-sdk/react` with server-side message persistence. Key patterns:

**Server-side message saving** (`/app/api/chat/route.ts`):
```typescript
const result = streamText({
  model: openai('gpt-4o'),
  messages: convertToModelMessages(messages),
  onFinish: async ({ text }) => {
    // Save assistant message AFTER streaming completes
    if (currentChatId && text) {
      await saveMessage(userId, teamId, currentChatId, 'assistant', text);
    }
  },
});

// Return chat ID in header for client tracking
const response = result.toUIMessageStreamResponse();
response.headers.set('X-Chat-Id', currentChatId.toString());
return response;
```

**Client-side chat ID persistence** - Use `useRef` (not `useState`) to maintain chat ID across API calls:
```typescript
const chatIdRef = useRef<number | undefined>(currentChatId);

// Intercept fetch to inject chatId at REQUEST TIME (not hook creation time)
useEffect(() => {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    if (url.includes('/api/chat')) {
      const body = JSON.parse(init?.body as string);
      body.chatId = chatIdRef.current;  // Use ref, not state

      const response = await originalFetch(input, {
        ...init,
        body: JSON.stringify(body),
      });

      // Extract new chat ID from response header
      const newChatId = response.headers.get('X-Chat-Id');
      if (newChatId && !chatIdRef.current) {
        chatIdRef.current = parseInt(newChatId, 10);
      }
      return response;
    }
    return originalFetch(input, init);
  };
  return () => { window.fetch = originalFetch; };
}, []);
```

**Why `useRef` instead of `useState`/`useMemo`**: State changes trigger re-renders which recreate the transport/body, but the value is captured at creation time. Using a ref ensures the current chat ID is read at request time, not hook initialization time.

**Server/Client component split**:
- `page.tsx` (Server): Fetches user's chats and current chat messages
- `chat-interface.tsx` (Client): Handles streaming with `useChat` hook
- `chat-dropdown.tsx` (Client): UI for chat selection/creation/deletion

### Database Interaction (Supabase PostgreSQL)
**IMPORTANT**: This project uses Supabase PostgreSQL with the PostgREST API and Row Level Security (RLS).

#### Correct ways to interact with the database:
1. **Supabase Dashboard** (GUI): Use the Table Editor in your Supabase project dashboard
2. **Supabase migrations** (preferred for schema changes):
   - `npx supabase db push` - Push schema changes to Supabase (use `--include-all` flag if needed)
   - Place SQL migrations in `supabase/migrations/` with format `NNNN_name.sql`
   - After pushing, regenerate types: `npx supabase gen types typescript --project-id "YOUR_PROJECT_ID" --schema public > lib/db/database.types.ts`
   - **IMPORTANT**: Always use Supabase CLI to run SQL, not the Supabase Dashboard
3. **Custom scripts**: Create TypeScript files that use the Supabase client:
   ```typescript
   import { createAdminClient } from '@/lib/supabase/admin';
   const supabase = createAdminClient();
   const { data } = await supabase.from('table_name').select('*');
   ```
   Then run with: `npx tsx scripts/your-script.ts`

#### Supabase Data API (PostgREST)
For high-throughput operations that may exhaust connection pools, use the Supabase Data API instead of direct database connections:

```typescript
import { createClient } from '@/lib/supabase/server';

// Simple queries - use Supabase client (HTTP-based, no connection limits)
const supabase = await createClient();
const { data } = await supabase.from('table_name').select('*').eq('id', 1);

// Vector operations - use RPC functions (defined in supabase/migrations/)
const { data } = await supabase.rpc('function_name', { param: value });
```

**RPC type safety notes:**
- When changing RPC return types, you must `DROP FUNCTION` first, then `CREATE` (not `CREATE OR REPLACE`)
- Cast varchar columns to `::text` in SELECT to match declared return types
- Use `timestamp` (not `timestamp with time zone`) if the source column has no timezone

Supabase queries are in `lib/db/supabase-queries.ts`.

#### Row Level Security (RLS)

RLS policies are defined in SQL migrations (see `supabase/migrations/` directory).

**How it works:**
1. RLS is enforced based on Supabase Auth JWT claims
2. Queries made via `createClient()` (from `lib/supabase/server.ts`) respect RLS
3. Queries made via `createAdminClient()` (from `lib/supabase/admin.ts`) bypass RLS

**Two Supabase clients:**
- `createClient()` - User client, uses Supabase Auth session (RLS enforced)
- `createAdminClient()` - Admin client, uses service role key (RLS bypassed)

**Usage patterns:**
```typescript
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// User-facing queries - respects RLS
const supabase = await createClient();
const { data } = await supabase.from('organizations').select('*');

// Admin/webhook operations - bypasses RLS
const adminSupabase = createAdminClient();
const { data } = await adminSupabase.from('teams').select('*');
```

**RLS helper functions** (defined in migrations):
- `get_auth_user_id()` - Returns UUID from `auth.uid()`
- `get_app_user_id()` - Returns app user ID from Supabase auth
- `is_team_member(team_id)` - Checks if current user belongs to team
- `get_active_team_id()` - Returns user's primary team ID

### Claude access keys (MCP endpoint)

Teams create API keys in Settings → Integrations so an outside assistant (e.g. Claude cowork, as a custom connector) can read their CRM data. Keys are read-only unless "allow changes" (`api_keys.can_write`) is on; write access is credited to the key's creator and lapses if they leave the team.

- `supabase/migrations/0030_api_keys.sql` - `api_keys` table; only a SHA-256 hash of each key is stored
- `lib/auth/api-key.ts` - key generation and lookup (`fhc_...` keys)
- `lib/mcp/protocol.ts` - minimal stateless MCP (JSON-RPC over Streamable HTTP) handler
- `lib/mcp/crm-tools.ts` - read-only tools; uses the admin client, so every query must filter by `team_id`
- `lib/mcp/crm-write-tools.ts` - write tools (update/create contacts and organizations, log/update 1-on-1s); same admin-client rule
- `app/api/mcp/route.ts` (`Authorization: Bearer <key>`) and `app/api/mcp/[key]/route.ts` (key in the URL, for Claude's connector form)

### Environment Variables
Required in `.env`:
- `OPENAI_API_KEY`: OpenAI API key for embeddings generation
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_WEBHOOK_SECRET`: For validating webhooks
- `BASE_URL`: Application URL (http://localhost:3000 for dev)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: Supabase publishable key for client-side
- `SUPABASE_SECRET_KEY`: Supabase secret key for server-side admin operations

## Theme Implementation
This application supports **light, dark, and system themes** via next-themes:
- Users can toggle themes using the theme toggle in the navigation
- ThemeProvider in root layout handles theme state with `defaultTheme="system"`
- An inline script in `<head>` prevents flash of unstyled content on page load
- **Do NOT add hardcoded `dark` classes to page containers** - this overrides user preference
- All shadcn/ui components automatically adapt to the current theme via CSS variables
- Use semantic color tokens like `bg-background`, `text-foreground`, `border-border` etc.

## Brand and UI
- Sentence case (don't title case)
- Clean, professional interface for CRM users
- Supports light and dark modes with proper contrast for accessibility
- Responsive design optimized for both desktop and mobile use

## Core Features

### Organization Management
- Create, manage, and track organizations with status pipeline
- Inline editing of organization details

### Contact Management
- Contacts linked to organizations
- Inline editing of contact details

### AI Chat
- Conversational interface for product questions
- Persistent chat history with conversation switching
- Server-side message storage using AI SDK `onFinish` callback
- Knowledge base integration via tool calls
- Real-time streaming responses
