import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;

/*
# Seed script — creates demo users, 5 projects with versions and tasks

Users (yopmail):
  ast.super-admin@yopmail.com  (super_admin)
  ast.project-admin@yopmail.com (project_admin)
  ast.developer@yopmail.com    (developer)
  ast.tester@yopmail.com       (tester)
  ast.viewer@yopmail.com       (viewer)

Projects: 5 projects, each with 20-50 versions, each version 40-100 tasks.
*/

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path: string) {
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv(`${__dirname}/../.env`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables in .env');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Test@123456';

const USERS = [
  { email: 'ast.super-admin@yopmail.com', role: 'super_admin', full_name: 'AST Super Admin' },
  { email: 'ast.project-admin@yopmail.com', role: 'project_admin', full_name: 'AST Project Admin' },
  { email: 'ast.developer@yopmail.com', role: 'developer', full_name: 'AST Developer' },
  { email: 'ast.tester@yopmail.com', role: 'tester', full_name: 'AST Tester' },
  { email: 'ast.viewer@yopmail.com', role: 'viewer', full_name: 'AST Viewer' },
];

const PROJECTS = [
  { name: 'Art of Living — Mobile App', description: 'Mobile application for Art of Living programs and courses', client_name: 'Art of Living' },
  { name: 'Art of Living — Website', description: 'Corporate website with course listings and donations', client_name: 'Art of Living' },
  { name: 'Art of Living — CRM', description: 'Customer relationship management for volunteers and participants', client_name: 'Art of Living' },
  { name: 'Art of Living — Payments', description: 'Payment gateway and donation processing platform', client_name: 'Art of Living' },
  { name: 'Art of Living — Analytics', description: 'Analytics dashboard for program performance and engagement', client_name: 'Art of Living' },
];

const TITLES = [
  'Fix login page styling', 'Implement user profile page', 'Add dark mode toggle',
  'Optimize database queries', 'Write unit tests for auth', 'Fix notification badge count',
  'Add export to CSV feature', 'Improve sidebar navigation', 'Fix task drag and drop',
  'Add search debouncing', 'Update dependencies', 'Fix mobile responsive layout',
  'Add activity log viewer', 'Implement password reset flow', 'Fix timezone display bug',
  'Add bulk task operations', 'Improve loading skeletons', 'Fix comment threading',
  'Add keyboard shortcuts', 'Optimize image uploads', 'Fix project member invite',
  'Add task templates', 'Improve error messages', 'Fix version release flow',
  'Add audit trail export', 'Implement task dependencies', 'Fix assignee dropdown',
  'Add due date reminders', 'Improve dashboard charts', 'Fix notification preferences',
  'Add project archive feature', 'Implement task labels', 'Fix search relevance',
  'Add bulk status updates', 'Improve task detail layout', 'Fix version rollback',
  'Add user activity feed', 'Implement task cloning', 'Fix pagination issues',
  'Add project health metrics', 'Improve onboarding flow', 'Fix email notifications',
  'Add task watchers', 'Implement sprint planning', 'Fix filter persistence',
  'Add CSV import feature', 'Improve task numbering', 'Fix realtime updates',
  'Add project templates', 'Implement task estimates', 'Fix avatar uploads',
  'Add team workload view', 'Improve task search', 'Fix version comparison',
  'Add task dependencies UI', 'Implement burndown chart', 'Fix member role sync',
  'Add project milestones', 'Improve task comments', 'Fix notification grouping',
  'Add task checklist items', 'Implement time tracking', 'Fix project stats',
  'Add task attachments', 'Improve version history', 'Fix assignee notifications',
  'Add project favorites', 'Implement task priorities UI', 'Fix search filters',
  'Add task subtasks', 'Improve activity timeline', 'Fix version status flow',
  'Add project reports', 'Implement task tags UI', 'Fix member permissions',
  'Add task due date picker', 'Improve dashboard widgets', 'Fix notification sounds',
  'Add project settings page', 'Implement task bulk edit', 'Fix version naming',
  'Add task description editor', 'Improve project cards', 'Fix task numbering',
  'Add project search', 'Implement task filters UI', 'Fix member avatars',
  'Add task status transitions', 'Improve version cards', 'Fix notification links',
  'Add project members page', 'Implement task sorting', 'Fix task title validation',
  'Add task priority sorting', 'Improve project header', 'Fix version task counts',
  'Add project activity log', 'Implement task search UI', 'Fix member role labels',
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('=== Seeding demo data ===\n');

  // 1. Create users
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);
    if (found) {
      userIds[u.email] = found.id;
      await admin.from('profiles').update({ role: u.role, full_name: u.full_name }).eq('id', found.id);
      console.log(`User exists: ${u.email} (${u.role})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) { console.error(`Failed to create ${u.email}: ${error.message}`); continue; }
      userIds[u.email] = data.user.id;
      await admin.from('profiles').update({ role: u.role, full_name: u.full_name }).eq('id', data.user.id);
      console.log(`Created: ${u.email} (${u.role})`);
    }
  }

  // 2. Create projects
  let totalVersions = 0;
  let totalTasks = 0;
  for (const p of PROJECTS) {
    // Skip if project already exists (idempotent)
    const { data: existing } = await admin.from('projects').select('id').eq('name', p.name).maybeSingle();
    if (existing) {
      console.log(`\nProject exists, skipping: ${p.name}`);
      continue;
    }
    const { data: project, error: pe } = await admin.from('projects').insert({
      name: p.name,
      description: p.description,
      client_name: p.client_name,
      status: 'active',
      owner_id: userIds['ast.super-admin@yopmail.com'],
    }).select().single();
    if (pe || !project) { console.error(`Failed to create project ${p.name}: ${pe?.message}`); continue; }
    console.log(`\nProject: ${p.name} (${project.id})`);

    // Add members
    const members = [
      { user_id: userIds['ast.project-admin@yopmail.com'], role: 'project_admin' },
      { user_id: userIds['ast.developer@yopmail.com'], role: 'developer' },
      { user_id: userIds['ast.tester@yopmail.com'], role: 'tester' },
      { user_id: userIds['ast.viewer@yopmail.com'], role: 'viewer' },
    ];
    for (const m of members) {
      await admin.from('project_members').upsert(
        { project_id: project.id, user_id: m.user_id, role: m.role },
        { onConflict: 'project_id,user_id' }
      );
    }

    // Versions: 20-50
    const versionCount = rand(20, 50);
    const versionIds: string[] = [];
    for (let v = 1; v <= versionCount; v++) {
      const { data: version, error: ve } = await admin.from('versions').insert({
        project_id: project.id,
        name: `v${v}.0`,
        description: `Version ${v} — release ${v}.0`,
        status: v === versionCount ? 'active' : 'released',
        release_date: `2026-${String((v % 12) + 1).padStart(2, '0')}-15`,
      }).select('id').single();
      if (ve) { console.error(`  version err: ${ve.message}`); continue; }
      versionIds.push(version!.id);

      // Tasks: 40-100 per version
      const taskCount = rand(40, 100);
      const rows = [];
      for (let t = 1; t <= taskCount; t++) {
        rows.push({
          number: t,
          project_id: project.id,
          version_id: version!.id,
          title: TITLES[(t + totalTasks) % TITLES.length],
          description: `Task ${t} for v${v}.0`,
          type: ['task', 'bug', 'story', 'issue'][t % 4],
          status: ['open', 'in_progress', 'completed', 'cancelled'][t % 4],
          priority: ['low', 'medium', 'high', 'critical'][t % 4],
          reporter_id: userIds['ast.super-admin@yopmail.com'],
          assignee_id: t % 3 === 0 ? userIds['ast.developer@yopmail.com'] : (t % 3 === 1 ? userIds['ast.tester@yopmail.com'] : null),
          due_date: t % 5 === 0 ? '2026-12-31' : null,
        });
      }
      const { error: te } = await admin.from('tasks').insert(rows);
      if (te) { console.error(`  tasks err for v${v}.0: ${te.message}`); continue; }
      totalTasks += rows.length;
    }
    totalVersions += versionIds.length;
    console.log(`  ${versionIds.length} versions, ${totalTasks} tasks so far`);
  }

  console.log(`\n=== Seed complete ===`);
  console.log(`Users: ${USERS.length}`);
  console.log(`Projects: ${PROJECTS.length}`);
  console.log(`Versions: ${totalVersions}`);
  console.log(`Tasks: ${totalTasks}`);
  console.log(`\nLogin: any user / ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
