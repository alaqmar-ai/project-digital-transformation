'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { StageCheckpoint } from '@/lib/types';
import {
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
} from '@/lib/data/store';

interface Props {
  stageId: string;
  checkpoints: StageCheckpoint[];
  canEdit: boolean;
  onChange: (next: StageCheckpoint[]) => void;
  onError: (msg: string) => void;
}

export default function StageCheckpoints({
  stageId,
  checkpoints,
  canEdit,
  onChange,
  onError,
}: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const handleAdd = async () => {
    const label = draft.trim();
    if (!label) return;
    setBusy('add');
    try {
      const created = await createCheckpoint({
        stageId,
        label,
        sortOrder: checkpoints.length,
      });
      onChange([...checkpoints, created]);
      setDraft('');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (cp: StageCheckpoint) => {
    setBusy(cp.id);
    try {
      const updated = await updateCheckpoint(cp.id, { done: !cp.done });
      onChange(checkpoints.map((c) => (c.id === cp.id ? updated : c)));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (cp: StageCheckpoint) => {
    setBusy(cp.id);
    try {
      await deleteCheckpoint(cp.id);
      onChange(checkpoints.filter((c) => c.id !== cp.id));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const done = checkpoints.filter((c) => c.done).length;
  const total = checkpoints.length;

  return (
    <div className="bg-elevated/60 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Checkpoints
        </h4>
        {total > 0 && (
          <span className="text-[10px] font-mono text-text-muted">
            {done}/{total} done
          </span>
        )}
      </div>

      {checkpoints.length === 0 && (
        <p className="text-xs text-text-muted italic mb-2">No checkpoints yet.</p>
      )}

      <ul className="space-y-1.5 mb-2">
        {checkpoints.map((cp) => (
          <li key={cp.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={cp.done}
              disabled={!canEdit || busy === cp.id}
              onChange={() => handleToggle(cp)}
              className="w-4 h-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
            />
            <span
              className={`text-xs flex-1 ${
                cp.done ? 'line-through text-text-muted' : 'text-text-primary'
              }`}
            >
              {cp.label}
            </span>
            {canEdit && (
              <button
                type="button"
                disabled={busy === cp.id}
                onClick={() => handleDelete(cp)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-600 disabled:opacity-50"
                aria-label="Delete checkpoint"
              >
                {busy === cp.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a checkpoint…"
            disabled={busy === 'add'}
            className="input-styled text-xs py-1 flex-1"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim() || busy === 'add'}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add
          </button>
        </div>
      )}
    </div>
  );
}
