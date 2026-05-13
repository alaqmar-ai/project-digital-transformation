'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Users as UsersIcon } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import DeadlinesList, { buildDeadlineRows, type DeadlineRow } from '@/components/DeadlinesList';
import {
  listSubProjects,
  listStages,
  listMajorProjects,
  listUsers,
} from '@/lib/data/store';
import type { StageSchedule, SubProject, MajorProject, User } from '@/lib/types';
import { isAdmin } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function MyTasksPage() {
  const { user } = useApp();
  const [subs, setSubs] = useState<SubProject[]>([]);
  const [majors, setMajors] = useState<MajorProject[]>([]);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sp, mp, us] = await Promise.all([listSubProjects(), listMajorProjects(), listUsers()]);
      setSubs(sp);
      setMajors(mp);
      setUsers(us);
      const all: StageSchedule[] = [];
      for (const s of sp) all.push(...(await listStages(s.id)));
      setStages(all);
      setLoading(false);
    })();
  }, []);

  const mineRows: DeadlineRow[] = useMemo(
    () => (user ? buildDeadlineRows({ stages, subs, majors, users, picId: user.id }) : []),
    [stages, subs, majors, users, user]
  );

  const allRows: DeadlineRow[] = useMemo(
    () => buildDeadlineRows({ stages, subs, majors, users }),
    [stages, subs, majors, users]
  );

  const activeRows = view === 'mine' ? mineRows : allRows;

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title={view === 'mine' ? 'My Tasks' : 'All Tasks — Master List'}
        subtitle={
          view === 'mine'
            ? `Open stages assigned to ${user?.name ?? 'you'} — nearest deadline first`
            : 'Every open stage across the plant — nearest deadline first'
        }
        action={
          isAdmin(user) && (
            <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-card">
              <ToggleButton active={view === 'mine'} onClick={() => setView('mine')} icon={<ClipboardList size={14} />} count={mineRows.length}>
                My tasks
              </ToggleButton>
              <ToggleButton active={view === 'all'} onClick={() => setView('all')} icon={<UsersIcon size={14} />} count={allRows.length}>
                All tasks
              </ToggleButton>
            </div>
          )
        }
      />

      {/* Counts pill row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <CountPill label="Open" value={activeRows.length} tone="blue" />
        <CountPill label="Overdue" value={activeRows.filter((r) => (r.stage.planEnd ?? '') < todayIso()).length} tone="red" />
        <CountPill label="Due this week" value={activeRows.filter((r) => withinDays(r.stage.planEnd, 7)).length} tone="amber" />
      </div>

      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : (
          <DeadlinesList
            rows={activeRows}
            showPic={view === 'all'}
            emptyTitle={view === 'mine' ? "You're all caught up" : 'No open stages anywhere'}
            emptyHint={view === 'mine' ? 'Sub-projects assigned to you will populate this list.' : 'Every stage is either Completed or Cancelled.'}
          />
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
  icon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        active ? 'bg-primary text-white shadow-card' : 'text-text-secondary hover:bg-elevated'
      )}
    >
      {icon}
      <span>{children}</span>
      <span
        className={cn(
          'inline-block min-w-[20px] px-1.5 rounded-md text-[10px] font-mono',
          active ? 'bg-white/20 text-white' : 'bg-elevated text-text-muted'
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'red' | 'amber' }) {
  const map = {
    blue: 'bg-blue-50 text-primary border-blue-100',
    red: 'bg-red-50 text-danger border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold', map[tone])}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function withinDays(date: string | undefined, n: number) {
  if (!date) return false;
  const t = new Date(todayIso());
  const d = new Date(date);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  return diff >= 0 && diff <= n;
}
