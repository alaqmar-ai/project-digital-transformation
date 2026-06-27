'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { User, Project } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useToast, ToastMessage } from '@/hooks/useToast';
import { validateToken } from '@/lib/api';
import { CONFIG } from '@/lib/constants';
import LoginForm from './LoginForm';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ToastContainer from './Toast';

interface AppContextValue {
  user: User | null;
  projects: Project[];
  projectsLoading: boolean;
  projectsError: string | null;
  reloadProjects: () => Promise<void>;
  addToast: (type: 'success' | 'error', message: string) => void;
  toasts: ToastMessage[];
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

const PUBLIC_PATHS = ['/login'];

export default function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, login, logout } = useAuth();
  const { projects, loading: projectsLoading, error: projectsError, reload } = useProjects();
  const { toasts, addToast, removeToast } = useToast();

  // Optional token-based bypass (e.g. shared dashboard preview link)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !user) {
      if (token === CONFIG.TEAM_TOKEN) {
        login({ id: 'u_guest', username: 'guest', name: 'Guest', role: 'STAFF' });
        router.replace('/dashboard');
      } else {
        validateToken(token)
          .then((valid) => {
            if (valid) {
              login({ id: 'u_guest', username: 'guest', name: 'Guest', role: 'STAFF' });
              router.replace('/dashboard');
            }
          })
          .catch(() => {});
      }
    }
  }, [searchParams, user, login, router]);

  // Route guard
  useEffect(() => {
    if (authLoading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname) || pathname === '/';
    if (!user && !isPublic) {
      router.replace('/');
    }
    if (user && pathname === '/') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, pathname, router]);

  const handleLogin = (u: User) => {
    login(u);
    router.replace('/dashboard');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="skeleton w-10 h-10 rounded-full" />
      </div>
    );
  }

  // Unauthenticated → login page
  if (!user) {
    return (
      <AppContext.Provider
        value={{
          user: null,
          projects,
          projectsLoading,
          projectsError,
          reloadProjects: reload,
          addToast,
          toasts,
          logout: handleLogout,
        }}
      >
        <LoginForm onLogin={handleLogin} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider
      value={{
        user,
        projects,
        projectsLoading,
        projectsError,
        reloadProjects: reload,
        addToast,
        toasts,
        logout: handleLogout,
      }}
    >
      <Sidebar user={user} projectCount={projects.length} onLogout={handleLogout} />
      <TopBar />
      <main className="md:ml-[260px] min-h-screen">{children}</main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AppContext.Provider>
  );
}
