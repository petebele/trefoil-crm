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
  // úklid prošlých sessions (viz cleanupExpiredSessions) jede přes expires_at
  await db.schema.createIndex('sessions_expires_at').ifNotExists().on('sessions').columns(['expires_at']).execute();

  // --- modul Zákazníci ---
  await sql`ALTER TABLE persons ADD COLUMN note text`.execute(db).catch(() => {});
  // jazyk UI per uživatel ('cs' | 'en'); starší DB idempotentně
  await sql`ALTER TABLE persons ADD COLUMN lang text`.execute(db).catch(() => {});
  // pozice v týmu (prostý text); starší DB idempotentně
  await sql`ALTER TABLE persons ADD COLUMN position text`.execute(db).catch(() => {});

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
  await sql`ALTER TABLE clients ADD COLUMN retainer_hourly_rate real`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN overage_rate real`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN hours_rollover integer NOT NULL DEFAULT 0`.execute(db).catch(() => {});
  // Název zákazníka (zkrácený do hlavičky) + strukturovaná mezinárodní adresa (idempotentně)
  await sql`ALTER TABLE clients ADD COLUMN display_name text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN street text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN house_no text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN address2 text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN city text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN postal_code text`.execute(db).catch(() => {});
  await sql`ALTER TABLE clients ADD COLUMN country text`.execute(db).catch(() => {});

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
  // rozpočet služby (alokace z klientského paušálu) — idempotentně
  await sql`ALTER TABLE services ADD COLUMN budget_hours real`.execute(db).catch(() => {});
  await sql`ALTER TABLE services ADD COLUMN allow_overage integer NOT NULL DEFAULT 0`.execute(db).catch(() => {});
  await sql`ALTER TABLE services ADD COLUMN alert_pct real`.execute(db).catch(() => {});

  // --- modul Výkazy práce (Krok 6) ---
  await db.schema
    .createTable('work_records')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('client_id', 'text', (c) => c.notNull().references('clients.id'))
    .addColumn('service_id', 'text', (c) => c.notNull().references('services.id'))
    .addColumn('worker_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('description', 'text', (c) => c.notNull())
    .addColumn('note', 'text')
    .addColumn('minutes', 'integer', (c) => c.notNull())
    .addColumn('performed_at', 'text', (c) => c.notNull())
    .addColumn('billing', 'text', (c) => c.notNull().defaultTo('retainer_hours'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('pending'))
    .addColumn('approved_by_id', 'text')
    .addColumn('approved_at', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('work_records_client').ifNotExists().on('work_records').columns(['client_id', 'performed_at']).execute();
  await db.schema.createIndex('work_records_worker').ifNotExists().on('work_records').columns(['worker_id', 'performed_at']).execute();
  // volitelná vazba výkazu na úkol (Propojení Výkazů a Úkolů) — starší DB idempotentně
  await sql`ALTER TABLE work_records ADD COLUMN task_id text`.execute(db).catch(() => {});
  await db.schema.createIndex('work_records_task').ifNotExists().on('work_records').columns(['task_id']).execute();
  // zamítnutí (vrácení k přepracování) — důvod vrácení; starší DB idempotentně
  await sql`ALTER TABLE work_records ADD COLUMN rejection_reason text`.execute(db).catch(() => {});

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

  // --- modul Úkoly (Krok 7) ---
  await db.schema
    .createTable('tasks')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('category_item_id', 'text', (c) => c.references('list_items.id'))
    .addColumn('client_id', 'text', (c) => c.references('clients.id'))
    .addColumn('assignee_id', 'text', (c) => c.references('persons.id'))
    .addColumn('due_at', 'text')
    .addColumn('done', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('done_at', 'text')
    .addColumn('source_kind', 'text')
    .addColumn('source_id', 'text')
    .addColumn('created_by_id', 'text', (c) => c.references('persons.id'))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('tasks_assignee').ifNotExists().on('tasks').columns(['tenant_id', 'assignee_id', 'done']).execute();
  await db.schema.createIndex('tasks_client').ifNotExists().on('tasks').columns(['client_id']).execute();
  await db.schema.createIndex('tasks_source').ifNotExists().on('tasks').columns(['source_kind', 'source_id']).execute();
  // Kanban (Úkoly v2) — sloupce idempotentně do stávající DB
  await sql`ALTER TABLE tasks ADD COLUMN status_id text`.execute(db).catch(() => {});
  await sql`ALTER TABLE tasks ADD COLUMN prev_status_id text`.execute(db).catch(() => {});
  await sql`ALTER TABLE tasks ADD COLUMN archived integer NOT NULL DEFAULT 0`.execute(db).catch(() => {});
  await sql`ALTER TABLE tasks ADD COLUMN board_month text`.execute(db).catch(() => {});
  await sql`ALTER TABLE tasks ADD COLUMN sort_order real NOT NULL DEFAULT 0`.execute(db).catch(() => {});

  // stavy úkolů = sloupce kanbanu, per uživatel
  await db.schema
    .createTable('task_statuses')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('owner_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('label', 'text', (c) => c.notNull())
    .addColumn('color', 'text')
    .addColumn('sort_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_done', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_default', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('task_statuses_owner').ifNotExists().on('task_statuses').columns(['tenant_id', 'owner_id', 'sort_order']).execute();
  await sql`ALTER TABLE task_statuses ADD COLUMN is_default integer NOT NULL DEFAULT 0`.execute(db).catch(() => {});

  // per‑uživatelské předvolby (klíč → hodnota): zvolené zobrazení modulu apod.
  await db.schema
    .createTable('person_prefs')
    .ifNotExists()
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('person_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('key', 'text', (c) => c.notNull())
    .addColumn('value', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('person_prefs_pk', ['person_id', 'key'])
    .execute();

  // --- modul Poznámky ---
  await db.schema
    .createTable('notes')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('title', 'text')
    .addColumn('body_html', 'text', (c) => c.notNull())
    .addColumn('created_by_id', 'text', (c) => c.references('persons.id'))
    .addColumn('is_private', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();
  // nadpis poznámky (volitelný); starší DB idempotentně
  await sql`ALTER TABLE notes ADD COLUMN title text`.execute(db).catch(() => {});
  await db.schema.createIndex('notes_tenant').ifNotExists().on('notes').columns(['tenant_id', 'created_at']).execute();

  await db.schema
    .createTable('note_links')
    .ifNotExists()
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('note_id', 'text', (c) => c.notNull().references('notes.id'))
    .addColumn('entity_kind', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'text', (c) => c.notNull())
    .addColumn('sort_order', 'real', (c) => c.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('note_links_pk', ['note_id', 'entity_kind', 'entity_id'])
    .execute();
  // ruční pořadí poznámek u entity (drag/drop v mozaice); starší DB idempotentně
  await sql`ALTER TABLE note_links ADD COLUMN sort_order real NOT NULL DEFAULT 0`.execute(db).catch(() => {});
  await db.schema.createIndex('note_links_entity').ifNotExists().on('note_links').columns(['entity_kind', 'entity_id']).execute();

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

  // --- Notifikace (modul D) — adresná schránka oznámení pro příjemce ---
  await db.schema
    .createTable('notifications')
    .ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('tenant_id', 'text', (c) => c.notNull().references('tenants.id'))
    .addColumn('recipient_id', 'text', (c) => c.notNull().references('persons.id'))
    .addColumn('actor_id', 'text', (c) => c.references('persons.id'))
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('body', 'text')
    .addColumn('entity_kind', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'text', (c) => c.notNull())
    .addColumn('link', 'text', (c) => c.notNull())
    .addColumn('read_at', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('notifications_recipient')
    .ifNotExists()
    .on('notifications')
    .columns(['tenant_id', 'recipient_id', 'read_at', 'created_at'])
    .execute();

  // --- Úkoly: kategorie → ŠTÍTKY (víc na úkol). Samoopravné a idempotentní. ---
  // 1) přejmenuj Seznam, ale jen když task_labels ještě není (jinak by spadl na unique index)
  await sql`UPDATE lists SET key='task_labels', label='Štítky úkolů'
    WHERE key='task_categories' AND tenant_id NOT IN (SELECT tenant_id FROM lists WHERE key='task_labels')`.execute(db).catch(() => {});
  // 2) převeď stávající kategorie úkolů na štítky (entity_list_items), kromě generické „Úkol"
  await sql`INSERT OR IGNORE INTO entity_list_items (tenant_id, entity_kind, entity_id, list_item_id)
    SELECT t.tenant_id, 'task', t.id, t.category_item_id
    FROM tasks t
    JOIN list_items li ON li.id = t.category_item_id
    JOIN lists l ON l.id = li.list_id AND l.key = 'task_labels'
    WHERE t.category_item_id IS NOT NULL AND li.value <> 'ukol'`.execute(db).catch(() => {});
  // 3) ukliď osiřelý starý Seznam task_categories (vznikne, když task_labels už existoval).
  //    Nejdřív odpoj reference (FK je zapnuté): tasks.category_item_id i případné staré štítky.
  await sql`UPDATE tasks SET category_item_id = NULL WHERE category_item_id IN
    (SELECT id FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE key='task_categories'))`.execute(db).catch(() => {});
  await sql`DELETE FROM entity_list_items WHERE list_item_id IN
    (SELECT id FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE key='task_categories'))`.execute(db).catch(() => {});
  await sql`DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE key='task_categories')`.execute(db).catch(() => {});
  await sql`DELETE FROM lists WHERE key='task_categories'`.execute(db).catch(() => {});
  // 4) zruš generickou „Úkol" ve štítcích
  await sql`UPDATE list_items SET active=0 WHERE value='ukol' AND list_id IN (SELECT id FROM lists WHERE key='task_labels')`.execute(db).catch(() => {});
}
