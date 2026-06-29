# Housing Advocacy CRM

A generic CRM boilerplate for vibe coding on top of.

## Prerequisites
- [Node.js](https://nodejs.org/) 18+ [check with node --version]
- [pnpm](https://pnpm.io/) [check with pnpm --version]
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) [`npm install -g supabase` or check with npx supabase --version]
- A [Supabase](https://supabase.com/) account (organization) and login (npx supabase login)

## Setup

### 1. Create a Supabase project

Via the CLI:

Login (will open up OAuth for you to login in the browser)
`npx supabase login`

```bash
npx supabase projects create "Housing Advocacy CRM" --org-id 
```

Or create one at [supabase.com/dashboard](https://supabase.com/dashboard).

Note your project URL and API keys from Settings > API

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials:
- `NEXT_PUBLIC_SUPABASE_URL` — your project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — the `anon` pu key
- `SUPABASE_SECRET_KEY` — the `service_role` secret key (Project settings > API Keys)

Add your own API keys:
- `OPENAI_API_KEY` — required for embeddings and AI features. From platform.openai.com
- `STRIPE_SECRET_KEY` — required for billing (or leave as placeholder to skip)

### 3. Push migrations

Link your project and push the schema:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This creates all tables, RLS policies, and pgvector extensions in your hosted database.

After pushing, regenerate TypeScript types to keep them in sync:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > lib/db/database.types.ts
```

### 4. Install dependencies

```bash
pnpm install
```

### 5. Start the dev server

```bash
pnpm dev
```

Open http://localhost:3000

## Features

### Companies and contacts
Create and manage companies with inline editing and a multi-stage pipeline (Lead, Opportunity, Client, Churned, Closed Lost). Each organiztracks details like website, industry, location, and employee size. Contacts live within organizations with inline-editable fields for name, email, phone, and location.

### Content library
A knowledge base built around collections and content blocks. Collections group related content, and blocks represent individual capabilities or features with a title, category, and description. Supports bulk CSV import with flexible column mapping. All content is automatically embedded using OpenAI and stored as vectors in PostgreSQL for semantic search and referencing from the AI chat.

### AI Chat
A conversational assistant with streaming responses, persistent chat history, and tool-based access to the knowledge base. The assistant can search content semantically, browse collections and blocks, manage organizations, and navigate the app — with preview-based confirmations before any database writes.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase PostgreSQL with pgvector
- **Auth**: Supabase Auth with Row Level Security
- **Payments**: Stripe
- **AI/ML**: OpenAI embeddings, Vercel AI SDK for streaming chat
- **UI**: shadcn/ui with Tailwind CSS

## Stripe (optional)

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run the webhook listener for local development:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Testing

```bash
pnpm test          # Unit tests (Jest)
pnpm test:e2e      # E2E tests (Playwright)
```

See `__tests__/README.md` for detailed test documentation.

## Environment Variables

See `.env.example` for the full list with descriptions.

## Deploying
I'd recommend using Github for the repo and integrating directly to Vercel. It'll create a  preview deploy branch on each git branch and previews on every commit. It's the tightest CI/CD I've seen in the market.
