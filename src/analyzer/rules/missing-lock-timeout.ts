import type { Rule, ParsedStatement, RuleViolation, RuleContext } from './types.js';
import { sqlMatches } from './types.js';

/**
 * MG009: Missing lock_timeout guard
 *
 * Risky DDL operations (CREATE INDEX, ALTER TABLE, etc.) should be preceded
 * by SET lock_timeout to prevent the migration from waiting indefinitely
 * for a lock. Without lock_timeout, a migration can trigger a "lock queue
 * death spiral" where the waiting lock request blocks all subsequent queries.
 */
export const missingLockTimeout: Rule = {
  id: 'MG009',
  name: 'missing-lock-timeout',
  severity: 'warning',
  description: 'No lock_timeout or statement_timeout set before risky operations',

  check(statements: ParsedStatement[], _context: RuleContext): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // Risky DDL patterns that acquire locks
    const riskyPatterns = [
      /CREATE\s+INDEX\b/i,
      /ALTER\s+TABLE\b/i,
      /DROP\s+INDEX\b/i,
    ];

    // Timeout SET patterns
    const lockTimeoutPattern = /SET\s+(LOCAL\s+)?lock_timeout/i;
    const statementTimeoutPattern = /SET\s+(LOCAL\s+)?statement_timeout/i;

    let hasSeenTimeout = false;
    let hasFlagged = false;

    for (const s of statements) {
      // Check if this statement sets a timeout
      if (
        sqlMatches(s.raw, lockTimeoutPattern) ||
        sqlMatches(s.raw, statementTimeoutPattern)
      ) {
        hasSeenTimeout = true;
        continue;
      }

      // Check if this is a risky operation and we haven't seen a timeout yet
      const isRisky = riskyPatterns.some((p) => sqlMatches(s.raw, p));
      if (isRisky && !hasSeenTimeout && !hasFlagged) {
        violations.push({
          ruleId: 'MG009',
          ruleName: 'missing-lock-timeout',
          severity: 'warning',
          message:
            'This migration contains DDL operations that acquire locks but does not set a ' +
            'lock_timeout before the first risky statement. Without a lock_timeout, if another transaction holds a conflicting ' +
            'lock, your migration will wait indefinitely — and all subsequent queries will ' +
            'queue behind it, potentially causing a cascading outage (lock queue death spiral).',
          line: 1,
          sql: _context.fullSql.substring(0, 200) + '...',
          suggestion:
            'Add a lock timeout at the beginning of your migration:\n' +
            '  SET lock_timeout = \'5s\';\n\n' +
            'This causes the migration to fail fast if it cannot acquire the lock within 5 seconds, ' +
            'rather than waiting indefinitely and blocking other queries. You can retry the migration ' +
            'during a quieter period.',
        });
        hasFlagged = true;
      }
    }

    return violations;
  },
};
