/**
 * Supabase test helper — provides client instances for testing.
 * Uses anon key by default. Service role key is optional for admin operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

export function getAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function hasServiceRoleKey(): boolean {
  return !!SUPABASE_SERVICE_ROLE_KEY;
}

/** Allowed domain matching logic — mirrors AuthManager.validateDomain */
export function matchesDomain(email: string, allowedDomains: string[]): boolean {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const emailDomain = parts[1];

  return allowedDomains.some(allowed => {
    const d = allowed.toLowerCase();
    return emailDomain === d || emailDomain.endsWith(`.${d}`);
  });
}
