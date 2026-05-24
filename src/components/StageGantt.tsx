'use client';

import { useMemo } from 'react';
import type { StageSchedule } from '@/lib/types';

interface Props {
  stages: StageSchedule[];
}

const ROW_H = 36;
const LABEL_W = 170;
const PAD_X = 16;
const PLAN_Y_OFFSET = 11;
const ACTUAL_Y_OFFSET = 22;

function toMs(d?: string): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

function nextMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

function formatMonth(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function StageGantt({ stages }: Props) {
  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.stageIndex - b.stageIndex),
    [stages]
  );

  const domain = useMemo(() => {
    const points: number[] = [];
    for (const s of sorted) {
      [s.planStart, s.planEnd, s.actualStart, s.actualEnd].forEach((d) => {
        const t = toMs(d);
        if (t !== null) points.push(t);
      });
    }
    if (points.length === 0) {
      const today = Date.now();
      return { min: today - 30 * 86400000, max: today + 30 * 86400000 };
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    if (min === max) {
      return { min: min - 14 * 86400000, max: max + 14 * 86400000 };
    }
    const pad = Math.max((max - min) * 0.05, 3 * 86400000);
    return { min: min - pad, max: max + pad };
  }, [sorted]);

  const months = useMemo(() => {
    const out: { ms: number; label: string }[] = [];
    let cur = startOfMonth(domain.min);
    while (cur < domain.max) {
      out.push({ ms: cur, label: formatMonth(cur) });
      cur = nextMonth(cur);
    }
    return out;
  }, [domain]);

  const chartW = 900;
  const trackW = chartW - LABEL_W - PAD_X * 2;
  const chartH = sorted.length * ROW_H + 36;

  const xOf = (ms: number) => {
    const t = (ms - domain.min) / (domain.max - domain.min);
    return LABEL_W + PAD_X + Math.max(0, Math.min(1, t)) * trackW;
  };

  const todayMs = Date.now();
  const todayInRange = todayMs >= domain.min && todayMs <= domain.max;

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Stage Timeline</h3>
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6">
              <line
                x1="1"
                y1="3"
                x2="21"
                y2="3"
                stroke="#2563EB"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
            </svg>
            Plan
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6">
              <line x1="1" y1="3" x2="21" y2="3" stroke="#10B981" strokeWidth="3" />
            </svg>
            Actual
          </span>
          {todayInRange && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-[2px] h-3 bg-amber-500" /> Today
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={chartW}
          height={chartH}
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="block min-w-full"
        >
          {/* Month ticks */}
          {months.map((m, i) => {
            const x = xOf(m.ms);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={24}
                  x2={x}
                  y2={chartH - 4}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
                <text
                  x={x + 4}
                  y={16}
                  className="fill-text-muted"
                  fontSize="10"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* Today line */}
          {todayInRange && (
            <line
              x1={xOf(todayMs)}
              y1={20}
              x2={xOf(todayMs)}
              y2={chartH - 4}
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
          )}

          {/* Rows */}
          {sorted.map((stage, i) => {
            const y = 32 + i * ROW_H;
            const planStart = toMs(stage.planStart);
            const planEnd = toMs(stage.planEnd);
            const actualStart = toMs(stage.actualStart);
            const actualEnd = toMs(stage.actualEnd);

            return (
              <g key={stage.id}>
                {/* Row separator */}
                {i > 0 && (
                  <line
                    x1={0}
                    y1={y - 2}
                    x2={chartW}
                    y2={y - 2}
                    stroke="#F3F4F6"
                    strokeWidth="1"
                  />
                )}
                {/* Label */}
                <text
                  x={12}
                  y={y + ROW_H / 2 + 4}
                  fontSize="11"
                  fontFamily="ui-sans-serif, system-ui"
                  className="fill-text-primary"
                  fontWeight="500"
                >
                  {stage.stageIndex + 1}. {stage.stageName}
                </text>
                {/* Plan line (dotted) */}
                {planStart !== null && planEnd !== null && (
                  <line
                    x1={xOf(planStart)}
                    y1={y + PLAN_Y_OFFSET}
                    x2={xOf(planEnd)}
                    y2={y + PLAN_Y_OFFSET}
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                )}
                {/* Actual line (solid) */}
                {actualStart !== null && actualEnd !== null && (
                  <line
                    x1={xOf(actualStart)}
                    y1={y + ACTUAL_Y_OFFSET}
                    x2={xOf(actualEnd)}
                    y2={y + ACTUAL_Y_OFFSET}
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                )}
                {/* Actual start only — short tick */}
                {actualStart !== null && actualEnd === null && (
                  <line
                    x1={xOf(actualStart)}
                    y1={y + ACTUAL_Y_OFFSET - 4}
                    x2={xOf(actualStart)}
                    y2={y + ACTUAL_Y_OFFSET + 4}
                    stroke="#10B981"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}

          {/* Divider between labels and track */}
          <line
            x1={LABEL_W}
            y1={0}
            x2={LABEL_W}
            y2={chartH}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
