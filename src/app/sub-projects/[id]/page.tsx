'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, ChevronRight, ChevronDown, ListChecks } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import StageGantt from '@/components/StageGantt';
import StageCheckpoints from '@/components/StageCheckpoints';
import {
  listSubProjects,
  listStages,
  updateStage,
  updateSubProject,
  listMajorProjects,
  listCheckpointsForStages,
} from '@/lib/data/store';
import { useUsers } from '@/hooks/useUsers';
import type { SubProject, StageSchedule, MajorProject, Status, StageCheckpoint } from '@/lib/types';
import { STATUSES } from '@/lib/constants';
import { planDuration, formatDate } from '@/lib/utils';
import { deriveStageStatus, progressOfSubProject } from '@/lib/status';
import { isAdmin } from '@/lib/types';

export default function SubProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, addToast } = useApp();
  const { userName } = useUsers();

  const [sub, setSub] = useState<SubProject | null>(null);
  const [major, setMajor] = useState<MajorProject | null>(null);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [checkpointsByStage, setCheckpointsByStage] = useState<Record<string, StageCheckpoint[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const all = await listSubProjects();
    const s = all.find((x) => x.id === id) ?? null;
    setSub(s);
    if (s) {
      const majors = await listMajorProjects();
      setMajor(majors.find((m) => m.id === s.majorProjectId) ?? null);
      const sts = await listStages(s.id);
      setStages(sts);
      const cps = await listCheckpointsForStages(sts.map((st) => st.id));
      const byStage: Record<string, StageCheckpoint[]> = {};
      for (const cp of cps) {
        (byStage[cp.stageId] ||= []).push(cp);
      }
      setCheckpointsByStage(byStage);
    }
    setLoading(false);
  };

  const toggleExpand = (stageId: string) => {
    setExpanded((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleCheckpointsChange = (stageId: string, next: StageCheckpoint[]) => {
    setCheckpointsByStage((prev) => ({ ...prev, [stageId]: next }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEdit = isAdmin(user) || (sub && sub.picId === user?.id);

  const handleStageSave = async (stage: StageSchedule, patch: Partial<StageSchedule>) => {
    setSaving(stage.id);
    try {
      const next: StageSchedule = {
        ...stage,
        ...patch,
        plannedDurationDays: planDuration(patch.planStart ?? stage.planStart, patch.planEnd ?? stage.planEnd),
        actualDurationDays: planDuration(
          patch.actualStart ?? stage.actualStart,
          patch.actualEnd ?? stage.actualEnd
        ),
      };
      next.status = deriveStageStatus({
        status: next.status,
        planEnd: next.planEnd,
        actualEnd: next.actualEnd,
      });
      await updateStage(stage.id, next);
      // Recompute sub-project progress / status
      const updated = stages.map((s) => (s.id === stage.id ? next : s));
      setStages(updated);
      const newProgress = progressOfSubProject(updated);
      const someDelayed = updated.some((s) => s.status === 'Delayed');
      const allCompleted = updated.every((s) => s.status === 'Completed' || s.status === 'Cancelled') && newProgress > 0;
      const newStatus: Status = allCompleted
        ? 'Completed'
        : someDelayed
        ? 'Delayed'
        : updated.some((s) => s.status === 'In Progress')
        ? 'In Progress'
        : sub?.status ?? 'Pending';
      if (sub) {
        await updateSubProject(sub.id, { progress: newProgress, status: newStatus });
        setSub({ ...sub, progress: newProgress, status: newStatus });
      }
      addToast('success', 'Stage saved');
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-content mx-auto">
        <div className="skeleton h-10 w-1/3 mb-4" />
        <div className="skeleton h-48 mb-3" />
        <div className="skeleton h-72" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="p-6 md:p-10 max-w-content mx-auto">
        <p className="text-sm text-text-muted">Sub project not found.</p>
        <Link href="/sub-projects" className="text-sm text-primary mt-2 inline-block">
          ← Back to sub projects
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <Link
        href={major ? `/sub-projects?major=${major.id}` : '/sub-projects'}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary mb-4"
      >
        <ArrowLeft size={14} />
        Back
      </Link>

      <PageHeader
        title={sub.projectName}
        subtitle={major ? `${major.projectName} · ${sub.equipmentGroup} · ${sub.source}` : sub.equipmentGroup}
        action={<StatusPill status={sub.status} />}
      />

      {/* Summary card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryStat label="PIC" value={userName(sub.picId)} />
        <SummaryStat label="Category" value={sub.category} />
        <SummaryStat label="Plan Start" value={formatDate(sub.plannedStart)} mono />
        <SummaryStat label="Plan End" value={formatDate(sub.plannedEnd)} mono />
        <SummaryStat label="Actual Start" value={formatDate(sub.actualStart)} mono />
        <SummaryStat label="Actual End" value={formatDate(sub.actualEnd)} mono />
        <SummaryStat
          label="Planned Duration"
          value={`${planDuration(sub.plannedStart, sub.plannedEnd)} d`}
          mono
        />
        <SummaryStat label="Progress" value={`${Math.round(sub.progress)}%`} mono />
      </div>

      {/* Gantt timeline (plan dotted, actual solid) */}
      <div className="mb-6">
        <StageGantt stages={stages} />
      </div>

      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Stage Schedule</h3>
          <p className="text-xs text-text-muted">Durations auto-calculate from start/end dates</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-elevated">
              <tr className="text-left">
                <th className="w-8" />
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Stage</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Plan Start</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Plan End</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Pl. Dur</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Actual Start</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Actual End</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Act. Dur</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Remarks</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {stages.map((st) => {
                const cps = checkpointsByStage[st.id] ?? [];
                const doneCount = cps.filter((c) => c.done).length;
                const isOpen = !!expanded[st.id];
                const colSpan = canEdit ? 11 : 10;
                return (
                  <Fragment key={st.id}>
                    <StageRowEditable
                      stage={st}
                      canEdit={!!canEdit}
                      saving={saving === st.id}
                      expanded={isOpen}
                      onToggleExpand={() => toggleExpand(st.id)}
                      checkpointCount={cps.length}
                      checkpointDoneCount={doneCount}
                      onSave={(patch) => handleStageSave(st, patch)}
                    />
                    {isOpen && (
                      <tr className="bg-elevated/30">
                        <td />
                        <td colSpan={colSpan - 1} className="px-4 py-3">
                          <StageCheckpoints
                            stageId={st.id}
                            checkpoints={cps}
                            canEdit={!!canEdit}
                            onChange={(next) => handleCheckpointsChange(st.id, next)}
                            onError={(msg) => addToast('error', msg)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">{label}</p>
      <p className={`text-sm font-semibold text-text-primary mt-1 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function StageRowEditable({
  stage,
  canEdit,
  saving,
  expanded,
  onToggleExpand,
  checkpointCount,
  checkpointDoneCount,
  onSave,
}: {
  stage: StageSchedule;
  canEdit: boolean;
  saving: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  checkpointCount: number;
  checkpointDoneCount: number;
  onSave: (patch: Partial<StageSchedule>) => void;
}) {
  const [planStart, setPlanStart] = useState(stage.planStart ?? '');
  const [planEnd, setPlanEnd] = useState(stage.planEnd ?? '');
  const [actualStart, setActualStart] = useState(stage.actualStart ?? '');
  const [actualEnd, setActualEnd] = useState(stage.actualEnd ?? '');
  const [status, setStatus] = useState<Status>(stage.status);
  const [remarks, setRemarks] = useState(stage.remarks ?? '');

  useEffect(() => {
    setPlanStart(stage.planStart ?? '');
    setPlanEnd(stage.planEnd ?? '');
    setActualStart(stage.actualStart ?? '');
    setActualEnd(stage.actualEnd ?? '');
    setStatus(stage.status);
    setRemarks(stage.remarks ?? '');
  }, [stage]);

  const planDur = planDuration(planStart, planEnd);
  const actDur = planDuration(actualStart, actualEnd);

  const dirty =
    planStart !== (stage.planStart ?? '') ||
    planEnd !== (stage.planEnd ?? '') ||
    actualStart !== (stage.actualStart ?? '') ||
    actualEnd !== (stage.actualEnd ?? '') ||
    status !== stage.status ||
    remarks !== (stage.remarks ?? '');

  return (
    <tr className="border-t border-border hover:bg-elevated/50 transition-colors">
      <td className="pl-2 pr-0">
        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1 rounded-md hover:bg-elevated text-text-muted hover:text-primary transition-colors"
          aria-label={expanded ? 'Collapse checkpoints' : 'Expand checkpoints'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-text-primary whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span>
            {stage.stageIndex + 1}. {stage.stageName}
          </span>
          {checkpointCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-elevated text-[10px] font-mono text-text-muted"
              title={`${checkpointDoneCount} of ${checkpointCount} checkpoints done`}
            >
              <ListChecks size={10} />
              {checkpointDoneCount}/{checkpointCount}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <input
          type="date"
          disabled={!canEdit}
          value={planStart}
          onChange={(e) => setPlanStart(e.target.value)}
          className="input-styled text-xs font-mono py-1"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="date"
          disabled={!canEdit}
          value={planEnd}
          onChange={(e) => setPlanEnd(e.target.value)}
          className="input-styled text-xs font-mono py-1"
        />
      </td>
      <td className="px-3 py-3 text-xs font-mono text-text-secondary text-center">{planDur || '-'}</td>
      <td className="px-3 py-3">
        <input
          type="date"
          disabled={!canEdit}
          value={actualStart}
          onChange={(e) => setActualStart(e.target.value)}
          className="input-styled text-xs font-mono py-1"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="date"
          disabled={!canEdit}
          value={actualEnd}
          onChange={(e) => setActualEnd(e.target.value)}
          className="input-styled text-xs font-mono py-1"
        />
      </td>
      <td className="px-3 py-3 text-xs font-mono text-text-secondary text-center">{actDur || '-'}</td>
      <td className="px-3 py-3">
        <select
          disabled={!canEdit}
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="select-styled text-xs py-1"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3 min-w-[160px]">
        <input
          disabled={!canEdit}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="-"
          className="input-styled text-xs py-1"
        />
      </td>
      {canEdit && (
        <td className="px-3 py-3">
          <button
            onClick={() =>
              onSave({
                planStart: planStart || undefined,
                planEnd: planEnd || undefined,
                actualStart: actualStart || undefined,
                actualEnd: actualEnd || undefined,
                status,
                remarks: remarks.trim() || undefined,
              })
            }
            disabled={!dirty || saving}
            className={`p-1.5 rounded-lg transition-colors ${
              dirty ? 'text-primary hover:bg-primary-light' : 'text-text-muted opacity-50 cursor-not-allowed'
            }`}
            aria-label="Save"
          >
            <Save size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}
