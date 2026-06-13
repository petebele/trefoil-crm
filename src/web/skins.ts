/**
 * Skiny (motivy vzhledu). Vzhled aplikace NENÍ natvrdo — je řízený sadou
 * barevných tokenů (CSS proměnných). Strukturu řeší theme.css, barvy každý skin
 * v public/skins/<id>.css.
 *
 * Přidání dalšího skinu = (1) nový soubor public/skins/<id>.css s blokem
 * `:root[data-skin="<id>"] { …tokeny… }` a (2) položka v SKINS níže. Nic víc —
 * přepínač v uživatelském menu i načtení stylů se z registru vygenerují samy.
 *
 * Rodiny: Trefoil (značkový), Klasický (Capsule styl), Vysoký
 * kontrast (přístupnost). Každá má světlou a tmavou variantu.
 */
export interface Skin {
  id: string;
  label: string;
}

export const SKINS: Skin[] = [
  { id: 'trefoil-light', label: 'Trefoil · světlý' },
  { id: 'trefoil-dark', label: 'Trefoil · tmavý' },
  { id: 'oled-dark', label: 'OLED · tmavý' },
  { id: 'classic-light', label: 'Klasický · světlý' },
  { id: 'classic-dark', label: 'Klasický · tmavý' },
  { id: 'contrast-light', label: 'Vysoký kontrast · světlý' },
  { id: 'contrast-dark', label: 'Vysoký kontrast · tmavý' },
];

/** Výchozí skin při světlém / neznámém systému a při tmavém systému (první návštěva). */
export const DEFAULT_SKIN = 'classic-light';
export const DEFAULT_DARK_SKIN = 'classic-dark';

/**
 * Skript do <head>, který běží JEŠTĚ PŘED prvním vykreslením (žádné bliknutí
 * špatného motivu). Zveřejní konfiguraci do `window.__skins` (čte ji i app.js)
 * a nastaví atribut data-skin na <html>: dle volby uživatele (localStorage),
 * jinak dle systému (prefers-color-scheme). Musí být samostatný a běžet dřív
 * než app.js.
 */
export function skinBootScript(): string {
  const ids = JSON.stringify(SKINS.map((s) => s.id));
  const def = JSON.stringify(DEFAULT_SKIN);
  const dark = JSON.stringify(DEFAULT_DARK_SKIN);
  return (
    `(function(){window.__skins={ids:${ids},def:${def},dark:${dark}};try{` +
    `var c=localStorage.getItem('skin');` +
    `if(!c||window.__skins.ids.indexOf(c)<0){c=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?window.__skins.dark:window.__skins.def;}` +
    `document.documentElement.setAttribute('data-skin',c);}catch(e){}})();`
  );
}
