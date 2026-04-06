/**
 * GatherUp Test Framework
 * Lightweight test runner with formatted table output.
 */

export interface SubTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface TestResult {
  id: string;
  description: string;
  testType: string;
  inputs: string;
  expectedOutput: string;
  result: 'PASS' | 'FAIL' | 'PARTIAL';
  details: SubTestResult[];
  duration: number;
}

export abstract class BaseTestCase {
  abstract id: string;
  abstract description: string;
  abstract testType: string;
  abstract inputs: string;
  abstract expectedOutput: string;

  abstract execute(): Promise<SubTestResult[]>;

  async run(): Promise<TestResult> {
    const start = Date.now();
    let details: SubTestResult[] = [];
    let result: 'PASS' | 'FAIL' | 'PARTIAL' = 'PASS';

    try {
      details = await this.execute();
      const passed = details.filter(d => d.passed).length;
      const total = details.length;

      if (total === 0) result = 'FAIL';
      else if (passed === 0) result = 'FAIL';
      else if (passed < total) result = 'PARTIAL';
      else result = 'PASS';
    } catch (error: any) {
      details = [{ name: 'Execution Error', passed: false, message: error.message || String(error) }];
      result = 'FAIL';
    }

    return {
      id: this.id,
      description: this.description,
      testType: this.testType,
      inputs: this.inputs,
      expectedOutput: this.expectedOutput,
      result,
      details,
      duration: Date.now() - start,
    };
  }
}

export class TestRunner {
  private tests: BaseTestCase[] = [];

  register(test: BaseTestCase) {
    this.tests.push(test);
  }

  async runAll(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    console.log('\n');
    console.log('  ⏳ GatherUp — Automated Test Execution Starting...');
    console.log('  ' + '─'.repeat(62));
    console.log('');

    for (const test of this.tests) {
      process.stdout.write(`  ▶ Running ${test.id} — ${test.description}...`);
      const result = await test.run();
      results.push(result);

      const icon = result.result === 'PASS' ? '✅' : result.result === 'PARTIAL' ? '⚠️ ' : '❌';
      const passCount = result.details.filter(d => d.passed).length;
      console.log(` ${icon} (${passCount}/${result.details.length} sub-tests, ${result.duration}ms)`);
    }

    console.log('');
    this.printTable(results);
    this.printDetails(results);

    return results;
  }

  private pad(str: string, len: number): string {
    if (str.length > len) return str.substring(0, len - 3) + '...';
    return str + ' '.repeat(len - str.length);
  }

  private printTable(results: TestResult[]) {
    const W = { id: 9, desc: 32, type: 20, inp: 24, exp: 26, res: 12 };
    const totalInner = W.id + W.desc + W.type + W.inp + W.exp + W.res + 5; // 5 inner borders

    const line = (l: string, m: string, r: string, f = '═') =>
      l + f.repeat(W.id) + m + f.repeat(W.desc) + m + f.repeat(W.type) + m + f.repeat(W.inp) + m + f.repeat(W.exp) + m + f.repeat(W.res) + r;

    const row = (a: string, b: string, c: string, d: string, e: string, f: string) =>
      '║' + this.pad(a, W.id) + '║' + this.pad(b, W.desc) + '║' + this.pad(c, W.type) + '║' + this.pad(d, W.inp) + '║' + this.pad(e, W.exp) + '║' + this.pad(f, W.res) + '║';

    const title = 'GatherUp — Automated Test Execution Report';
    const padL = Math.floor((totalInner - title.length) / 2);
    const padR = totalInner - title.length - padL;

    console.log(line('╔', '═', '╗'));
    console.log('║' + ' '.repeat(padL) + title + ' '.repeat(padR) + '║');
    console.log(line('╠', '╦', '╣'));
    console.log(row(' Test ID', ' Description', ' Test Type', ' Input(s)', ' Expected Output', ' Result'));
    console.log(line('╠', '╬', '╣'));

    for (const r of results) {
      const icon = r.result === 'PASS' ? ' ✅ PASS' : r.result === 'PARTIAL' ? ' ⚠️  PARTIAL' : ' ❌ FAIL';
      console.log(row(
        ' ' + r.id,
        ' ' + r.description,
        ' ' + r.testType,
        ' ' + r.inputs.split('\n')[0],
        ' ' + r.expectedOutput.split('\n')[0],
        icon
      ));
    }

    console.log(line('╚', '╩', '╝'));

    const passed = results.filter(r => r.result === 'PASS').length;
    const failed = results.filter(r => r.result === 'FAIL').length;
    const partial = results.filter(r => r.result === 'PARTIAL').length;
    const totalTime = results.reduce((a, r) => a + r.duration, 0);

    console.log('');
    console.log(`  📊 Summary: ${passed} passed, ${partial} partial, ${failed} failed — Total: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('');
  }

  private printDetails(results: TestResult[]) {
    console.log('  ' + '═'.repeat(62));
    console.log('  📋 Detailed Sub-Test Results');
    console.log('  ' + '═'.repeat(62));

    for (const r of results) {
      const icon = r.result === 'PASS' ? '✅' : r.result === 'PARTIAL' ? '⚠️ ' : '❌';
      console.log(`\n  ${icon} ${r.id} — ${r.description} (${r.duration}ms)`);

      for (const sub of r.details) {
        const mark = sub.passed ? '\x1b[32m  ✓' : '\x1b[31m  ✗';
        console.log(`    ${mark} ${sub.name}: ${sub.message}\x1b[0m`);
      }
    }

    console.log('\n');
  }
}
