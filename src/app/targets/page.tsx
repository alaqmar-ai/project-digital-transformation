'use client';

import { useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { StatCardSkeleton } from '@/components/LoadingSpinner';
import { getStageStatus } from '@/lib/status';
import { formatFullDate, formatDate, daysFromToday } from '@/lib/utils';

interface TargetItem {
  projectName: string;
  projectCode: string;
  pic: string;
  stageIndex: number;
  stageName: string;
  planStart: string;
  planFinish: string;
  status: string;
  priority: 'overdue' | 'due-soon' | 'active';
  daysLabel: string;
}

export default function TargetsPage() {
  const { projects, projectsLoading } = useApp();

  const targets = useMemo(() => {
    const items: TargetItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    projects.forEach((project) => {
      project.stages.forEach((stage, i) => {
        const status = getStageStatus(stage);
        if (status === 'COMPLETED' || status === 'NOT STARTED' || status === 'UPCOMING') return;

        if (status === 'DELAY') {
          const daysOver = stage.planFinish ? -daysFromToday(stage.planFinish) : 0;
          items.push({
            projectName: project.name,
            projectCode: project.code,
            pic: project.pic,
            stageIndex: i,
            stageName: stage.stageName,
            planStart: stage.planStart,
            planFinish: stage.planFinish,
            status,
            priority: 'overdue',
            daysLabel: `${daysOver}d overdue`,
          });
        } else if (status === 'IN PROGRESS') {
          const daysLeft = stage.planFinish ? daysFromToday(stage.planFinish) : 999;
          if (daysLeft <= 3) {
            items.push({
              projectName: project.name,
              projectCode: project.code,
              pic: project.pic,
              stageIndex: i,
              stageName: stage.stageName,
              planStart: stage.planStart,
              planFinish: stage.planFinish,
              status,
              priority: 'due-soon',
              daysLabel: daysLeft <= 0 ? 'Due today' : `${daysLeft}d remaining`,
            });
          } else {
            items.push({
              projectName: project.name,
              projectCode: project.code,
              pic: project.pic,
              stageIndex: i,
              stageName: stage.stageName,
              planStart: stage.planStart,
              planFinish: stage.planFinish,
              status,
              priority: 'active',
              daysLabel: 'Active',
            });
          }
        }
      });
    });

    const order = { overdue: 0, 'due-soon': 1, active: 2 };
    return items.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [projects]);

  const stats = useMemo(() => ({
    active: targets.filter((t) => t.priority === 'active').length,
    dueSoon: targets.filter((t) => t.priority === 'due-soon').length,
    overdue: targets.filter((t) => t.priority === 'overdue').length,
  }), [targets]);

  const borderColor = (priority: string) => {
    switch (priority) {
      case 'overdue': return '#ef4444';
      case 'due-soon': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-content mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Daily Targets</h1>
        <p className="text-[13px] text-text-muted mt-1">{formatFullDate(new Date())}</p>
      </div>

      {/* KPI Cards */}
      {projectsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="Active Today" value={stats.active} accentColor="#3b82f6" />
          <StatCard label="Due Within 3 Days" value={stats.dueSoon} accentColor="#f59e0b" />
          <StatCard label="Overdue" value={stats.overdue} accentColor="#ef4444" />
        </div>
      )}

      {/* Target Cards */}
      {targets.length === 0 && !projectsLoading ? (
        <div className="text-center py-20 text-text-muted text-sm">
          No active targets today - all on track
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {targets.map((t, i) => (
            <div
              key={i}
              className="card p-4 relative overflow-hidden animate-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 w-full h-[2px]"
                style={{ background: `linear-gradient(90deg, ${borderColor(t.priority)}, transparent)` }}
              />
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{t.projectName}</p>
                  <p className="font-mono text-[11px] text-text-muted mt-0.5">{t.projectCode}</p>
                </div>
                <span
                  className="text-[10px] font-mono font-medium px-2 py-1 rounded-md flex-shrink-0"
                  style={{
                    color: borderColor(t.priority),
                    backgroundColor: `${borderColor(t.priority)}12`,
                  }}
                >
                  {t.daysLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-text-secondary">
                    Stage {t.stageIndex + 1}: {t.stageName}
                  </p>
                  <p className="font-mono text-[11px] text-text-muted mt-1">
                    {formatDate(t.planStart)} → {formatDate(t.planFinish)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <p className="text-[11px] text-text-muted">PIC: <span className="text-text-secondary">{t.pic}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
