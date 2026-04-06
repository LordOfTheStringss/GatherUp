/**
 * GatherUp — Automated Test Suite Runner
 * 
 * Executes all test cases and prints results in a formatted table.
 * 
 * Usage: npx tsx tests/run_tests.ts
 */

import { TC_01_DomainAuth } from './TC_01_DomainAuth';
import { TC_03_VectorProfiling } from './TC_03_VectorProfiling';
import { TC_04_RLS } from './TC_04_RLS';
import { TC_13_OneTapSuggestion } from './TC_13_OneTapSuggestion';
import { TC_14_AsyncAIProcessing } from './TC_14_AsyncAIProcessing';
import { TC_15_GroupPlanning } from './TC_15_GroupPlanning';
import { TC_16_DynamicMerge } from './TC_16_DynamicMerge';
import { TC_17_RealtimeChat } from './TC_17_RealtimeChat';
import { TC_18_SocialBadges } from './TC_18_SocialBadges';
import { TC_22_DisasterRecovery } from './TC_22_DisasterRecovery';
import { TC_23_DataDeletion } from './TC_23_DataDeletion';
import { TC_24_TermsAcceptance } from './TC_24_TermsAcceptance';
import { TestRunner } from './TestRunner';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           GatherUp — Automated Test Suite v1.1             ║');
  console.log('║           Running 12 Test Cases Against Live DB            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const runner = new TestRunner();

  // Register all test cases in order
  runner.register(new TC_01_DomainAuth());
  runner.register(new TC_03_VectorProfiling());
  runner.register(new TC_04_RLS());
  runner.register(new TC_13_OneTapSuggestion());
  runner.register(new TC_14_AsyncAIProcessing());
  runner.register(new TC_15_GroupPlanning());
  runner.register(new TC_16_DynamicMerge());
  runner.register(new TC_17_RealtimeChat());
  runner.register(new TC_18_SocialBadges());
  runner.register(new TC_22_DisasterRecovery());
  runner.register(new TC_23_DataDeletion());
  runner.register(new TC_24_TermsAcceptance());

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
