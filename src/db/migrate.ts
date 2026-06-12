import { db } from './index';
import { sql } from 'kysely';

/** Vytvoří tabulky, pokud neexistují. Idempotentní. */
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

  // --- modul Zákazníci ---
  await sql`ALTER TABLE persons ADD COLUMN note text`.execute(db).catch(() => {});

  await db.schema
    .createTable('clients')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('kind', 'text', (c) => c.notNull().defaultTo('company'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('ico', 'text')
    .addColumn('dic', 'text')
    .addColumn('website', 'text')
    .addColumn('address', 'text')
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('lead'))
    .addColumn('owner_id', 'text', (c) => c.references('persons.id'))
    .addColumn('note', 'text')
    .addColumn('hours_budget_monthly', 'real')
    .addColumn('retainer_price', 'real')
    .addColumn('hours_rollover', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .addColumn('deleted_at', 'text')
    .execute();
  await db.schema.createIndex('clients_tenant').ifNotExists().on('clients').columns(['tenant_id']).execute();
  // starší DB bez novějších sloupců (idempotentně)
  await sql`ALTER TABLE clients ADD COLUMN address text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN hours_budget_monthly real`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN retainer_price real`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN hours_rollover integer NOT NULL DEFAULT 0`.execute(db).catch(() => {});

  // --- modul Služby (Krok 5: služby u zákazníka) ---
  await db.schema
    .createTable('services')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('client_id', 'text', (c) => c.notNull().references('clients.id'))
    .addColumn('catalog_item_id', 'text', (c) => c.notNull().references('list_items.id'))
    .addColumn('detail', 'text')
    .addColumn('description', 'text')
    .addColumn('mode', 'text', (c) => c.notNull().defaultTo('retainer'))
    .addColumn('rate', 'real')
    .addColumn('monthly_amount', 'real')
    .addColumn('owner_id', 'text', (c) => c.references('persons.id'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('services_client').ifNotExists().on('services').columns(['client_id']).execute();
  // starší DB bez sloupců detail/description (idempotentně)
  await sql`ALTER TABLE services ADD COLUMN detail text`.execute(db).catch(() => {});
  await sql`ALTER TABLE services ADD COLUMN description text`.execute(db).catch(() => {});

  await db.schema
    .createTable('person_clients')
    .ifNotExists()
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('person_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('client_id', 'text', (c) => c.notNull().references('clients.id'))
    .addColumn('role_at_client', 'text')
    .addColumn('is_primary', 'integer', (c) => c.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('person_clients_pk', ['person_id', 'client_id'])
    .execute();

  await db.schema
    .createTable('person_contacts')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('owner_kind', 'text', (c) => c.notNull())
    .addColumn('owner_id', 'text', (c) => c.notNull())
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('value', 'text', (c) => c.notNull())
    .addColumn('label', 'text')
    .addColumn('client_id', 'text')
    .addColumn('is_primary', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('person_contacts_owner')
    .ifNotExists()
    .on('person_contacts')
    .columns(['owner_kind', 'owner_id'])
    .execute();

  await db.schema
    .createTable('lists')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('key', 'text', (c) => c.notNull())
    .addColumn('label', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('lists_tenant_key').ifNotExists().on('lists').columns(['tenant_id', 'key']).unique().execute();

  await db.schema
    .createTable('list_items')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('list_id', 'text', (c) => c.notNull().references('lists.id'))
    .addColumn('value', 'text', (c) => c.notNull())
    .addColumn('label', 'text', (c) => c.notNull())
    .addColumn('color', 'text')
    .addColumn('sort_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('active', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('meta', 'text')
    .execute();
  await db.schema.createIndex('list_items_list').ifNotExists().on('list_items').columns(['list_id']).execute();
  // starší DB bez sloupce meta (idempotentně)
  await sql`ALTER TABLE list_items ADD COLUMN meta text`.execute(db).catch(() => {});

  await db.schema
    .createTable('entity_list_items')
    .ifNotExists()
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('entity_kind', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'text', (c) => c.notNull())
    .addColumn('list_item_id', 'text', (c) => c.notNull().references('list_items.id'))
    .addPrimaryKeyConstraint('entity_list_items_pk', ['entity_kind', 'entity_id', 'list_item_id'])
    .execute();

  await db.schema
    .createTable('events')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('entity_kind', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'text', (c) => c.notNull())
    .addColumn('person_id', 'text')
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('events_entity')
    .ifNotExists()
    .on('events')
    .columns(['entity_kind', 'entity_id', 'created_at'])
    .execute();
}
