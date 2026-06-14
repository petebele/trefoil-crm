import type { Child } from 'hono/jsx';
import type { PersonsTable } from '../db/schema';
import { MODULES } from '../modules';
import { SKINS } from './skins';
import { HeadAssets, ASSET_V } from './head';
import { IconHome, IconSliders, IconSearch, IconPlus, IconChevron, moduleIcon } from './icons';
import { initials } from './components';
import { tr, getLocale, LOCALES } from '../i18n';

/**
 * Společný obal stránky. Lišta ukazuje Nástěnku (vždy), JEN zapnuté moduly
 * a Administraci (jen adminům). Zapnuté nepostavené moduly = „Připravujeme".
 */
export function Layout(props: {
  title: string;
  person: PersonsTable | null;
  modules?: Set<string>;
  active?: string; // 'nastenka' | klíč modulu | 'administrace'
  children?: Child;
}) {
  const { title, person, children } = props;
  const enabled = props.modules ?? new Set<string>();
  const active = props.active ?? '';
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <HeadAssets title={`${title} · Trefoil CRM`} />
        <script src="/static/htmx.min.js" defer></script>
        <script src={`/static/app.js?v=${ASSET_V}`} defer></script>
      </head>
      <body>
        {person ? (
          <header class="topbar">
            <nav class="nav-icons" aria-label={tr('Hlavní navigace')}>
              <a class={`nico ${active === 'nastenka' ? 'active' : ''}`} href="/" title={tr('Nástěnka')} aria-label={tr('Nástěnka')}>
                <IconHome />
              </a>
              {MODULES.filter((m) => enabled.has(m.key)).map((m) =>
                m.built ? (
                  <a
                    class={`nico ${active === m.key ? 'active' : ''}`}
                    href={m.path}
                    title={tr(m.label)}
                    aria-label={tr(m.label)}
                  >
                    {moduleIcon(m.icon)}
                  </a>
                ) : (
                  <span class="nico" style="opacity:.4;cursor:default" title={tr('{label} — připravujeme', { label: tr(m.label) })} aria-label={tr('{label} — připravujeme', { label: tr(m.label) })}>
                    {moduleIcon(m.icon)}
                  </span>
                ),
              )}
              {person.is_admin === 1 ? (
                <a
                  class={`nico ${active === 'administrace' ? 'active' : ''}`}
                  href="/administrace"
                  title={tr('Administrace')}
                  aria-label={tr('Administrace')}
                >
                  <IconSliders />
                </a>
              ) : null}
            </nav>

            <div class="search" role="search" title={tr('Vyhledávání připravujeme')}>
              <IconSearch />
              <span>{tr('Hledat firmu, osobu, zakázku…')}</span>
              <kbd>/</kbd>
            </div>

            <div class="top-right">
              <div class="menu align-right" id="addMenu">
                {enabled.has('zakaznici') || enabled.has('vykazy') || enabled.has('ukoly') ? (
                  <>
                    <button class="btn" type="button" data-menu-toggle="addMenu" aria-haspopup="true">
                      {tr('Přidat')} <IconPlus />
                    </button>
                    <div class="menu-list" role="menu">
                      {enabled.has('zakaznici') ? (
                        <>
                          <button class="menu-item" type="button" role="menuitem" hx-get="/firmy/modal/nova" hx-target="#modal" hx-swap="innerHTML">
                            {tr('Nová firma')}
                          </button>
                          <button class="menu-item" type="button" role="menuitem" hx-get="/osoby/modal/nova" hx-target="#modal" hx-swap="innerHTML">
                            {tr('Nová osoba')}
                          </button>
                        </>
                      ) : null}
                      {enabled.has('ukoly') ? (
                        <button class="menu-item" type="button" role="menuitem" hx-get="/ukoly/modal/novy" hx-target="#modal" hx-swap="innerHTML">
                          {tr('Úkol')}
                        </button>
                      ) : null}
                      {enabled.has('vykazy') ? (
                        <button class="menu-item" type="button" role="menuitem" hx-get="/vykazy/modal/novy" hx-target="#modal" hx-swap="innerHTML">
                          {tr('Výkaz práce')}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <button class="btn" type="button" title={tr('Připravujeme')} aria-label={tr('Přidat — připravujeme')}>
                    {tr('Přidat')} <IconPlus />
                  </button>
                )}
              </div>
              <div class="menu align-right" id="userMenu">
                <div class="user" data-menu-toggle="userMenu" role="button" tabindex={0} aria-haspopup="true">
                  <span class="av av-i">{initials(person.name)}</span>
                  <span class="uname">
                    {person.name}
                    <small>Trefoil CRM</small>
                  </span>
                  <IconChevron />
                </div>
                <div class="menu-list" role="menu">
                  <div class="submenu">
                    <button class="menu-item has-sub" type="button" data-submenu-toggle aria-haspopup="true">
                      {tr('Vzhledy')}
                      <span class="sub-arrow" aria-hidden="true">›</span>
                    </button>
                    <div class="menu-list submenu-list" role="menu" aria-label={tr('Vzhledy')}>
                      {SKINS.map((s) => (
                        <button class="opt" type="button" role="menuitemradio" aria-checked="false" data-skin-set={s.id}>
                          <span>{tr(s.label)}</span>
                          <span class="tick">✓</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div class="submenu">
                    <button class="menu-item has-sub" type="button" data-submenu-toggle aria-haspopup="true">
                      {tr('Jazyk a formáty')}
                      <span class="sub-arrow" aria-hidden="true">›</span>
                    </button>
                    <div class="menu-list submenu-list" role="menu" aria-label={tr('Jazyk a formáty')}>
                      {LOCALES.map((l) => (
                        <form method="post" action="/jazyk" class="m0">
                          <input type="hidden" name="lang" value={l.id} />
                          <button class="opt" type="submit" role="menuitemradio" aria-checked={locale === l.id ? 'true' : 'false'}>
                            <span>{l.label}</span>
                            {locale === l.id ? <span class="tick">✓</span> : null}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                  <div class="menu-sep"></div>
                  <form method="post" action="/logout" class="m0">
                    <button class="menu-item" type="submit" role="menuitem">
                      {tr('Odhlásit')}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </header>
        ) : null}
        <main class="page">{children}</main>
        <div id="modal"></div>
      </body>
    </html>
  );
}
