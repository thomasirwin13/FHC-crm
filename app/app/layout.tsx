'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Menu,
  X,
  Library,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  User,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  SunMoon,
  CalendarDays,
  BarChart2,
} from 'lucide-react';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { signOut } from '@/app/(login)/actions';
import { User as UserType } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';
import { Toaster } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import { DashboardChat } from './dashboard-chat';
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TeamData {
  id: number;
  name: string;
  currentUserRole: string;
}

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<UserType>('/api/user', fetcher);
  const { data: team } = useSWR<TeamData>('/api/team', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback className="bg-muted text-foreground text-sm">
              {user.email.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name || user.email}
            </p>

          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover border-border text-popover-foreground">
        <DropdownMenuItem asChild className="cursor-pointer hover:bg-muted focus:bg-muted">
          <Link href="/settings" className="flex items-center">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="focus:bg-transparent hover:bg-transparent" onSelect={(e) => e.preventDefault()}>
          <div className="flex items-center">
            <SunMoon className="mr-2 h-4 w-4" />
            <span className="flex-1">Theme</span>
            <ModeToggle className="p-1.5 rounded-md hover:bg-muted transition-colors" />
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-muted" />
        <DropdownMenuItem
          className="cursor-pointer hover:bg-muted focus:bg-muted"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollapsedUserMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex justify-center p-2">
        <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage alt="User" />
          <AvatarFallback className="bg-muted text-foreground text-sm">
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-56 bg-popover border-border text-popover-foreground">
        <DropdownMenuItem asChild className="cursor-pointer hover:bg-muted focus:bg-muted">
          <Link href="/settings" className="flex items-center">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="focus:bg-transparent hover:bg-transparent" onSelect={(e) => e.preventDefault()}>
          <div className="flex items-center">
            <SunMoon className="mr-2 h-4 w-4" />
            <span className="flex-1">Theme</span>
            <ModeToggle className="p-1.5 rounded-md hover:bg-muted transition-colors" />
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-muted" />
        <DropdownMenuItem
          className="cursor-pointer hover:bg-muted focus:bg-muted"
          onClick={async () => {
            await signOut();
            mutate('/api/user');
            router.push('/');
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [chatMode, setChatMode] = useState<'minimized' | 'sidebar' | 'fullscreen'>('minimized');
  const { data: chats } = useSWR<{ id: number; title: string | null; created_at: string; updated_at: string }[]>('/api/chats', fetcher);

  // Load collapsed + chat mode state from localStorage on mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    const hasCollapsedPreference = localStorage.getItem('sidebar-collapsed-set');
    if (hasCollapsedPreference && savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }

    const savedChatMode = localStorage.getItem('chat-mode') as typeof chatMode | null;
    if (savedChatMode && ['minimized', 'sidebar', 'fullscreen'].includes(savedChatMode)) {
      const isMobile = window.innerWidth < 1024;
      setChatMode(isMobile && savedChatMode === 'sidebar' ? 'fullscreen' : savedChatMode);
    }
  }, []);

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
    localStorage.setItem('sidebar-collapsed-set', 'true');
  }, [isCollapsed]);

  // Save chat mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chat-mode', chatMode);
  }, [chatMode]);

  const navItems = [
    { href: '/app', icon: Home, label: 'Home' },
    { href: '/app/organizations', icon: Building2, label: 'Organizations' },
    { href: '/app/contacts', icon: Users, label: 'Contacts' },
    { href: '/app/meetings', icon: CalendarDays, label: 'Meetings' },
    { href: '/app/reports', icon: BarChart2, label: 'Reports' },
    { href: '/app/library/collections', icon: Library, label: 'Collections' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-card border-b border-border p-4">
        <Link href="/app" className="flex items-center">
          <Home className="h-6 w-6 text-foreground" />
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
        <aside className={`hidden lg:flex lg:flex-col ${isCollapsed ? 'w-20' : 'w-64'} h-screen fixed left-0 top-0 bg-card border-r border-border transition-all duration-300 z-30`}>
          <div className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 overflow-y-auto`}>
            {/* Logo/Brand area with toggle button */}
            <div className={`mb-8 ${isCollapsed ? 'px-0' : 'px-3'} flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isCollapsed && <h2 className="text-lg font-semibold text-foreground">Iona CRM</h2>}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
            </div>

            {/* Main Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <TooltipProvider key={item.href}>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </nav>

          </div>

          {/* User Menu at bottom - render both to avoid hydration mismatch from useId() */}
          <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t border-border`}>
            <div className={isCollapsed ? '' : 'hidden'}>
              <Suspense fallback={<div className="h-10 w-10 bg-muted rounded-lg animate-pulse mx-auto" />}>
                <CollapsedUserMenu />
              </Suspense>
            </div>
            <div className={isCollapsed ? 'hidden' : ''}>
              <Suspense fallback={<div className="h-14 bg-muted rounded-lg animate-pulse" />}>
                <UserMenu />
              </Suspense>
            </div>
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
                <h2 className="text-lg font-semibold text-foreground">Iona CRM</h2>
              </div>

              {/* Main Navigation */}
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

            {/* User Menu at bottom */}
            <div className="p-4 border-t border-border">
              <Suspense fallback={<div className="h-14 bg-muted rounded-lg animate-pulse" />}>
                <UserMenu />
              </Suspense>
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
        <main className={`flex-1 flex flex-col h-screen min-w-0 overflow-x-hidden ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'} transition-all duration-300`}>
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
      <DashboardChat mode={chatMode} onModeChange={setChatMode} chats={chats || []} />
    </div>
  );
}