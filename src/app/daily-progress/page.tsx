'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, AlertCircle, CheckCircle2, Circle, Clock, User as UserIcon, GripVertical } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import { useUsers } from '@/hooks/useUsers';
import {
  listSubProjects,
  listStages,
  listMajorProjects,
  updateStage,
  updateSubProject,
} from '@/lib/data/store';
import type { StageSchedule, SubProject, MajorProject, Status } from '@/lib/types';
import { isAdmin } from '@/lib/types';
import { todayIso, deriveStageStatus, progressOfSubProject } from '@/lib/status';
import { formatDate, cn } from '@/lib/utils';

interface Row {
  stage: StageSchedule;
  sub: SubProject;
  major?: MajorProject;
}

const COLUMN_DAYS = 7;

export default function DailyProgressPage() {
  const { user, addToast } = useApp();
  const { data: users } = useUsers();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const admin = isAdmin(user);

  const userName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (id: string) => map.get(id) ?? '-';
  }, [users]);

  const load = async () => {
    setLoading(true);
    const today = todayIso();
    const horizon = addDaysIso(today, COLUMN_DAYS - 1);
    const [subs, majors] = await Promise.all([listSubProjects(), listMajorProjects()]);
    const majorById = new Map(majors.map((m) => [m.id, m]));
    const scopedSubs = admin ? subs : subs.filter((s) => s.picId === user?.id);
    const collected: Row[] = [];
    for (const sub of scopedSubs) {
      const stages = await listStages(sub.id);
      for (const s of stages) {
        if (s.status === 'Completed' || s.status === 'Cancelled') continue;
        if (!s.planEnd) continue;
        if (s.planEnd <= horizon) {
          collected.push({ stage: s, sub, major: majorById.get(sub.majorProjectId) });
        }
      }
    }
    setRows(collected);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, user?.id]);

  const today = todayIso();

  const overdueRows = useMemo(
    () => rows.filter((r) => (r.stage.planEnd ?? '') < today),
    [rows, today]
  );

  const columns = useMemo(() => {
    const cols: { iso: string; rows: Row[] }[] = [];
    for (let i = 0; i < COLUMN_DAYS; i++) {
      const iso = addDaysIso(today, i);
      cols.push({ iso, rows: rows.filter((r) => r.stage.planEnd === iso) });
    }
    return cols;
  }, [rows, today]);

  const toggleStage = async (r: Row, completed: boolean) => {
    setSaving(r.stage.id);
    try {
      const today = todayIso();
      const nextStatus: Status = completed ? 'Completed' : deriveStageStatus({
        status: 'In Progress',
        planEnd: r.stage.planEnd,
        actualEnd: undefined,
      });
      const patch: Partial<StageSchedule> = {
        status: nextStatus,
        actualEnd: completed ? today : undefined,
        progress: completed ? 100 : (r.stage.progress ?? 0),
      };
      await updateStage(r.stage.id, patch);
      const updated = rows.map((row) =>
        row.stage.id === r.stage.id ? { ...row, stage: { ...row.stage, ...patch } } : row
      );
      setRows(updated);

      const sameSub = updated.filter((row) => row.sub.id === r.sub.id).map((row) => row.stage);
      const allSubStages = await listStages(r.sub.id);
      const merged = allSubStages.map((s) => sameSub.find((x) => x.id === s.id) ?? s);
      const newProgress = progressOfSubProject(merged);
      await updateSubProject(r.sub.id, { progress: newProgress });
      addToast('success', completed ? 'Marked complete' : 'Reopened');
      if (completed) {
        setRows((prev) => prev.filter((row) => row.stage.id !== r.stage.id));
      }
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const reschedule = async (r: Row, targetIso: string) => {
    if (r.stage.planEnd === targetIso) return;
    const prev = rows;
    // Optimistic update
    const optimistic = rows.map((row) =>
      row.stage.id === r.stage.id
        ? { ...row, stage: { ...row.stage, planEnd: targetIso } }
        : row
    );
    setRows(optimistic);
    setSaving(r.stage.id);
    try {
      const nextStatus = deriveStageStatus({
        status: r.stage.status === 'Pending' ? 'Pending' : r.stage.status,
        planEnd: targetIso,
        actualEnd: r.stage.actualEnd,
      });
      await updateStage(r.stage.id, { planEnd: targetIso, status: nextStatus });
      addToast('success', `Moved to ${formatDate(targetIso)}`);
    } catch (e) {
      setRows(prev);
      addToast('error', (e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const handleDrop = (targetIso: string) => {
    if (!dragId) return;
    const row = rows.find((r) => r.stage.id === dragId);
    setDragId(null);
    setDropTarget(null);
    if (!row) return;
    reschedule(row, targetIso);
  };

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Daily Progress"
        subtitle={`Drag a card to reschedule. Next ${COLUMN_DAYS} days · ${formatDate(today)}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatTile label="Due today" value={columns[0].rows.length} icon={<Calendar size={18} />} tone="blue" />
        <StatTile label="Overdue" value={overdueRows.length} icon={<AlertCircle size={18} />} tone="red" />
        <StatTile label="This week" value={rows.length - overdueRows.length} icon={<Clock size={18} />} tone="green" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton h-64" />
          ))}
        </div>
      ) : (
        <>
          {overdueRows.length > 0 && (
            <DayColumn
              iso="overdue"
              title="Overdue"
              subtitle={`${overdueRows.length} item${overdueRows.length === 1 ? '' : 's'} past deadline`}
              tone="red"
              rows={overdueRows}
              userName={userName}
              saving={saving}
              onToggle={toggleStage}
              showDate
              wide
              dragId={dragId}
              dropTarget={dropTarget}
              onDragStart={setDragId}
              onDragEnd={() => { setDragId(null); setDropTarget(null); }}
              onDragOver={setDropTarget}
              onDrop={handleDrop}
              droppable={false}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-3">
            {columns.map((c, i) => (
              <DayColumn
                key={c.iso}
                iso={c.iso}
                title={dayLabel(c.iso, i)}
                subtitle={formatDate(c.iso)}
                tone={i === 0 ? 'blue' : 'slate'}
                rows={c.rows}
                userName={userName}
                saving={saving}
                onToggle={toggleStage}
                dragId={dragId}
                dropTarget={dropTarget}
                onDragStart={setDragId}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                onDragOver={setDropTarget}
                onDrop={handleDrop}
                droppable
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ColumnProps {
  iso: string;
  title: string;
  subtitle?: string;
  tone: 'blue' | 'red' | 'slate' | 'green';
  rows: Row[];
  userName: (id: string) => string;
  saving: string | null;
  onToggle: (r: Row, completed: boolean) => void;
  showDate?: boolean;
  wide?: boolean;
  dragId: string | null;
  dropTarget: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (iso: string | null) => void;
  onDrop: (iso: string) => void;
  droppable?: boolean;
}

function DayColumn({
  iso,
  title,
  subtitle,
  tone,
  rows,
  userName,
  saving,
  onToggle,
  showDate = false,
  wide = false,
  dragId,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  droppable = false,
}: ColumnProps) {
  const toneMap = {
    blue: 'border-blue-200 bg-blue-50/40',
    red: 'border-red-200 bg-red-50/40',
    slate: 'border-border bg-elevated/30',
    green: 'border-emerald-200 bg-emerald-50/40',
  };
  const titleTone = {
    blue: 'text-primary',
    red: 'text-danger',
    slate: 'text-text-secondary',
    green: 'text-emerald-700',
  };

  const isDropping = droppable && dropTarget === iso && dragId !== null;

  return (
    <div
      onDragOver={(e) => {
        if (!droppable || !dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropTarget !== iso) onDragOver(iso);
      }}
      onDragLeave={() => {
        if (droppable && dropTarget === iso) onDragOver(null);
      }}
      onDrop={(e) => {
        if (!droppable) return;
        e.preventDefault();
        onDrop(iso);
      }}
      className={cn(
        'rounded-2xl border p-3 flex flex-col gap-2 transition-all',
        toneMap[tone],
        wide && 'mb-2',
        isDropping && 'ring-2 ring-primary ring-offset-1 bg-primary-light/40 scale-[1.01]'
      )}
    >
      <div className="px-1 pb-2 border-b border-border/60">
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-bold uppercase tracking-wide', titleTone[tone])}>{title}</span>
          <span className="text-[10px] font-mono text-text-muted">{rows.length}</span>
        </div>
        {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className={cn('text-[11px] text-text-muted italic py-3 px-1', isDropping && 'text-primary not-italic font-semibold')}>
          {isDropping ? 'Drop to reschedule' : 'Nothing scheduled.'}
        </p>
      ) : (
        <div className={cn('flex flex-col gap-2', wide && 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2')}>
          {rows.map((r) => (
            <TaskCard
              key={r.stage.id}
              r={r}
              userName={userName}
              saving={saving === r.stage.id}
              onToggle={onToggle}
              showDate={showDate}
              isDragging={dragId === r.stage.id}
              onDragStart={() => onDragStart(r.stage.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  r,
  userName,
  saving,
  onToggle,
  showDate,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  r: Row;
  userName: (id: string) => string;
  saving: boolean;
  onToggle: (r: Row, completed: boolean) => void;
  showDate?: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const completed = r.stage.status === 'Completed';
  const overdue = !completed && (r.stage.planEnd ?? '') < todayIso();

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', r.stage.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group bg-white border border-border rounded-xl p-2.5 shadow-card hover:shadow-elevated transition-all cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => onToggle(r, !completed)}
          disabled={saving}
          className={cn(
            'mt-0.5 flex-shrink-0 transition-colors',
            completed ? 'text-emerald-600' : 'text-text-muted hover:text-primary'
          )}
          aria-label={completed ? 'Reopen' : 'Mark complete'}
        >
          {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <Link
              href={`/sub-projects/${r.sub.id}`}
              className={cn(
                'text-[13px] font-semibold text-text-primary leading-tight line-clamp-2 hover:text-primary',
                completed && 'line-through text-text-muted'
              )}
            >
              {r.stage.stageIndex + 1}. {r.stage.stageName}
            </Link>
            <GripVertical size={12} className="text-text-muted/60 flex-shrink-0 mt-0.5" aria-hidden />
          </div>
          <p className="text-[11px] text-text-muted mt-0.5 truncate">{r.sub.projectName}</p>
          {r.major && (
            <p className="text-[10px] text-text-muted mt-0.5 truncate">{r.major.projectName}</p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary bg-elevated rounded-md px-1.5 py-0.5">
              <UserIcon size={10} />
              <span className="truncate max-w-[100px]">{userName(r.sub.picId)}</span>
            </span>
            {showDate && r.stage.planEnd && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 font-mono',
                  overdue ? 'bg-red-50 text-danger' : 'bg-elevated text-text-secondary'
                )}
              >
                {formatDate(r.stage.planEnd)}
              </span>
            )}
            {r.stage.progress != null && r.stage.progress > 0 && !completed && (
              <span className="text-[10px] text-text-muted font-mono">{Math.round(r.stage.progress)}%</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'blue' | 'red' | 'green';
}) {
  const map = {
    blue: 'bg-primary-light text-primary',
    red: 'bg-red-50 text-danger',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-text-muted">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${map[tone]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
    </div>
  );
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso: string, offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
}
