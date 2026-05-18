'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { useSubProjects } from '@/hooks/useSubProjects';
import { useMajorProjects } from '@/hooks/useMajorProjects';
import { useUsers } from '@/hooks/useUsers';
import PageHeader from '@/components/ui/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import SubProjectModal from '@/components/SubProjectModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deleteSubProject } from '@/lib/data/store';
import { isAdmin, canDeleteProjects } from '@/lib/types';
import type { SubProject } from '@/lib/types';
import { EQUIPMENT_GROUPS, SOURCES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export default function SubProjectsPage() {
  const params = useSearchParams();
  const majorFilter = params.get('major') ?? '';
  const { user, addToast } = useApp();
  const { data: allSubs, loading, reload } = useSubProjects(majorFilter || undefined);
  const { data: majors } = useMajorProjects();
  const { data: users } = useUsers();

  // Staff only sees their own assigned sub-projects.
  const subs = useMemo(
    () => (isAdmin(user) ? allSubs : allSubs.filter((s) => s.picId === user?.id)),
    [allSubs, user]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [fGroup, setFGroup] = useState('');
  const [fSource, setFSource] = useState('');
  const [fPic, setFPic] = useState('');
  const [fStatus, setFStatus] = useState('');

  const majorName = useMemo(() => {
    const map = new Map(majors.map((m) => [m.id, m.projectName]));
    return (id: string) => map.get(id) ?? '-';
  }, [majors]);
  const userName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (id: string) => map.get(id) ?? '-';
  }, [users]);

  const filtered = useMemo(() => {
    return subs.filter(
      (s) =>
        (!fGroup || s.equipmentGroup === fGroup) &&
        (!fSource || s.source === fSource) &&
        (!fPic || s.picId === fPic) &&
        (!fStatus || s.status === fStatus)
    );
  }, [subs, fGroup, fSource, fPic, fStatus]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSubProject(deleteTarget.id);
      addToast('success', 'Sub project deleted');
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const activeMajor = majorFilter ? majors.find((m) => m.id === majorFilter) : null;

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Sub Projects"
        subtitle={
          activeMajor
            ? `Filtered to "${activeMajor.projectName}"`
            : 'Detailed projects under each major project'
        }
        action={
          isAdmin(user) && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} />
              New Sub Project
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 mb-5">
        <select className="select-styled" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
          <option value="">All Groups</option>
          {EQUIPMENT_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select className="select-styled" value={fSource} onChange={(e) => setFSource(e.target.value)}>
          <option value="">All Sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select-styled" value={fPic} onChange={(e) => setFPic(e.target.value)}>
          <option value="">All PICs</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select className="select-styled" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Pending', 'In Progress', 'Completed', 'Cancelled', 'Not Completed', 'Delayed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-elevated text-text-muted mb-3">
            <Layers size={22} />
          </div>
          <p className="text-sm text-text-primary font-medium">No sub projects yet</p>
          <p className="text-xs text-text-muted mt-1">
            {isAdmin(user)
              ? 'Click "New Sub Project" to add one.'
              : 'Sub projects assigned to you will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto data-table">
          <table className="w-full">
            <thead>
              <tr>
                <th>Project</th>
                <th>Major</th>
                <th>Group</th>
                <th>Source</th>
                <th>PIC</th>
                <th>Plan Start</th>
                <th>Plan End</th>
                <th>Progress</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/sub-projects/${s.id}`} className="font-medium text-text-primary hover:text-primary">
                      {s.projectName}
                    </Link>
                  </td>
                  <td className="text-text-secondary">{majorName(s.majorProjectId)}</td>
                  <td>{s.equipmentGroup}</td>
                  <td>{s.source}</td>
                  <td>{userName(s.picId)}</td>
                  <td className="font-mono text-xs">{s.plannedStart ? formatDate(s.plannedStart) : '-'}</td>
                  <td className="font-mono text-xs">{s.plannedEnd ? formatDate(s.plannedEnd) : '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, s.progress)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-text-secondary">{Math.round(s.progress)}%</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill status={s.status} />
                  </td>
                  <td>
                    {isAdmin(user) && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-light"
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {canDeleteProjects(user) && (
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50"
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SubProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          reload();
          addToast('success', editing ? 'Sub project updated' : 'Sub project created');
        }}
        existing={editing}
        defaultMajorId={majorFilter || undefined}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete sub project?"
        message={`"${deleteTarget?.projectName}" and all its stages will be permanently removed.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
