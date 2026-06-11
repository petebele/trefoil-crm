import type { Child } from 'hono/jsx';
import { CONTACT_TYPE_LABELS } from '../domain/contacts';
import type { PersonContactsTable } from '../db/schema';

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

// ---------- Inline editace (katalog §18) ----------

export type FieldKind = 'text' | 'textarea' | 'select' | 'title';

export function FieldDisplay(props: {
  base: string;
  field: string;
  label: string;
  value: string | null;
  kind: FieldKind;
  display?: Child; // volitelné vlastní zobrazení hodnoty (např. chip stavu)
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
        {props.display ??
          (value ? (
            kind === 'title' ? <span class="record-name" style="margin:0">{value}</span> : <span style="white-space:pre-wrap">{value}</span>
          ) : (
            <span class="sub" style="font-style:italic">— doplnit —</span>
          ))}
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
  options?: Array<{ value: string; label: string }>;
}) {
  const { base, field, label, value, kind } = props;
  const action = `${base}/pole/${field}`;
  return (
    <div class="field-wrap" id={`f-${field}`}>
      <div class="sub" style="font-size:.73rem">{label}</div>
      <form class="inline-form" hx-post={action} hx-target={`#f-${field}`} hx-swap="outerHTML">
        {kind === 'select' ? (
          <select class="input" name="value">
            {(props.options ?? []).map((o) => (
              <option value={o.value} selected={value === o.value}>{o.label}</option>
            ))}
          </select>
        ) : kind === 'textarea' ? (
          <textarea class="input" name="value" rows={3}>{value ?? ''}</textarea>
        ) : (
          <input class="input" name="value" value={value ?? ''} />
        )}
        <button class="btn btn-sm btn-primary" type="submit">Uložit</button>
        <button class="btn btn-sm btn-ghost" type="button" hx-get={`${base}/pole/${field}`} hx-target={`#f-${field}`} hx-swap="outerHTML">
          Zrušit
        </button>
      </form>
    </div>
  );
}

// ---------- Štítky ----------

export function TagsSection(props: {
  base: string;
  tags: Array<{ id: string; label: string }>;
  allTags: Array<{ label: string }>;
}) {
  return (
    <div id="tags">
      <div class="chips" style="align-items:center">
        {props.tags.map((t) => (
          <span class="chip">
            {t.label}
            <button
              type="button"
              class="btn-ghost"
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
        <form hx-post={`${props.base}/stitek`} hx-target="#tags" hx-swap="outerHTML" class="m0" style="display:inline">
          <input
            class="input"
            name="label"
            list="allTags"
            placeholder="+ štítek"
            autocomplete="off"
            aria-label="Přidat štítek"
            style="height:1.7rem;font-size:.75rem;max-width:8.5rem;padding:0 .5rem"
          />
          <datalist id="allTags">
            {props.allTags.map((t) => (
              <option value={t.label}></option>
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
}

// ---------- Kontaktní údaje ----------

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
            <div style="display:flex;align-items:baseline;gap:.45rem">
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
              <button
                type="button"
                style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:.75rem;margin-left:auto"
                aria-label="Smazat kontakt"
                hx-post={`${props.base}/kontakt/${c.id}/smazat`}
                hx-confirm="Smazat tento kontakt?"
                hx-target="#contacts"
                hx-swap="outerHTML"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}
      {props.contacts.length === 0 ? <p class="sub m0" style="padding:.3rem 0">Zatím žádný kontakt.</p> : null}

      <form hx-post={`${props.base}/kontakt`} hx-target="#contacts" hx-swap="outerHTML" class="m0" style="margin-top:.5rem">
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <select class="input" name="type" aria-label="Typ kontaktu" style="height:30px;font-size:.78rem;max-width:6.2rem;padding:0 .4rem">
            <option value="phone">Telefon</option>
            <option value="email">E-mail</option>
            <option value="web">Web</option>
            <option value="other">Jiné</option>
          </select>
          <input class="input" name="value" placeholder="Hodnota" required aria-label="Hodnota kontaktu" style="height:30px;font-size:.78rem;flex:1;min-width:7rem" />
          <input
            class="input"
            name="label"
            list="contactLabels"
            placeholder="Štítek (Práce…)"
            autocomplete="off"
            aria-label="Štítek kontaktu"
            style="height:30px;font-size:.78rem;max-width:7.5rem"
          />
          <datalist id="contactLabels">
            {props.labels.map((l) => (
              <option value={l.label}></option>
            ))}
          </datalist>
          <button class="btn btn-sm" type="submit">Přidat</button>
        </div>
      </form>
    </div>
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
