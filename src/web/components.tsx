import type { Child } from 'hono/jsx';
import { CONTACT_TYPE_LABELS } from '../domain/contacts';
import type { PersonContactsTable } from '../db/schema';
import { IconPhone, IconMail, IconGlobe, IconPlus, IconPencil } from './icons';

/** Sdílené komponenty modulů (skládají jen prvky z katalogu). */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Deterministická pastelová barva avataru podle jména. */
export function avColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 997;
  return ['av-g', 'av-p', 'av-b', 'av-y'][h % 4]!;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `před ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'včera' : `před ${d} dny`;
}

export function EmptyState(props: { text: string; children?: Child }) {
  return (
    <div class="empty">
      <span class="big">✓</span>
      {props.text}
      {props.children ? <div class="hint" style="margin-top:.6rem">{props.children}</div> : null}
    </div>
  );
}

/** Chip stavu zákazníka — barva z položky Seznamu client_statuses. */
export function StatusChip(props: { value: string; items: Array<{ value: string; label: string; color: string | null }> }) {
  const it = props.items.find((i) => i.value === props.value);
  const cls =
    it?.color === 'teal' ? 'chip-soft-teal' : it?.color === 'orange' ? 'chip-soft-orange' : it?.color === 'dark' ? 'chip-soft-dark' : 'chip-soft-gray';
  return <span class={`chip ${cls}`}>{it?.label ?? props.value}</span>;
}

// ---------- Dropdown panel (katalog §19) ----------

/** Obal: trigger (subtle-action/ikonka) + plovoucí panel. Otevírání řeší app.js. */
export function Picker(props: { id: string; trigger: Child; triggerClass?: string; triggerLabel?: string; children?: Child }) {
  return (
    <div class="menu" id={props.id} style="display:inline-block">
      <button
        type="button"
        class={props.triggerClass ?? 'subtle-action'}
        data-menu-toggle={props.id}
        aria-haspopup="true"
        aria-label={props.triggerLabel}
      >
        {props.trigger}
      </button>
      <div class="menu-list panel" role="menu">
        {props.children}
      </div>
    </div>
  );
}

// ---------- Inline editace (katalog §18 — kompaktní ✓/✕) ----------

export type FieldKind = 'text' | 'textarea' | 'title';

export function FieldDisplay(props: {
  base: string;
  field: string;
  label: string;
  value: string | null;
  kind: FieldKind;
}) {
  const { base, field, label, value, kind } = props;
  return (
    <div class="field-wrap" id={`f-${field}`}>
      <div class="sub" style="font-size:.73rem">{label}</div>
      <div
        class="editable"
        role="button"
        tabindex={0}
        hx-get={`${base}/pole/${field}/edit`}
        hx-target={`#f-${field}`}
        hx-swap="outerHTML"
      >
        {value ? (
          kind === 'title' ? <span class="record-name" style="margin:0">{value}</span> : <span style="white-space:pre-wrap">{value}</span>
        ) : (
          <span class="sub" style="font-style:italic">— doplnit —</span>
        )}
      </div>
    </div>
  );
}

export function FieldEdit(props: {
  base: string;
  field: string;
  label: string;
  value: string | null;
  kind: FieldKind;
}) {
  const { base, field, label, value, kind } = props;
  const action = `${base}/pole/${field}`;
  return (
    <div class="field-wrap" id={`f-${field}`}>
      <div class="sub" style="font-size:.73rem">{label}</div>
      <form class="inline-form" hx-post={action} hx-target={`#f-${field}`} hx-swap="outerHTML">
        {kind === 'textarea' ? (
          <textarea class="input" name="value" rows={3} autofocus>{value ?? ''}</textarea>
        ) : (
          <input class="input" name="value" value={value ?? ''} autofocus />
        )}
        <button class="icon-btn" type="submit" aria-label="Uložit">✓</button>
        <button class="icon-btn" type="button" aria-label="Zrušit" hx-get={action} hx-target={`#f-${field}`} hx-swap="outerHTML">
          ✕
        </button>
      </form>
    </div>
  );
}

// ---------- Stav: chip + dropdown panel ----------

export function StatusBox(props: {
  base: string;
  value: string;
  items: Array<{ value: string; label: string; color: string | null }>;
}) {
  return (
    <div class="field-wrap" id="f-status">
      <div class="sub" style="font-size:.73rem">Stav</div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <StatusChip value={props.value} items={props.items} />
        <Picker id="statusPicker" trigger="změnit" triggerLabel="Změnit stav">
          <div class="opt-group">Stav</div>
          {props.items.map((s) => (
            <button
              type="button"
              class="opt"
              hx-post={`${props.base}/pole/status`}
              hx-vals={JSON.stringify({ value: s.value })}
              hx-target="#f-status"
              hx-swap="outerHTML"
            >
              {s.label}
              {s.value === props.value ? <span class="tick">✓</span> : null}
            </button>
          ))}
        </Picker>
      </div>
    </div>
  );
}

