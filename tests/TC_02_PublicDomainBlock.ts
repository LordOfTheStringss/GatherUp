/**
 * TC-02: Public Domain Blocking
 * Verify that the system actively blocks registration attempts from 
 * unverified or public email providers (REQ-01).
 * Input: user@gmail.com, admin@hotmail.com
 * Expected Output: The system identifies these as invalid domains.
 */

import { BaseTestCase, SubTestResult } from './TestRunner';
import { getAnonClient, matchesDomain } from './supabase.helper';

export class TC_02_PublicDomainBlock extends BaseTestCase {
  id = 'TC-02';
  description = 'Public domain blocking (Unit)';
  testType = 'Unit Testing';
  inputs = 'Email: user@gmail.com / admin@hotmail.com';
  expectedOutput = 'Rejects the registration (Invalid Domain)';

  async execute(): Promise<SubTestResult[]> {
    const results: SubTestResult[] = [];
    const client = getAnonClient();

    // 1. Fetch allowed domains from DB to use as reference
    const { data: domains, error: domainErr } = await client
      .from('allowed_domains')
      .select('domain');

    if (domainErr || !domains) {
      return [{ name: 'Setup: Allowed domains list', passed: false, message: `Could not fetch domains: ${domainErr?.message}` }];
    }

    const domainList = domains.map((d: any) => d.domain);

    // 2. Negative Test Cases: Public Providers
    const publicEmails = [
      'user@gmail.com',
      'test.account@hotmail.com',
      'someone@yahoo.com',
      'admin@outlook.com',
      'bot@icloud.com'
    ];

    for (const email of publicEmails) {
      const isAllowed = matchesDomain(email, domainList);
      results.push({
        name: `Block public provider: ${email.split('@')[1]}`,
        passed: !isAllowed,
        message: !isAllowed 
          ? `Correctly blocked ${email}` 
          : `SECURITY FAILURE: ${email} was allowed!`
      });
    }

    // 3. Positive Test Case: Institutional Suffix
    const validEmails = [
      'student@etu.edu.tr',
      'staff@hacettepe.edu.tr',
      'research@metu.edu.tr'
    ];

    for (const email of validEmails) {
      const isAllowed = matchesDomain(email, domainList);
      results.push({
        name: `Permit institutional domain: ${email.split('@')[1]}`,
        passed: isAllowed,
        message: isAllowed 
          ? `Correctly permitted ${email}` 
          : `Error: Valid institutional domain ${email} was rejected.`
      });
    }

    // 4. Edge Case: Subdomains of allowed domains
    const subdomainEmail = 'lab@ceng.metu.edu.tr';
    const subdomainAllowed = matchesDomain(subdomainEmail, domainList);
    results.push({
      name: 'Permit valid subdomains',
      passed: subdomainAllowed,
      message: subdomainAllowed 
        ? `Correctly permitted subdomain ${subdomainEmail}` 
        : `Error: Subdomain ${subdomainEmail} should be permitted.`
    });

    return results;
  }
}
