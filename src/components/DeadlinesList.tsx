'use client';

import Link from 'next/link';
import { AlertCircle, Calendar, CheckCircle2, Clock } from 'lucide-react';
import StatusPill from '@/components/ui/StatusPill';
import type { StageSchedule, SubProject, MajorProject, User } from '@/lib/types';
import { deriveStageStatus, daysUntil } from '@/lib/status';
import { cn, formatDate } from '@/lib/utils';

export interface DeadlineRow {
  stage: StageSchedule;
  sub: SubProject;
  major?: MajorProject;
  pic?: User;
}

/**
 * Build a list of *open* stages (Pending / In Progress / Delayed) with a
 * plan_end, sorted by nearest deadline first.
 */
export function buildDeadlineRows(opts: {
  stages: StageSchedule[];
  subs: SubProject[];
  majors: MajorProject[];
  users: User[];
  picId?: string;
  limit?: number;
}): DeadlineRow[] {
  const subById = new Map(opts.subs.map((s) => [s.id, s]));
  const majorById = new Map(opts.majors.map((m) => [m.id, m]));
  const userById = new Map(opts.users.map((u) => [u.id, u]));

  const rows: DeadlineRow[] = [];
  for (const stage of opts.stages) {
    if (!stage.planEnd) continue;
    if (stage.status === 'Completed' || stage.status === 'Cancelled') continue;
    const sub = subById.get(stage.subProjectId);
    if (!sub) continue;
    if (opts.picId && sub.picId !== opts.picId) continue;
    rows.push({
      stage,
      sub,
      major: majorById.get(sub.majorProjectId),
      pic: userById.get(sub.picId),
    });
  }

  rows.sort((a, b) => (a.stage.planEnd ?? '').localeCompare(b.stage.planEnd ?? ''));
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

interface Props {
  rows: DeadlineRow[];
  showPic?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}

export default function DeadlinesList({ rows, showPic = false, emptyTitle, emptyHint }: Props) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-3">
          <CheckCircle2 size={20} />
        </div>
        <p className="text-sm font-medium text-text-primary">{emptyTitle ?? 'No upcoming deadlines'}</p>
        {emptyHint && <p className="text-xs text-text-muted mt-1">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const days = daysUntil(r.stage.planEnd);
        const derived = deriveStageStatus({
          status: r.stage.status,
          planEnd: r.stage.planEnd,
          actualEnd: r.stage.actualEnd,
        });

        return (
          <li key={r.stage.id}>
            <Link
              href={`/sub-projects/${r.sub.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-elevated transition-colors"
            >
              <DeadlineBadge days={days} delayed={derived === 'Delayed'} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  <span className="text-text-muted font-normal mr-2">{r.stage.stageIndex + 1}.</span>
                  {r.stage.stageName}{' '}
                  <span className="text-text-secondary font-normal">- {r.sub.projectName}</span>
                </p>
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {r.major?.projectName ?? '-'}
                  {showPic && r.pic && <span> · <span className="font-medium text-text-secondary">{r.pic.name}</span></span>}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-mono text-text-muted hidden sm:inline">{formatDate(r.stage.planEnd)}</span>
                <StatusPill status={derived} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DeadlineBadge({ days, delayed }: { days: number; delayed: boolean }) {
  let label: string;
  let cls: string;
  let Icon = Clock;

  if (delayed || days < 0) {
    label = `${Math.abs(days)}d late`;
    cls = 'bg-red-50 text-danger border-red-100';
    Icon = AlertCircle;
  } else if (days === 0) {
    label = 'Today';
    cls = 'bg-amber-50 text-amber-700 border-amber-100';
    Icon = Calendar;
  } else if (days === 1) {
    label = 'Tomorrow';
    cls = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (days <= 3) {
    label = `${days}d`;
    cls = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (days <= 7) {
    label = `${days}d`;
    cls = 'bg-blue-50 text-primary border-blue-100';
  } else {
    label = `${days}d`;
    cls = 'bg-slate-50 text-text-secondary border-slate-200';
  }

  return (
    <div className={cn('flex flex-col items-center justify-center w-14 h-14 rounded-xl border flex-shrink-0', cls)}>
      <Icon size={14} className="mb-0.5" />
      <span className="text-[11px] font-bold leading-none">{label}</span>
    </div>
  );
}
