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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // 1. RLS status per table
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const t of ['projects', 'tasks', 'versions', 'comments', 'profiles', 'project_members', 'tags', 'task_tags', 'task_images', 'notifications', 'activity_logs']) {
    const { data, error } = await anon.from(t as any).select('*').limit(1);
    console.log(`anon read ${t}:`, error ? `ERROR: ${error.message}` : `SUCCESS rows=${data?.length ?? 0}`);
  }

  // 2. Wrong password sign-in
  const temp = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await temp.auth.signInWithPassword({ email: 'developer@test.com', password: 'wrongpass' });
  console.log('wrong password sign-in:', error ? `ERROR: ${error.message}` : `SUCCESS user=${data.user?.email}`);

  // 3. Check schema via service role: try inserting invalid status project
  const { data: p, error: pErr } = await admin.from('projects').insert({ name: 'Diag', status: 'bogus', owner_id: (await admin.auth.admin.listUsers()).data.users.find(u => u.email === 'super_admin@test.com')!.id }).select().single();
  console.log('insert project invalid status:', pErr ? `ERROR: ${pErr.message}` : `SUCCESS id=${p?.id}`);
  if (p) await admin.from('projects').delete().eq('id', p.id);

  // 4. Check if helper functions exist
  const { data: fns, error: fnErr } = await admin.rpc('is_project_member' as any, { project_id: '00000000-0000-0000-0000-000000000000', user_id: '00000000-0000-0000-0000-000000000000' });
  console.log('is_project_member rpc:', fnErr ? `ERROR: ${fnErr.message}` : `ok result=${fns}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
