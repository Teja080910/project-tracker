import { supabase } from './client';

// Privileged operations now live on the NestJS API; server code uses the same
// client and the API enforces authorization from the caller's JWT.
export const supabaseAdmin = supabase;
