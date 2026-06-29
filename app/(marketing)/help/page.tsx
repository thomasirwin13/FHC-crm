import Link from 'next/link';
import styles from '@/styles/marketing.module.css';
import { StartTrialButton } from '@/components/marketing';
import { ModeToggle } from '@/components/mode-toggle';
import { MobileNav } from '@/app/mobile-nav';
import { getContentByType } from '@/lib/content';

export const metadata = {
  title: 'Help center - Housing Advocacy CRM',
  description: 'Get help with Housing Advocacy CRM. Find guides, tutorials, and answers to common questions.',
};

export default async function HelpPage() {
  const articles = await getContentByType('help');

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

        {/* Help Center Header */}
        <main
          style={{
            paddingTop: '8rem',
            paddingBottom: '4rem',
            minHeight: '80vh',
          }}
        >
          <div className={styles.container}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
              <h1
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                  fontWeight: 400,
                  lineHeight: 1.2,
                  color: 'var(--color-charcoal)',
                  marginBottom: '1rem',
                  letterSpacing: '-0.02em',
                }}
              >
                Help center
              </h1>
              <p
                style={{
                  fontSize: '1.2rem',
                  color: 'var(--color-slate)',
                  lineHeight: 1.6,
                  maxWidth: '600px',
                  margin: '0 auto',
                }}
              >
                Everything you need to get started and make the most of Housing Advocacy CRM.
              </p>
            </header>

            {/* Help Articles Grid */}
            <section>
              <div
                style={{
                  display: 'grid',
                  gap: '1.5rem',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                }}
              >
                {articles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/help/${article.slug}`}
                    style={{
                      display: 'block',
                      padding: '2rem',
                      background: 'var(--card-bg)',
                      borderRadius: '16px',
                      border: '1px solid var(--color-sand)',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                    }}
                  >
                    <article>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #C4714A 0%, #D4896A 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <line x1="10" y1="9" x2="8" y2="9" />
                          </svg>
                        </div>
                        <div>
                          <h3
                            style={{
                              fontFamily: "'Fraunces', Georgia, serif",
                              fontSize: '1.25rem',
                              fontWeight: 500,
                              color: 'var(--color-charcoal)',
                              marginBottom: '0.5rem',
                              lineHeight: 1.3,
                            }}
                          >
                            {article.title}
                          </h3>
                          {article.description && (
                            <p
                              style={{
                                color: 'var(--color-slate)',
                                fontSize: '0.95rem',
                                lineHeight: 1.5,
                                margin: 0,
                              }}
                            >
                              {article.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>


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
