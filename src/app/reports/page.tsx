'use client';

import { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '@/components/AppProvider';
import PageHeader from '@/components/ui/PageHeader';
import {
  listMajorProjects,
  listSubProjects,
  listStages,
  listAttendance,
  listActivity,
  listUsers,
} from '@/lib/data/store';
import type { MajorProject, SubProject, StageSchedule, User, AttendanceRecord, ActivityLog } from '@/lib/types';
import { isAdmin } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils';

type ReportId =
  | 'projects_status'
  | 'delay_analysis'
  | 'attendance'
  | 'manpower'
  | 'category'
  | 'activity_log';

interface ReportSpec {
  id: ReportId;
  title: string;
  description: string;
  build: () => Promise<{ headers: string[]; rows: (string | number)[][] }>;
}

export default function ReportsPage() {
  const { user } = useApp();
  const admin = isAdmin(user);
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [majors, setMajors] = useState<MajorProject[]>([]);
  const [subs, setSubs] = useState<SubProject[]>([]);
  const [stages, setStages] = useState<StageSchedule[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    (async () => {
      const [us, mp, sp, ac] = await Promise.all([
        listUsers(),
        listMajorProjects(),
        listSubProjects(),
        admin ? listActivity(500) : Promise.resolve([] as ActivityLog[]),
      ]);
      setUsers(us);
      setMajors(mp);
      const scopedSubs = admin ? sp : sp.filter((s) => s.picId === user?.id);
      setSubs(scopedSubs);
      setActivity(ac);
      const all: StageSchedule[] = [];
      for (const s of scopedSubs) all.push(...(await listStages(s.id)));
      setStages(all);
      const att = await listAttendance();
      setAttendance(admin ? att : att.filter((a) => a.userId === user?.id));
    })();
  }, [admin, user?.id]);

  const userName = (id?: string) => users.find((u) => u.id === id)?.name ?? '-';
  const majorName = (id: string) => majors.find((m) => m.id === id)?.projectName ?? '-';

  const allReports: ReportSpec[] = [
    {
      id: 'projects_status',
      title: admin ? 'Project Status Report' : 'My Project Status Report',
      description: admin
        ? 'All sub-projects with status, progress, and dates.'
        : 'Your assigned sub-projects with status, progress, and dates.',
      build: async () => ({
        headers: ['Major', 'Sub Project', 'Group', 'Source', 'Category', 'PIC', 'Plan Start', 'Plan End', 'Progress %', 'Status'],
        rows: subs.map((s) => [
          majorName(s.majorProjectId),
          s.projectName,
          s.equipmentGroup,
          s.source,
          s.category,
          userName(s.picId),
          s.plannedStart ? formatDate(s.plannedStart) : '',
          s.plannedEnd ? formatDate(s.plannedEnd) : '',
          Math.round(s.progress),
          s.status,
        ]),
      }),
    },
    {
      id: 'delay_analysis',
      title: 'Delay Analysis',
      description: admin
        ? 'Stages flagged as delayed across all projects.'
        : 'Your stages flagged as delayed.',
      build: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const delayed = stages.filter((st) => st.planEnd && today > st.planEnd && st.status !== 'Completed' && st.status !== 'Cancelled');
        return {
          headers: ['Sub Project', 'Stage', 'Plan End', 'Days Late', 'Status', 'Remarks'],
          rows: delayed.map((st) => {
            const sub = subs.find((s) => s.id === st.subProjectId);
            const late = st.planEnd ? Math.floor((Date.parse(today) - Date.parse(st.planEnd)) / 86400000) : 0;
            return [sub?.projectName ?? '-', `${st.stageIndex + 1}. ${st.stageName}`, st.planEnd ? formatDate(st.planEnd) : '', late, st.status, st.remarks ?? ''];
          }),
        };
      },
    },
    {
      id: 'attendance',
      title: admin ? 'Attendance Report' : 'My Attendance Report',
      description: admin ? 'All attendance records.' : 'Your own attendance records.',
      build: async () => ({
        headers: ['User', 'Date', 'Status', 'Remarks'],
        rows: attendance.map((a) => [userName(a.userId), formatDate(a.date), a.status, a.remarks ?? '']),
      }),
    },
    {
      id: 'manpower',
      title: 'Manpower Analytics',
      description: 'Sub-project workload per PIC.',
      build: async () => {
        const map: Record<string, { name: string; assigned: number; completed: number; delayed: number }> = {};
        subs.forEach((s) => {
          const k = userName(s.picId);
          const b = (map[k] = map[k] ?? { name: k, assigned: 0, completed: 0, delayed: 0 });
          b.assigned++;
          if (s.status === 'Completed') b.completed++;
          if (s.status === 'Delayed') b.delayed++;
        });
        return {
          headers: ['PIC', 'Assigned', 'Completed', 'Delayed'],
          rows: Object.values(map).map((b) => [b.name, b.assigned, b.completed, b.delayed]),
        };
      },
    },
    {
      id: 'category',
      title: 'Category Analytics',
      description: 'Sub-projects grouped by category.',
      build: async () => {
        const map: Record<string, { name: string; count: number; avgProgress: number; sum: number }> = {};
        subs.forEach((s) => {
          const b = (map[s.category] = map[s.category] ?? { name: s.category, count: 0, sum: 0, avgProgress: 0 });
          b.count++;
          b.sum += s.progress;
        });
        return {
          headers: ['Category', 'Count', 'Avg Progress %'],
          rows: Object.values(map).map((b) => [b.name, b.count, Math.round(b.sum / b.count)]),
        };
      },
    },
    {
      id: 'activity_log',
      title: 'Activity Log',
      description: 'Audit trail of system changes.',
      build: async () => ({
        headers: ['Date', 'User', 'Action', 'Ref Type', 'Ref ID'],
        rows: activity.map((a) => [formatDateTime(a.createdAt), userName(a.userId), a.action, a.refType ?? '', a.refId ?? '']),
      }),
    },
  ];

  const reports = admin
    ? allReports
    : allReports.filter((r) => r.id !== 'manpower' && r.id !== 'category' && r.id !== 'activity_log');

  const exportXlsx = async (r: ReportSpec) => {
    setBusy(r.id + ':xlsx');
    try {
      const { headers, rows } = await r.build();
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, r.title.slice(0, 31));
      XLSX.writeFile(wb, `${r.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async (r: ReportSpec) => {
    setBusy(r.id + ':pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const { headers, rows } = await r.build();
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text(r.title, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated ${formatDateTime(new Date().toISOString())} · ${user?.name ?? 'User'}`, 14, 22);
      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows.map((row) => row.map(String)),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`${r.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-content mx-auto">
      <PageHeader title="Reports" subtitle="Export project, attendance and audit data as Excel or PDF" />

      <div className="grid gap-3">
        {reports.map((r) => (
          <div key={r.id} className="bg-white border border-border rounded-2xl shadow-card p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{r.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{r.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportXlsx(r)}
                disabled={!!busy}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <FileSpreadsheet size={14} /> {busy === `${r.id}:xlsx` ? 'Building…' : 'Excel'}
              </button>
              <button
                onClick={() => exportPdf(r)}
                disabled={!!busy}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download size={14} /> {busy === `${r.id}:pdf` ? 'Building…' : 'PDF'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
