import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/make-admin.ts <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function makeAdmin() {
  // Check if user exists in auth
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.log(`User ${email} not found. Creating...`);
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID().slice(0, 12),
      email_confirm: true,
    });
    if (createError) {
      console.error('Failed to create user:', createError.message);
      process.exit(1);
    }
    console.log(`User created with ID: ${data.user.id}`);
    // Profile is created by the DB trigger, now update role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', data.user.id);
    if (updateError) {
      console.error('Failed to update role:', updateError.message);
      process.exit(1);
    }
    console.log(`Promoted ${email} to super_admin`);
  } else {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', user.id);
    if (updateError) {
      console.error('Failed to update role:', updateError.message);
      process.exit(1);
    }
    console.log(`Promoted ${email} to super_admin`);
  }
}

makeAdmin();
