'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, FolderOpen, Search } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { useMajorProjects } from '@/hooks/useMajorProjects';
import { useUsers } from '@/hooks/useUsers';
import PageHeader from '@/components/ui/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import MajorProjectModal from '@/components/MajorProjectModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deleteMajorProject, listSubProjects } from '@/lib/data/store';
import { canDeleteProjects, isAdmin } from '@/lib/types';
import type { MajorProject } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function MajorProjectsPage() {
  const { user, addToast } = useApp();
  const { data: allMajors, loading, reload } = useMajorProjects();
  const { data: users } = useUsers();
  const admin = isAdmin(user);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MajorProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MajorProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [myMajorIds, setMyMajorIds] = useState<Set<string> | null>(null);

  // For staff, determine which majors contain at least one sub-project they own.
  useEffect(() => {
    if (admin) {
      setMyMajorIds(null);
      return;
    }
    if (!user?.id) return;
    listSubProjects().then((sp) => {
      setMyMajorIds(new Set(sp.filter((s) => s.picId === user.id).map((s) => s.majorProjectId)));
    });
  }, [admin, user?.id]);

  const majors = useMemo(
    () => (admin || !myMajorIds ? allMajors : allMajors.filter((m) => myMajorIds.has(m.id))),
    [admin, allMajors, myMajorIds]
  );

  const ownerName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (id?: string) => (id ? map.get(id) ?? '-' : '-');
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return majors;
    return majors.filter(
      (m) =>
        m.projectName.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        ownerName(m.ownerId).toLowerCase().includes(q)
    );
  }, [majors, search, ownerName]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMajorProject(deleteTarget.id);
      addToast('success', 'Major project deleted');
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Major Projects"
        subtitle="Parent-level projects. Progress rolls up from sub-projects."
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
              New Major Project
            </button>
          )
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="input-styled pl-9"
          placeholder="Search name, owner, description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-elevated text-text-muted mb-3">
            <FolderOpen size={22} />
          </div>
          <p className="text-sm text-text-primary font-medium">No major projects yet</p>
          <p className="text-xs text-text-muted mt-1">
            {isAdmin(user) ? 'Click "New Major Project" to create one.' : 'Awaiting administrator setup.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-border rounded-2xl shadow-card hover:shadow-card-hover transition-all p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/sub-projects?major=${m.id}`}
                      className="text-base font-semibold text-text-primary hover:text-primary truncate"
                    >
                      {m.projectName}
                    </Link>
                    <StatusPill status={m.status} />
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 max-w-2xl">
                    {m.description ?? 'No description'}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                    <span>
                      <span className="text-text-muted">Owner:</span> {ownerName(m.ownerId)}
                    </span>
                    <span>
                      <span className="text-text-muted">Created:</span>{' '}
                      {formatDate(m.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                      Progress
                    </p>
                    <p className="text-lg font-bold text-text-primary font-mono">
                      {Math.round(m.overallProgress)}%
                    </p>
                  </div>
                  {isAdmin(user) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditing(m);
                          setModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary-light transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      {canDeleteProjects(user) && (
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 h-2 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full bg-primary progress-fill"
                  style={{ width: `${Math.min(100, m.overallProgress)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <MajorProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          reload();
          addToast('success', editing ? 'Project updated' : 'Project created');
        }}
        existing={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete major project?"
        message={`"${deleteTarget?.projectName}" and all its sub-projects and stages will be permanently removed.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
