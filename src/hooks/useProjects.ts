'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, Stage } from '@/lib/types';
import { listSubProjects, listStagesForSubs, listUsers } from '@/lib/data/store';

function daysBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const d = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Legacy-shaped project list, now sourced from the Neon model
 * (sub-projects + stage schedules + users). The /gantt, /targets and /export
 * pages still consume the flat `Project` shape, so we adapt here instead of
 * rewriting each page.
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const subs = await listSubProjects();
      const [stages, users] = await Promise.all([
        listStagesForSubs(subs.map((s) => s.id)),
        listUsers(),
      ]);

      const nameById = new Map(users.map((u) => [u.id, u.name]));
      const stagesBySub = new Map<string, typeof stages>();
      for (const st of stages) {
        const arr = stagesBySub.get(st.subProjectId) ?? [];
        arr.push(st);
        stagesBySub.set(st.subProjectId, arr);
      }

      const mapped: Project[] = subs.map((sub) => {
        const stageList: Stage[] = (stagesBySub.get(sub.id) ?? [])
          .sort((a, b) => a.stageIndex - b.stageIndex)
          .map((st) => ({
            stageIndex: st.stageIndex,
            stageName: st.stageName,
            planStart: st.planStart ?? '',
            planFinish: st.planEnd ?? '',
            actualStart: st.actualStart ?? '',
            actualFinish: st.actualEnd ?? '',
            checked: st.status === 'Completed',
          }));
        return {
          id: sub.id,
          pic: nameById.get(sub.picId) ?? '',
          name: sub.projectName,
          code: sub.projectName,
          group: sub.equipmentGroup,
          source: sub.source,
          duration: daysBetween(sub.plannedStart, sub.plannedEnd),
          stages: stageList,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        };
      });

      setProjects(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, reload: load };
}
