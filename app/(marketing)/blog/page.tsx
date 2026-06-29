import Link from 'next/link';
import { format } from 'date-fns';
import styles from '@/styles/marketing.module.css';
import { StartTrialButton } from '@/components/marketing';
import { ModeToggle } from '@/components/mode-toggle';
import { MobileNav } from '@/app/mobile-nav';
import { getContentByType } from '@/lib/content';

export const metadata = {
  title: 'Blog - Housing Advocacy CRM',
  description: 'Insights on CRM management, sales engineering, and AI-powered automation.',
};

export default async function BlogPage() {
  const posts = await getContentByType('blog');

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

        {/* Blog Header */}
        <main className={styles.blogMain}>
          <div className={styles.container}>
            <header className={styles.blogHeader}>
              <h1 className={styles.blogTitle}>Blog</h1>
            </header>

            {/* Posts */}
            <section>
              <div className={styles.blogGrid}>
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className={styles.blogCard}
                  >
                    <article className={styles.blogCardInner}>
                      <div>
                        <h3 className={styles.blogCardTitle}>{post.title}</h3>
                        {post.description && (
                          <p className={styles.blogCardDescription}>{post.description}</p>
                        )}
                      </div>
                      <div className={styles.blogCardDate}>
                        {post.date && format(new Date(post.date), 'MMM d, yyyy')}
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
