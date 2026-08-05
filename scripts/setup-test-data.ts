import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  { email: 'super_admin@test.com', role: 'super_admin', password: 'test123456' },
  { email: 'project_admin@test.com', role: 'project_admin', password: 'test123456' },
  { email: 'developer@test.com', role: 'developer', password: 'test123456' },
  { email: 'tester@test.com', role: 'tester', password: 'test123456' },
  { email: 'viewer@test.com', role: 'viewer', password: 'test123456' },
];

async function setup() {
  const userIds: Record<string, string> = {};

  // 1. Create users
  for (const u of TEST_USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);

    if (found) {
      console.log(`User ${u.email} already exists`);
      userIds[u.email] = found.id;
      await supabase.from('profiles').update({ role: u.role }).eq('id', found.id);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) { console.error(`Failed to create ${u.email}:`, error.message); continue; }
      userIds[u.email] = data.user.id;
      await supabase.from('profiles').update({ role: u.role }).eq('id', data.user.id);
      console.log(`Created ${u.email} as ${u.role}`);
    }
  }

  // 2. Create a test project owned by super_admin
  const { data: project } = await supabase
    .from('projects')
    .insert({ name: 'Test Project', description: 'Test project for role verification', owner_id: userIds['super_admin@test.com'] })
    .select()
    .single();

  if (!project) { console.error('Failed to create project'); return; }
  console.log(`Created project: ${project.id}`);

  // 3. Add members with different roles
  const members = [
    { user_id: userIds['project_admin@test.com'], role: 'project_admin' },
    { user_id: userIds['developer@test.com'], role: 'developer' },
    { user_id: userIds['tester@test.com'], role: 'tester' },
    { user_id: userIds['viewer@test.com'], role: 'viewer' },
  ];

  for (const m of members) {
    await supabase.from('project_members').upsert(
      { project_id: project.id, user_id: m.user_id, role: m.role },
      { onConflict: 'project_id,user_id' }
    );
  }
  console.log('Added members to project');

  // 4. Create a test task
  const { data: task } = await supabase
    .from('tasks')
    .insert({
      number: 1,
      project_id: project.id,
      title: 'Test Task',
      description: 'A test task for role verification',
      type: 'task',
      status: 'open',
      priority: 'medium',
      reporter_id: userIds['super_admin@test.com'],
      assignee_id: userIds['developer@test.com'],
    })
    .select()
    .single();

  if (task) console.log(`Created task: ${task.id}`);

  console.log('\n--- Setup Complete ---');
  console.log('Test credentials:');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email} / ${u.password} (${u.role})`);
  }
}

setup();
