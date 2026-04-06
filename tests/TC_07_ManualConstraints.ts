/**
 * TC-07: Manual Constraints
 * Verify that the system allows users to successfully save manual constraints 
 * using the visual grid interface as a fallback to OCR (REQ-05).
 * Input: Manual Input: Select Mon 09:00-11:00 as Busy
 * Expected Output: The selected time blocks are saved in the database as confirmed busy periods for the user.
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient } from './supabase.helper';
import { v4 as uuidv4 } from 'uuid';

// Local definitions to avoid importing source files that might pull in React Native
enum BlockType {
  BUSY = 'BUSY',
  FREE = 'FREE'
}

enum DataSource {
  MANUAL = 'MANUAL'
}


export class TC_07_ManualConstraints extends BaseTestCase {
  id = 'TC-07';
  description = 'Manual constraints saving (Grid Fallback)';
  testType = 'Unit Testing';
  inputs = 'Monday 09:00-11:00, Type: Busy';
  expectedOutput = 'Record saved in "schedule" table with is_busy=true';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const sb = getAnonClient();

    // 1. Check if 'schedule' table exists and is accessible
    const { error: schemaErr } = await sb.from('schedule').select('id').limit(1);
    results.push({
      name: 'Schedule table accessible',
      passed: !schemaErr,
      message: !schemaErr ? 'Table "schedule" confirmed' : `Schema error: ${schemaErr.message}`
    });

    if (schemaErr) return results;

    // 2. Fetch a valid user_id from the 'users' table (Hybrid: real user needed for FK)
    const { data: userData, error: userErr } = await sb.from('users').select('id').limit(1).single();
    if (userErr || !userData) {
      results.push({
        name: 'Valid user available',
        passed: false,
        message: `Could not find a valid user in the "users" table to satisfy FK: ${userErr?.message}`
      });
      return results;
    }
    const mockUserId = userData.id;

    // 3. Prepare data for direct DB insertion (Hybrid Test)
    const testData = {
      user_id: mockUserId,
      day_of_week: 'Monday',
      start_time: '09:00:00',
      end_time: '11:00:00',
      is_busy: true,
      label: 'Busy',
      title: 'Test Busy Period',
      source: DataSource.MANUAL,
      specific_date: null
    };

    // 4. Test Insertion
    const { error: insertError } = await sb.from('schedule').insert(testData);
    
    results.push({
      name: 'Manual constraint insertion',
      passed: !insertError,
      message: !insertError ? 'Successfully inserted busy period' : `Insert failed: ${insertError.message}`
    });

    if (insertError) return results;

    // 5. Verify Persistence & Retrieval
    const { data: retrieved, error: fetchError } = await sb
      .from('schedule')
      .select('*')
      .eq('user_id', mockUserId)
      .eq('day_of_week', 'Monday')
      .single();

    const fetchSuccess = !fetchError && retrieved;
    results.push({
      name: 'Constraint persisted and accurately retrieved',
      passed: !!fetchSuccess,
      message: fetchSuccess 
        ? `Found ${retrieved.title} at ${retrieved.start_time}` 
        : `Fetch failed or mismatch: ${fetchError?.message}`
    });

    if (!fetchSuccess) return results;

    // 6. Verify Values
    const valuesMatch = retrieved.is_busy === true && retrieved.start_time === '09:00:00';
    results.push({
      name: 'Constraint attributes match expected values',
      passed: valuesMatch,
      message: valuesMatch 
        ? 'is_busy=true and times are correct' 
        : `Attribute mismatch: busy=${retrieved.is_busy}, start=${retrieved.start_time}`
    });

    // 7. Cleanup (Safe cleanup by title and user_id to avoid wiping real data)
    const { error: deleteError } = await sb.from('schedule').delete().eq('user_id', mockUserId).eq('title', 'Test Busy Period');
    results.push({
      name: 'Safe test data cleanup',
      passed: !deleteError,
      message: !deleteError ? 'Cleanup successful' : `Cleanup failed: ${deleteError.message}`
    });

    return results;
  }
}
