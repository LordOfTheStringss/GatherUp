import { BaseTestCase, SubTestResult } from './TestRunner';

export class TC_08_GapAnalysis extends BaseTestCase {
  id = 'TC-08';
  description = 'Gap Analysis Time Slots';
  testType = 'Logic Mock';
  inputs = 'A busy block (e.g. Mon 09:00-11:00)';
  expectedOutput = 'Algorithm correctly returns the remaining free time slots';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];

    // Dummy mock of Gap Analysis
    // Assume working hours are 09:00 to 17:00
    const calculateFreeSlots = (busyBlocks: {start: number, end: number}[]) => {
      const workingStart = 9;
      const workingEnd = 17;
      let freeSlots: {start: number, end: number}[] = [];
      let currentMarker = workingStart;

      // Sort blocks by start time for correct processing
      const sortedBlocks = [...busyBlocks].sort((a, b) => a.start - b.start);

      for (const block of sortedBlocks) {
        if (currentMarker < block.start) {
          freeSlots.push({ start: currentMarker, end: block.start });
        }
        if (currentMarker < block.end) {
          currentMarker = block.end;
        }
      }

      if (currentMarker < workingEnd) {
        freeSlots.push({ start: currentMarker, end: workingEnd });
      }

      return freeSlots;
    };

    // Run the logic with a busy block from 9:00 to 11:00
    const busyBlock = [{ start: 9, end: 11 }];
    const freeSlots = calculateFreeSlots(busyBlock);

    const hasExpectedFreeSlot = freeSlots.length === 1 && 
                                freeSlots[0].start === 11 && 
                                freeSlots[0].end === 17;

    results.push({
      name: 'Return correct free slots for morning busy block',
      passed: hasExpectedFreeSlot,
      message: hasExpectedFreeSlot 
        ? 'Successfully generated free slot 11:00-17:00' 
        : `Failed. Resulted in slots: ${JSON.stringify(freeSlots)}`,
    });

    return results;
  }
}
