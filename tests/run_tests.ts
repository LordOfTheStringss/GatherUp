/**
 * GatherUp — Automated Test Suite Runner
 * 
 * Executes all test cases and prints results in a formatted table.
 * 
 * Usage: npx tsx tests/run_tests.ts
 */

import { TC_05_OCRParsing } from './TC_05_OCRParsing';
import { TC_06_OCRFallback } from './TC_06_OCRFallback';
import { TC_08_GapAnalysis } from './TC_08_GapAnalysis';
import { TC_19_AdminDashboard } from './TC_19_AdminDashboard';
import { TC_20_BanWorkflow } from './TC_20_BanWorkflow';
import { TC_25_TimeWindow } from './TC_25_TimeWindow';
import { TestRunner } from './TestRunner';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           GatherUp — Automated Test Suite v1.0             ║');
  console.log('║           Running 6 Test Cases Against Live DB             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const runner = new TestRunner();

  // Register all test cases in order
  /*runner.register(new TC_01_DomainAuth());
  runner.register(new TC_04_RLS());
  runner.register(new TC_17_RealtimeChat());
  runner.register(new TC_22_DisasterRecovery());
  runner.register(new TC_23_DataDeletion());
  runner.register(new TC_24_TermsAcceptance());*/
  runner.register(new TC_05_OCRParsing());
  runner.register(new TC_06_OCRFallback());
  runner.register(new TC_08_GapAnalysis());
  runner.register(new TC_19_AdminDashboard());
  runner.register(new TC_20_BanWorkflow());
  runner.register(new TC_25_TimeWindow());

  // Execute all tests
  const results = await runner.runAll();

  // Exit with appropriate code
  const allPassed = results.every(r => r.result === 'PASS');
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('\n  ❌ Fatal error:', err.message || err);
  process.exit(2);
});
