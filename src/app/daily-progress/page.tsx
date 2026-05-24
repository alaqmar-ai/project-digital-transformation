'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import {
  listDailyTodos,
  createDailyTodo,
  updateDailyTodo,
  deleteDailyTodo,
} from '@/lib/data/store';
import type { DailyTodo } from '@/lib/types';
import { todayIso } from '@/lib/status';
import { formatDate, cn } from '@/lib/utils';

export default function DailyProgressPage() {
  const { user, addToast } = useApp();
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftDue, setDraftDue] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listDailyTodos(user.id);
        if (!cancelled) setTodos(list);
      } catch (e) {
        if (!cancelled) addToast('error', (e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, addToast]);

  const today = todayIso();

  const { open, done } = useMemo(() => {
    return {
      open: todos.filter((t) => !t.done),
      done: todos.filter((t) => t.done),
    };
  }, [todos]);

  const overdueCount = useMemo(
    () => open.filter((t) => t.dueDate && t.dueDate < today).length,
    [open, today]
  );

  const handleAdd = async () => {
    const label = draftLabel.trim();
    if (!label || !user?.id) return;
    setBusy('add');
    try {
      const created = await createDailyTodo({
        userId: user.id,
        label,
        dueDate: draftDue || undefined,
        sortOrder: todos.length,
      });
      setTodos((prev) => [...prev, created]);
      setDraftLabel('');
      setDraftDue('');
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (todo: DailyTodo) => {
    setBusy(todo.id);
    try {
      const updated = await updateDailyTodo(todo.id, { done: !todo.done });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (todo: DailyTodo) => {
    setBusy(todo.id);
    try {
      await deleteDailyTodo(todo.id);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <PageHeader
        title="Daily Progress"
        subtitle="Your personal todo list - add anything you're working on today"
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatTile label="Open" value={open.length} tone="blue" icon={<Circle size={16} />} />
        <StatTile label="Overdue" value={overdueCount} tone="red" icon={<Calendar size={16} />} />
        <StatTile label="Done" value={done.length} tone="green" icon={<CheckSquare size={16} />} />
      </div>

      {/* Add new */}
      <div className="bg-white border border-border rounded-2xl shadow-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="What needs to get done?"
            disabled={busy === 'add'}
            className="input-styled text-sm py-2 flex-1"
          />
          <input
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            disabled={busy === 'add'}
            className="input-styled text-sm py-2 font-mono w-full sm:w-44"
            title="Optional due date"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draftLabel.trim() || busy === 'add'}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Section
            title="To do"
            count={open.length}
            empty="Nothing on your list - add something above."
            todos={open}
            busy={busy}
            today={today}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />

          {done.length > 0 && (
            <div className="mt-8">
              <Section
                title="Done"
                count={done.length}
                empty=""
                todos={done}
                busy={busy}
                today={today}
                onToggle={handleToggle}
                onDelete={handleDelete}
                muted
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  todos,
  busy,
  today,
  onToggle,
  onDelete,
  muted,
}: {
  title: string;
  count: number;
  empty: string;
  todos: DailyTodo[];
  busy: string | null;
  today: string;
  onToggle: (t: DailyTodo) => void;
  onDelete: (t: DailyTodo) => void;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className={cn('text-xs font-bold uppercase tracking-wider', muted ? 'text-text-muted' : 'text-text-secondary')}>
          {title}
        </h3>
        <span className="text-[10px] font-mono text-text-muted">{count}</span>
      </div>
      {todos.length === 0 ? (
        empty && <p className="text-sm text-text-muted italic px-1 py-3">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              busy={busy === t.id}
              overdue={!t.done && !!t.dueDate && t.dueDate < today}
              onToggle={() => onToggle(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  busy,
  overdue,
  onToggle,
  onDelete,
}: {
  todo: DailyTodo;
  busy: boolean;
  overdue: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        'group bg-white border border-border rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-card hover:shadow-elevated transition-all',
        todo.done && 'bg-elevated/40'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={cn(
          'flex-shrink-0 transition-colors',
          todo.done ? 'text-emerald-600' : 'text-text-muted hover:text-primary',
          busy && 'opacity-50'
        )}
        aria-label={todo.done ? 'Reopen' : 'Mark complete'}
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin" />
        ) : todo.done ? (
          <CheckCircle2 size={20} />
        ) : (
          <Circle size={20} />
        )}
      </button>

      <span
        className={cn(
          'flex-1 text-sm leading-snug',
          todo.done ? 'line-through text-text-muted' : 'text-text-primary'
        )}
      >
        {todo.label}
      </span>

      {todo.dueDate && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md',
            overdue
              ? 'bg-red-50 text-danger'
              : todo.done
                ? 'bg-elevated text-text-muted'
                : 'bg-primary-light text-primary'
          )}
        >
          <Calendar size={10} />
          {formatDate(todo.dueDate)}
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-600 disabled:opacity-50"
        aria-label="Delete"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'red' | 'green';
  icon: React.ReactNode;
}) {
  const map = {
    blue: 'bg-primary-light text-primary',
    red: 'bg-red-50 text-danger',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white border border-border rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${map[tone]}`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-text-primary font-mono">{value}</p>
    </div>
  );
}
