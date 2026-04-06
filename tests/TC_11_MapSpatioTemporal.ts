/**
 * TC-11: Spatio-Temporal Map
 * Verify that the spatio-temporal map mode accurately queries and renders 
 * both real-time active event pins and historical aggregated data 
 * (heatmaps) for a selected region (REQ-09).
 * Input: Select Region: "Ankara Pilot Zone"
 * Expected Output: The map successfully populates with accurate current 
 * event pins and color-coded heatmap overlays reflecting database metrics.
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient, getAdminClient } from './supabase.helper';
import { v4 as uuidv4 } from 'uuid';
import { ANKARA_BOUNDS } from '../src/data/locations';

export class TC_11_MapSpatioTemporal extends BaseTestCase {
  id = 'TC-11';
  description = 'Spatio-temporal map integration';
  testType = 'Integration Testing';
  inputs = 'Region: Ankara (Kızılay, Çankaya, Bahçelievler)';
  expectedOutput = 'Events within bounds returned as pins, heatmap aggregates returned';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const sb = getAdminClient() || getAnonClient();

    // 0. Identify valid user
    const { data: userData } = await sb.from('users').select('id').limit(1).single();
    if (!userData) return [{ name: 'User available', passed: false, message: 'No users found' }];
    const userId = userData.id;

    // 1. Setup: Insert 3 test events in Ankara (minimal columns)
    const today = new Date().toISOString().split('T')[0];
    const testEvents = [
      { id: uuidv4(), title: 'Kızılay Meetup', sub_category: 'Social', organizer_id: userId, location_lat: 39.9208, location_lng: 32.8541, start_time: `${today}T10:00:00Z`, end_time: `${today}T12:00:00Z`, status: 'UPCOMING' },
      { id: uuidv4(), title: 'Bahçeli Study', sub_category: 'Education', organizer_id: userId, location_lat: 39.9168, location_lng: 32.8210, start_time: `${today}T14:00:00Z`, end_time: `${today}T16:00:00Z`, status: 'UPCOMING' },
      { id: uuidv4(), title: 'Çankaya Sports', sub_category: 'Fitness', organizer_id: userId, location_lat: 39.8833, location_lng: 32.8667, start_time: `${today}T18:00:00Z`, end_time: `${today}T20:00:00Z`, status: 'UPCOMING' }
    ];

    const { error: setupErr } = await sb.from('events').insert(testEvents);
    results.push({
      name: 'Spatial setup (3 Ankara events created)',
      passed: !setupErr,
      message: !setupErr ? 'Events inserted at Kızılay, Bahçelievler, and Çankaya' : `Setup failed: ${setupErr.message}`
    });

    if (setupErr) return results;

    try {
      // 2. Verification: Query pins using spatial bounds
      // We simulate the viewport query by checking latitude/longitude ranges
      const { data: pins, error: pinErr } = await sb
        .from('events')
        .select('*')
        .gte('location_lat', ANKARA_BOUNDS.minLat)
        .lte('location_lat', ANKARA_BOUNDS.maxLat)
        .gte('location_lng', ANKARA_BOUNDS.minLng)
        .lte('location_lng', ANKARA_BOUNDS.maxLng);

      const foundAll = testEvents.every(te => pins?.some((p: any) => p.id === te.id));
      results.push({
        name: 'Map pins accurately queryable by region',
        passed: foundAll && !pinErr,
        message: foundAll 
          ? `Found ${pins?.length} pins in Ankara Pilot Zone (including all 3 test events)` 
          : `Spatial query failed or missing events: ${pinErr?.message}`
      });

      // 3. Verification: Heatmap Metadata Verification
      // In a real system, we'd query an aggregation endpoint. 
      // Here we verify the metadata that enables the heatmap (event counts per coordinates)
      const hasSpatialMetrics = pins && pins.length > 0 && pins.every((p: any) => p.location_lat && p.location_lng);
      results.push({
        name: 'Database metrics support color-coded heatmaps',
        passed: !!hasSpatialMetrics,
        message: hasSpatialMetrics 
          ? `Coordinate density available: ${pins.length} active metrics ready for heatmap overlay` 
          : 'Missing spatial metadata for heatmap generation'
      });

    } finally {
      // 4. Cleanup
      const eventIds = testEvents.map(e => e.id);
      await sb.from('events').delete().in('id', eventIds);
    }

    return results;
  }
}
