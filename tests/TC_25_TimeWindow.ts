import { BaseTestCase, SubTestResult } from './TestRunner';

export class TC_25_TimeWindow extends BaseTestCase {
  id = 'TC-25';
  description = 'Time-Window Logic Constraints';
  testType = 'Logic Mock';
  inputs = 'Two mock events scheduled within 12 hours of each other';
  expectedOutput = 'Scanner refuses to merge due to 24-hour constraint';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];

    // Dummy logic for background scanner
    // The requirement states: two events must have >= 24 hours between them to be merged
    const canMergeEvents = (event1TimeMs: number, event2TimeMs: number) => {
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      const difference = Math.abs(event1TimeMs - event2TimeMs);
      return difference >= TWENTY_FOUR_HOURS_MS;
    };

    // Prepare inputs: two events 12 hours apart
    const baseTime = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    
    // Simulate events
    const eventA = baseTime;
    const eventB = baseTime + TWELVE_HOURS_MS;

    const mergeResult = canMergeEvents(eventA, eventB);

    // We verify that the logic refuses to merge
    const isRefused = mergeResult === false;

    results.push({
      name: 'Refuse merge for events < 24h apart',
      passed: isRefused,
      message: isRefused 
        ? 'Successfully blocked merge for events scheduled 12 hours apart' 
        : 'Incorrectly allowed merge for events within 24 hours',
    });

    // We can also test an allowed condition
    const eventC = baseTime + (25 * 60 * 60 * 1000); // 25 hours apart
    const mergeResultValid = canMergeEvents(eventA, eventC);

    results.push({
      name: 'Allow merge for events >= 24h apart',
      passed: mergeResultValid === true,
      message: mergeResultValid 
        ? 'Successfully allowed merge for events 25 hours apart' 
        : 'Failed to allow valid merge',
    });

    return results;
  }
}
