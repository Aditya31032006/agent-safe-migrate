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

// ─── MG002: ALTER COLUMN TYPE ───────────────────────────────────────

describe('MG002: alter-column-type', () => {
  it('should flag ALTER COLUMN TYPE', async () => {
    const sql = 'ALTER TABLE users ALTER COLUMN age TYPE bigint;';
    const stmts = await parseSql(sql);
    const violations = alterColumnType.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG002');
  });

  it('should NOT flag ALTER COLUMN SET DEFAULT', async () => {
    const sql = 'ALTER TABLE users ALTER COLUMN status SET DEFAULT \'active\';';
    const stmts = await parseSql(sql);
    const violations = alterColumnType.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG003: ADD COLUMN NOT NULL without DEFAULT ─────────────────────

describe('MG003: add-column-not-null-no-default', () => {
  it('should flag ADD COLUMN NOT NULL without DEFAULT', async () => {
    const sql = 'ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL;';
    const stmts = await parseSql(sql);
    const violations = addColumnNotNullNoDefault.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG003');
  });

  it('should NOT flag ADD COLUMN NOT NULL with DEFAULT', async () => {
    const sql = "ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';";
    const stmts = await parseSql(sql);
    const violations = addColumnNotNullNoDefault.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });

  it('should NOT flag ADD COLUMN (nullable)', async () => {
    const sql = 'ALTER TABLE users ADD COLUMN name VARCHAR(255);';
    const stmts = await parseSql(sql);
    const violations = addColumnNotNullNoDefault.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG004: ADD CONSTRAINT without NOT VALID ────────────────────────

describe('MG004: add-constraint-not-valid', () => {
  it('should flag ADD CONSTRAINT CHECK without NOT VALID', async () => {
    const sql = 'ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age > 0);';
    const stmts = await parseSql(sql);
    const violations = addConstraintNotValid.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG004');
  });

  it('should NOT flag ADD CONSTRAINT CHECK NOT VALID', async () => {
    const sql = 'ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age > 0) NOT VALID;';
    const stmts = await parseSql(sql);
    const violations = addConstraintNotValid.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG005: DROP COLUMN ─────────────────────────────────────────────

describe('MG005: drop-column', () => {
  it('should flag DROP COLUMN', async () => {
    const sql = 'ALTER TABLE users DROP COLUMN legacy_field;';
    const stmts = await parseSql(sql);
    const violations = dropColumn.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG005');
    expect(violations[0].severity).toBe('error');
  });

  it('should NOT flag ADD COLUMN', async () => {
    const sql = 'ALTER TABLE users ADD COLUMN new_field TEXT;';
    const stmts = await parseSql(sql);
    const violations = dropColumn.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG006: DROP TABLE ──────────────────────────────────────────────

describe('MG006: drop-table', () => {
  it('should flag DROP TABLE', async () => {
    const sql = 'DROP TABLE users;';
    const stmts = await parseSql(sql);
    const violations = dropTable.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG006');
  });

  it('should flag DROP TABLE IF EXISTS', async () => {
    const sql = 'DROP TABLE IF EXISTS users;';
    const stmts = await parseSql(sql);
    const violations = dropTable.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should NOT flag DROP INDEX', async () => {
    const sql = 'DROP INDEX idx_users_email;';
    const stmts = await parseSql(sql);
    const violations = dropTable.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG007: RENAME COLUMN ───────────────────────────────────────────

describe('MG007: rename-column', () => {
  it('should flag RENAME COLUMN', async () => {
    const sql = 'ALTER TABLE users RENAME COLUMN name TO display_name;';
    const stmts = await parseSql(sql);
    const violations = renameColumn.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG007');
    expect(violations[0].severity).toBe('warning');
  });
});

// ─── MG008: RENAME TABLE ────────────────────────────────────────────

describe('MG008: rename-table', () => {
  it('should flag ALTER TABLE RENAME TO', async () => {
    const sql = 'ALTER TABLE users RENAME TO accounts;';
    const stmts = await parseSql(sql);
    const violations = renameTable.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG008');
    expect(violations[0].severity).toBe('warning');
  });
});

// ─── MG009: Missing lock_timeout ────────────────────────────────────

describe('MG009: missing-lock-timeout', () => {
  it('should flag risky ops without lock_timeout', async () => {
    const sql = 'ALTER TABLE users ADD COLUMN status TEXT;';
    const stmts = await parseSql(sql);
    const violations = missingLockTimeout.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG009');
  });

  it('should NOT flag when lock_timeout is set', async () => {
    const sql = "SET lock_timeout = '5s';\nALTER TABLE users ADD COLUMN status TEXT;";
    const stmts = await parseSql(sql);
    const violations = missingLockTimeout.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });

  it('should flag when lock_timeout is set after risky DDL', async () => {
    const sql = "ALTER TABLE users ADD COLUMN age INT;\nSET lock_timeout = '5s';";
    const stmts = await parseSql(sql);
    const violations = missingLockTimeout.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG009');
  });

  it('should NOT flag non-risky operations', async () => {
    const sql = "SELECT 1;";
    const stmts = await parseSql(sql);
    const violations = missingLockTimeout.check(stmts, { ...defaultContext, fullSql: sql });
    expect(violations.length).toBe(0);
  });
});

// ─── MG010: Missing down migration ─────────────────────────────────

describe('MG010: missing-down-migration', () => {
  it('should flag when no down migration exists', async () => {
    const stmts = await parseSql('ALTER TABLE users ADD COLUMN status TEXT;');
    const context: RuleContext = {
      hasDownMigration: false,
      format: 'raw-sql',
      fullSql: 'ALTER TABLE users ADD COLUMN status TEXT;',
    };
    const violations = missingDownMigration.check(stmts, context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].ruleId).toBe('MG010');
  });

  it('should NOT flag when down migration exists', async () => {
    const stmts = await parseSql('ALTER TABLE users ADD COLUMN status TEXT;');
    const context: RuleContext = {
      hasDownMigration: true,
      format: 'raw-sql',
      fullSql: 'ALTER TABLE users ADD COLUMN status TEXT;',
    };
    const violations = missingDownMigration.check(stmts, context);
    expect(violations.length).toBe(0);
  });

  it.each(['drizzle', 'prisma', 'supabase'] as const)('should skip for forward-only format: %s', async (format) => {
    const stmts = await parseSql('ALTER TABLE users ADD COLUMN status TEXT;');
    const context: RuleContext = {
      hasDownMigration: false,
      format,
      fullSql: 'ALTER TABLE users ADD COLUMN status TEXT;',
    };
    const violations = missingDownMigration.check(stmts, context);
    expect(violations.length).toBe(0);
  });
});

// ─── MG011: TRUNCATE ───────────────────────────────────────────────

describe('MG011: truncate-table', () => {
  it('should flag TRUNCATE', async () => {
    const stmts = await parseSql('TRUNCATE users;');
    const violations = truncateTable.check(stmts, defaultContext);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe('MG011');
    expect(violations[0].severity).toBe('error');
  });

  it('should mention CASCADE when present', async () => {
    const stmts = await parseSql('TRUNCATE TABLE users CASCADE;');
    const violations = truncateTable.check(stmts, defaultContext);
    expect(violations[0].message).toContain('CASCADE');
  });

  it('should NOT flag DELETE or other statements', async () => {
    const stmts = await parseSql("DELETE FROM users WHERE id = 1;\nCREATE TABLE truncate_log (id int);");
    expect(truncateTable.check(stmts, defaultContext).length).toBe(0);
  });
});

// ─── MG012: DROP SCHEMA ────────────────────────────────────────────

describe('MG012: drop-schema', () => {
  it('should flag DROP SCHEMA ... CASCADE', async () => {
    const stmts = await parseSql('DROP SCHEMA public CASCADE;');
    const violations = dropSchema.check(stmts, defaultContext);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe('MG012');
    expect(violations[0].message).toContain('CASCADE');
  });

  it('should NOT flag DROP TABLE', async () => {
    const stmts = await parseSql('DROP TABLE users;');
    expect(dropSchema.check(stmts, defaultContext).length).toBe(0);
  });
});

// ─── MG013: DROP DATABASE ──────────────────────────────────────────

describe('MG013: drop-database', () => {
  it('should flag DROP DATABASE', async () => {
    const stmts = await parseSql('DROP DATABASE prod;');
    const violations = dropDatabase.check(stmts, defaultContext);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe('MG013');
  });

  it('should be treated as destructive along with TRUNCATE and DROP SCHEMA', () => {
    for (const id of ['MG005', 'MG006', 'MG011', 'MG012', 'MG013']) {
      expect(DESTRUCTIVE_RULE_IDS.has(id)).toBe(true);
    }
  });
});

// ─── MG014: unparseable SQL ────────────────────────────────────────

describe('MG014: unparseable-sql', () => {
  it('should flag a statement the parser rejects, with the parser error', async () => {
    const stmts = await parseSql('CREAT TABLE x (id int);');
    const violations = unparseableSql.check(stmts, defaultContext);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe('MG014');
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].message).toContain('CREAT');
  });

  it('should keep the AST for the valid statements around a bad one', async () => {
    const stmts = await parseSql('CREATE INDEX idx_a ON users (email);\nCREAT TABLE x (id int);\nTRUNCATE users;');
    expect(stmts.length).toBe(3);
    expect(stmts[0].ast).not.toBeNull();
    expect(stmts[1].parseError).toBeDefined();
    expect(stmts[2].ast).not.toBeNull();
    expect(stmts[1].line).toBe(2);
    expect(createIndexNotConcurrent.check(stmts, defaultContext).length).toBe(1);
    expect(truncateTable.check(stmts, defaultContext).length).toBe(1);
    expect(unparseableSql.check(stmts, defaultContext).length).toBe(1);
  });

  it('should NOT flag valid SQL', async () => {
    const stmts = await parseSql("SET lock_timeout = '5s';\nCREATE TABLE ok (id int);");
    expect(unparseableSql.check(stmts, defaultContext).length).toBe(0);
  });
});
