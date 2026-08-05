import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  // Create a fresh anon client, sign in, extract session, then set header
  const tempClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);

  // Create a new client with the access token in the header
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
  return client;
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  \u2717 ${name}: ${e.message}`);
    failed++;
  }
}

async function expectBlock(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    // fn() completed without throwing -> operation was blocked (expected)
    console.log(`  \u2713 ${name} (blocked as expected)`);
    passed++;
  } catch (e: any) {
    // fn() threw -> operation succeeded when it shouldn't have
    console.log(`  \u2717 ${name}: ${e.message}`);
    failed++;
  }
}

async function main() {
  const { data: { users } } = await admin.auth.admin.listUsers();
  const uid = (email: string) => users!.find((u) => u.email === email)!.id;

  const ids = {
    super_admin: uid('super_admin@test.com'),
    project_admin: uid('project_admin@test.com'),
    developer: uid('developer@test.com'),
    tester: uid('tester@test.com'),
    viewer: uid('viewer@test.com'),
  };

  // Create fresh project
  const { data: project } = await admin.from('projects').insert({ name: 'RLS Test', owner_id: ids.super_admin }).select().single();
  const pid = project!.id;

  for (const { role, uid: userId } of [
    { role: 'project_admin', uid: ids.project_admin },
    { role: 'developer', uid: ids.developer },
    { role: 'tester', uid: ids.tester },
    { role: 'viewer', uid: ids.viewer },
  ]) {
    await admin.from('project_members').insert({ project_id: pid, user_id: userId, role });
  }

  const { data: task } = await admin.from('tasks').insert({
    number: 1, project_id: pid, title: 'Test Task', type: 'task',
    reporter_id: ids.super_admin, assignee_id: ids.developer,
  }).select().single();
  const tid = task!.id;

  console.log(`\nProject: ${pid}`);
  console.log(`Task: ${tid}\n`);

  // 1. Create Project
  console.log('1. Create Project:');
  await test('super_admin can create', async () => {
    const sb = await signInAs('super_admin@test.com', 'test123456');
    const { error } = await sb.from('projects').insert({ name: 'X', owner_id: ids.super_admin });
    if (error) throw error;
  });
  await expectBlock('project_admin cannot create', async () => {
    const sb = await signInAs('project_admin@test.com', 'test123456');
    const { error } = await sb.from('projects').insert({ name: 'X', owner_id: ids.project_admin });
    if (!error) throw new Error('Should have been blocked');
  });

  // 2. View Project
  console.log('\n2. View Project:');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester', 'viewer']) {
    await test(`${role} can view`, async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { data, error } = await sb.from('projects').select('id').eq('id', pid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No data');
    });
  }

  // 3. Create Version
  console.log('\n3. Create Version:');
  await test('super_admin can create', async () => {
    const sb = await signInAs('super_admin@test.com', 'test123456');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v1' });
    if (error) throw error;
  });
  await test('project_admin can create', async () => {
    const sb = await signInAs('project_admin@test.com', 'test123456');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v2' });
    if (error) throw error;
  });
  await expectBlock('developer cannot create', async () => {
    const sb = await signInAs('developer@test.com', 'test123456');
    const { error } = await sb.from('versions').insert({ project_id: pid, name: 'v3' });
    if (!error) throw new Error('Should have been blocked');
  });

  // 4. Create Task
  console.log('\n4. Create Task:');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester']) {
    await test(`${role} can create`, async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { error } = await sb.from('tasks').insert({
        number: Math.floor(Math.random() * 10000), project_id: pid,
        title: `Task by ${role}`, type: 'task', reporter_id: ids[role as keyof typeof ids],
      });
      if (error) throw error;
    });
  }
  await expectBlock('viewer cannot create', async () => {
    const sb = await signInAs('viewer@test.com', 'test123456');
    const { error } = await sb.from('tasks').insert({
      number: Math.floor(Math.random() * 10000), project_id: pid,
      title: 'Task by viewer', type: 'task', reporter_id: ids.viewer,
    });
    if (!error) throw new Error('Should have been blocked');
  });

  // 5. View Task
  console.log('\n5. View Task:');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester', 'viewer']) {
    await test(`${role} can view`, async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { data, error } = await sb.from('tasks').select('id').eq('id', tid).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No data');
    });
  }

  // 6. Update Task
  console.log('\n6. Update Task:');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester']) {
    await test(`${role} can update`, async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { error } = await sb.from('tasks').update({ title: `Updated by ${role}` }).eq('id', tid);
      if (error) throw error;
    });
  }
  await expectBlock('viewer cannot update', async () => {
    const sb = await signInAs('viewer@test.com', 'test123456');
    const { data, error } = await sb.from('tasks').update({ title: 'Updated by viewer' }).eq('id', tid).select();
    if (error) throw error;
    if (data && data.length > 0) throw new Error('Should have been blocked');
  });

  // 7. Delete Task
  console.log('\n7. Delete Task:');
  for (const { role, expectBlock: shouldBlock } of [
    { role: 'super_admin', expectBlock: false },
    { role: 'project_admin', expectBlock: false },
    { role: 'developer', expectBlock: true },
    { role: 'tester', expectBlock: true },
    { role: 'viewer', expectBlock: true },
  ]) {
    const { data: t } = await admin.from('tasks').insert({
      number: Math.floor(Math.random() * 10000), project_id: pid,
      title: `Delete test for ${role}`, type: 'task', reporter_id: ids.super_admin,
    }).select().single();
    const delId = t!.id;

    const fn = async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { error } = await sb.from('tasks').delete().eq('id', delId);
      if (error) throw error;
    };

    if (shouldBlock) {
      await expectBlock(`${role} cannot delete`, fn);
    } else {
      await test(`${role} can delete`, fn);
    }
  }

  // 8. Add Comment
  console.log('\n8. Add Comment:');
  for (const role of ['super_admin', 'project_admin', 'developer', 'tester']) {
    await test(`${role} can comment`, async () => {
      const sb = await signInAs(`${role}@test.com`, 'test123456');
      const { error } = await sb.from('comments').insert({ task_id: tid, message: `Comment by ${role}` });
      if (error) throw error;
    });
  }

  // 9. Add Member
  console.log('\n9. Add Member:');
  // Create fresh users for add-member tests (not already a member)
  const { data: newUser, error: newUserErr } = await admin.auth.admin.createUser({
    email: `addmember_${Date.now()}@test.com`, password: 'test123456', email_confirm: true,
  });
  if (newUserErr || !newUser) { console.error('Failed to create addmember user:', newUserErr?.message); process.exit(1); }
  const newUserId = newUser.user.id;

  await test('super_admin can add member', async () => {
    const sb = await signInAs('super_admin@test.com', 'test123456');
    const { error } = await sb.from('project_members').insert({
      project_id: pid, user_id: newUserId, role: 'developer',
    });
    if (error) throw error;
  });

  // Create another fresh user for project_admin add-member test
  const { data: newUser2, error: newUserErr2 } = await admin.auth.admin.createUser({
    email: `addmember2_${Date.now()}@test.com`, password: 'test123456', email_confirm: true,
  });
  if (newUserErr2 || !newUser2) { console.error('Failed to create addmember2 user:', newUserErr2?.message); process.exit(1); }
  const newUserId2 = newUser2.user.id;

  await test('project_admin can add member', async () => {
    const sb = await signInAs('project_admin@test.com', 'test123456');
    const { error } = await sb.from('project_members').insert({
      project_id: pid, user_id: newUserId2, role: 'developer',
    });
    if (error) throw error;
  });
  await expectBlock('developer cannot add member', async () => {
    const sb = await signInAs('developer@test.com', 'test123456');
    const { error } = await sb.from('project_members').insert({
      project_id: pid, user_id: ids.developer, role: 'developer',
    });
    if (!error) throw new Error('Should have been blocked');
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
