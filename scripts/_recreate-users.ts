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

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  { email: 'super_admin@test.com', role: 'super_admin', password: 'test123456' },
  { email: 'project_admin@test.com', role: 'project_admin', password: 'test123456' },
  { email: 'developer@test.com', role: 'developer', password: 'test123456' },
  { email: 'tester@test.com', role: 'tester', password: 'test123456' },
  { email: 'viewer@test.com', role: 'viewer', password: 'test123456' },
];

async function main() {
  for (const u of TEST_USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) {
      console.error(`Failed to create ${u.email}: ${error.message}`);
      continue;
    }
    const { error: roleErr } = await admin
      .from('profiles')
      .update({ role: u.role })
      .eq('id', data.user.id);
    if (roleErr) {
      console.error(`Failed to set role for ${u.email}: ${roleErr.message}`);
      continue;
    }
    console.log(`Created ${u.email} as ${u.role}`);
  }
}

main();
