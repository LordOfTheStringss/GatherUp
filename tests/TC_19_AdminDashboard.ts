import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAdminClient } from './supabase.helper';

export class TC_19_AdminDashboard extends BaseTestCase {
  id = 'TC-19';
  description = 'Admin Dashboard Metrics Query';
  testType = 'Integration - Database';
  inputs = "Request metrics via Service Role / Admin privileges";
  expectedOutput = 'Query returns without significant delay or permission errors';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];

    // Initialize Supabase admin client
    const supabase = getAdminClient();

    if (!supabase) {
      results.push({
        name: 'Fetch User Count Metric',
        passed: false,
        message: 'SUPABASE_SERVICE_ROLE_KEY is missing in .env. Admin privileges required.'
      });
      return results;
    }

    // Query basic metrics (e.g. user count) from Supabase
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.push({
          name: 'Fetch User Count Metric',
          passed: false,
          message: `Query failed with error: ${error.message}`
        });
      } else {
        results.push({
          name: 'Fetch User Count Metric',
          passed: true,
          message: `Successfully returned total count (Users: ${count}) without permission errors`
        });
      }
    } catch (err: any) {
      results.push({
        name: 'Fetch User Count Metric',
        passed: false,
        message: err.message || String(err),
      });
    }

    return results;
  }
}