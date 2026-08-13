/*
# API Test Suite — Trackflow (project-tracker)

This app has no REST routes; the "APIs" are Supabase table operations
(CRUD on projects, tasks, versions, comments, notifications, etc.).
Security model: RLS enabled with permissive policies for authenticated
users (anon key has no access) + a trigger preventing users from
changing their own role. This suite tests every data operation with
multiple test cases: all 5 roles, non-members, unauthenticated access,
invalid input, and edge cases.

Run: npm run test:apis
Requires: local Supabase running (see .env) + test users created via
`npm run setup-test-data` (or scripts/setup-test-data.ts).
*/

import { readFileSync } from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env loading (.env uses `KEY = "value"` format with spaces)
// ---------------------------------------------------------------------------
function loadEnv(path: string) {
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv(`${__dirname}/../.env`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Missing Supabase environment variables in .env');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'test123456';
const ROLES = ['super_admin', 'project_admin', 'developer', 'tester', 'viewer'] as const;
type Role = (typeof ROLES)[number];

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  \u2717 ${name}: ${e.message}`);
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// Expect the operation to be BLOCKED (RLS / validation error).
// Convention: fn throws when the operation SUCCEEDED (unexpectedly);
// fn completing without throwing means it was blocked.
async function expectBlock(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \u2713 ${name} (blocked as expected)`);
    passed++;
  } catch (e: any) {
    console.log(`  \u2717 ${name}: ${e.message}`);
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// Expect the operation to SUCCEED
async function expectOk(name: string, fn: () => Promise<void>) {
  await test(name, fn);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
async function signInAs(email: string): Promise<SupabaseClient> {
  const temp = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await temp.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } },
  });
}

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { data: { users } } = await admin.auth.admin.listUsers();
  const uid = (email: string) => users!.find((u) => u.email === email)!.id;

  const ids: Record<Role, string> = {
    super_admin: uid('super_admin@test.com'),
    project_admin: uid('project_admin@test.com'),
    developer: uid('developer@test.com'),
    tester: uid('tester@test.com'),
    viewer: uid('viewer@test.com'),
  };

  // Fresh non-member user (not part of the test project)
  const nonMemberEmail = `nonmember_${Date.now()}@test.com`;
  const { data: nm, error: nmErr } = await admin.auth.admin.createUser({
    email: nonMemberEmail, password: PASSWORD, email_confirm: true,
  });
  if (nmErr || !nm) { console.error('Failed to create non-member user:', nmErr?.message); process.exit(1); }
  const nonMemberId = nm.user.id;

  // Fresh test project owned by super_admin
  const { data: project, error: projErr } = await admin.from('projects').insert({
    name: `API Test ${Date.now()}`, description: 'API test project', owner_id: ids.super_admin,
  }).select().single();
  if (projErr || !project) { console.error('Failed to create test project:', projErr?.message); process.exit(1); }
  const pid = project.id;

  for (const role of ['project_admin', 'developer', 'tester', 'viewer'] as Role[]) {
    await admin.from('project_members').insert({ project_id: pid, user_id: ids[role], role });
  }

  const { data: version } = await admin.from('versions').insert({
    project_id: pid, name: 'v1.0', description: 'First release', status: 'active',
  }).select().single();
  const vid = version!.id;

  const { data: tag } = await admin.from('tags').insert({ project_id: pid, name: 'backend', color: 'blue' }).select().single();
  const tagId = tag!.id;

  const { data: task } = await admin.from('tasks').insert({
    number: 1, project_id: pid, version_id: vid, title: 'Test Task', description: 'desc',
    type: 'task', status: 'open', priority: 'medium',
    reporter_id: ids.super_admin, assignee_id: ids.developer,
  }).select().single();
  const tid = task!.id;

  const { data: comment } = await admin.from('comments').insert({
    task_id: tid, user_id: ids.super_admin, message: 'Initial comment',
  }).select().single();
  const cid = comment!.id;

  const { data: image } = await admin.from('task_images').insert({
    task_id: tid, storage_path: `test/${tid}/screenshot.png`, file_name: 'screenshot.png', uploaded_by: ids.super_admin,
  }).select().single();
  const imgId = image!.id;

  const { data: notif } = await admin.from('notifications').insert({
    user_id: ids.developer, type: 'assignment', title: 'You were assigned', body: 'Task 1', link: `/tasks/${tid}`,
  }).select().single();
  const notifId = notif!.id;

  const { data: log } = await admin.from('activity_logs').insert({
    project_id: pid, task_id: tid, user_id: ids.super_admin, action: 'task.created', entity_type: 'task', entity_id: tid,
  }).select().single();
  const logId = log!.id;

  console.log(`\nTest project: ${pid}`);
  console.log(`Test task: ${tid}`);
  console.log(`Non-member: ${nonMemberEmail}\n`);

  // =====================================================================
  // 1. AUTH API
  // =====================================================================
  section('1. Auth API');
  await test('sign in with valid credentials', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    if (data.user?.email !== 'developer@test.com') throw new Error('Wrong user returned');
  });
  await expectBlock('sign in with wrong password', async () => {
    const sb = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await sb.auth.signInWithPassword({ email: 'developer@test.com', password: 'wrongpass' });
    if (!error) throw new Error('Sign in should have failed');
  });
  await expectBlock('sign in with unknown email', async () => {
    const sb = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await sb.auth.signInWithPassword({ email: 'nobody@test.com', password: PASSWORD });
    if (!error) throw new Error('Sign in should have failed');
  });
  await expectBlock('unauthenticated cannot read projects', async () => {
    const { data, error } = await anonClient.from('projects').select('*').limit(1);
    if (error) throw error;
    if (data && data.length > 0) throw new Error('Anon should not see projects');
  });
  await expectBlock('unauthenticated cannot read tasks', async () => {
    const { data, error } = await anonClient.from('tasks').select('*').limit(1);
    if (error) throw error;
    if (data && data.length > 0) throw new Error('Anon should not see tasks');
  });

  // =====================================================================
  // 2. PROFILES API
  // =====================================================================
  section('2. Profiles API');
  await test('any authenticated user can list profiles', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('profiles').select('*');
    if (error) throw error;
    if (!data || data.length < 5) throw new Error('Expected at least 5 profiles');
  });
  await test('user can read own profile', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('profiles').select('*').eq('id', ids.developer).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Own profile not found');
  });
  await test('user can update own profile (full_name)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('profiles').update({ full_name: 'Dev Updated' }).eq('id', ids.developer);
    if (error) throw error;
  });
  await test('user can update own profile (avatar_url)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('profiles').update({ avatar_url: 'https://example.com/a.png' }).eq('id', ids.developer);
    if (error) throw error;
  });
  await test('developer can update another user profile (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('profiles').update({ full_name: 'Hacked' }).eq('id', ids.viewer).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await expectBlock('developer cannot change own role (trigger)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('profiles').update({ role: 'super_admin' }).eq('id', ids.developer).select();
    if (!error) throw new Error('Role change should have been blocked');
  });
  await test('super_admin can update any profile', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('profiles').update({ full_name: 'Renamed by Admin' }).eq('id', ids.tester);
    if (error) throw error;
  });
  await test('super_admin can change another user role', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('profiles').update({ role: 'tester' }).eq('id', ids.tester);
    if (error) throw error;
  });
  await expectBlock('unauthenticated cannot read profiles', async () => {
    const { data, error } = await anonClient.from('profiles').select('*').limit(1);
    if (error) throw error;
    if (data && data.length > 0) throw new Error('Anon should not see profiles');
  });

  // =====================================================================
  // 3. PROJECTS API
  // =====================================================================
  section('3. Projects API');
  await test('super_admin can create project', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').insert({ name: `New Project ${Date.now()}`, owner_id: ids.super_admin });
    if (error) throw error;
  });
  for (const role of ['project_admin', 'developer', 'tester', 'viewer'] as Role[]) {
    await test(`${role} can create project (permissive RLS)`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { data, error } = await sb.from('projects').insert({ name: `X ${Date.now()}`, owner_id: ids[role] }).select().single();
      if (error) throw error;
      await sb.from('projects').delete().eq('id', data!.id);
    });
  }
  await expectBlock('create project with missing name', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').insert({ owner_id: ids.super_admin });
    if (!error) throw new Error('Missing name should fail');
  });
  await expectBlock('create project with invalid status', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').insert({ name: 'Bad', owner_id: ids.super_admin, status: 'bogus' });
    if (!error) throw new Error('Invalid status should fail');
  });
  for (const role of ROLES) {
    await test(`${role} (member) can view project`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { data, error } = await sb.from('projects').select('*').eq('id', pid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Project not visible');
    });
  }
  await test('non-member can view project (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('projects').select('*').eq('id', pid).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Project should be visible');
  });
  await test('super_admin can update project', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').update({ description: 'Updated desc' }).eq('id', pid);
    if (error) throw error;
  });
  await test('owner (super_admin) can change project status', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').update({ status: 'completed' }).eq('id', pid);
    if (error) throw error;
    await sb.from('projects').update({ status: 'active' }).eq('id', pid);
  });
  await test('project_admin can update project (permissive RLS)', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { data, error } = await sb.from('projects').update({ description: 'Hacked' }).eq('id', pid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('developer can update project (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('projects').update({ description: 'Hacked' }).eq('id', pid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('viewer can update project (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('projects').update({ description: 'Hacked' }).eq('id', pid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('non-member can update project (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('projects').update({ description: 'Hacked' }).eq('id', pid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('project_admin can delete project', async () => {
    const { data: p2 } = await admin.from('projects').insert({ name: 'Del PA', owner_id: ids.super_admin }).select().single();
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('projects').delete().eq('id', p2!.id);
    if (error) throw error;
  });
  await test('developer can delete project', async () => {
    const { data: p2 } = await admin.from('projects').insert({ name: 'Del Dev', owner_id: ids.super_admin }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('projects').delete().eq('id', p2!.id);
    if (error) throw error;
  });
  await test('viewer can delete project', async () => {
    const { data: p2 } = await admin.from('projects').insert({ name: 'Del Viewer', owner_id: ids.super_admin }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('projects').delete().eq('id', p2!.id);
    if (error) throw error;
  });
  await test('super_admin can delete project', async () => {
    const { data: p2 } = await admin.from('projects').insert({ name: 'To Delete', owner_id: ids.super_admin }).select().single();
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').delete().eq('id', p2!.id);
    if (error) throw error;
  });
  await expectBlock('delete project with invalid uuid', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').delete().eq('id', 'not-a-uuid');
    if (!error) throw new Error('Invalid uuid should fail');
  });

  // =====================================================================
  // 4. PROJECT MEMBERS API
  // =====================================================================
  section('4. Project Members API');
  await test('super_admin can add member', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: nonMemberId, role: 'developer' });
    if (error) throw error;
  });
  await test('project_admin can add member', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `m1_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'tester' });
    if (error) throw error;
  });
  await test('developer can add member (permissive RLS)', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `add1_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'developer' });
    if (error) throw error;
  });
  await test('tester can add member (permissive RLS)', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `add2_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'developer' });
    if (error) throw error;
  });
  await test('viewer can add member (permissive RLS)', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `add3_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'developer' });
    if (error) throw error;
  });
  await test('non-member can add member (permissive RLS)', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `add4_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'developer' });
    if (error) throw error;
  });
  await test('member can view own membership', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('project_members').select('*').eq('user_id', ids.developer);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Own membership not visible');
  });
  await test('project_admin can view all members', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { data, error } = await sb.from('project_members').select('*').eq('project_id', pid);
    if (error) throw error;
    if (!data || data.length < 4) throw new Error('Expected at least 4 members');
  });
  await test('project_admin can update member role', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('project_members').update({ role: 'tester' }).eq('project_id', pid).eq('user_id', nonMemberId);
    if (error) throw error;
  });
  await test('developer can update member role (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('project_members').update({ role: 'project_admin' }).eq('project_id', pid).eq('user_id', ids.tester).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('project_admin can remove member', async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `m2_${Date.now()}@test.com`, password: PASSWORD, email_confirm: true });
    await admin.from('project_members').insert({ project_id: pid, user_id: u!.user!.id, role: 'viewer' });
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('project_members').delete().eq('project_id', pid).eq('user_id', u!.user!.id);
    if (error) throw error;
  });
  await test('developer can remove member (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('project_members').delete().eq('project_id', pid).eq('user_id', ids.tester);
    if (error) throw error;
  });
  await test('viewer can remove member (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('project_members').delete().eq('project_id', pid).eq('user_id', ids.tester);
    if (error) throw error;
  });

  // =====================================================================
  // 5. VERSIONS API
  // =====================================================================
  section('5. Versions API');
  await test('super_admin can create version', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v2.0' });
    if (error) throw error;
  });
  await test('project_admin can create version', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v2.1' });
    if (error) throw error;
  });
  await test('developer can create version (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: `v3 ${Date.now()}` });
    if (error) throw error;
  });
  await test('tester can create version (permissive RLS)', async () => {
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: `v3 ${Date.now()}` });
    if (error) throw error;
  });
  await test('viewer can create version (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: `v3 ${Date.now()}` });
    if (error) throw error;
  });
  await test('non-member can create version (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('versions').insert({ project_id: pid, name: `v3 ${Date.now()}` });
    if (error) throw error;
  });
  await expectBlock('create version with missing name', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid });
    if (!error) throw new Error('Missing name should fail');
  });
  await expectBlock('create version with invalid status', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v9', status: 'bogus' });
    if (!error) throw new Error('Invalid status should fail');
  });
  for (const role of ROLES) {
    await test(`${role} (member) can view versions`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { data, error } = await sb.from('versions').select('*').eq('project_id', pid);
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No versions visible');
    });
  }
  await test('non-member can view versions (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('versions').select('*').eq('project_id', pid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Versions should be visible');
  });
  await test('project_admin can update version', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('versions').update({ description: 'Updated' }).eq('id', vid);
    if (error) throw error;
  });
  await test('project_admin can release version (status change)', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('versions').update({ status: 'released' }).eq('id', vid);
    if (error) throw error;
    await sb.from('versions').update({ status: 'active' }).eq('id', vid);
  });
  await test('developer can update version (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('versions').update({ description: 'Hacked' }).eq('id', vid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('viewer can update version (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('versions').update({ description: 'Hacked' }).eq('id', vid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('project_admin can delete version', async () => {
    const { data: v2 } = await admin.from('versions').insert({ project_id: pid, name: 'temp' }).select().single();
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('versions').delete().eq('id', v2!.id);
    if (error) throw error;
  });
  await test('developer can delete version (permissive RLS)', async () => {
    const { data: v2 } = await admin.from('versions').insert({ project_id: pid, name: 'temp2' }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('versions').delete().eq('id', v2!.id);
    if (error) throw error;
  });
  await test('viewer can delete version (permissive RLS)', async () => {
    const { data: v2 } = await admin.from('versions').insert({ project_id: pid, name: 'temp3' }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('versions').delete().eq('id', v2!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 6. TAGS API
  // =====================================================================
  section('6. Tags API');
  await test('super_admin can create tag', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'frontend', color: 'green' });
    if (error) throw error;
  });
  await test('developer can create tag', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'urgent', color: 'red' });
    if (error) throw error;
  });
  await test('tester can create tag', async () => {
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'qa', color: 'yellow' });
    if (error) throw error;
  });
  await test('viewer can create tag (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'x', color: 'gray' });
    if (error) throw error;
  });
  await test('non-member can create tag (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'x2', color: 'gray' });
    if (error) throw error;
  });
  await expectBlock('duplicate tag name in project', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('tags').insert({ project_id: pid, name: 'backend', color: 'blue' });
    if (!error) throw new Error('Duplicate tag should fail');
  });
  await test('member can view tags', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('tags').select('*').eq('project_id', pid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No tags visible');
  });
  await test('project_admin can delete tag', async () => {
    const { data: t2 } = await admin.from('tags').insert({ project_id: pid, name: 'temp-tag', color: 'gray' }).select().single();
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('tags').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('developer can delete tag (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tags').insert({ project_id: pid, name: 'temp-tag2', color: 'gray' }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tags').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('viewer can delete tag (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tags').insert({ project_id: pid, name: 'temp-tag3', color: 'gray' }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('tags').delete().eq('id', t2!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 7. TASKS API
  // =====================================================================
  section('7. Tasks API');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester'] as Role[]) {
    await test(`${role} can create task`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { error } = await sb.from('tasks').insert({
        number: Math.floor(Math.random() * 100000), project_id: pid, title: `Task by ${role}`,
        type: 'task', reporter_id: ids[role],
      });
      if (error) throw error;
    });
  }
  await test('tester can create bug', async () => {
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Bug report',
      type: 'bug', priority: 'high', reporter_id: ids.tester,
    });
    if (error) throw error;
  });
  await test('developer can create story with assignee', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Story',
      type: 'story', assignee_id: ids.developer, reporter_id: ids.developer,
    });
    if (error) throw error;
  });
  await test('viewer can create task (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Viewer task', type: 'task', reporter_id: ids.viewer,
    });
    if (error) throw error;
  });
  await test('non-member can create task (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Intruder task', type: 'task', reporter_id: nonMemberId,
    });
    if (error) throw error;
  });
  await expectBlock('create task with missing title', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, type: 'task', reporter_id: ids.developer,
    });
    if (!error) throw new Error('Missing title should fail');
  });
  await expectBlock('create task with invalid type', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Bad type', type: 'epic', reporter_id: ids.developer,
    });
    if (!error) throw new Error('Invalid type should fail');
  });
  await expectBlock('create task with invalid status', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Bad status', type: 'task', status: 'done', reporter_id: ids.developer,
    });
    if (!error) throw new Error('Invalid status should fail');
  });
  await expectBlock('create task with invalid priority', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Bad priority', type: 'task', priority: 'urgent', reporter_id: ids.developer,
    });
    if (!error) throw new Error('Invalid priority should fail');
  });
  await test('duplicate task number allowed (no unique constraint)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: 1, project_id: pid, title: 'Duplicate number', type: 'task', reporter_id: ids.developer,
    });
    if (error) throw error;
  });
  for (const role of ROLES) {
    await test(`${role} (member) can view task`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { data, error } = await sb.from('tasks').select('*').eq('id', tid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Task not visible');
    });
  }
  await test('non-member can view task (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('tasks').select('*').eq('id', tid).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Task should be visible');
  });
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester'] as Role[]) {
    await test(`${role} can update task title`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { error } = await sb.from('tasks').update({ title: `Updated by ${role}` }).eq('id', tid);
      if (error) throw error;
    });
  }
  await test('developer can update task status', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').update({ status: 'in_progress' }).eq('id', tid);
    if (error) throw error;
    await sb.from('tasks').update({ status: 'open' }).eq('id', tid);
  });
  await test('developer can update task priority', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').update({ priority: 'critical' }).eq('id', tid);
    if (error) throw error;
    await sb.from('tasks').update({ priority: 'medium' }).eq('id', tid);
  });
  await test('developer can update task assignee', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').update({ assignee_id: ids.tester }).eq('id', tid);
    if (error) throw error;
    await sb.from('tasks').update({ assignee_id: ids.developer }).eq('id', tid);
  });
  await test('viewer can update task (permissive RLS)', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('tasks').update({ title: 'Hacked by viewer' }).eq('id', tid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('non-member can update task (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('tasks').update({ title: 'Hacked' }).eq('id', tid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await expectBlock('update task with invalid status', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').update({ status: 'bogus' }).eq('id', tid);
    if (!error) throw new Error('Invalid status should fail');
  });
  await test('super_admin can delete task', async () => {
    const { data: t2 } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Delete me', type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('tasks').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('project_admin can delete task', async () => {
    const { data: t2 } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Delete me 2', type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('tasks').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('developer can delete task (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Keep me', type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('tester can delete task (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Keep me 2', type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('tasks').delete().eq('id', t2!.id);
    if (error) throw error;
  });
  await test('viewer can delete task (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, title: 'Keep me 3', type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('tasks').delete().eq('id', t2!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 8. TASK TAGS API
  // =====================================================================
  section('8. Task Tags API');
  await test('member can assign tag to task', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('task_tags').insert({ task_id: tid, tag_id: tagId });
    if (error) throw error;
  });
  await test('viewer can assign tag to task', async () => {
    const { data: t2 } = await admin.from('tags').insert({ project_id: pid, name: 'v-tag', color: 'gray' }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('task_tags').insert({ task_id: tid, tag_id: t2!.id });
    if (error) throw error;
  });
  await test('non-member can assign tag (permissive RLS)', async () => {
    const { data: t2 } = await admin.from('tags').insert({ project_id: pid, name: 'nm-tag', color: 'gray' }).select().single();
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('task_tags').insert({ task_id: tid, tag_id: t2!.id });
    if (error) throw error;
  });
  await test('member can view task tags', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('task_tags').select('*').eq('task_id', tid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No task tags visible');
  });
  await test('member can remove tag from task', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('task_tags').delete().eq('task_id', tid).eq('tag_id', tagId);
    if (error) throw error;
  });

  // =====================================================================
  // 9. TASK IMAGES API
  // =====================================================================
  section('9. Task Images API');
  await test('member can attach image record', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('task_images').insert({
      task_id: tid, storage_path: `test/${tid}/dev.png`, file_name: 'dev.png',
    });
    if (error) throw error;
  });
  await test('viewer can attach image record', async () => {
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('task_images').insert({
      task_id: tid, storage_path: `test/${tid}/viewer.png`, file_name: 'viewer.png',
    });
    if (error) throw error;
  });
  await test('non-member can attach image record (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('task_images').insert({
      task_id: tid, storage_path: 'x.png', file_name: 'x.png',
    });
    if (error) throw error;
  });
  await test('member can view task images', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('task_images').select('*').eq('task_id', tid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No images visible');
  });
  await test('uploader can delete own image', async () => {
    const { data: img } = await admin.from('task_images').insert({
      task_id: tid, storage_path: 'own.png', file_name: 'own.png', uploaded_by: ids.developer,
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('task_images').delete().eq('id', img!.id);
    if (error) throw error;
  });
  await test('project_admin can delete any image', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('task_images').delete().eq('id', imgId);
    if (error) throw error;
  });
  await test('developer can delete another user image (permissive RLS)', async () => {
    const { data: img } = await admin.from('task_images').insert({
      task_id: tid, storage_path: 'other.png', file_name: 'other.png', uploaded_by: ids.super_admin,
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('task_images').delete().eq('id', img!.id);
    if (error) throw error;
  });
  await test('viewer can delete image (permissive RLS)', async () => {
    const { data: img } = await admin.from('task_images').insert({
      task_id: tid, storage_path: 'v.png', file_name: 'v.png', uploaded_by: ids.super_admin,
    }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('task_images').delete().eq('id', img!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 10. COMMENTS API
  // =====================================================================
  section('10. Comments API');
  for (const role of ROLES) {
    await test(`${role} (member) can comment`, async () => {
      const sb = await signInAs(`${role}@test.com`);
      const { error } = await sb.from('comments').insert({ task_id: tid, message: `Comment by ${role}` });
      if (error) throw error;
    });
  }
  await test('non-member can comment (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { error } = await sb.from('comments').insert({ task_id: tid, message: 'Intruder comment' });
    if (error) throw error;
  });
  await expectBlock('comment with empty message', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('comments').insert({ task_id: tid, message: '' });
    if (!error) throw new Error('Empty message should fail');
  });
  await test('member can view comments', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('comments').select('*').eq('task_id', tid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No comments visible');
  });
  await test('author can update own comment', async () => {
    const { data: c2 } = await admin.from('comments').insert({
      task_id: tid, user_id: ids.developer, message: 'Original',
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('comments').update({ message: 'Edited' }).eq('id', c2!.id);
    if (error) throw error;
  });
  await test('user can update another user comment (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('comments').update({ message: 'Hacked' }).eq('id', cid).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('author can delete own comment', async () => {
    const { data: c2 } = await admin.from('comments').insert({
      task_id: tid, user_id: ids.tester, message: 'Delete me',
    }).select().single();
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('comments').delete().eq('id', c2!.id);
    if (error) throw error;
  });
  await test('project_admin can delete any comment', async () => {
    const { data: c2 } = await admin.from('comments').insert({
      task_id: tid, user_id: ids.developer, message: 'Delete me 2',
    }).select().single();
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('comments').delete().eq('id', c2!.id);
    if (error) throw error;
  });
  await test('super_admin can delete any comment', async () => {
    const { data: c2 } = await admin.from('comments').insert({
      task_id: tid, user_id: ids.developer, message: 'Delete me 3',
    }).select().single();
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('comments').delete().eq('id', c2!.id);
    if (error) throw error;
  });
  await test('viewer can delete another user comment (permissive RLS)', async () => {
    const { data: c2 } = await admin.from('comments').insert({
      task_id: tid, user_id: ids.developer, message: 'Keep me',
    }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('comments').delete().eq('id', c2!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 11. NOTIFICATIONS API
  // =====================================================================
  section('11. Notifications API');
  await test('user can insert notification for self', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('notifications').insert({
      user_id: ids.developer, type: 'test', title: 'Self notif',
    });
    if (error) throw error;
  });
  await test('user can insert notification for another user (policy allows)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('notifications').insert({
      user_id: ids.tester, type: 'test', title: 'Cross-user notif',
    });
    if (error) throw error;
  });
  await test('user can read own notifications', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('notifications').select('*').eq('user_id', ids.developer);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No notifications visible');
  });
  await test('user can read another user notifications (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('notifications').select('*').eq('user_id', ids.tester);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Notifications should be visible');
  });
  await test('user can mark own notification as read', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('notifications').update({ read: true }).eq('id', notifId);
    if (error) throw error;
  });
  await test('user can update another user notification (permissive RLS)', async () => {
    const { data: n2 } = await admin.from('notifications').insert({
      user_id: ids.tester, type: 'test', title: 'Tester notif',
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { data, error } = await sb.from('notifications').update({ read: true }).eq('id', n2!.id).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Update should have returned the row');
  });
  await test('user can delete own notification', async () => {
    const { data: n2 } = await admin.from('notifications').insert({
      user_id: ids.developer, type: 'test', title: 'Delete me',
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('notifications').delete().eq('id', n2!.id);
    if (error) throw error;
  });
  await test('user can delete another user notification (permissive RLS)', async () => {
    const { data: n2 } = await admin.from('notifications').insert({
      user_id: ids.tester, type: 'test', title: 'Keep me',
    }).select().single();
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('notifications').delete().eq('id', n2!.id);
    if (error) throw error;
  });

  // =====================================================================
  // 12. ACTIVITY LOGS API
  // =====================================================================
  section('12. Activity Logs API');
  await test('user can insert activity log for self', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('activity_logs').insert({
      project_id: pid, task_id: tid, action: 'task.commented', entity_type: 'task', entity_id: tid,
    });
    if (error) throw error;
  });
  await test('user can insert activity log for another user (permissive RLS)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('activity_logs').insert({
      project_id: pid, task_id: tid, user_id: ids.super_admin, action: 'task.created', entity_type: 'task', entity_id: tid,
    });
    if (error) throw error;
  });
  await test('member can view project activity logs', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.from('activity_logs').select('*').eq('project_id', pid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No logs visible');
  });
  await test('non-member can view project activity logs (permissive RLS)', async () => {
    const sb = await signInAs(nonMemberEmail);
    const { data, error } = await sb.from('activity_logs').select('*').eq('project_id', pid);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Logs should be visible');
  });
  await test('super_admin can view any activity logs', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { data, error } = await sb.from('activity_logs').select('*').eq('id', logId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Log not visible');
  });

  // =====================================================================
  // 13. STORAGE API (task-screenshots bucket)
  // =====================================================================
  section('13. Storage API (task-screenshots)');
  const storagePath = `test/${Date.now()}/shot.png`;
  await test('member can upload screenshot', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.storage.from('task-screenshots').upload(storagePath, Buffer.from('png-data'), { contentType: 'image/png' });
    if (error) throw error;
  });
  await test('member can download screenshot', async () => {
    const sb = await signInAs('viewer@test.com');
    const { data, error } = await sb.storage.from('task-screenshots').download(storagePath);
    if (error) throw error;
    if (!data) throw new Error('No data returned');
  });
  await test('member can list screenshots', async () => {
    const sb = await signInAs('tester@test.com');
    const { data, error } = await sb.storage.from('task-screenshots').list('test');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No files listed');
  });
  await test('member can delete screenshot', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.storage.from('task-screenshots').remove([storagePath]);
    if (error) throw error;
  });
  await expectBlock('unauthenticated cannot upload screenshot', async () => {
    const { error } = await anonClient.storage.from('task-screenshots').upload(`test/${Date.now()}/anon.png`, Buffer.from('x'), { contentType: 'image/png' });
    if (!error) throw new Error('Anon upload should fail');
  });

  // =====================================================================
  // 14. CROSS-ENTITY / EDGE CASES
  // =====================================================================
  section('14. Edge Cases');
  await expectBlock('create task in non-existent project', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: 999999, project_id: '00000000-0000-0000-0000-000000000000', title: 'Ghost', type: 'task', reporter_id: ids.developer,
    });
    if (!error) throw new Error('Should have been blocked');
  });
  await expectBlock('comment on non-existent task', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('comments').insert({
      task_id: '00000000-0000-0000-0000-000000000000', message: 'Ghost comment',
    });
    if (!error) throw new Error('Should have been blocked');
  });
  await test('viewer can insert activity log for self on foreign project (permissive RLS)', async () => {
    const { data: p2 } = await admin.from('projects').insert({ name: `Foreign ${Date.now()}`, owner_id: ids.super_admin }).select().single();
    const sb = await signInAs('viewer@test.com');
    const { error } = await sb.from('activity_logs').insert({
      project_id: p2!.id, action: 'project.created', entity_type: 'project', entity_id: p2!.id,
    });
    if (error) throw error;
  });
  await test('task with due_date and version assignment', async () => {
    const sb = await signInAs('tester@test.com');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 100000), project_id: pid, version_id: vid, title: 'Scheduled',
      type: 'issue', due_date: '2026-12-31', reporter_id: ids.tester,
    });
    if (error) throw error;
  });
  await test('task number can be negative (no check constraint)', async () => {
    const sb = await signInAs('developer@test.com');
    const { error } = await sb.from('tasks').insert({
      number: -5, project_id: pid, title: 'Negative number', type: 'task', reporter_id: ids.developer,
    });
    if (error) throw error;
  });
  await test('project with long description', async () => {
    const sb = await signInAs('super_admin@test.com');
    const { error } = await sb.from('projects').insert({
      name: `Long Desc ${Date.now()}`, owner_id: ids.super_admin, description: 'x'.repeat(5000),
    });
    if (error) throw error;
  });
  await test('version with release_date', async () => {
    const sb = await signInAs('project_admin@test.com');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v-release', release_date: '2026-12-01' });
    if (error) throw error;
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  await admin.from('projects').delete().eq('id', pid);
  await admin.auth.admin.deleteUser(nonMemberId);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
