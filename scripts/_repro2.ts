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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { users } } = await admin.auth.admin.listUsers();
  const sa = users!.find(u => u.email === 'super_admin@test.com')!.id;

  // 1. Create project via admin
  const { data: p, error: pErr } = await admin.from('projects').insert({ name: `Repro ${Date.now()}`, owner_id: sa }).select().single();
  console.log('admin create project:', pErr ? `ERR ${pErr.message}` : `OK ${p.id}`);
  if (!p) return;

  // 2. Query via admin
  const { data: p2, error: p2Err } = await admin.from('projects').select('id').eq('id', p.id).maybeSingle();
  console.log('admin read project:', p2Err ? `ERR ${p2Err.message}` : p2 ? `OK` : 'NOT FOUND');

  // 3. Sign in as super_admin via anon client
  const temp = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sess, error: sErr } = await temp.auth.signInWithPassword({ email: 'super_admin@test.com', password: 'test123456' });
  console.log('sign in:', sErr ? `ERR ${sErr.message}` : 'OK');
  if (sErr) return;

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session!.access_token}` } },
  });

  // 4. Read project as super_admin
  const { data: p3, error: p3Err } = await sb.from('projects').select('id').eq('id', p.id).maybeSingle();
  console.log('super_admin read project:', p3Err ? `ERR ${p3Err.message}` : p3 ? 'OK' : 'NOT FOUND');

  // 5. Insert a task into it as super_admin
  const { error: tErr } = await sb.from('tasks').insert({ number: 999, project_id: p.id, title: 'Repro task', type: 'task', reporter_id: sa });
  console.log('super_admin insert task:', tErr ? `ERR ${tErr.message}` : 'OK');

  // 6. Check DB directly via docker
  const { execSync } = await import('child_process');
  const out = execSync(`docker exec supabase_db_project-tracker psql -U postgres -d postgres -t -c "SELECT id, name FROM projects WHERE id='${p.id}';"`).toString();
  console.log('docker DB has project:', out.trim() || 'NOT FOUND');

  await admin.from('projects').delete().eq('id', p.id);
}

main().catch((e) => { console.error('THREW:', e.message); process.exit(1); });
