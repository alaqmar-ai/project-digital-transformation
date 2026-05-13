'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Layers,
  CalendarCheck,
  CalendarDays,
  BarChart3,
  FileBarChart,
  Users as UsersIcon,
  Settings,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { User } from '@/lib/types';
import { isAdmin } from '@/lib/types';
import { useState } from 'react';

interface SidebarProps {
  user: User;
  projectCount: number;
  onLogout: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  showCount?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-tasks', label: 'My Tasks', icon: ClipboardList },
  { href: '/projects', label: 'Major Projects', icon: FolderKanban, showCount: true },
  { href: '/sub-projects', label: 'Sub Projects', icon: Layers },
  { href: '/daily-progress', label: 'Daily Progress', icon: CalendarCheck },
  { href: '/attendance', label: 'Attendance Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/users', label: 'User Management', icon: UsersIcon },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const STAFF_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-tasks', label: 'My Tasks', icon: ClipboardList },
  { href: '/daily-progress', label: 'Daily Progress', icon: CalendarCheck },
  { href: '/attendance', label: 'Attendance Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
];

export default function Sidebar({ user, projectCount, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = isAdmin(user) ? ADMIN_NAV : STAFF_NAV;

  const sidebar = (
    <div className="flex flex-col h-full bg-white border-r border-border">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-card">
            <span className="text-white text-[11px] font-bold tracking-wider">EP</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight">EPMS</h1>
            <p className="text-[10px] text-text-muted leading-none mt-0.5">Project Monitoring</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border mx-4" />

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 relative ${
                active
                  ? 'bg-primary-light text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-elevated'
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {item.showCount && projectCount > 0 && (
                <span className="text-[10px] bg-elevated text-text-muted px-1.5 py-0.5 rounded-md font-mono">
                  {projectCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-elevated border border-border">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-sm font-bold text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-text-muted">{user.role}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-xs text-text-secondary hover:text-danger transition-colors w-full"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 bg-white border border-border rounded-xl p-2 shadow-card"
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`md:hidden fixed top-0 left-0 z-40 w-[260px] h-full transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block w-[260px] h-screen fixed left-0 top-0">{sidebar}</div>
    </>
  );
}
