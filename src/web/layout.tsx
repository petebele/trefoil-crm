import type { Child } from 'hono/jsx';
import type { PersonsTable } from '../db/schema';
import { MODULES } from '../modules';
import { IconHome, IconSliders, IconSearch, IconPlus, IconChevron, moduleIcon } from './icons';

/** Verze statických souborů — zvednout při změně theme.css/app.js (cache-busting). */
const ASSET_V = '11';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

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

  return (
    <html lang="cs">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · Conviu CRM</title>
        <link rel="stylesheet" href={`/static/theme.css?v=${ASSET_V}`} />
        <script src="/static/htmx.min.js" defer></script>
        <script src={`/static/app.js?v=${ASSET_V}`} defer></script>
      </head>
      <body>
        {person ? (
          <header class="topbar">
            <nav class="nav-icons" aria-label="Hlavní navigace">
              <a class={`nico ${active === 'nastenka' ? 'active' : ''}`} href="/" title="Nástěnka" aria-label="Nástěnka">
                <IconHome />
              </a>
              {MODULES.filter((m) => enabled.has(m.key)).map((m) =>
                m.built ? (
                  <a
                    class={`nico ${active === m.key ? 'active' : ''}`}
                    href={m.path}
                    title={m.label}
                    aria-label={m.label}
                  >
                    {moduleIcon(m.icon)}
                  </a>
                ) : (
                  <span class="nico" style="opacity:.4;cursor:default" title={`${m.label} — připravujeme`} aria-label={`${m.label} — připravujeme`}>
                    {moduleIcon(m.icon)}
                  </span>
                ),
              )}
              {person.is_admin === 1 ? (
                <a
                  class={`nico ${active === 'administrace' ? 'active' : ''}`}
                  href="/administrace"
                  title="Administrace"
                  aria-label="Administrace"
                >
                  <IconSliders />
                </a>
              ) : null}
            </nav>

            <div class="search" role="search" title="Vyhledávání připravujeme">
              <IconSearch />
              <span>Hledat firmu, osobu, zakázku…</span>
              <kbd>/</kbd>
            </div>

            <div class="top-right">
              <div class="menu align-right" id="addMenu">
                {enabled.has('zakaznici') ? (
                  <>
                    <button class="btn" type="button" data-menu-toggle="addMenu" aria-haspopup="true">
                      Přidat <IconPlus />
                    </button>
                    <div class="menu-list" role="menu">
                      <button class="menu-item" type="button" role="menuitem" hx-get="/firmy/modal/nova" hx-target="#modal" hx-swap="innerHTML">
                        Nová firma
                      </button>
                      <button class="menu-item" type="button" role="menuitem" hx-get="/osoby/modal/nova" hx-target="#modal" hx-swap="innerHTML">
                        Nová osoba
                      </button>
                    </div>
                  </>
                ) : (
                  <button class="btn" type="button" title="Připravujeme" aria-label="Přidat — připravujeme">
                    Přidat <IconPlus />
                  </button>
                )}
              </div>
              <div class="menu align-right" id="userMenu">
                <div class="user" data-menu-toggle="userMenu" role="button" tabindex={0} aria-haspopup="true">
                  <span class="av av-i">{initials(person.name)}</span>
                  <span class="uname">
                    {person.name}
                    <small>Conviu CRM</small>
                  </span>
                  <IconChevron />
                </div>
                <div class="menu-list" role="menu">
                  <form method="post" action="/logout" class="m0">
                    <button class="menu-item" type="submit" role="menuitem">
                      Odhlásit
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
