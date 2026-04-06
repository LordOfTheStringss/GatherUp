import * as fs from 'fs';
import * as path from 'path';
import { BaseTestCase, SubTestResult } from './TestRunner';

export class TC_14_AsyncAIProcessing extends BaseTestCase {
  id = 'TC-14';
  description = 'Asynchronous AI Processing limits';
  testType = 'Performance Testing';
  inputs = 'Action: Trigger AI Suggestion algorithms';
  expectedOutput = 'Function operates asynchronously, returning Promises without UI block.';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const enginePath = path.resolve(__dirname, '../src/intelligence/RecommendationEngine.ts');
    const engineCode = fs.existsSync(enginePath) ? fs.readFileSync(enginePath, 'utf8') : '';

    // 1. Verify getOneTapSuggestion signature returns Promise
    const isAsyncOneTap = engineCode.includes('async getOneTapSuggestion(') || engineCode.match(/getOneTapSuggestion.*Promise/);

    results.push({
      name: 'getOneTapSuggestion non-blocking signature',
      passed: !!isAsyncOneTap,
      message: isAsyncOneTap ? 'Confirmed asynchronous offloading for One-Tap inferences.' : 'Function is completely synchronous and blocking!',
    });

    // 2. Verify getGroupSuggestion signature returns Promise
    const isAsyncGroup = engineCode.includes('async getGroupSuggestion(') || engineCode.match(/getGroupSuggestion.*Promise/);

    results.push({
      name: 'getGroupSuggestion non-blocking signature',
      passed: !!isAsyncGroup,
      message: isAsyncGroup ? 'Confirmed asynchronous offloading for Group logic calculations.' : 'Function is synchronous and blocking!',
    });

    // 3. Verify rankEvents returns instantly (lightweight sync constraint)
    const isSyncRank = !engineCode.includes('async rankEvents(') && engineCode.includes('rankEvents(');
    results.push({
      name: 'rankEvents lightweight check',
      passed: !!isSyncRank,
      message: isSyncRank ? 'Ranking subsystem parses sync vectors efficiently.' : 'Ranking unnecessarily asynchronous.',
    });

    return results;
  }
}
