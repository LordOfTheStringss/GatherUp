/**
 * GatherUp — Automated Test Suite Runner V1.6
 * 
 * Executes all test cases and prints results in a formatted table.
 * 
 * Usage: npx tsx tests/run_tests.ts
 */

import { TestRunner } from './TestRunner';
import { TC_01_DomainAuth } from './TC_01_DomainAuth';
import { TC_02_PublicDomainBlock } from './TC_02_PublicDomainBlock';
import { TC_03_VectorProfiling } from './TC_03_VectorProfiling';
import { TC_04_RLS } from './TC_04_RLS';
import { TC_05_OCRParsing } from './TC_05_OCRParsing';
import { TC_06_OCRFallback } from './TC_06_OCRFallback';
import { TC_07_ManualConstraints } from './TC_07_ManualConstraints';
import { TC_08_GapAnalysis } from './TC_08_GapAnalysis';
import { TC_09_EventCreation } from './TC_09_EventCreation';
import { TC_10_ConflictDetection } from './TC_10_ConflictDetection';
import { TC_11_MapSpatioTemporal } from './TC_11_MapSpatioTemporal';
import { TC_12_MapPerformance } from './TC_12_MapPerformance';
import { TC_13_OneTapSuggestion } from './TC_13_OneTapSuggestion';
import { TC_14_AsyncAIProcessing } from './TC_14_AsyncAIProcessing';
import { TC_15_GroupPlanning } from './TC_15_GroupPlanning';
import { TC_16_DynamicMerge } from './TC_16_DynamicMerge';
import { TC_17_RealtimeChat } from './TC_17_RealtimeChat';
import { TC_18_SocialBadges } from './TC_18_SocialBadges';
import { TC_19_AdminDashboard } from './TC_19_AdminDashboard';
import { TC_20_BanWorkflow } from './TC_20_BanWorkflow';
import { TC_21_PanicButton } from './TC_21_PanicButton';
import { TC_22_DisasterRecovery } from './TC_22_DisasterRecovery';
import { TC_23_DataDeletion } from './TC_23_DataDeletion';
import { TC_24_TermsAcceptance } from './TC_24_TermsAcceptance';
import { TC_25_TimeWindow } from './TC_25_TimeWindow';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           GatherUp — Automated Test Suite v1.6             ║');
  console.log('║           Running 25 Test Cases Against Live DB            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const runner = new TestRunner();

  // Register all test cases in order
  runner.register(new TC_01_DomainAuth());
  runner.register(new TC_02_PublicDomainBlock());
  runner.register(new TC_03_VectorProfiling());
  runner.register(new TC_04_RLS());
  runner.register(new TC_05_OCRParsing());
  runner.register(new TC_06_OCRFallback());
  runner.register(new TC_07_ManualConstraints());
  runner.register(new TC_08_GapAnalysis());
  runner.register(new TC_09_EventCreation());
  runner.register(new TC_10_ConflictDetection());
  runner.register(new TC_11_MapSpatioTemporal());
  runner.register(new TC_12_MapPerformance());
  runner.register(new TC_13_OneTapSuggestion());
  runner.register(new TC_14_AsyncAIProcessing());
  runner.register(new TC_15_GroupPlanning());
  runner.register(new TC_16_DynamicMerge());
  runner.register(new TC_17_RealtimeChat());
  runner.register(new TC_18_SocialBadges());
  runner.register(new TC_19_AdminDashboard());
  runner.register(new TC_20_BanWorkflow());
  runner.register(new TC_21_PanicButton());
  runner.register(new TC_22_DisasterRecovery());
  runner.register(new TC_23_DataDeletion());
  runner.register(new TC_24_TermsAcceptance());
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
