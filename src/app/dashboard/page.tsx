'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Calendar, Users, Percent, ArrowRight, ListChecks } from 'lucide-react';
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
  listAttendance,
  listUsers,
} from '@/lib/data/store';
import { todayIso } from '@/lib/status';
import type { MajorProject, SubProject, StageSchedule, User, AttendanceRecord } from '@/lib/types';

const PIE_COLORS = ['#2563EB', '#10B981', '#EF4444', '#F59E0B', '#94A3B8', '#6B7280'];

export default function DashboardPage() {
  const { user } = useApp();
  const [majors, setMajors] = useState<MajorProject[]>([]);
  const [subs, setSubs] = useState<SubProject[]>([]);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mp, sp, us] = await Promise.all([listMajorProjects(), listSubProjects(), listUsers()]);
      setMajors(mp);
      setSubs(sp);
      setUsers(us);
      const all: StageSchedule[] = [];
      for (const s of sp) all.push(...(await listStages(s.id)));
      setStages(all);
      const today = new Date();
      setAttendance(
        await listAttendance({ year: today.getFullYear(), monthIndex: today.getMonth() })
      );
      setLoading(false);
    })();
  }, []);

  const today = todayIso();

  const kpi = useMemo(() => {
    const activeProjects = subs.filter((s) => s.status === 'In Progress' || s.status === 'Pending').length;
    const delayedProjects = subs.filter((s) => s.status === 'Delayed').length;
    const completedProjects = subs.filter((s) => s.status === 'Completed').length;

    const dueToday = stages.filter((st) => st.planEnd === today).length;

    const todayAtt = attendance.filter((a) => a.date === today);
    const presentStatuses = ['Present', 'Half-day (AM)', 'Half-day (PM)', 'Training', 'Business Trip', 'Holiday Job', 'Weekend Job'];
    const present = todayAtt.filter((a) => presentStatuses.includes(a.status)).length;

    const totalUsers = users.length || 1;
    const attendancePct = Math.round((present / totalUsers) * 100);

    const overall = subs.length > 0 ? Math.round(subs.reduce((acc, s) => acc + s.progress, 0) / subs.length) : 0;

    return {
      activeProjects,
      delayedProjects,
      completedProjects,
      dueToday,
      present,
      attendancePct,
      overall,
    };
  }, [subs, stages, attendance, users, today]);

  const statusPie = useMemo(() => {
    const buckets: Record<string, number> = {};
    subs.forEach((s) => (buckets[s.status] = (buckets[s.status] ?? 0) + 1));
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [subs]);

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

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader title={`Welcome, ${user?.name?.split(' ')[0] ?? 'User'}`} subtitle={new Date().toDateString()} />

      {loading ? (
        <div className="grid gap-3 mb-6 md:grid-cols-3">
          <div className="skeleton h-40 md:row-span-2" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 mb-6 md:grid-cols-3">
          {/* Hero tile — Overall completion */}
          <div className="md:row-span-2 bg-gradient-to-br from-primary to-blue-700 text-white rounded-2xl p-6 shadow-card relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative z-10 flex flex-col h-full">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-white/70">Overall Completion</p>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-6xl font-bold font-mono tracking-tight">{kpi.overall}</p>
                <span className="text-3xl font-semibold text-white/80">%</span>
              </div>
              <p className="text-sm text-white/80 mt-1">across {subs.length} sub-projects</p>

              <div className="mt-5 w-full h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${Math.min(100, kpi.overall)}%` }} />
              </div>

              <div className="mt-auto pt-6 grid grid-cols-2 gap-3 text-white/90">
                <MiniStat label="Active" value={kpi.activeProjects} />
                <MiniStat label="Delayed" value={kpi.delayedProjects} accent />
              </div>
            </div>
          </div>

          <Kpi label="Completed" value={kpi.completedProjects} icon={<CheckCircle2 size={18} />} tone="green" />
          <Kpi label="Due Today" value={kpi.dueToday} icon={<Calendar size={18} />} tone="amber" />
          <Kpi label="Staff Present" value={`${kpi.present}/${users.length}`} icon={<Users size={18} />} tone="blue" />
          <Kpi label="Attendance" value={`${kpi.attendancePct}%`} icon={<Percent size={18} />} tone="green" />
        </div>
      )}

      {/* My next deadlines */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center">
              <ListChecks size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {isAdmin(user) ? 'My next deadlines' : 'Your next deadlines'}
              </h3>
              <p className="text-[11px] text-text-muted">
                {myDeadlines.length > 0
                  ? `${myDeadlines.length} open stage${myDeadlines.length === 1 ? '' : 's'} assigned to you — nearest first`
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
          {statusPie.length === 0 ? (
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
          {groupBars.length === 0 ? (
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
          <h3 className="text-sm font-semibold text-text-primary">Recent major projects</h3>
          <Link href="/projects" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {majors.length === 0 ? (
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
              {majors.slice(0, 5).map((m) => (
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
                  <td className="px-3 py-3 text-xs text-text-muted font-mono">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${accent ? 'bg-white/15' : 'bg-white/10'} border border-white/10`}>
      <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{label}</p>
      <p className="text-xl font-bold font-mono mt-0.5">{value}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'red' | 'green' | 'amber' | 'slate';
}) {
  const map = {
    blue: 'bg-primary-light text-primary',
    red: 'bg-red-50 text-danger',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white border border-border rounded-2xl shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${map[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">{label}</p>
        <p className="text-xl font-bold text-text-primary font-mono mt-0.5 truncate">{value}</p>
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
