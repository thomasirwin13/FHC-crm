'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StartTrialButton } from '@/components/marketing';
import { ModeToggle } from '@/components/mode-toggle';
import styles from '@/styles/marketing.module.css';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Toggle button - stays in nav */}
      <button
        className={`${styles.mobileNavToggle} ${isOpen ? styles.mobileNavToggleOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      {/* Backdrop */}
      <div
        className={`${styles.mobileNavBackdrop} ${isOpen ? styles.mobileNavBackdropOpen : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`${styles.mobileNavPanel} ${isOpen ? styles.mobileNavPanelOpen : ''}`}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-label="Mobile navigation"
        inert={!isOpen ? true : undefined}
      >
        {/* Close button inside panel */}
        <button
          className={styles.mobileNavClose}
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <nav className={styles.mobileNavLinks}>
          <Link href="#features" className={styles.mobileNavLink} onClick={closeMenu}>
            Features
          </Link>
        </nav>

        <div className={styles.mobileNavFooter}>
          <div className={styles.mobileNavThemeRow}>
            <span className={styles.mobileNavThemeLabel}>Theme</span>
            <ModeToggle className={styles.themeToggle} />
          </div>
          <Link href="/sign-in" className={styles.mobileNavLogin} onClick={closeMenu}>
            Log in
          </Link>
          <StartTrialButton
            variant="warm"
            className={`${styles.btn} ${styles.btnWarm} ${styles.mobileNavCtaButton}`}
          />
        </div>
      </div>
    </>
  );
}
