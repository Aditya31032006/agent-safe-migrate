import { describe, it, expect } from 'vitest';
import { parseSql } from '../../src/analyzer/parser.js';
import { createIndexNotConcurrent } from '../../src/analyzer/rules/create-index-not-concurrent.js';
import { alterColumnType } from '../../src/analyzer/rules/alter-column-type.js';
import { addColumnNotNullNoDefault } from '../../src/analyzer/rules/add-column-not-null-no-default.js';
import { addConstraintNotValid } from '../../src/analyzer/rules/add-constraint-not-valid.js';
import { dropColumn } from '../../src/analyzer/rules/drop-column.js';
import { dropTable } from '../../src/analyzer/rules/drop-table.js';
import { renameColumn } from '../../src/analyzer/rules/rename-column.js';
import { renameTable } from '../../src/analyzer/rules/rename-table.js';
import { missingLockTimeout } from '../../src/analyzer/rules/missing-lock-timeout.js';
import { missingDownMigration } from '../../src/analyzer/rules/missing-down-migration.js';
import { truncateTable } from '../../src/analyzer/rules/truncate-table.js';
import { dropSchema } from '../../src/analyzer/rules/drop-schema.js';
import { dropDatabase } from '../../src/analyzer/rules/drop-database.js';
import { unparseableSql } from '../../src/analyzer/rules/unparseable-sql.js';
import { DESTRUCTIVE_RULE_IDS } from '../../src/analyzer/rules/index.js';
import type { RuleContext } from '../../src/analyzer/rules/types.js';

const defaultContext: RuleContext = {
  hasDownMigration: true,
  format: 'raw-sql',
  fullSql: '',
};

// ─── MG001: CREATE INDEX without CONCURRENTLY ───────────────────────

describe('MG001: create-index-not-concurrent', () => {
  it('should flag CREATE INDEX without CONCURRENTLY', async () => {
    const stmts = await parseSql('CREATE INDEX idx_email ON users (email);');
    const ctx = { ...defaultContext, fullSql: 'CREATE INDEX idx_email ON users (email);' };
    const violations = createIndexNotConcurrent.check(stmts, ctx);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG001');
  });

  it('should NOT flag CREATE INDEX CONCURRENTLY', async () => {
    const stmts = await parseSql('CREATE INDEX CONCURRENTLY idx_email ON users (email);');
    const ctx = { ...defaultContext, fullSql: 'CREATE INDEX CONCURRENTLY idx_email ON users (email);' };
    const violations = createIndexNotConcurrent.check(stmts, ctx);
    expect(violations.length).toBe(0);
  });

  it('should flag CREATE UNIQUE INDEX without CONCURRENTLY', async () => {
    const stmts = await parseSql('CREATE UNIQUE INDEX idx_email ON users (email);');
    const ctx = { ...defaultContext, fullSql: 'CREATE UNIQUE INDEX idx_email ON users (email);' };
    const violations = createIndexNotConcurrent.check(stmts, ctx);
    expect(violations.length).toBeGreaterThan(0);
  });
});

// truncated for brevity in this call, but full file will be used in real -- actually I need full
