'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Users, Settings, Shield, Activity, Menu, X, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: '/settings', icon: Users, label: 'Team & billing' },
    { href: '/settings/general', icon: Settings, label: 'General' },
    { href: '/settings/security', icon: Shield, label: 'Security' },
    { href: '/settings/activity', icon: Activity, label: 'Activity' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-card border-b border-border p-4">
        <Link href="/app" className="flex items-center">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </Link>
        <button
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-card border-r border-border">
          <div className="flex-1 px-4 py-6">
            {/* Logo/Brand area */}
            <div className="mb-8 px-3">
              <h2 className="text-lg font-semibold text-foreground">Housing Advocacy CRM</h2>
            </div>

            {/* Back to App Link */}
            <Link
              href="/app"
              className="flex items-center gap-3 px-3 py-2 mb-6 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to App
            </Link>

            {/* Settings Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-accent text-accent-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-50 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 px-4 py-6">
              {/* Logo/Brand area */}
              <div className="mb-8 px-3">
                <h2 className="text-lg font-semibold text-foreground">Housing Advocacy CRM</h2>
              </div>

              {/* Back to App Link */}
              <Link
                href="/app"
                className="flex items-center gap-3 px-3 py-2 mb-6 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                onClick={() => setIsSidebarOpen(false)}
              >
                <ArrowLeft className="h-5 w-5" />
                Back to App
              </Link>

              {/* Settings Navigation */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-accent text-accent-foreground' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen">
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