// ---------- Odpovědná osoba: text/odkaz + dropdown panel ----------

export function OwnerBox(props: {
  base: string;
  owner: { id: string; name: string } | null;
  coworkers: Array<{ id: string; name: string }>;
}) {
  const picker = (trigger: Child, triggerClass?: string, label?: string) => (
    <Picker id="ownerPicker" trigger={trigger} triggerClass={triggerClass} triggerLabel={label}>
      <input class="input" data-filter-list placeholder="Hledat kolegu…" aria-label="Hledat kolegu" />
      <div class="opt-group">Kolegové</div>
      {props.coworkers.map((u) => (
        <button
          type="button"
          class="opt"
          hx-post={`${props.base}/owner`}
          hx-vals={JSON.stringify({ owner_id: u.id })}
          hx-target="#owner-box"
          hx-swap="outerHTML"
        >
          <span style="display:flex;align-items:center;gap:.5rem">
            <span class={`av av-sm ${avColor(u.name)}`}>{initials(u.name)}</span>
            {u.name}
          </span>
          {props.owner?.id === u.id ? <span class="tick">✓</span> : null}
        </button>
      ))}
      {props.owner ? (
        <button
          type="button"
          class="opt"
          style="color:var(--muted)"
          hx-post={`${props.base}/owner`}
          hx-vals={JSON.stringify({ owner_id: '' })}
          hx-target="#owner-box"
          hx-swap="outerHTML"
        >
          Zrušit přiřazení
        </button>
      ) : null}
    </Picker>
  );

  return (
    <div class="side-section" id="owner-box">
      <h4>Odpovědná osoba</h4>
      {props.owner ? (
        <div class="person-row hover-row">
          <span class={`av av-sm ${avColor(props.owner.name)}`}>{initials(props.owner.name)}</span>
          <span class="nm" style="flex:1">{props.owner.name}</span>
          <span class="row-actions">{picker(<IconPencil />, 'icon-btn', 'Změnit odpovědnou osobu')}</span>
        </div>
      ) : (
        picker('Přiřadit odpovědnou osobu')
      )}
    </div>
  );
}

// ---------- Štítky: chipy + „+ štítek" panel ----------

export function TagsSection(props: {
  base: string;
  tags: Array<{ id: string; label: string }>;
  allTags: Array<{ label: string }>;
}) {
  const assigned = new Set(props.tags.map((t) => t.label));
  const available = props.allTags.filter((t) => !assigned.has(t.label));
  return (
    <div id="tags">
      <div class="chips" style="align-items:center">
        {props.tags.map((t) => (
          <span class="chip hover-row">
            {t.label}
            <button
              type="button"
              class="row-actions"
              style="border:none;background:none;cursor:pointer;padding:0 0 0 .3rem;font-size:.8em;color:var(--muted)"
              aria-label={`Odebrat štítek ${t.label}`}
              hx-post={`${props.base}/stitek/${t.id}/smazat`}
              hx-target="#tags"
              hx-swap="outerHTML"
            >
              ✕
            </button>
          </span>
        ))}
        <Picker id="tagPicker" trigger="+ štítek" triggerLabel="Přidat štítek">
          <form hx-post={`${props.base}/stitek`} hx-target="#tags" hx-swap="outerHTML" class="m0">
            <input class="input" name="label" data-filter-list placeholder="Najít nebo vytvořit…" autocomplete="off" aria-label="Název štítku" />
            <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-bottom:.35rem">
              Přidat napsaný štítek
            </button>
          </form>
          {available.length ? <div class="opt-group">Existující štítky</div> : null}
          {available.map((t) => (
            <button
              type="button"
              class="opt"
              hx-post={`${props.base}/stitek`}
              hx-vals={JSON.stringify({ label: t.label })}
              hx-target="#tags"
              hx-swap="outerHTML"
            >
              {t.label}
            </button>
          ))}
        </Picker>
      </div>
    </div>
  );
}

// ---------- Kontaktní údaje: text + hover akce + rychlé přidání ----------

function contactTypeIcon(t: PersonContactsTable['type']) {
  if (t === 'phone') return <IconPhone />;
  if (t === 'email') return <IconMail />;
  if (t === 'web') return <IconGlobe />;
  return <IconPlus />;
}

function QuickAddPanel(props: { base: string; type: PersonContactsTable['type']; labels: Array<{ label: string }> }) {
  const id = `addContact-${props.type}`;
  return (
    <Picker
      id={id}
      trigger={contactTypeIcon(props.type)}
      triggerClass="icon-btn"
      triggerLabel={`Přidat: ${CONTACT_TYPE_LABELS[props.type]}`}
    >
      <form hx-post={`${props.base}/kontakt`} hx-target="#contacts" hx-swap="outerHTML" class="m0">
        <input type="hidden" name="type" value={props.type} />
        <div class="opt-group" style="padding-left:0">{CONTACT_TYPE_LABELS[props.type]}</div>
        <input class="input" name="value" placeholder="Hodnota" required autocomplete="off" aria-label="Hodnota kontaktu" />
        <input class="input" name="label" list="contactLabels" placeholder="Štítek (Práce, Domů…)" autocomplete="off" aria-label="Štítek kontaktu" />
        <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center">Přidat</button>
      </form>
    </Picker>
  );
}

