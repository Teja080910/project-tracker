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

async function main() {
  const sb = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const res = await sb.auth.signInWithPassword({ email: 'developer@test.com', password: 'wrongpass' });
  console.log('error:', res.error ? JSON.stringify(res.error) : 'NULL');
  console.log('data:', res.data ? JSON.stringify(res.data) : 'NULL');
}

main().catch((e) => { console.error('THREW:', e.message); });
