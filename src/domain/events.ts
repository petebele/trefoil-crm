import { db } from '../db';
import { newId, now } from '../lib/util';

/**
 * Obecný log událostí (Historie): kdo, kdy, u čeho, co se stalo.
 * Každá akce v modulech zapisuje událost — dohledatelnost podle ID.
 */
export async function logEvent(
  tenantId: string,
  entityKind: string,
  entityId: string,
  personId: string | null,
  action: string,
): Promise<void> {
  await db
    .insertInto('events')
    .values({ id: newId(), tenant_id: tenantId, entity_kind: entityKind, entity_id: entityId, person_id: personId, action, created_at: now() })
    .execute();
}

/** Události záznamu (Historie detailu), nejnovější první, včetně jména autora. */
export async function listEvents(tenantId: string, entityKind: string, entityId: string, limit = 200) {
  return db
    .selectFrom('events')
    .leftJoin('persons', 'persons.id', 'events.person_id')
    .where('events.tenant_id', '=', tenantId)
    .where('events.entity_kind', '=', entityKind)
    .where('events.entity_id', '=', entityId)
    .select([
      'events.id as id',
      'events.action as action',
      'events.created_at as created_at',
      'persons.name as person_name',
    ])
    .orderBy('events.created_at', 'desc')
    .limit(limit)
    .execute();
}
