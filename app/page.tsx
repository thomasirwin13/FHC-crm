import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';

export const metadata = {
  title: 'Iona CRM',
  description: 'A modern, full-stack CRM boilerplate built with Next.js and Supabase.',
};

const includedModules = [
  { name: 'Authentication', desc: 'Supabase Auth with email/password, row-level security, and session management.', included: true },
  { name: 'Teams & roles', desc: 'Multi-user teams with owner/member roles and activity logging.', included: true },
  { name: 'Organizations', desc: 'Company records with contacts, notes, and relationship tracking.', included: true },
  { name: 'AI chat', desc: 'Conversational AI interface with persistent history and streaming responses.', included: true },
  { name: 'Content library', desc: 'Searchable knowledge base with collections, CSV import, and embeddings.', included: true },
];

const bringYourOwn = [
  { name: 'Email campaigns', desc: 'Integrate Resend, SendGrid, or Postmark for outbound email sequences.' },
  { name: 'Calendar & scheduling', desc: 'Connect Cal.com or Calendly for meeting booking and availability.' },
  { name: 'Pipeline & deals', desc: 'Add a Kanban-style deal pipeline with stages, values, and forecasting.' },
  { name: 'Reporting', desc: 'Build dashboards with Tremor or Recharts for revenue and activity metrics.' },
  { name: 'Integrations', desc: 'Connect to Slack, HubSpot, Salesforce, or any API via webhooks.' },
  { name: 'File storage', desc: 'Add document uploads with Supabase Storage or S3-compatible backends.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-semibold tracking-tight">Iona CRM</span>
        <div className="flex items-center gap-4 text-sm">
          <a href="#whats-included" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            What&apos;s included
          </a>
          <a href="#stack" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            Stack
          </a>
          <Link href="/sign-in" className="text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <ModeToggle />
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-8">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Open-source boilerplate
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
          Your CRM,<br />your way
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          A production-ready starting point for building CRM applications.
          Authentication, AI, and data management — all wired up and ready to customize.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Try the demo
          </Link>
          <a
            href="#whats-included"
            className="rounded-md border border-border px-6 py-3 font-medium hover:bg-accent transition-colors"
          >
            See what&apos;s included
          </a>
        </div>
      </section>

      {/* Tech stack bar */}
      <section id="stack" className="px-6 py-12 border-y border-border bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">Built with</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm">
            {[
              'Next.js 15',
              'React 19',
              'TypeScript',
              'Tailwind CSS 4',
              'Supabase',
              'OpenAI',
              'shadcn/ui',
            ].map((tech) => (
              <span key={tech} className="font-medium text-foreground/70">{tech}</span>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section id="whats-included" className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold tracking-tight mb-8">Included</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {includedModules.map((item) => (
            <div key={item.name} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <svg className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Bring your own</h2>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Ideas
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bringYourOwn.map((item) => (
            <div key={item.name} className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <svg className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section className="px-6 py-24 border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Get running in minutes</h2>
          <p className="text-muted-foreground mb-10">Clone, configure your environment, and start building.</p>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-left">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">terminal</span>
            </div>
            <div className="p-6 font-mono text-sm space-y-1 text-muted-foreground">
              <p><span className="text-foreground">$</span> git clone your-repo iona-crm</p>
              <p><span className="text-foreground">$</span> cd iona-crm</p>
              <p><span className="text-foreground">$</span> pnpm install</p>
              <p><span className="text-foreground">$</span> pnpm db:setup</p>
              <p><span className="text-foreground">$</span> pnpm dev</p>
              <p className="pt-2 text-green-500">Ready on http://localhost:3000</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Start building your CRM
        </h2>
        <p className="mt-4 text-muted-foreground text-lg">
          Sign up to explore the demo, or clone the repo and make it yours.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Try the demo
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Iona CRM</p>
          <div className="flex gap-6">
            <Link href="/legal/terms-of-service">Terms</Link>
            <Link href="/legal/privacy-policy">Privacy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Iona CRM</p>
        </div>
      </footer>
    </div>
  );
}
