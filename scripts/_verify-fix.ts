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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signInAs(email: string) {
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: 'test123456' });
  if (error) throw error;
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function main() {
  const dev = await signInAs('developer@test.com');
  const { data: me } = await dev.from('profiles').select('id, role').eq('email', 'developer@test.com').single();
  console.log('developer role before:', me?.role);

  const { data, error } = await dev
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('email', 'developer@test.com')
    .select();
  console.log('self role-change attempt -> error:', error?.message ?? 'NONE (SUCCEEDED!)', '| data:', JSON.stringify(data));

  const { data: me2 } = await dev.from('profiles').select('role').eq('email', 'developer@test.com').single();
  console.log('developer role after:', me2?.role);

  const { data: own, error: ownErr } = await dev
    .from('profiles')
    .update({ full_name: 'Dev Updated' })
    .eq('email', 'developer@test.com')
    .select();
  console.log('own full_name update -> error:', ownErr?.message ?? 'none', '| data:', JSON.stringify(own));
}

main();
