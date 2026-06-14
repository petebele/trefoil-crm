import { db } from '../db';
import { newId, now } from '../lib/util';
import { broadcast } from '../realtime';

/**
 * Obecný log událostí (Historie): kdo, kdy, u čeho, co se stalo.
 * Každá akce v modulech zapisuje událost — dohledatelnost podle ID.
 * Zároveň se událost vysílá realtime všem otevřeným oknům (zásada živé spolupráce).
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
  broadcast({ kind: entityKind, id: entityId });
}

/** Poslední dění napříč celou Organizací (feed na Nástěnce): čas · autor · akce · odkaz. */
export async function listRecentEvents(tenantId: string, limit = 12) {
  return db
    .selectFrom('events')
    .leftJoin('persons', 'persons.id', 'events.person_id')
    .leftJoin('clients', (join) => join.onRef('clients.id', '=', 'events.entity_id').on('events.entity_kind', '=', 'client'))
    .where('events.tenant_id', '=', tenantId)
    .select([
      'events.id as id',
      'events.action as action',
      'events.created_at as created_at',
      'events.entity_kind as entity_kind',
      'events.entity_id as entity_id',
      'persons.name as person_name',
      'clients.name as client_name',
    ])
    .orderBy('events.created_at', 'desc')
    .limit(limit)
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
