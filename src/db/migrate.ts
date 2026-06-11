import { db } from './index';

/** Vytvoří tabulky kostry, pokud neexistují. Idempotentní. */
export async function migrate(): Promise<void> {
  await db.schema
    .createTable('tenants')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();

  await db.schema
    .createTable('tenant_modules')
    .ifNotExists()
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('module', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('tenant_modules_pk', ['tenant_id', 'module'])
    .execute();

  await db.schema
    .createTable('persons')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('login_email', 'text')
    .addColumn('password_hash', 'text')
    .addColumn('is_admin', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('deleted_at', 'text')
    .execute();
  await db.schema
    .createIndex('persons_login_email')
    .ifNotExists()
    .on('persons')
    .columns(['login_email'])
    .execute();

  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('person_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('expires_at', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
}
