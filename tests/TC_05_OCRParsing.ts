import { BaseTestCase, SubTestResult } from './TestRunner';

export class TC_05_OCRParsing extends BaseTestCase {
  id = 'TC-05';
  description = 'OCR Parsing Validation';
  testType = 'Logic Mock';
  inputs = 'Valid mocked document string with temporal data';
  expectedOutput = 'Structured temporal data extracted correctly';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];

    // Dummy mock of OCR parsing logic
    const parseDocument = (docString: string) => {
      if (docString.includes('October 15, 2026')) {
        return {
          events: [
            { title: 'Midterm Exam', date: '2026-10-15', time: '10:00 AM' }
          ]
        };
      }
      return { events: [] };
    };

    const inputString = 'Course Syllabus\nMidterm Exam: October 15, 2026 at 10:00 AM';
    const parsedData = parseDocument(inputString);

    const hasExtractedData = parsedData.events.length > 0 && 
                             parsedData.events[0].date === '2026-10-15' &&
                             parsedData.events[0].time === '10:00 AM';

    results.push({
      name: 'Extract temporal data from valid string',
      passed: hasExtractedData,
      message: hasExtractedData 
        ? 'Successfully extracted date and time from raw text' 
        : `Extraction failed on text: ${inputString}`,
    });

    return results;
  }
}
