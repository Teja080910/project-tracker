import { readFileSync } from 'fs';
import { WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';

(globalThis as any).WebSocket = WebSocket;

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

async function main() {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: true } });
  const { error } = await client.auth.signInWithPassword({ email: 'ast.super-admin@yopmail.com', password: 'Test@123456' });
  if (error) { console.log('SIGNIN ERR:', error.message); return; }
  console.log('signed in as super-admin');

  // 1. Fetch projects (as super_admin: all)
  const { data: projects, error: pe } = await client.from('projects').select('*').order('name');
  console.log('projects:', pe ? `ERR ${pe.message}` : projects?.length);

  const presetProject = 'art-of-living--website';
  const presetVersion = 'v270';
  const match = projects?.find((p: any) => p.slug === presetProject || p.id === presetProject);
  console.log('project match:', match ? `${match.name} (${match.id})` : 'NOT FOUND');

  if (match) {
    const { data: versions, error: ve } = await client.from('versions').select('*').eq('project_id', match.id);
    console.log('versions:', ve ? `ERR ${ve.message}` : versions?.length);
    const v = (versions as any[] ?? []).find((x: any) => x.slug === presetVersion || x.id === presetVersion);
    console.log('version match:', v ? `${v.name} (${v.id})` : 'NOT FOUND');

    // 3. Fetch tasks for that version
    const { data: tasks, error: te } = await client
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .eq('project_id', match.id)
      .eq('version_id', v?.id)
      .order('created_at', { ascending: false });
    console.log('tasks:', te ? `ERR ${te.message}` : tasks?.length);
  }
}

main();
