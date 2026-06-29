import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { format } from 'date-fns';
import Link from 'next/link';
import styles from '@/styles/marketing.module.css';
import { StartTrialButton } from '@/components/marketing';
import { ModeToggle } from '@/components/mode-toggle';
import { MobileNav } from '@/app/mobile-nav';
import { marketingMdxComponents } from '@/components/mdx';
import { getContentBySlug, helpSlugs } from '@/lib/content';

interface HelpArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return helpSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = await getContentBySlug('help', slug);

  if (!article) {
    return { title: 'Article Not Found - Housing Advocacy CRM' };
  }

  return {
    title: `${article.frontmatter.title} - Housing Advocacy CRM Help`,
    description: article.frontmatter.description,
  };
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = await getContentBySlug('help', slug);

  if (!article) {
    notFound();
  }

  const { frontmatter, content } = article;

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Source+Sans+3:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div className={styles.page}>
        {/* Navigation */}
        <nav className={styles.nav}>
          <div className={`${styles.container} ${styles.navContainer}`}>
            <Link href="/" className={styles.logo}>
              Housing Advocacy CRM
            </Link>
            <div className={styles.navLinks}>
              <Link href="/#features" className={styles.navLink}>
                Features
              </Link>
              <Link href="/#pricing" className={styles.navLink}>
                Pricing
              </Link>
              <Link href="/sign-in" className={styles.navLink}>
                Sign in
              </Link>
              <ModeToggle className={styles.themeToggle} />
              <StartTrialButton variant="primary" />
            </div>
            <MobileNav />
          </div>
        </nav>

        {/* Help Article Content */}
        <main
          style={{
            paddingTop: '8rem',
            paddingBottom: '4rem',
            minHeight: '80vh',
          }}
        >
          <div className={styles.container}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {/* Back link */}
              <Link
                href="/help"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#C4714A',
                  fontSize: '0.95rem',
                  marginBottom: '2rem',
                  textDecoration: 'none',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to help center
              </Link>

              {/* Article header */}
              <header style={{ marginBottom: '3rem' }}>
                <h1
                  style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontSize: 'clamp(2.2rem, 5vw, 3rem)',
                    fontWeight: 400,
                    lineHeight: 1.2,
                    color: 'var(--color-charcoal)',
                    marginBottom: '1rem',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {frontmatter.title}
                </h1>

                {frontmatter.description && (
                  <p
                    style={{
                      fontSize: '1.2rem',
                      color: '#5A5A5A',
                      lineHeight: 1.6,
                      marginBottom: '1rem',
                    }}
                  >
                    {frontmatter.description}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.5rem',
                    fontSize: '0.9rem',
                    color: '#8A8A8A',
                  }}
                >
                  {frontmatter.date && (
                    <span>Last updated: {format(new Date(frontmatter.date), 'MMMM d, yyyy')}</span>
                  )}
                </div>
              </header>

              {/* Divider */}
              <hr
                style={{ border: 'none', borderTop: '1px solid #E8E0D4', marginBottom: '2.5rem' }}
              />

              {/* Article content */}
              <article>
                <MDXRemote source={content!} components={marketingMdxComponents} />
              </article>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.container}>
            <div className={styles.footerGrid}>
              <div className={styles.footerBrand}>
                <Link href="/" className={styles.logo}>
                  Housing Advocacy CRM
                </Link>
                <p className={styles.footerDescription}>AI-powered CRM for modern teams.</p>
              </div>
              <div className={styles.footerColumn}>
                <h4>Product</h4>
                <ul>
                  <li>
                    <Link href="/#features">Features</Link>
                  </li>
                  <li>
                    <Link href="/#pricing">Pricing</Link>
                  </li>
                  <li>
                    <a href="#">Integrations</a>
                  </li>
                  <li>
                    <a href="#">Changelog</a>
                  </li>
                </ul>
              </div>
              <div className={styles.footerColumn}>
                <h4>Company</h4>
                <ul>
                  <li>
                    <Link href="/#about">About</Link>
                  </li>
                  <li>
                    <Link href="/blog">Blog</Link>
                  </li>
                  <li>
                    <Link href="/demo">Contact</Link>
                  </li>
                </ul>
              </div>
              <div className={styles.footerColumn}>
                <h4>Resources</h4>
                <ul>
                  <li>
                    <Link href="/help">Help center</Link>
                  </li>
                  <li>
                    <Link href="/legal/terms-of-service">Terms of service</Link>
                  </li>
                  <li>
                    <Link href="/legal/privacy-policy">Privacy policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.footerBottom}>
              <span>&copy; {new Date().getFullYear()} Housing Advocacy CRM. All rights reserved.</span>
              <div className={styles.footerSocial}>
                <ModeToggle className={styles.footerThemeToggle} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
