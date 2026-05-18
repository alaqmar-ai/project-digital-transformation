/**
 * Notification engine - scans projects and emits 14/7/3/2/1-day lead-time
 * alerts and delay escalations. Runs on app load and is idempotent (we
 * keep a "fired" log keyed by stage+lead so the same lead is never
 * notified twice).
 */

import { NOTIFICATION_LEAD_DAYS } from './constants';
import {
  listMajorProjects,
  listSubProjects,
  listStages,
  createNotification,
  listUsers,
} from './data/store';
import type { User } from './types';
import { daysUntil, deriveStageStatus, todayIso } from './status';

const FIRED_KEY = 'epms_notif_fired_v2';

function uniq<T>(arr: T[]): T[] {
  const out: T[] = [];
  for (const x of arr) if (out.indexOf(x) === -1) out.push(x);
  return out;
}

function loadFired(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveFired(set: Set<string>) {
  if (typeof window === 'undefined') return;
  const arr: string[] = [];
  set.forEach((v) => arr.push(v));
  localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
}

export async function runNotificationScan(): Promise<number> {
  const today = todayIso();
  const fired = loadFired();
  let fresh = 0;

  const [majors, subs, users] = await Promise.all([
    listMajorProjects(),
    listSubProjects(),
    listUsers(),
  ]);
  const admins: User[] = users.filter((u) => u.role === 'ADMIN');
  const userById = new Map(users.map((u) => [u.id, u]));
  const majorById = new Map(majors.map((m) => [m.id, m]));

  for (const sub of subs) {
    const stages = await listStages(sub.id);
    const pic = userById.get(sub.picId);
    const major = majorById.get(sub.majorProjectId);

    for (const stage of stages) {
      if (!stage.planEnd) continue;
      if (stage.status === 'Completed' || stage.status === 'Cancelled') continue;

      const days = daysUntil(stage.planEnd);

      // Lead-time alerts (14/7/3/2/1)
      for (const lead of NOTIFICATION_LEAD_DAYS) {
        if (days === lead) {
          const recipientIds = uniq([sub.picId, ...admins.map((a) => a.id)]);
          for (const rid of recipientIds) {
            const key = `lead:${stage.id}:${lead}:${rid}`;
            if (fired.has(key)) continue;
            fired.add(key);
            fresh++;
            await createNotification({
              userId: rid,
              kind: 'stage_lead_time',
              title: `${lead} day${lead === 1 ? '' : 's'} until "${stage.stageName}" deadline`,
              body: `${sub.projectName}${major ? ` (${major.projectName})` : ''} - PIC ${pic?.name ?? 'unassigned'}, due ${stage.planEnd}.`,
              refType: 'stage',
              refId: stage.id,
            });
          }
        }
      }

      // Delay escalation - once per stage
      const derived = deriveStageStatus({
        status: stage.status,
        planEnd: stage.planEnd,
        actualEnd: stage.actualEnd,
      });
      if (derived === 'Delayed') {
        const recipientIds = uniq([sub.picId, ...admins.map((a) => a.id)]);
        for (const rid of recipientIds) {
          const key = `delay:${stage.id}:${today}:${rid}`;
          if (fired.has(key)) continue;
          fired.add(key);
          fresh++;
          await createNotification({
            userId: rid,
            kind: 'stage_delayed',
            title: `Delayed: ${stage.stageName}`,
            body: `${sub.projectName}${major ? ` (${major.projectName})` : ''} - was due ${stage.planEnd}, still not complete.`,
            refType: 'stage',
            refId: stage.id,
          });
        }
      }
    }
  }

  saveFired(fired);
  return fresh;
}
