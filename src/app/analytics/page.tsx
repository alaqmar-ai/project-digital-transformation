'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import { isAdmin } from '@/lib/types';
import {
  listMajorProjects,
  listSubProjects,
  listStagesForSubs,
  listAttendance,
  listUsers,
} from '@/lib/data/store';
import type { MajorProject, SubProject, StageSchedule, User, AttendanceRecord } from '@/lib/types';
import { deriveStageStatus } from '@/lib/status';
import { formatDate } from '@/lib/utils';
import { STAGES, STATUSES, EQUIPMENT_GROUPS, SOURCES, STATUS_COLORS } from '@/lib/constants';

const PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B'];

export default function AnalyticsPage() {
  const { user } = useApp();
  const admin = isAdmin(user);

  const [majors, setMajors] = useState<MajorProject[]>([]);
  const [subs, setSubs] = useState<SubProject[]>([]);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin cascading selectors.
  const [selMajor, setSelMajor] = useState<string>('');
  const [selStage, setSelStage] = useState<string>('');
  const [selPic, setSelPic] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mp, sp, us] = await Promise.all([listMajorProjects(), listSubProjects(), listUsers()]);
      setMajors(mp);
      const scopedSubs = admin ? sp : sp.filter((s) => s.picId === user?.id);
      setSubs(scopedSubs);
      setUsers(us);
      setStages(await listStagesForSubs(scopedSubs.map((s) => s.id)));
      const today = new Date();
      const att = await listAttendance({ year: today.getFullYear(), monthIndex: today.getMonth() });
      setAttendance(admin ? att : att.filter((a) => a.userId === user?.id));
      setLoading(false);
    })();
  }, [admin, user?.id]);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // ── Admin cascade derivation ────────────────────────────────────────────
  const selectedMajor = majors.find((m) => m.id === selMajor) ?? null;
  const subsInMajor = useMemo(
    () => (selectedMajor ? subs.filter((s) => s.majorProjectId === selectedMajor.id) : []),
    [subs, selectedMajor]
  );
  const stagesInMajor = useMemo(
    () => stages.filter((st) => subsInMajor.some((s) => s.id === st.subProjectId)),
    [stages, subsInMajor]
  );
  const uniqueStageNames = useMemo(() => {
    const set = new Set<string>();
    stagesInMajor.forEach((s) => set.add(s.stageName));
    return Array.from(set);
  }, [stagesInMajor]);
  const picsInMajor = useMemo(() => {
    const set = new Map<string, User>();
    subsInMajor.forEach((s) => {
      const u = userById.get(s.picId);
      if (u) set.set(u.id, u);
    });
    return Array.from(set.values());
  }, [subsInMajor, userById]);

  // Filtered slice for the detail card
  const cascadeSubs = useMemo(() => {
    let result = subsInMajor;
    if (selPic) result = result.filter((s) => s.picId === selPic);
    return result;
  }, [subsInMajor, selPic]);
  const cascadeStages = useMemo(() => {
    let result = stages.filter((st) => cascadeSubs.some((s) => s.id === st.subProjectId));
    if (selStage) result = result.filter((st) => st.stageName === selStage);
    return result;
  }, [stages, cascadeSubs, selStage]);

  // ── Universal charts ─────────────────────────────────────────────────────
  const byPic = useMemo(() => {
    const map: Record<string, { name: string; assigned: number; completed: number; delayed: number; _sum: number }> = {};
    subs.forEach((s) => {
      const u = userById.get(s.picId);
      const k = u?.name ?? '-';
      const bucket = (map[k] = map[k] ?? { name: k, assigned: 0, completed: 0, delayed: 0, _sum: 0 });
      bucket.assigned++;
      if (s.status === 'Completed') bucket.completed++;
      if (s.status === 'Delayed') bucket.delayed++;
      bucket._sum += s.progress;
    });
    return Object.values(map).map((b) => ({
      name: b.name,
      assigned: b.assigned,
      completed: b.completed,
      delayed: b.delayed,
    }));
  }, [subs, userById]);

  const byGroup = useMemo(() => bucketBy(subs, (s) => s.equipmentGroup), [subs]);
  const bySource = useMemo(() => bucketBy(subs, (s) => s.source), [subs]);

  const delayCounts = useMemo(() => {
    let onTrack = 0;
    let delayed = 0;
    stages.forEach((st) => {
      const d = deriveStageStatus({ status: st.status, planEnd: st.planEnd, actualEnd: st.actualEnd });
      if (d === 'Delayed') delayed++;
      else onTrack++;
    });
    return [
      { name: 'On Track', value: onTrack },
      { name: 'Delayed', value: delayed },
    ];
  }, [stages]);

  const attendanceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    attendance.forEach((a) => (map[a.status] = (map[a.status] ?? 0) + 1));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [attendance]);

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-content mx-auto">
        <PageHeader title="Analytics" subtitle="Loading…" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Analytics"
        subtitle={admin ? 'Breakdowns across projects, PICs, attendance and delays' : 'Your assigned projects and attendance'}
      />

      {/* Admin cascading selectors - major project detail ─────────────── */}
      {admin && (
        <div className="bg-white border border-border rounded-2xl shadow-card mb-5 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Major project detail</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Drill into a major project → process stage → PIC for a focused breakdown.
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Selector
              label="Major project"
              value={selMajor}
              onChange={(v) => {
                setSelMajor(v);
                setSelStage('');
                setSelPic('');
              }}
              options={[{ value: '', label: '- Choose a project -' }, ...majors.map((m) => ({ value: m.id, label: m.projectName }))]}
            />
            <Selector
              label="Process / stage"
              value={selStage}
              onChange={setSelStage}
              disabled={!selMajor}
              options={[{ value: '', label: 'All stages' }, ...uniqueStageNames.map((n) => ({ value: n, label: n }))]}
            />
            <Selector
              label="PIC"
              value={selPic}
              onChange={setSelPic}
              disabled={!selMajor}
              options={[{ value: '', label: 'All PICs' }, ...picsInMajor.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </div>

          {selectedMajor && (
            <div className="border-t border-border p-5">
              <CascadeSummary
                major={selectedMajor}
                subs={cascadeSubs}
                stages={cascadeStages}
                userById={userById}
              />
            </div>
          )}
        </div>
      )}

      {/* Chart grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title={admin ? 'Sub projects by PIC' : 'My sub projects'}>
          {byPic.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPic}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" name="Assigned" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="By equipment group">
          {byGroup.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byGroup}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avg" name="Avg progress %" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="By source">
          {bySource.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={bySource} dataKey="count" nameKey="name" outerRadius={100} innerRadius={50}>
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Delay analytics (stages)">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={delayCounts} dataKey="value" outerRadius={100} innerRadius={50} label>
                <Cell fill="#10B981" />
                <Cell fill="#EF4444" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title={admin ? 'Attendance (current month)' : 'Your attendance (current month)'}>
          {attendanceCounts.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={11} width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="#06B6D4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Multi-filter explorer (admin) ─────────────────────────────────── */}
      {admin && (
        <MultiFilterAnalytics majors={majors} subs={subs} stages={stages} userById={userById} />
      )}
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">{label}</span>
      <select
        className="select-styled"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CascadeSummary({
  major,
  subs,
  stages,
  userById,
}: {
  major: MajorProject;
  subs: SubProject[];
  stages: StageSchedule[];
  userById: Map<string, User>;
}) {
  const avg = subs.length ? Math.round(subs.reduce((a, s) => a + s.progress, 0) / subs.length) : 0;
  const delayed = stages.filter((st) =>
    deriveStageStatus({ status: st.status, planEnd: st.planEnd, actualEnd: st.actualEnd }) === 'Delayed'
  ).length;
  const completed = stages.filter((st) => st.status === 'Completed').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-base font-bold text-text-primary">{major.projectName}</p>
          <p className="text-xs text-text-muted mt-0.5">{major.description ?? '-'}</p>
        </div>
        <StatusPill status={major.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatBox label="Sub-projects" value={subs.length} />
        <StatBox label="Stages" value={stages.length} />
        <StatBox label="Completed stages" value={completed} tone="green" />
        <StatBox label="Delayed stages" value={delayed} tone="red" />
      </div>

      <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
        <span>Average progress</span>
        <span className="font-mono font-bold text-text-primary">{avg}%</span>
      </div>
      <div className="h-2 rounded-full bg-elevated overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${avg}%` }} />
      </div>

      {subs.length > 0 && (
        <div className="mt-5 border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-elevated">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Sub project</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">PIC</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Plan end</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Progress</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-text-primary">{s.projectName}</td>
                  <td className="px-3 py-2 text-text-secondary">{userById.get(s.picId)?.name ?? '-'}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{formatDate(s.plannedEnd)}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{Math.round(s.progress)}%</td>
                  <td className="px-3 py-2"><StatusPill status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const toneCls =
    tone === 'green'
      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
      : tone === 'red'
      ? 'bg-red-50 border-red-100 text-danger'
      : 'bg-elevated border-border text-text-primary';
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">{label}</p>
      <p className="text-xl font-bold font-mono mt-0.5">{value}</p>
    </div>
  );
}

function bucketBy(subs: SubProject[], key: (s: SubProject) => string) {
  const map: Record<string, { name: string; count: number; _sum: number }> = {};
  subs.forEach((s) => {
    const k = key(s);
    const b = (map[k] = map[k] ?? { name: k, count: 0, _sum: 0 });
    b.count++;
    b._sum += s.progress;
  });
  return Object.values(map).map((b) => ({ name: b.name, count: b.count, avg: Math.round(b._sum / b.count) }));
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-2xl shadow-card">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return <p className="text-xs text-text-muted text-center py-20">No data yet</p>;
}

// ── Multi-filter explorer ───────────────────────────────────────────────────
// One flattened stage row per (sub-project stage), joined with its major/PIC,
// so all 7 filters operate uniformly. Filters cascade: each dropdown only
// offers values still reachable under the other active filters, then the
// charts render the AND-combined slice.

type Row = {
  majorId: string;
  group: string;
  source: string;
  subId: string;
  subName: string;
  stageName: string;
  status: string; // derived stage status
  picId: string;
  picName: string;
  subProgress: number;
};

type FilterKey = 'major' | 'group' | 'source' | 'equipment' | 'step' | 'status' | 'pic';

function MultiFilterAnalytics({
  majors,
  subs,
  stages,
  userById,
}: {
  majors: MajorProject[];
  subs: SubProject[];
  stages: StageSchedule[];
  userById: Map<string, User>;
}) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    major: '',
    group: '',
    source: '',
    equipment: '',
    step: '',
    status: '',
    pic: '',
  });

  const subById = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);

  const rows = useMemo<Row[]>(() => {
    return stages.map((st) => {
      const sub = subById.get(st.subProjectId);
      const pic = sub ? userById.get(sub.picId) : undefined;
      return {
        majorId: sub?.majorProjectId ?? '',
        group: sub?.equipmentGroup ?? '-',
        source: sub?.source ?? '-',
        subId: sub?.id ?? '',
        subName: sub?.projectName ?? '-',
        stageName: st.stageName,
        status: deriveStageStatus({ status: st.status, planEnd: st.planEnd, actualEnd: st.actualEnd }),
        picId: sub?.picId ?? '',
        picName: pic?.name ?? '-',
        subProgress: sub?.progress ?? 0,
      };
    });
  }, [stages, subById, userById]);

  // Apply every active filter except the ones listed in `except`.
  const passes = (r: Row, except: FilterKey[] = []) => {
    const skip = new Set(except);
    if (!skip.has('major') && filters.major && r.majorId !== filters.major) return false;
    if (!skip.has('group') && filters.group && r.group !== filters.group) return false;
    if (!skip.has('source') && filters.source && r.source !== filters.source) return false;
    if (!skip.has('equipment') && filters.equipment && r.subId !== filters.equipment) return false;
    if (!skip.has('step') && filters.step && r.stageName !== filters.step) return false;
    if (!skip.has('status') && filters.status && r.status !== filters.status) return false;
    if (!skip.has('pic') && filters.pic && r.picId !== filters.pic) return false;
    return true;
  };

  const filtered = useMemo(() => rows.filter((r) => passes(r)), [rows, filters]);

  // Cascading options: distinct reachable values under the *other* filters.
  const reachable = (key: FilterKey, pick: (r: Row) => string) => {
    const seen = new Set<string>();
    rows.filter((r) => passes(r, [key])).forEach((r) => {
      const v = pick(r);
      if (v) seen.add(v);
    });
    return seen;
  };

  const majorOpts = useMemo(() => {
    const ids = reachable('major', (r) => r.majorId);
    return majors.filter((m) => ids.has(m.id)).map((m) => ({ value: m.id, label: m.projectName }));
  }, [rows, filters, majors]);

  const groupOpts = useMemo(() => {
    const set = reachable('group', (r) => r.group);
    return EQUIPMENT_GROUPS.filter((g) => set.has(g)).map((g) => ({ value: g, label: g }));
  }, [rows, filters]);

  const sourceOpts = useMemo(() => {
    const set = reachable('source', (r) => r.source);
    return SOURCES.filter((s) => set.has(s)).map((s) => ({ value: s, label: s }));
  }, [rows, filters]);

  const equipmentOpts = useMemo(() => {
    const ids = reachable('equipment', (r) => r.subId);
    return subs
      .filter((s) => ids.has(s.id))
      .map((s) => ({ value: s.id, label: s.projectName }));
  }, [rows, filters, subs]);

  const stepOpts = useMemo(() => {
    const set = reachable('step', (r) => r.stageName);
    return STAGES.filter((s) => set.has(s)).map((s) => ({ value: s, label: s }));
  }, [rows, filters]);

  const statusOpts = useMemo(() => {
    const set = reachable('status', (r) => r.status);
    return STATUSES.filter((s) => set.has(s)).map((s) => ({ value: s, label: s }));
  }, [rows, filters]);

  const picOpts = useMemo(() => {
    const ids = reachable('pic', (r) => r.picId);
    return Array.from(ids)
      .map((id) => ({ value: id, label: userById.get(id)?.name ?? '-' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, filters, userById]);

  const set = (key: FilterKey, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const reset = () =>
    setFilters({ major: '', group: '', source: '', equipment: '', step: '', status: '', pic: '' });
  const activeCount = Object.values(filters).filter(Boolean).length;

  // ── Aggregations over the filtered slice ──────────────────────────────────
  const distinctEquipment = useMemo(() => new Set(filtered.map((r) => r.subId)).size, [filtered]);
  const completedStages = useMemo(() => filtered.filter((r) => r.status === 'Completed').length, [filtered]);
  const delayedStages = useMemo(() => filtered.filter((r) => r.status === 'Delayed').length, [filtered]);
  const avgProgress = useMemo(() => {
    const ids = new Map<string, number>();
    filtered.forEach((r) => ids.set(r.subId, r.subProgress));
    if (ids.size === 0) return 0;
    return Math.round(Array.from(ids.values()).reduce((a, b) => a + b, 0) / ids.size);
  }, [filtered]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => (map[r.status] = (map[r.status] ?? 0) + 1));
    return STATUSES.filter((s) => map[s]).map((s) => ({ name: s, value: map[s] }));
  }, [filtered]);

  const byStep = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number; delayed: number }> = {};
    filtered.forEach((r) => {
      const b = (map[r.stageName] = map[r.stageName] ?? { name: r.stageName, total: 0, completed: 0, delayed: 0 });
      b.total++;
      if (r.status === 'Completed') b.completed++;
      if (r.status === 'Delayed') b.delayed++;
    });
    return STAGES.filter((s) => map[s]).map((s) => map[s]);
  }, [filtered]);

  const byGroup = useMemo(() => {
    const map: Record<string, { name: string; subIds: Set<string>; _sum: number }> = {};
    filtered.forEach((r) => {
      const b = (map[r.group] = map[r.group] ?? { name: r.group, subIds: new Set<string>(), _sum: 0 });
      b.subIds.add(r.subId);
    });
    return Object.values(map).map((b) => {
      const ids = Array.from(b.subIds);
      const avg = ids.length
        ? Math.round(ids.reduce((a, id) => a + (subById.get(id)?.progress ?? 0), 0) / ids.length)
        : 0;
      return { name: b.name, equipment: ids.length, avg };
    });
  }, [filtered, subById]);

  const byPic = useMemo(() => {
    const map: Record<string, { name: string; subIds: Set<string>; delayed: number }> = {};
    filtered.forEach((r) => {
      const b = (map[r.picName] = map[r.picName] ?? { name: r.picName, subIds: new Set<string>(), delayed: 0 });
      b.subIds.add(r.subId);
      if (r.status === 'Delayed') b.delayed++;
    });
    return Object.values(map).map((b) => ({ name: b.name, equipment: b.subIds.size, delayed: b.delayed }));
  }, [filtered]);

  const bySource = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    filtered.forEach((r) => {
      (map[r.source] = map[r.source] ?? new Set<string>()).add(r.subId);
    });
    return Object.entries(map).map(([name, ids]) => ({ name, value: ids.size }));
  }, [filtered]);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card mt-5 overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Filtered analytics</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Slice every chart by major project → group → source → equipment → step → status → PIC. Filters cascade.
          </p>
        </div>
        {activeCount > 0 && (
          <button
            onClick={reset}
            className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Reset ({activeCount})
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 border-b border-border">
        <Selector
          label="Major project"
          value={filters.major}
          onChange={(v) => set('major', v)}
          options={[{ value: '', label: 'All projects' }, ...majorOpts]}
        />
        <Selector
          label="Group"
          value={filters.group}
          onChange={(v) => set('group', v)}
          options={[{ value: '', label: 'All groups' }, ...groupOpts]}
        />
        <Selector
          label="Source"
          value={filters.source}
          onChange={(v) => set('source', v)}
          options={[{ value: '', label: 'All sources' }, ...sourceOpts]}
        />
        <Selector
          label="Equipment"
          value={filters.equipment}
          onChange={(v) => set('equipment', v)}
          options={[{ value: '', label: 'All equipment' }, ...equipmentOpts]}
        />
        <Selector
          label="Step"
          value={filters.step}
          onChange={(v) => set('step', v)}
          options={[{ value: '', label: 'All steps' }, ...stepOpts]}
        />
        <Selector
          label="Status"
          value={filters.status}
          onChange={(v) => set('status', v)}
          options={[{ value: '', label: 'All statuses' }, ...statusOpts]}
        />
        <Selector
          label="PIC"
          value={filters.pic}
          onChange={(v) => set('pic', v)}
          options={[{ value: '', label: 'All PICs' }, ...picOpts]}
        />
      </div>

      {/* Summary stats */}
      <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-border">
        <StatBox label="Equipment" value={distinctEquipment} />
        <StatBox label="Steps" value={filtered.length} />
        <StatBox label="Completed steps" value={completedStages} tone="green" />
        <StatBox label="Delayed steps" value={delayedStages} tone="red" />
        <StatBox label="Avg progress %" value={avgProgress} />
      </div>

      {/* Charts */}
      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyChart />
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Step status breakdown">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={100} innerRadius={50} label>
                  {statusBreakdown.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS[d.name] ?? PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Steps by stage">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byStep}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#2563EB" radius={[6, 6, 0, 0]} fillOpacity={0.15} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Equipment by group">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byGroup}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="equipment" name="Equipment" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avg" name="Avg progress %" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Equipment & delays by PIC">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPic}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="equipment" name="Equipment" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed steps" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Equipment by source">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={bySource} dataKey="value" nameKey="name" outerRadius={100} innerRadius={50} label>
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
