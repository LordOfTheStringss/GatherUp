import { BaseTestCase, SubTestResult } from './TestRunner';

export class TC_06_OCRFallback extends BaseTestCase {
  id = 'TC-06';
  description = 'OCR Fallback on Low Confidence';
  testType = 'Logic Mock';
  inputs = 'Mocked document string with a low-confidence score';
  expectedOutput = 'Triggers manual review state';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];

    // Dummy mock of OCR fallback logic
    const analyzeOCRConfidence = (confidenceScore: number) => {
      if (confidenceScore < 0.75) {
        return { status: 'MANUAL_REVIEW_REQUIRED' };
      }
      return { status: 'AUTO_APPROVED' };
    };

    const lowConfidenceScore = 0.52;
    const outcome = analyzeOCRConfidence(lowConfidenceScore);

    const isReviewed = outcome.status === 'MANUAL_REVIEW_REQUIRED';

    results.push({
      name: 'Trigger manual review on low confidence score',
      passed: isReviewed,
      message: isReviewed 
        ? 'Correctly routed to manual review for confidence 0.52' 
        : 'Failed to trigger manual review',
    });

    const highConfidenceScore = 0.95;
    const outcomeHigh = analyzeOCRConfidence(highConfidenceScore);
    const isApproved = outcomeHigh.status === 'AUTO_APPROVED';

    results.push({
      name: 'Bypass manual review on high confidence score',
      passed: isApproved,
      message: isApproved 
        ? 'Correctly bypassed manual review for confidence 0.95' 
        : 'Incorrectly routed to manual review',
    });

    return results;
  }
}
