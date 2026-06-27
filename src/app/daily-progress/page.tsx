'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
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
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Monday of the week containing `d`. */
function mondayOf(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DailyProgressPage() {
  const { user, addToast } = useApp();
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const today = todayIso();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

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

  // Mon–Fri dates of the displayed week.
  const weekDays = useMemo(() => {
    return WEEKDAYS.map((name, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return { name, iso: isoOf(d), dayNum: d.getDate(), month: MONTHS[d.getMonth()] };
    });
  }, [weekStart]);

  const weekIsoSet = useMemo(() => new Set(weekDays.map((d) => d.iso)), [weekDays]);

  // Group todos by due date; anything undated (or outside this week) lands in Unscheduled.
  const byDay = useMemo(() => {
    const map = new Map<string, DailyTodo[]>();
    weekDays.forEach((d) => map.set(d.iso, []));
    const unscheduled: DailyTodo[] = [];
    todos.forEach((t) => {
      if (t.dueDate && weekIsoSet.has(t.dueDate)) map.get(t.dueDate)!.push(t);
      else unscheduled.push(t);
    });
    const sort = (a: DailyTodo, b: DailyTodo) =>
      Number(a.done) - Number(b.done) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
    map.forEach((arr) => arr.sort(sort));
    unscheduled.sort(sort);
    return { map, unscheduled };
  }, [todos, weekDays, weekIsoSet]);

  const weekLabel = useMemo(() => {
    const fri = new Date(weekStart);
    fri.setDate(weekStart.getDate() + 4);
    const sameMonth = weekStart.getMonth() === fri.getMonth();
    return sameMonth
      ? `${weekStart.getDate()} – ${fri.getDate()} ${MONTHS[fri.getMonth()]} ${fri.getFullYear()}`
      : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${fri.getDate()} ${MONTHS[fri.getMonth()]}`;
  }, [weekStart]);

  const shiftWeek = (deltaDays: number) =>
    setWeekStart((w) => {
      const n = new Date(w);
      n.setDate(w.getDate() + deltaDays);
      return n;
    });

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  const addTask = async (label: string, dueIso: string | null) => {
    const text = label.trim();
    if (!text || !user?.id) return;
    try {
      const created = await createDailyTodo({
        userId: user.id,
        label: text,
        dueDate: dueIso ?? undefined,
        sortOrder: todos.length,
      });
      setTodos((prev) => [...prev, created]);
    } catch (e) {
      addToast('error', (e as Error).message);
    }
  };

  const toggle = async (todo: DailyTodo) => {
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

  const remove = async (todo: DailyTodo) => {
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

  const reschedule = async (id: string, dueIso: string | null) => {
    const cur = todos.find((t) => t.id === id);
    if (!cur || (cur.dueDate ?? null) === dueIso) return;
    // Optimistic
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, dueDate: dueIso ?? undefined } : t)));
    try {
      await updateDailyTodo(id, { dueDate: dueIso });
    } catch (e) {
      addToast('error', (e as Error).message);
      // Revert
      setTodos((prev) => prev.map((t) => (t.id === id ? cur : t)));
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader
        title="Daily Progress"
        subtitle="Your week at a glance — drag tasks between days to reschedule"
      />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="p-2 rounded-lg border border-border bg-white hover:bg-elevated text-text-secondary"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="p-2 rounded-lg border border-border bg-white hover:bg-elevated text-text-secondary"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-1 text-sm font-semibold text-text-primary">{weekLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(mondayOf(new Date()))}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-elevated text-text-secondary"
        >
          This week
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {weekDays.map((d) => (
            <DayColumn
              key={d.iso}
              title={d.name}
              dateLabel={`${d.dayNum} ${d.month}`}
              isToday={d.iso === today}
              todos={byDay.map.get(d.iso) ?? []}
              busy={busy}
              today={today}
              onAdd={(label) => addTask(label, d.iso)}
              onToggle={toggle}
              onDelete={remove}
              onDropTask={(id) => reschedule(id, d.iso)}
            />
          ))}
          <DayColumn
            title="Unscheduled"
            dateLabel="No date"
            isToday={false}
            todos={byDay.unscheduled}
            busy={busy}
            today={today}
            onAdd={(label) => addTask(label, null)}
            onToggle={toggle}
            onDelete={remove}
            onDropTask={(id) => reschedule(id, null)}
            muted
          />
        </div>
      )}
    </div>
  );
}

function DayColumn({
  title,
  dateLabel,
  isToday,
  todos,
  busy,
  today,
  onAdd,
  onToggle,
  onDelete,
  onDropTask,
  muted,
}: {
  title: string;
  dateLabel: string;
  isToday: boolean;
  todos: DailyTodo[];
  busy: string | null;
  today: string;
  onAdd: (label: string) => void;
  onToggle: (t: DailyTodo) => void;
  onDelete: (t: DailyTodo) => void;
  onDropTask: (id: string) => void;
  muted?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const submit = () => {
    if (draft.trim()) onAdd(draft);
    setDraft('');
    setAdding(false);
  };

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-baseline gap-2 px-1 mb-2">
        <h3 className={cn('text-sm font-bold', isToday ? 'text-primary' : muted ? 'text-text-muted' : 'text-text-primary')}>
          {dateLabel}
        </h3>
        <span className={cn('text-xs font-medium', muted ? 'text-text-muted' : 'text-text-secondary')}>{title}</span>
        <span className="ml-auto text-[11px] font-mono text-text-muted">{todos.length}</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData('text/plain');
          if (id) onDropTask(id);
        }}
        className={cn(
          'flex-1 min-h-[8rem] rounded-2xl border p-2 space-y-2 transition-colors',
          dragOver ? 'border-primary bg-primary-light/40' : 'border-border bg-elevated/30',
          isToday && !dragOver && 'border-primary/40'
        )}
      >
        {todos.map((t) => (
          <TaskCard
            key={t.id}
            todo={t}
            busy={busy === t.id}
            overdue={!t.done && !!t.dueDate && t.dueDate < today}
            onToggle={() => onToggle(t)}
            onDelete={() => onDelete(t)}
          />
        ))}

        {adding ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                setDraft('');
                setAdding(false);
              }
            }}
            placeholder="Task name…"
            className="input-styled text-sm py-2 w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-text-muted hover:text-primary hover:bg-white transition-colors"
          >
            <Plus size={14} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({
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
    <div
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', todo.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group bg-white border border-border rounded-xl px-3 py-2.5 flex items-start gap-2.5 shadow-card hover:shadow-elevated transition-all cursor-grab active:cursor-grabbing',
        todo.done && 'bg-elevated/40',
        overdue && 'border-red-200'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={cn(
          'flex-shrink-0 mt-0.5 transition-colors',
          todo.done ? 'text-emerald-600' : 'text-text-muted hover:text-primary',
          busy && 'opacity-50'
        )}
        aria-label={todo.done ? 'Reopen' : 'Mark complete'}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : todo.done ? (
          <CheckCircle2 size={18} />
        ) : (
          <Circle size={18} />
        )}
      </button>

      <span
        className={cn(
          'flex-1 text-sm leading-snug break-words',
          todo.done ? 'line-through text-text-muted' : 'text-text-primary'
        )}
      >
        {todo.label}
      </span>

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 rounded hover:bg-red-50 text-text-muted hover:text-red-600 disabled:opacity-50"
        aria-label="Delete"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
