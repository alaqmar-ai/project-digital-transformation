'use client';

import { useState } from 'react';
import { Loader2, Lock, User as UserIcon, Factory, GaugeCircle, ShieldCheck, BarChart3 } from 'lucide-react';
import { loginUser } from '@/lib/api';
import type { User } from '@/lib/types';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await loginUser(username.trim(), password.trim());
      onLogin(user);
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-[#F5F7FA]">
      {/* ── Brand panel (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col justify-between bg-primary text-white px-12 py-10 relative overflow-hidden">
        {/* Decorative grid + radial glow */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-20 w-[420px] h-[420px] rounded-full bg-white/[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 mb-10">
            Project Monitoring System
          </p>

          <h1 className="text-3xl xl:text-4xl font-bold leading-[1.1] max-w-md tracking-tight">
            Track every project, every stage, every deadline - across the entire plant.
          </h1>
          <p className="text-white/70 text-sm mt-4 max-w-md leading-relaxed">
            Capital equipment monitoring built for manufacturing engineering. Visibility from
            concept to validation, with attendance and analytics in one place.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 mt-12">
          <Feature icon={<Factory size={16} />} label="7-stage project pipeline" />
          <Feature icon={<GaugeCircle size={16} />} label="Auto delay detection" />
          <Feature icon={<BarChart3 size={16} />} label="Real-time analytics" />
          <Feature icon={<ShieldCheck size={16} />} label="Role-based access" />
        </div>
      </aside>

      {/* ── Sign-in form ──────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-between p-6 md:p-10">
        <div className="flex-1 w-full max-w-sm flex items-center">
          <div className="w-full">
            <div className="mb-7">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Sign in</p>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Welcome back</h2>
              <p className="text-sm text-text-muted mt-1.5">Enter your credentials to access the dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    className="input-styled pl-11"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-xs font-semibold text-text-secondary">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="input-styled pl-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Sign in
              </button>
            </form>

          </div>
        </div>

        <footer className="w-full max-w-sm pt-6 text-center">
          <p className="text-[11px] text-text-muted">
            Developed by{' '}
            <a
              href="https://alaqmar.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-text-secondary hover:text-primary transition-colors"
            >
              alaqmar.cloud
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-white/90 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">{icon}</div>
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}
