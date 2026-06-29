import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { format } from 'date-fns';
import Link from 'next/link';
import styles from '@/styles/marketing.module.css';
import { StartTrialButton } from '@/components/marketing';
import { ModeToggle } from '@/components/mode-toggle';
import { MobileNav } from '@/app/mobile-nav';
import { getContentBySlug, blogSlugs } from '@/lib/content';
import { marketingMdxComponents } from '@/components/mdx/marketing-mdx-components';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return blogSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getContentBySlug('blog', slug);

  if (!post) {
    return { title: 'Post Not Found - Housing Advocacy CRM' };
  }

  return {
    title: `${post.frontmatter.title} - Housing Advocacy CRM Blog`,
    description: post.frontmatter.description,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getContentBySlug('blog', slug);

  if (!post) {
    notFound();
  }

  const { frontmatter, content } = post;

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

        {/* Blog Post Content */}
        <main className={styles.blogMain}>
          <div className={styles.container}>
            <div className={styles.articleContainer}>
              {/* Back link */}
              <Link href="/blog" className={styles.articleBackLink}>
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
                Back to blog
              </Link>

              {/* Article header */}
              <header className={styles.articleHeader}>
                <h1 className={styles.articleTitle}>{frontmatter.title}</h1>

                {frontmatter.description && (
                  <p className={styles.articleDescription}>{frontmatter.description}</p>
                )}

                <div className={styles.articleMeta}>
                  {frontmatter.date && (
                    <span>{format(new Date(frontmatter.date), 'MMMM d, yyyy')}</span>
                  )}
                  {frontmatter.author && <span>By {frontmatter.author}</span>}
                </div>
              </header>

              {/* Divider */}
              <hr className={styles.articleDivider} />

              {/* Article content */}
              <article className={styles.mdxContent}>
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
