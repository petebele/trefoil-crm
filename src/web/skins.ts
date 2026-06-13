/**
 * Skiny (motivy vzhledu). Vzhled aplikace NENÍ natvrdo — je řízený sadou
 * barevných tokenů (CSS proměnných). Strukturu řeší theme.css, barvy každý skin
 * v public/skins/<id>.css.
 *
 * Přidání dalšího skinu = (1) nový soubor public/skins/<id>.css s blokem
 * `:root[data-skin="<id>"] { …tokeny… }` a (2) položka v SKINS níže. Nic víc —
 * přepínač v uživatelském menu i načtení stylů se z registru vygenerují samy.
 */
export interface Skin {
  id: string;
  label: string;
}

export const SKINS: Skin[] = [
  { id: 'light', label: 'Světlý' },
  { id: 'dark', label: 'Tmavý' },
];

/** Výchozí skin, když uživatel nic nevybral a nelze zjistit systémové nastavení. */
export const DEFAULT_SKIN = 'light';

/**
 * Skript do <head>, který nastaví atribut data-skin na <html> JEŠTĚ PŘED prvním
 * vykreslením — žádné bliknutí špatného motivu. Volba uživatele je
 * v localStorage['skin']; když chybí, řídí se systémovým nastavením
 * (prefers-color-scheme). Musí být samostatný (běží dřív než app.js).
 */
export function skinInitScript(): string {
  const ids = JSON.stringify(SKINS.map((s) => s.id));
  const def = JSON.stringify(DEFAULT_SKIN);
  return (
    `(function(){try{var S=${ids},k=localStorage.getItem('skin');` +
    `if(!k||S.indexOf(k)<0){k=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches&&S.indexOf('dark')>=0)?'dark':${def};}` +
    `document.documentElement.setAttribute('data-skin',k);}catch(e){}})();`
  );
}
