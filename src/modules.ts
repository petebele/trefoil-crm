/**
 * Registr modulů aplikace. Modul = zapínatelná část (per Organizace, tabulka tenant_modules).
 * Nástěnka a Administrace nejsou moduly (Nástěnka je vždy, Administrace vždy pro adminy).
 *
 * `built` říká, zda je modul už postavený — zapnuté nepostavené moduly se v liště
 * zobrazují šedě s popiskem „Připravujeme". Při stavbě modulu se přepne na true.
 */
export type ModuleDef = {
  key: string;
  label: string;
  desc: string;
  icon: 'users' | 'check' | 'briefcase' | 'trend';
  path: string;
  built: boolean;
};

export const MODULES: ModuleDef[] = [
  {
    key: 'zakaznici',
    label: 'Zákazníci',
    desc: 'Firmy a osoby, kontakty, štítky a historie komunikace.',
    icon: 'users',
    path: '/zakaznici',
    built: false,
  },
  {
    key: 'ukoly',
    label: 'Úkoly',
    desc: 'Úkoly s kategoriemi a termíny, přehled Po termínu / Dnes.',
    icon: 'check',
    path: '/ukoly',
    built: false,
  },
  {
    key: 'zakazky',
    label: 'Zakázky',
    desc: 'Delivery projekty s milníky a kanbanem stavů.',
    icon: 'briefcase',
    path: '/zakazky',
    built: false,
  },
  {
    key: 'obchod',
    label: 'Obchod',
    desc: 'Obchodní příležitosti v pipeline s hodnotami.',
    icon: 'trend',
    path: '/obchod',
    built: false,
  },
];

export function isModuleKey(key: string): boolean {
  return MODULES.some((m) => m.key === key);
}
