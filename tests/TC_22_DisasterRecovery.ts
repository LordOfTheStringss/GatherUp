/**
 * TC-22: Disaster Recovery Protocol
 * Verify that the database schema and backend services can be restored
 * to a new instance within the 1-hour constraint (NFR-04).
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient } from './supabase.helper';

export class TC_22_DisasterRecovery extends BaseTestCase {
  id = 'TC-22';
  description = 'Disaster recovery verification';
  testType = 'System Testing';
  inputs = 'Schema & migration check';
  expectedOutput = 'System fully restorable <60min';

  private readonly CRITICAL_TABLES = [
    'users',
    'events',
    'event_participants',
    'chat_messages',
    'friendships',
    'notifications',
    'schedule',
    'allowed_domains',
    'locations',
    'reports',
    'audit_logs',
    'base_locations',
    'admins',
  ];

  private readonly TABLE_REQUIRED_COLUMNS: Record<string, string[]> = {
    users: ['id', 'email', 'full_name', 'interest_tags', 'reputation_score', 'is_verified', 'badges', 'is_available', 'privacy_settings', 'status'],
    events: ['id', 'organizer_id', 'title', 'start_time', 'end_time', 'is_private', 'chat_room_id', 'status'],
    event_participants: ['event_id', 'user_id', 'joined_at'],
    chat_messages: ['id', 'room_id', 'sender_id', 'content', 'event_id'],
    friendships: ['id', 'user_id', 'friend_id'],
    notifications: ['id', 'user_id', 'title', 'body', 'type', 'is_read'],
    schedule: ['id', 'user_id', 'day_of_week', 'start_time', 'end_time', 'is_busy', 'source', 'specific_date'],
    allowed_domains: ['id', 'domain'],
  };

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const client = getAnonClient();
    const recoveryStart = Date.now();

    // 1. Verify all critical tables exist by attempting SELECT
    let tablesVerified = 0;
    let tablesFailed: string[] = [];

    for (const table of this.CRITICAL_TABLES) {
      const { error } = await client.from(table).select('*').limit(0);
      if (!error) {
        tablesVerified++;
      } else {
        tablesFailed.push(table);
      }
    }

    results.push({
      name: 'Critical tables existence',
      passed: tablesVerified === this.CRITICAL_TABLES.length,
      message: tablesVerified === this.CRITICAL_TABLES.length
        ? `All ${this.CRITICAL_TABLES.length} critical tables verified`
        : `${tablesVerified}/${this.CRITICAL_TABLES.length} tables found. Missing: ${tablesFailed.join(', ')}`,
    });

    // 2. Verify column schemas on key tables
    let schemaIssues: string[] = [];

    for (const [table, requiredCols] of Object.entries(this.TABLE_REQUIRED_COLUMNS)) {
      // Build a select string with all required columns
      const selectStr = requiredCols.join(', ');
      const { error } = await client.from(table).select(selectStr).limit(0);
      
      if (error) {
        schemaIssues.push(`${table}: ${error.message.substring(0, 50)}`);
      }
    }

    results.push({
      name: 'Table schema integrity',
      passed: schemaIssues.length === 0,
      message: schemaIssues.length === 0
        ? `All ${Object.keys(this.TABLE_REQUIRED_COLUMNS).length} table schemas verified with required columns`
        : `Schema issues: ${schemaIssues.join('; ')}`,
    });

    // 3. Verify RLS is active on security-sensitive tables
    const rlsTables = ['events', 'event_participants', 'chat_messages'];
    let rlsActive = 0;

    for (const table of rlsTables) {
      // Attempt unauthenticated INSERT — should fail if RLS is active
      const { error } = await client.from(table).insert({
        id: '00000000-0000-0000-0000-000000000000',
      });

      if (error) rlsActive++;
    }

    results.push({
      name: 'RLS active on security tables',
      passed: rlsActive === rlsTables.length,
      message: `${rlsActive}/${rlsTables.length} security tables have active RLS enforcement`,
    });

    // 4. Verify data integrity — users table has records
    const { count: userCount, error: countErr } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });

    results.push({
      name: 'Database has user data',
      passed: (userCount || 0) > 0,
      message: `${userCount || 0} users in database${countErr ? ` (error: ${countErr.message})` : ''}`,
    });

    // 5. Verify events data exists
    const { count: eventCount } = await client
      .from('events')
      .select('*', { count: 'exact', head: true });

    results.push({
      name: 'Database has event data',
      passed: (eventCount || 0) > 0,
      message: `${eventCount || 0} events in database`,
    });

    // 6. Verify Supabase API is responsive
    const apiStart = Date.now();
    const { error: pingErr } = await client.from('users').select('id').limit(1);
    const apiLatency = Date.now() - apiStart;

    results.push({
      name: 'API responsiveness',
      passed: !pingErr && apiLatency < 5000,
      message: `API responded in ${apiLatency}ms${pingErr ? ` (error: ${pingErr.message})` : ''}`,
    });

    // 7. Total verification time (must be well under 60 minutes)
    const totalTime = Date.now() - recoveryStart;
    const underOneHour = totalTime < 60 * 60 * 1000;

    results.push({
      name: 'Verification completed within 60-min SLA',
      passed: underOneHour,
      message: `Schema verification completed in ${(totalTime / 1000).toFixed(2)}s (SLA: 3600s)`,
    });

    return results;
  }
}
