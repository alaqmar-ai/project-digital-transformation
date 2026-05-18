'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import { isAdmin } from '@/lib/types';
import { listHolidays, createHoliday, deleteHoliday, listActivity, listUsers } from '@/lib/data/store';
import type { Holiday, HolidayKind, ActivityLog, User } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function SettingsPage() {
  const { user, addToast } = useApp();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HolidayKind>('Public Holiday');
  const [saving, setSaving] = useState(false);

  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [activityUsers, setActivityUsers] = useState<User[]>([]);

  const reload = async () => {
    setLoading(true);
    const [hs, ac, us] = await Promise.all([listHolidays(), listActivity(50), listUsers()]);
    setHolidays(hs);
    setActivity(ac);
    setActivityUsers(us);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const userName = (id?: string) => activityUsers.find((u) => u.id === id)?.name ?? '-';

  const add = async () => {
    if (!date || !name.trim()) return;
    setSaving(true);
    try {
      await createHoliday({ date, name: name.trim(), kind });
      setDate('');
      setName('');
      addToast('success', 'Holiday added');
      await reload();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteHoliday(id);
      addToast('success', 'Holiday removed');
      await reload();
    } catch (e) {
      addToast('error', (e as Error).message);
    }
  };

  if (!isAdmin(user)) {
    return (
      <div className="p-6 md:p-10 max-w-content mx-auto">
        <PageHeader title="Settings" />
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-text-muted">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader title="Settings" subtitle="Manage public holidays and system preferences" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1 bg-white border border-border rounded-2xl shadow-card p-5 h-fit">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-primary" />
            Add holiday
          </h3>
          <div className="space-y-3">
            <input type="date" className="input-styled" value={date} onChange={(e) => setDate(e.target.value)} />
            <input
              type="text"
              className="input-styled"
              placeholder="Name (e.g. Hari Raya)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select className="select-styled w-full" value={kind} onChange={(e) => setKind(e.target.value as HolidayKind)}>
              <option value="Public Holiday">Public Holiday</option>
              <option value="Annual Leave Deduction">Annual Leave Deduction</option>
            </select>
            <button onClick={add} disabled={saving || !date || !name.trim()} className="btn-primary w-full inline-flex items-center justify-center gap-2">
              <Plus size={14} /> {saving ? 'Adding…' : 'Add holiday'}
            </button>
          </div>
        </div>

        <div className="md:col-span-2 bg-white border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Holiday calendar</h3>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-10" />
              ))}
            </div>
          ) : holidays.length === 0 ? (
            <p className="p-10 text-sm text-text-muted text-center">No holidays defined yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left bg-elevated">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase text-text-secondary">Date</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase text-text-secondary">Name</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase text-text-secondary">Kind</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="px-5 py-3 font-mono text-sm">{formatDate(h.date)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-text-primary">{h.name}</td>
                    <td className="px-3 py-3 text-xs">
                      <span className={`pill ${h.kind === 'Public Holiday' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-violet-50 text-violet-700 border border-violet-100'}`}>
                        {h.kind}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => remove(h.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-red-50 rounded-lg" aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div className="mt-6 bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Recent activity</h3>
          <p className="text-xs text-text-muted mt-0.5">Last 50 changes across projects, stages and attendance.</p>
        </div>
        {activity.length === 0 ? (
          <p className="p-8 text-sm text-text-muted text-center">No activity recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-elevated">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Time</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">User</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Action</th>
                <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">Ref</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-5 py-2.5 text-xs font-mono text-text-muted whitespace-nowrap">
                    {formatDateTime(a.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-primary">{userName(a.userId)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="pill bg-primary-light text-primary border border-primary/10">{a.action}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted font-mono truncate max-w-xs">
                    {a.refType ? `${a.refType}/${(a.refId ?? '').slice(0, 12)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
