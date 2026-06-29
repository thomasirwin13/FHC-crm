/**
 * MDX components styled for Housing Advocacy CRM marketing site
 * Uses Fraunces serif font and warm color palette
 * Colors use CSS variables to support dark mode
 */

import React from 'react';

export const marketingMdxComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 'clamp(2rem, 4vw, 2.5rem)',
        fontWeight: 400,
        lineHeight: 1.25,
        color: 'var(--color-marketing-charcoal)',
        marginBottom: '1.5rem',
        letterSpacing: '-0.02em',
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '1.625rem',
        fontWeight: 500,
        color: 'var(--color-marketing-charcoal)',
        marginTop: '2.5rem',
        marginBottom: '1rem',
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: '1.375rem',
        fontWeight: 500,
        color: 'var(--color-marketing-charcoal)',
        marginTop: '2rem',
        marginBottom: '0.75rem',
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        color: 'var(--color-marketing-slate)',
        marginBottom: '1.25rem',
        lineHeight: 1.8,
        fontSize: '1.125rem',
      }}
    >
      {children}
    </p>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul
      style={{
        listStyleType: 'disc',
        paddingLeft: '1.5rem',
        color: 'var(--color-marketing-slate)',
        marginBottom: '1.25rem',
        lineHeight: 1.8,
        fontSize: '1.125rem',
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol
      style={{
        listStyleType: 'decimal',
        paddingLeft: '1.5rem',
        color: 'var(--color-marketing-slate)',
        marginBottom: '1.25rem',
        lineHeight: 1.8,
        fontSize: '1.125rem',
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li
      style={{
        color: 'var(--color-marketing-slate)',
        marginBottom: '0.5rem',
      }}
    >
      {children}
    </li>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong style={{ color: 'var(--color-marketing-charcoal)', fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => (
    <em style={{ color: 'var(--color-marketing-terracotta)', fontStyle: 'italic' }}>{children}</em>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--color-marketing-border)', margin: '2.5rem 0' }} />
  ),
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a
      href={href}
      style={{
        color: 'var(--color-marketing-terracotta)',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
      }}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--color-marketing-terracotta)',
        paddingLeft: '1.25rem',
        margin: '1.5rem 0',
        fontStyle: 'italic',
        color: 'var(--color-marketing-slate)',
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }: { children: React.ReactNode; className?: string }) => {
    // Fenced code blocks render as <pre><code className="language-xxx">
    // Only apply inline-code styles when NOT inside a pre block
    if (className?.startsWith('language-')) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code
        style={{
          background: 'var(--color-marketing-sand)',
          color: 'var(--color-marketing-charcoal)',
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
          fontSize: '0.9em',
          fontFamily: 'monospace',
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre
      style={{
        background: 'var(--color-marketing-sand)',
        color: 'var(--color-marketing-charcoal)',
        padding: '1.25rem',
        borderRadius: '12px',
        overflow: 'auto',
        marginBottom: '1.25rem',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        border: '1px solid var(--color-marketing-border)',
      }}
    >
      {children}
    </pre>
  ),
};