export function ContactsSection(props: {
  base: string;
  contacts: PersonContactsTable[];
  labels: Array<{ label: string }>;
}) {
  const groups: Array<{ type: PersonContactsTable['type']; rows: PersonContactsTable[] }> = (
    ['phone', 'email', 'web', 'other'] as const
  )
    .map((t) => ({ type: t, rows: props.contacts.filter((c) => c.type === t) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div id="contacts">
      {groups.map((g) => (
        <div class="fact">
          <span class="lbl" style="margin-bottom:.15rem">{CONTACT_TYPE_LABELS[g.type]}</span>
          {g.rows.map((c) => (
            <div class="hover-row" id={`c-${c.id}`} style="display:flex;align-items:baseline;gap:.45rem">
              <span class="val">
                {c.type === 'email' ? (
                  <a href={`mailto:${c.value}`}>{c.value}</a>
                ) : c.type === 'web' ? (
                  <a href={c.value.startsWith('http') ? c.value : `https://${c.value}`} target="_blank" rel="noreferrer">{c.value}</a>
                ) : (
                  c.value
                )}
              </span>
              {c.label ? <span class="meta-lbl">{c.label}</span> : null}
              <span class="row-actions" style="margin-left:auto;white-space:nowrap">
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Upravit kontakt"
                  hx-get={`${props.base}/kontakt/${c.id}/edit`}
                  hx-target={`#c-${c.id}`}
                  hx-swap="outerHTML"
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Smazat kontakt"
                  hx-post={`${props.base}/kontakt/${c.id}/smazat`}
                  hx-confirm="Smazat tento kontakt?"
                  hx-target="#contacts"
                  hx-swap="outerHTML"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {props.contacts.length === 0 ? <p class="sub m0" style="padding:.3rem 0">Zatím žádný kontakt.</p> : null}

      <div class="quick-add" role="group" aria-label="Rychlé přidání kontaktu">
        <QuickAddPanel base={props.base} type="phone" labels={props.labels} />
        <QuickAddPanel base={props.base} type="email" labels={props.labels} />
        <QuickAddPanel base={props.base} type="web" labels={props.labels} />
        <QuickAddPanel base={props.base} type="other" labels={props.labels} />
      </div>
      <datalist id="contactLabels">
        {props.labels.map((l) => (
          <option value={l.label}></option>
        ))}
      </datalist>
    </div>
  );
}

/** Editace jednoho kontaktu na místě (✎). */
export function ContactEditRow(props: { base: string; contact: PersonContactsTable }) {
  const c = props.contact;
  return (
    <form class="inline-form" id={`c-${c.id}`} hx-post={`${props.base}/kontakt/${c.id}`} hx-target="#contacts" hx-swap="outerHTML">
      <input class="input" name="value" value={c.value} style="flex:2" aria-label="Hodnota kontaktu" autofocus />
      <input class="input" name="label" value={c.label ?? ''} list="contactLabels" placeholder="Štítek" style="flex:1" aria-label="Štítek kontaktu" />
      <button class="icon-btn" type="submit" aria-label="Uložit">✓</button>
      <button class="icon-btn" type="button" aria-label="Zrušit" hx-get={`${props.base}/kontakty`} hx-target="#contacts" hx-swap="outerHTML">
        ✕
      </button>
    </form>
  );
}

// ---------- Taby detailu + feed ----------

export function DetailTabs(props: { base: string; active: string }) {
  const tab = (key: string, label: string) => (
    <a class={`tab ${props.active === key ? 'active' : ''}`} href={`${props.base}?tab=${key}`}>
      {label}
    </a>
  );
  return (
    <nav class="tabs" style="margin-top:0" aria-label="Sekce detailu">
      {tab('nastenka', 'Nástěnka')}
      {tab('sluzby', 'Služby')}
      {tab('projekty', 'Projekty')}
      {tab('historie', 'Historie')}
    </nav>
  );
}

export function EventRow(props: { e: { id: string; action: string; created_at: string; person_name: string | null } }) {
  const { e } = props;
  return (
    <div style="display:flex;gap:.7rem;padding:.5rem 0;border-top:1px solid var(--line);font-size:.83rem">
      <span class="sub" style="white-space:nowrap">{formatDateTime(e.created_at)}</span>
      <span style="font-weight:600;white-space:nowrap">{e.person_name ?? '—'}</span>
      <span style="flex:1">{e.action}</span>
      <span class="sub" title={`ID záznamu: ${e.id}`} style="font-size:.7rem">#{e.id.slice(0, 8)}</span>
    </div>
  );
}
