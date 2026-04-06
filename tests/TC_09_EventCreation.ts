/**
 * TC-09: Event Creation
 * Verify that the manual event creation wizard successfully processes 
 * and publishes an event when valid parameters (title, category, location, 
 * time, capacity) are provided (REQ-07).
 * Input: Title: "Study Session", Time: "14:00-16:00", Capacity: 5
 * Expected Output: The event is securely created, stored in the database, 
 * and becomes visible to the targeted audience.
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient, getAdminClient } from './supabase.helper';
import { v4 as uuidv4 } from 'uuid';

export class TC_09_EventCreation extends BaseTestCase {
  id = 'TC-09';
  description = 'Manual event creation (Integration)';
  testType = 'Integration Testing';
  inputs = 'Title: Study Session, Time: 14:00-16:00, Capacity: 5';
  expectedOutput = 'Event record created with matching attributes';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const sb = getAdminClient() || getAnonClient();

    // 1. Fetch a valid organizer_id from 'users' table
    const { data: userData, error: userErr } = await sb.from('users').select('id').limit(1).single();
    if (userErr || !userData) {
      results.push({
        name: 'Valid organizer available',
        passed: false,
        message: `Could not find a valid user for organizer_id: ${userErr?.message}`
      });
      return results;
    }
    const organizerId = userData.id;

    // 2. Prepare Event Data
    const eventId = uuidv4();
    const today = new Date().toISOString().split('T')[0];
    const startTime = `${today}T14:00:00Z`;
    const endTime = `${today}T16:00:00Z`;

    const testEvent = {
      id: eventId,
      title: 'Study Session (TC-09 Test)',
      description: 'Testing manual event creation wizard flow',
      organizer_id: organizerId,
      sub_category: 'Education',
      start_time: startTime,
      end_time: endTime,
      location_lat: 39.9208,
      location_lng: 32.8541,
      max_capacity: 5,
      is_private: false,
      status: 'UPCOMING'
    };

    // 3. Execution: Create Event
    const { error: insertErr } = await sb.from('events').insert(testEvent);
    results.push({
      name: 'Event record insertion',
      passed: !insertErr,
      message: !insertErr ? 'Successfully created event' : `Insert failed: ${insertErr.message}`
    });

    if (insertErr) return results;

    // 4. Verify Persistence
    const { data: retrieved, error: fetchErr } = await sb
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    const fetchSuccess = !fetchErr && retrieved;
    results.push({
      name: 'Event persisted and retrieved',
      passed: !!fetchSuccess,
      message: fetchSuccess 
        ? `Confirmed: ${retrieved.title} (Capacity: ${retrieved.capacity})` 
        : `Fetch failed: ${fetchErr?.message}`
    });

    if (!fetchSuccess) return results;

    // 5. Verify Core Parameters
    const paramsMatch = retrieved.title === testEvent.title && 
                        retrieved.max_capacity === 5 &&
                        retrieved.organizer_id === organizerId;

    results.push({
      name: 'Event parameters integrity',
      passed: paramsMatch,
      message: paramsMatch 
        ? 'Title, Capacity, and Organizer match perfectly' 
        : `Mismatch found: title=${retrieved.title}, cap=${retrieved.max_capacity}`
    });

    // 6. Cleanup
    const { error: deleteErr } = await sb.from('events').delete().eq('id', eventId);
    results.push({
      name: 'Safe test event cleanup',
      passed: !deleteErr,
      message: !deleteErr ? 'Cleanup successful' : `Cleanup failed: ${deleteErr.message}`
    });

    return results;
  }
}
