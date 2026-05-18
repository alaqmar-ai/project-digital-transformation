'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import DeadlinesList, { buildDeadlineRows } from '@/components/DeadlinesList';
import { isAdmin } from '@/lib/types';
import {
  listMajorProjects,
  listSubProjects,
  listStages,
  listUsers,
} from '@/lib/data/store';
import type { MajorProject, SubProject, StageSchedule, User } from '@/lib/types';
import { formatDate, formatFullDate } from '@/lib/utils';

const PIE_COLORS = ['#2563EB', '#10B981', '#EF4444', '#F59E0B', '#94A3B8', '#6B7280'];

export default function DashboardPage() {
  const { user } = useApp();
  const admin = isAdmin(user);
  const [majors, setMajors] = useState<MajorProject[]>([]);
  const [subs, setSubs] = useState<SubProject[]>([]);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mp, sp, us] = await Promise.all([listMajorProjects(), listSubProjects(), listUsers()]);
      setMajors(mp);
      // Staff only sees the sub-projects they own.
      const scopedSubs = admin ? sp : sp.filter((s) => s.picId === user?.id);
      setSubs(scopedSubs);
      setUsers(us);
      const all: StageSchedule[] = [];
      for (const s of scopedSubs) all.push(...(await listStages(s.id)));
      setStages(all);
      setLoading(false);
    })();
  }, [admin, user?.id]);

  // PIC-specific deadline list (top 5 nearest open stages)
  const myDeadlines = useMemo(
    () =>
      user
        ? buildDeadlineRows({
            stages,
            subs,
            majors,
            users,
            picId: user.id,
            limit: 5,
          })
        : [],
    [stages, subs, majors, users, user]
  );

  const statusPie = useMemo(() => {
    const buckets: Record<string, number> = {};
    subs.forEach((s) => (buckets[s.status] = (buckets[s.status] ?? 0) + 1));
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [subs]);

  const groupBars = useMemo(() => {
    const byGroup: Record<string, { name: string; count: number; progress: number }> = {};
    subs.forEach((s) => {
      const b = (byGroup[s.equipmentGroup] = byGroup[s.equipmentGroup] ?? {
        name: s.equipmentGroup,
        count: 0,
        progress: 0,
      });
      b.count++;
      b.progress += s.progress;
    });
    return Object.values(byGroup).map((b) => ({ ...b, progress: Math.round(b.progress / b.count) }));
  }, [subs]);

  // Major projects visible to this user - admin sees all; staff sees only those
  // that contain at least one sub-project assigned to them.
  const visibleMajors = useMemo(() => {
    if (admin) return majors;
    const ids = new Set(subs.map((s) => s.majorProjectId));
    return majors.filter((m) => ids.has(m.id));
  }, [admin, majors, subs]);

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] ?? 'User'}`} subtitle={formatFullDate(new Date())} />

      {/* My next deadlines */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
              <ListChecks size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {admin ? 'My next deadlines' : 'Your next deadlines'}
              </h3>
              <p className="text-[11px] text-text-muted">
                {myDeadlines.length > 0
                  ? `${myDeadlines.length} open stage${myDeadlines.length === 1 ? '' : 's'} assigned to you - nearest first`
                  : 'Stages assigned to you and not yet completed'}
              </p>
            </div>
          </div>
          <Link href="/my-tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <DeadlinesList
          rows={myDeadlines}
          emptyTitle="You're all caught up"
          emptyHint="Stages assigned to you will appear here, sorted by nearest deadline."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <ChartCard title="Status distribution" className="lg:col-span-1">
          {loading ? (
            <div className="skeleton h-60" />
          ) : statusPie.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusPie} dataKey="value" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="By equipment group" className="lg:col-span-2">
          {loading ? (
            <div className="skeleton h-60" />
          ) : groupBars.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={groupBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Bar dataKey="progress" name="Avg progress %" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="count" name="# projects" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Recent major projects */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {admin ? 'Recent major projects' : 'Major projects you contribute to'}
          </h3>
          {admin && (
            <Link href="/projects" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          )}
        </div>
        {visibleMajors.length === 0 ? (
          <p className="p-10 text-sm text-text-muted text-center">No projects yet.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Project</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Progress</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Created</th>
              </tr>
            </thead>
            <tbody>
              {visibleMajors.slice(0, 5).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link href={`/sub-projects?major=${m.id}`} className="font-medium text-text-primary hover:text-primary">
                      {m.projectName}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={m.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, m.overallProgress)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-text-secondary">{Math.round(m.overallProgress)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-muted font-mono">{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-border rounded-2xl shadow-card ${className ?? ''}`}>
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-text-muted text-center py-12">No data yet</p>;
}
