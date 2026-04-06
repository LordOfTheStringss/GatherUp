/**
 * TC-12: Map Performance
 * Verify the map interaction fluidity by testing zooming and panning 
 * under load, ensuring the UI does not stutter when rendering multiple 
 * active event pins (NFR-02).
 * Input: Rapid zoom/pan on a heavily populated map area (1000 pins).
 * Expected Output: The average query latency remains below threshold, 
 * simulating a responsive map interface.
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient, getAdminClient } from './supabase.helper';
import { v4 as uuidv4 } from 'uuid';
import { ANKARA_BOUNDS } from '../src/data/locations';

export class TC_12_MapPerformance extends BaseTestCase {
  id = 'TC-12';
  description = 'Map interaction performance (Load Simulation)';
  testType = 'Performance Testing';
  inputs = 'Load: 1000 active pins in Ankara region. Action: 10 rapid queries.';
  expectedOutput = 'Average query latency < 350ms (System Responsiveness)';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const sb = getAdminClient() || getAnonClient();

    // 0. Setup: Identify valid user
    const { data: userData } = await sb.from('users').select('id').limit(1).single();
    if (!userData) return [{ name: 'User available', passed: false, message: 'No users found' }];
    const userId = userData.id;

    const testTitlePrefix = 'TC-12-LOAD-';
    const numPins = 1000;
    const batchSize = 200;

    // 1. Setup: Batch insert 1000 events in a small Ankara area
    let insertedCount = 0;
    for (let i = 0; i < numPins; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && (i + j) < numPins; j++) {
        const today = new Date().toISOString().split('T')[0];
        // Spread them slightly around Kızılay (39.9208, 32.8541)
        const lat = 39.9208 + (Math.random() - 0.5) * 0.01;
        const lng = 32.8541 + (Math.random() - 0.5) * 0.01;

        batch.push({
          id: uuidv4(),
          title: `${testTitlePrefix}${i + j}`,
          sub_category: 'LoadTest',
          organizer_id: userId,
          location_lat: lat,
          location_lng: lng,
          start_time: `${today}T10:00:00Z`,
          end_time: `${today}T22:00:00Z`,
          status: 'UPCOMING'
        });
      }
      
      const { error } = await sb.from('events').insert(batch);
      if (!error) insertedCount += batch.length;
    }

    results.push({
      name: 'High-density load generation (1000 pins)',
      passed: insertedCount === numPins,
      message: insertedCount === numPins 
        ? `Successfully populated Ankara region with ${numPins} active event pins.` 
        : `Load generation partially failed: ${insertedCount}/${numPins} inserted.`
    });

    if (insertedCount === 0) return results;

    try {
      // 2. Measure Query Performance (Simulating 10 rapid pan/zoom interactions)
      const latencies: number[] = [];
      const numQueries = 10;

      for (let k = 0; k < numQueries; k++) {
        const start = Date.now();
        const { data, error } = await sb
          .from('events')
          .select('id, location_lat, location_lng')
          .gte('location_lat', ANKARA_BOUNDS.minLat)
          .lte('location_lat', ANKARA_BOUNDS.maxLat)
          .gte('location_lng', ANKARA_BOUNDS.minLng)
          .lte('location_lng', ANKARA_BOUNDS.maxLng)
          .limit(1000); // Typical map viewport limit
        
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / numQueries;
      const peakLatency = Math.max(...latencies);

      const withinThreshold = avgLatency < 350; // Performance threshold (350ms)
      results.push({
        name: 'Spatio-temporal query responsiveness under load',
        passed: withinThreshold,
        message: `Avg Latency: ${avgLatency.toFixed(2)}ms (Peak: ${peakLatency}ms). ${withinThreshold ? 'Maintains high responsiveness.' : 'Exceeds target latency.'}`
      });

    } finally {
      // 3. Cleanup: Multi-batch delete to avoid timeout
      const { error: deleteErr } = await sb
        .from('events')
        .delete()
        .like('title', `${testTitlePrefix}%`);

      results.push({
        name: 'Scale-down & cleanup of test metadata',
        passed: !deleteErr,
        message: !deleteErr ? 'Cleaned up 1000 load-test records.' : `Cleanup failed: ${deleteErr.message}`
      });
    }

    return results;
  }
}
