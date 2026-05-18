'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, ClipboardCheck } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import { useUsers } from '@/hooks/useUsers';
import {
  ATTENDANCE_WEEKDAY,
  ATTENDANCE_WEEKEND,
  ATTENDANCE_COLORS,
} from '@/lib/constants';
import {
  listAttendance,
  listHolidays,
  upsertAttendance,
  deleteAttendance,
} from '@/lib/data/store';
import type { AttendanceRecord, Holiday } from '@/lib/types';
import { canEditAttendance } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function isoDate(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function AttendancePage() {
  const { user } = useApp();
  const { data: users } = useUsers();
  const today = new Date();
  const canEdit = canEditAttendance(user);
  const [tab, setTab] = useState<'calendar' | 'today'>('calendar');
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ date: string; userId: string } | null>(null);

  // default selectedUser to current user (or first user for admin)
  useEffect(() => {
    if (!selectedUser && user) {
      setSelectedUser(user.id);
    }
  }, [user, selectedUser]);

  const reload = async () => {
    setLoading(true);
    const [recs, hols] = await Promise.all([
      listAttendance({ year, monthIndex }, selectedUser || undefined),
      listHolidays(),
    ]);
    setRecords(recs);
    setHolidays(hols);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedUser) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, monthIndex, selectedUser]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((r) => map.set(r.date, r));
    return map;
  }, [records]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const startWeekday = monthStart.getDay(); // 0=Sun
  const daysInMonth = monthEnd.getDate();

  const cells: Array<{ day?: number; date?: string; weekday?: number }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    cells.push({ day: d, date: isoDate(year, monthIndex, d), weekday: dt.getDay() });
  }

  const monthLabel = `${MONTHS[monthIndex]} ${year}`;

  const goPrev = () => {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear(year - 1);
    } else setMonthIndex(monthIndex - 1);
  };
  const goNext = () => {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear(year + 1);
    } else setMonthIndex(monthIndex + 1);
  };

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [records]);

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Attendance"
        subtitle={
          canEdit
            ? tab === 'calendar'
              ? 'Browse and edit any day in any month.'
              : "Mark today's attendance for every staff member in one place."
            : 'View your attendance record.'
        }
        action={
          canEdit && (
            <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-card">
              <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<CalendarDays size={14} />}>
                Calendar
              </TabButton>
              <TabButton active={tab === 'today'} onClick={() => setTab('today')} icon={<ClipboardCheck size={14} />}>
                Mark today
              </TabButton>
            </div>
          )
        }
      />

      {canEdit && tab === 'today' ? (
        <MarkTodayPanel
          users={users}
          holidays={holidays}
          onChanged={() => {
            if (selectedUser) {
              listAttendance({ year, monthIndex }, selectedUser).then(setRecords);
            }
          }}
        />
      ) : (
      <>
      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="btn-ghost p-2" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-lg font-bold text-text-primary min-w-[150px] text-center">{monthLabel}</h2>
            <button onClick={goNext} className="btn-ghost p-2" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          {canEdit && (
            <select
              className="select-styled"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-[11px] font-semibold uppercase tracking-wide text-text-muted text-center py-1">
                  {d}
                </div>
              ))}
              {cells.map((c, idx) => {
                if (!c.date) return <div key={idx} />;
                const rec = recordByDate.get(c.date);
                const hol = holidayByDate.get(c.date);
                const isWeekend = c.weekday === 0 || c.weekday === 6;
                const tone = rec ? ATTENDANCE_COLORS[rec.status] : isWeekend ? '#F3F4F6' : hol ? '#FEF9C3' : '#FFFFFF';
                const isToday = c.date === isoDate(today.getFullYear(), today.getMonth(), today.getDate());

                return (
                  <button
                    key={idx}
                    disabled={!selectedUser || !canEdit}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditing({ date: c.date!, userId: selectedUser });
                    }}
                    className={`relative aspect-square rounded-xl border p-2 text-left transition-all ${
                      canEdit ? 'hover:ring-2 hover:ring-primary/30 cursor-pointer' : 'cursor-default'
                    } ${isToday ? 'border-primary' : 'border-border'}`}
                    style={{ background: tone }}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-text-primary'}`}>{c.day}</span>
                      {hol && <span className="text-[8px] font-bold text-amber-700 uppercase">Holiday</span>}
                    </div>
                    {rec && (
                      <p className="text-[10px] text-text-secondary font-medium leading-tight mt-1 line-clamp-2">
                        {rec.status}
                      </p>
                    )}
                    {!rec && isWeekend && <p className="text-[10px] text-text-muted mt-1">Weekend</p>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Summary + legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-border rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Month summary</h3>
          {Object.keys(summary).length === 0 ? (
            <p className="text-xs text-text-muted">No records this month.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(summary)
                .sort((a, b) => b[1] - a[1])
                .map(([status, n]) => (
                  <div key={status} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: ATTENDANCE_COLORS[status] }}>
                    <span className="font-medium text-text-primary">{status}</span>
                    <span className="font-mono font-bold text-text-primary">{n}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Legend</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[...ATTENDANCE_WEEKDAY, ...ATTENDANCE_WEEKEND].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: ATTENDANCE_COLORS[s] }} />
                <span className="text-xs text-text-secondary">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-100" />
              <span className="text-xs text-text-secondary">Public Holiday</span>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      <AttendanceEditModal
        editing={editing}
        canEdit={canEdit}
        onClose={() => setEditing(null)}
        onSaved={reload}
        weekday={editing ? new Date(editing.date).getDay() : 0}
        isHoliday={!!editing && holidayByDate.has(editing.date)}
        existing={editing ? recordByDate.get(editing.date) : undefined}
      />
    </div>
  );
}

function AttendanceEditModal({
  editing,
  canEdit,
  onClose,
  onSaved,
  weekday,
  isHoliday,
  existing,
}: {
  editing: { date: string; userId: string } | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  weekday: number;
  isHoliday: boolean;
  existing?: AttendanceRecord;
}) {
  const { user, addToast } = useApp();
  const [status, setStatus] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(existing?.status ?? '');
    setRemarks(existing?.remarks ?? '');
  }, [editing, existing]);

  if (!editing) return null;

  const isWeekend = weekday === 0 || weekday === 6;
  const options = isWeekend
    ? [...ATTENDANCE_WEEKEND]
    : isHoliday
    ? ['Holiday Job']
    : [...ATTENDANCE_WEEKDAY];

  const save = async () => {
    if (!status || !user) return;
    setBusy(true);
    try {
      await upsertAttendance({
        userId: editing.userId,
        date: editing.date,
        status: status as AttendanceRecord['status'],
        remarks: remarks.trim() || undefined,
        recordedBy: user.id,
      });
      addToast('success', 'Attendance saved');
      onSaved();
      onClose();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteAttendance(existing.id);
      addToast('success', 'Attendance cleared');
      onSaved();
      onClose();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!editing} onClose={onClose} title={`Attendance - ${formatDate(editing.date)}`} size="sm">
      <div className="space-y-4">
        <div className="text-xs text-text-muted">
          {isWeekend ? 'Weekend day - only "Weekend Job" is allowed.' : isHoliday ? 'Public holiday - only "Holiday Job" is allowed.' : 'Weekday'}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Status</label>
          <select
            className="select-styled w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">- None -</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Remarks</label>
          <textarea
            className="input-styled min-h-[60px]"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="flex justify-end gap-2">
          {existing && canEdit && (
            <button onClick={remove} disabled={busy} className="inline-flex items-center gap-2 btn-ghost text-danger">
              <Trash2 size={14} /> Clear
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">
            Close
          </button>
          {canEdit && (
            <button onClick={save} disabled={!status || busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
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
    </button>
  );
}

interface MarkTodayPanelProps {
  users: { id: string; name: string; role: string }[];
  holidays: Holiday[];
  onChanged: () => void;
}

function MarkTodayPanel({ users, holidays, onChanged }: MarkTodayPanelProps) {
  const { user, addToast } = useApp();
  const todayDate = new Date();
  const todayIsoStr = isoDate(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const weekday = todayDate.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const isHoliday = holidays.some((h) => h.date === todayIsoStr);

  const options = isWeekend
    ? ATTENDANCE_WEEKEND
    : isHoliday
    ? (['Holiday Job'] as readonly string[])
    : ATTENDANCE_WEEKDAY;

  const [rows, setRows] = useState<Record<string, { status: string; remarks: string; existingId?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const recs = await listAttendance({
        year: todayDate.getFullYear(),
        monthIndex: todayDate.getMonth(),
      });
      const byUser = new Map<string, AttendanceRecord>();
      recs.filter((r) => r.date === todayIsoStr).forEach((r) => byUser.set(r.userId, r));
      const next: Record<string, { status: string; remarks: string; existingId?: string }> = {};
      users.forEach((u) => {
        const existing = byUser.get(u.id);
        next[u.id] = {
          status: existing?.status ?? '',
          remarks: existing?.remarks ?? '',
          existingId: existing?.id,
        };
      });
      setRows(next);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length]);

  const save = async (uid: string) => {
    if (!user) return;
    const row = rows[uid];
    if (!row?.status) return;
    setBusy(uid);
    try {
      await upsertAttendance({
        userId: uid,
        date: todayIsoStr,
        status: row.status as AttendanceRecord['status'],
        remarks: row.remarks.trim() || undefined,
        recordedBy: user.id,
      });
      addToast('success', 'Saved');
      onChanged();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const clear = async (uid: string) => {
    const row = rows[uid];
    if (!row?.existingId) return;
    setBusy(uid);
    try {
      await deleteAttendance(row.existingId);
      setRows((prev) => ({ ...prev, [uid]: { status: '', remarks: '', existingId: undefined } }));
      addToast('success', 'Cleared');
      onChanged();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Mark today - {formatDate(todayIsoStr)}</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            {isWeekend ? 'Weekend - only "Weekend Job" is allowed.' : isHoliday ? 'Public holiday - only "Holiday Job" is allowed.' : 'Choose a status for each staff member.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-elevated">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Name</th>
              <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Status</th>
              <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Remarks</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const row = rows[u.id] ?? { status: '', remarks: '' };
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-5 py-2.5">
                    <p className="text-sm font-medium text-text-primary">{u.name}</p>
                    <p className="text-[10px] font-mono text-text-muted">{u.role}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      className="select-styled py-1 text-xs"
                      value={row.status}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [u.id]: { ...prev[u.id], status: e.target.value },
                        }))
                      }
                    >
                      <option value="">- None -</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      className="input-styled py-1 text-xs"
                      placeholder="Optional remarks"
                      value={row.remarks}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [u.id]: { ...prev[u.id], remarks: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {row.existingId && (
                      <button
                        onClick={() => clear(u.id)}
                        disabled={busy === u.id}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 mr-1"
                        aria-label="Clear"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => save(u.id)}
                      disabled={!row.status || busy === u.id}
                      className={cn(
                        'inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                        row.status ? 'bg-primary text-white hover:bg-blue-700' : 'bg-elevated text-text-muted cursor-not-allowed'
                      )}
                    >
                      {busy === u.id ? 'Saving…' : row.existingId ? 'Update' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
