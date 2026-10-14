import type { Rule, ParsedStatement, RuleViolation, RuleContext } from './types.js';
import { sqlMatches } from './types.js';

/**
 * MG004: ADD CONSTRAINT (named or unnamed) without NOT VALID
 *
 * Adding a CHECK or FOREIGN KEY constraint without NOT VALID requires
 * PostgreSQL to validate all existing rows immediately, holding an
 * ACCESS EXCLUSIVE lock for the duration. This applies to both
 * named (ADD CONSTRAINT name ...) and unnamed (ADD FOREIGN KEY / ADD CHECK)
 * forms. The safe pattern is to add the constraint as NOT VALID first,
 * then VALIDATE CONSTRAINT separately (which only takes a SHARE UPDATE
 * EXCLUSIVE lock).
 */
export const addConstraintNotValid: Rule = {
  id: 'MG004',
  name: 'add-constraint-not-valid',
  severity: 'warning',
  description: 'ADD CONSTRAINT without NOT VALID causes full table scan under heavy lock',

  check(statements: ParsedStatement[], _context: RuleContext): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const stmt of statements) {
      // Check for ADD CONSTRAINT or unnamed ADD CHECK/FOREIGN KEY without NOT VALID
      // Unnamed constraints (ADD FOREIGN KEY / ADD CHECK) also trigger full validation
      const hasAddConstraint = sqlMatches(stmt.raw, /ADD\s+CONSTRAINT\b/i);
      const hasUnnamedAdd =
        sqlMatches(stmt.raw, /\bADD\s+FOREIGN\s+KEY\b/i) ||
        sqlMatches(stmt.raw, /\bADD\s+CHECK\s*\(/i);
      const hasCheckOrFK =
        sqlMatches(stmt.raw, /\bCHECK\s*\(/i) ||
        sqlMatches(stmt.raw, /\bFOREIGN\s+KEY\b/i);
      const hasNotValid = sqlMatches(stmt.raw, /\bNOT\s+VALID\b/i);

      if ((hasAddConstraint || hasUnnamedAdd) && hasCheckOrFK && !hasNotValid) {
        violations.push({
          ruleId: 'MG004',
          ruleName: 'add-constraint-not-valid',
          severity: 'warning',
          message:
            'Adding a CHECK or FOREIGN KEY constraint without NOT VALID causes PostgreSQL to ' +
            'scan and validate every existing row while holding an ACCESS EXCLUSIVE lock. On ' +
            'large tables, this blocks all access for the duration of the scan.',
          line: stmt.line,
          sql: stmt.raw,
          suggestion:
            'Split into two steps:\n' +
            '1. ALTER TABLE t ADD CONSTRAINT c CHECK (expr) NOT VALID;\n' +
            '   (instant, only applies to new/updated rows)\n' +
            '2. ALTER TABLE t VALIDATE CONSTRAINT c;\n' +
            '   (validates existing rows with a weaker SHARE UPDATE EXCLUSIVE lock)',
        });
      }
    }

    return violations;
  },
};
