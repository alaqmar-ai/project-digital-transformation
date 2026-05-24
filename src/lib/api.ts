import { Project, Stage, User } from './types';
import { CONFIG, STAGES } from './constants';
import { listUsersAction } from '@/app/actions/data';

const useNeon = process.env.NEXT_PUBLIC_USE_NEON === 'true';

const API_URL = CONFIG.API_URL;
const isOffline = !API_URL || API_URL === 'YOUR_APPS_SCRIPT_URL_HERE';

// ── Offline demo users (username / password) ──

interface DemoUser extends User {
  password: string;
}

const DEMO_USERS: DemoUser[] = [
  { id: 'u_admin', username: 'admin', password: 'admin', name: 'Administrator', role: 'ADMIN', email: 'admin@epms.local' },
  { id: 'u_staff', username: 'staff', password: 'staff', name: 'Staff User', role: 'STAFF', email: 'staff@epms.local' },
  { id: 'u_ahmad', username: 'ahmad', password: 'ahmad', name: 'Ahmad', role: 'STAFF' },
  { id: 'u_faiz',  username: 'faiz',  password: 'faiz',  name: 'Faiz',  role: 'STAFF' },
  { id: 'u_hidayat', username: 'hidayat', password: 'hidayat', name: 'Hidayat', role: 'STAFF' },
];

const STORAGE_KEY = 'epms_projects_v2'; // bumped after stage/group/source overhaul

function loadLocalProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  // Seed with demo projects on first load
  const seed = generateDemoProjects();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveLocalProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function generateDemoProjects(): Project[] {
  const today = new Date();
  const projects: Project[] = [
    makeDemoProject('EQ-2025-001', 'Chassis Line 4 Retool',    'Ahmad',   'Chassis',    'Overseas', 77, -50),
    makeDemoProject('EQ-2025-002', 'Trim Robotic Cell B',       'Faiz',    'Trim',       'TMA',      66, -40),
    makeDemoProject('EQ-2025-003', 'Final Inspection Conveyor', 'Ahmad',   'Final',      'Local',    55, -30),
    makeDemoProject('EQ-2025-004', 'Inspection Press 500T',     'Hidayat', 'Inspection', 'Overseas', 77, -55),
    makeDemoProject('EQ-2025-005', 'General Utility Upgrade',   'Faiz',    'General',    'Local',    44, -20),
    makeDemoProject('EQ-2026-006', 'Pilot AGV Handler',         'Ahmad',   'Pilot',      'Overseas', 55, -5),
  ];
  return projects;

  function makeDemoProject(code: string, name: string, pic: string, group: string, source: string, duration: number, dayOffset: number): Project {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + dayOffset);
    const id = 'prj_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const span = Math.max(1, Math.round(duration / STAGES.length));
    const stages: Stage[] = STAGES.map((stageName, i) => {
      const stageStart = new Date(startDate);
      stageStart.setDate(stageStart.getDate() + i * span);
      const stageEnd = new Date(stageStart);
      stageEnd.setDate(stageEnd.getDate() + span - 1);
      const isPast = stageEnd < today;
      const isActive = stageStart <= today && stageEnd >= today;
      const actualStart = isPast || isActive ? fmt(new Date(stageStart.getTime() + (Math.random() * 3 - 1) * 86400000)) : '';
      const actualFinish = isPast ? fmt(new Date(stageEnd.getTime() + (Math.random() * 5 - 2) * 86400000)) : '';
      return {
        stageIndex: i,
        stageName,
        planStart: fmt(stageStart),
        planFinish: fmt(stageEnd),
        actualStart,
        actualFinish,
        checked: isPast,
      };
    });
    return { id, pic, name, code, group, source, duration, stages, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  function fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

// ── API functions (online or offline) ──

export async function loginUser(username: string, password: string): Promise<User> {
  if (isOffline) {
    const found = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (!found) throw new Error('Invalid credentials');
    // When Neon is enabled, resolve the real DB UUID so subsequent inserts
    // (activity_logs.user_id, etc.) don't fail with "invalid uuid syntax".
    if (useNeon) {
      try {
        const dbUsers = await listUsersAction();
        const match = dbUsers.find(
          (u) => u.username.toLowerCase() === found.username.toLowerCase()
        );
        if (match) {
          return {
            id: match.id,
            username: match.username,
            name: match.name,
            role: match.role,
            email: match.email,
          };
        }
      } catch {
        /* fall through to demo id */
      }
    }
    const user: User = {
      id: found.id,
      username: found.username,
      name: found.name,
      role: found.role,
      email: found.email,
    };
    return user;
  }
  const res = await fetch(`${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Invalid credentials');
  return data.user as User;
}

export async function listUsers(): Promise<User[]> {
  if (isOffline) {
    return DEMO_USERS.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      email: u.email,
    }));
  }
  const res = await fetch(`${API_URL}?action=listUsers`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.users as User[];
}

export async function fetchAllProjects(): Promise<Project[]> {
  if (isOffline) {
    return loadLocalProjects();
  }
  const res = await fetch(`${API_URL}?action=getAll`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.projects;
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  if (isOffline) {
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      id: 'prj_' + Date.now(),
      createdAt: now,
      updatedAt: now,
      stages: project.stages.length === STAGES.length
        ? project.stages
        : STAGES.map((name, i) => ({
            stageIndex: i,
            stageName: name,
            planStart: project.stages[i]?.planStart || '',
            planFinish: project.stages[i]?.planFinish || '',
            actualStart: project.stages[i]?.actualStart || '',
            actualFinish: project.stages[i]?.actualFinish || '',
            checked: project.stages[i]?.checked || false,
          })),
    };
    const all = loadLocalProjects();
    all.push(newProject);
    saveLocalProjects(all);
    return newProject;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'createProject', data: project }),
    redirect: 'follow',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.project;
}

export async function updateProject(project: Project): Promise<Project> {
  if (isOffline) {
    const all = loadLocalProjects();
    const idx = all.findIndex((p) => p.id === project.id);
    if (idx === -1) throw new Error('Project not found');
    all[idx] = { ...project, updatedAt: new Date().toISOString() };
    saveLocalProjects(all);
    return all[idx];
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'updateProject', data: project }),
    redirect: 'follow',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  if (isOffline) {
    const all = loadLocalProjects();
    const filtered = all.filter((p) => p.id !== id);
    saveLocalProjects(filtered);
    return;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteProject', id }),
    redirect: 'follow',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function validateToken(token: string): Promise<boolean> {
  if (isOffline) {
    return token === CONFIG.TEAM_TOKEN;
  }
  const res = await fetch(`${API_URL}?action=validateToken&token=${token}`);
  const data = await res.json();
  return data.valid === true;
}
