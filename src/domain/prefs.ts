import { db } from '../db';

/**
 * Per‑uživatelské předvolby (klíč → hodnota). Obecný, znovupoužitelný úložný bod
 * pro drobné volby uživatele — např. zvolené zobrazení modulu. Klíče pojmenováváme
 * jmenným prostorem modulu, např. `ukoly.view`.
 */

/** Hodnota předvolby, nebo null když uživatel nic nezvolil. */
export async function getPref(tenantId: string, personId: string, key: string): Promise<string | null> {
  const row = await db
    .selectFrom('person_prefs')
    .select('value')
    .where('tenant_id', '=', tenantId)
    .where('person_id', '=', personId)
    .where('key', '=', key)
    .executeTakeFirst();
  return row?.value ?? null;
}

/** Uloží (vloží/přepíše) předvolbu uživatele. */
export async function setPref(tenantId: string, personId: string, key: string, value: string): Promise<void> {
  await db
    .insertInto('person_prefs')
    .values({ tenant_id: tenantId, person_id: personId, key, value })
    .onConflict((oc) => oc.columns(['person_id', 'key']).doUpdateSet({ value }))
    .execute();
}
