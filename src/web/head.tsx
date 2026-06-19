import { SKINS, skinBootScript } from './skins';

/** Verze statických souborů — zvednout při změně theme.css / app.js / skinů (cache-busting). */
export const ASSET_V = '58';

/**
 * Společné prvky <head> pro všechny stránky (vč. login a založení):
 * meta, titulek, skin-init skript (nastaví motiv ještě před vykreslením),
 * strukturní styl a tokeny všech skinů. Vrací fragment — stránka ho vloží
 * dovnitř svého <head> a může za něj přidat další skripty (htmx, app.js).
 */
export function HeadAssets(props: { title: string }) {
  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title}</title>
      {/* běží dřív než cokoli jiného → žádné bliknutí špatného motivu */}
      <script dangerouslySetInnerHTML={{ __html: skinBootScript() }} />
      <link rel="stylesheet" href={`/static/theme.css?v=${ASSET_V}`} />
      {SKINS.map((s) => (
        <link rel="stylesheet" href={`/static/skins/${s.id}.css?v=${ASSET_V}`} data-skin-css={s.id} />
      ))}
    </>
  );
}
