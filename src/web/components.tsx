import type { Child } from 'hono/jsx';
import { CONTACT_TYPE_LABELS } from '../domain/contacts';
import type { PersonContactsTable } from '../db/schema';
import { IconPhone, IconMail, IconGlobe, IconPlus, IconPencil } from './icons';
import { tr, fmtDateTime } from '../i18n';

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

/** Lokalizovaný štítek typu kontaktu (Telefon/E-mail/…). */
function contactTypeLabel(type: PersonContactsTable['type']): string {
  return tr(CONTACT_TYPE_LABELS[type]);
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
export function Picker(props: { id: string; trigger: Child; triggerClass?: string; triggerLabel?: string; alignRight?: boolean; children?: Child }) {
  return (
    <div class={`menu ${props.alignRight ? 'align-right' : ''}`} id={props.id} style="display:inline-block">
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

/**
 * ⋯ v pravém rohu sekce — vždy viditelný indikátor, že tu jsou akce/menu (katalog §20).
 * Jedna akce: použij ⋯ rovnou jako spouštěč (hx-get / Picker trigger).
 * Více akcí: KebabMenu s textovými položkami.
 */
export function KebabMenu(props: { id: string; label: string; children?: Child }) {
  return (
    <Picker id={props.id} trigger="⋯" triggerClass="icon-btn" triggerLabel={props.label} alignRight>
      {props.children}
    </Picker>
  );
}

// ---------- Velký modál (katalog §21) ----------

/** Overlay na střed obrazovky pro kompletní editaci záznamu. Zavírá ✕ / Esc / klik mimo. */
export function ModalShell(props: { title: string; children?: Child }) {
  return (
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-head">
          <h3>{props.title}</h3>
          <button type="button" class="icon-btn" data-modal-close aria-label={tr('Zavřít')}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** Opakovatelné řádky kontaktů pro modální formuláře (sdílené firma/osoba). */
export function ModalContactRows(props: { labels: Array<{ label: string }> }) {
  const row = (
    <div style="display:flex;gap:.4rem;margin-bottom:.4rem">
      <select class="input" name="c_type" style="max-width:6.5rem">
        <option value="phone">{tr('Telefon')}</option>
        <option value="email" selected>{tr('E-mail')}</option>
        <option value="web">{tr('Web')}</option>
        <option value="other">{tr('Jiné')}</option>
      </select>
      <input class="input" name="c_value" placeholder={tr('Hodnota')} style="flex:1" />
      <input class="input" name="c_label" list="contactLabelsModal" placeholder={tr('Štítek (Práce…)')} autocomplete="off" style="max-width:8rem" />
    </div>
  );
  return (
    <div class="field">
      <label>{tr('Kontakty')}</label>
      <template id="modalContactRow">{row}</template>
      {row}
      <button class="btn btn-ghost" type="button" data-add-row="modalContactRow">{tr('+ další kontakt')}</button>
      <datalist id="contactLabelsModal">
        {props.labels.map((l) => (
          <option value={l.label}></option>
        ))}
      </datalist>
    </div>
  );
}

// ---------- Editace pole = mini-panel, spouštěč = HODNOTA (katalog §18) ----------

/**
 * Editovatelné pole: spouštěčem je HODNOTA (`value`); panel je `children`
 * (formulář / výběr). `inline` = hodnota uvnitř textu (čárkované podtržení),
 * `wide` = široký panel pro text, `block` = hodnota přes celý řádek.
 * Otevírání, flip nad pole a kurzor do pole řeší app.js přes `.menu` mechanismus.
 */
/** Tužka-ikona (zakulacený čtverec, styl ladí s ikonkami hlavního menu). */
export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function EditField(props: {
  id: string;
  value: Child;
  label?: string;
  topLabel?: string; // popisek NAD hodnotou (řádkové pole)
  inline?: boolean;
  wide?: boolean; // užší panel pro jednořádkové vstupy
  area?: boolean; // středně široký panel pro textareu
  block?: boolean;
  alignRight?: boolean;
  children?: Child;
}) {
  const row = props.topLabel !== undefined;
  const tip = props.label ? tr('{label} — upravit', { label: props.label }) : tr('Upravit');
  // hodnota uvnitř textu (víc hodnot na řádku) = spouštěč, čárkované podtržení, bez tužky
  if (props.inline) {
    return (
      <div class={`menu ${props.alignRight ? 'align-right' : ''}`} id={props.id} style="display:inline-block">
        <span class="editable-inline" data-menu-toggle={props.id} role="button" tabindex={0} aria-haspopup="true" aria-label={tip}>
          {props.value}
        </span>
        <div class={`menu-list panel${props.wide ? ' wide' : ''}`} role="menu">
          {props.children}
        </div>
      </div>
    );
  }
  // standardní pole: JEDINÝ spouštěč = tužka; hodnota je jen zobrazená (text lze označit)
  return (
    <div class={`menu ${row ? 'field-row ' : ''}${props.alignRight ? 'align-right' : ''}`} id={props.id} style={props.block || row ? undefined : 'display:inline-block'}>
      <div class="editable">
        {row ? <span class="field-label">{props.topLabel}</span> : null}
        {props.value}
        <span class="pen-ind" data-menu-toggle={props.id} role="button" tabindex={0} aria-haspopup="true" aria-label={tip} data-tip={tip}>
          <PencilIcon />
        </span>
      </div>
      <div class={`menu-list panel${props.area ? ' area' : props.wide ? ' wide' : ''}`} role="menu">
        {props.children}
      </div>
    </div>
  );
}

/** Velký název záznamu — klik otevře panel s polem. Extra akce (Upravit/Smazat) jako children. */
export function TitleBox(props: { base: string; label: string; value: string; children?: Child }) {
  const label = tr(props.label);
  return (
    <EditField id="f-name" label={label} block value={<span class="idname field-strong">{props.value}</span>}>
      <form hx-post={`${props.base}/pole/name`} hx-target="#f-name" hx-swap="outerHTML" class="m0">
        <div class="opt-group" style="padding-left:0">{label}</div>
        <input class="input" name="value" value={props.value} required aria-label={label} style="width:100%" />
        <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:.4rem">{tr('Uložit')}</button>
      </form>
      {props.children}
    </EditField>
  );
}

/** Sekce Poznámka — klik na text (nebo „— doplnit —") otevře panel s textareou. */
export function NoteSection(props: { base: string; value: string | null }) {
  return (
    <div class="group" id="f-note">
      <div class="group-h">{tr('Poznámka')}</div>
      <EditField
        id="note-field"
        label={tr('Poznámka')}
        area
        block
        value={props.value ? <p style="white-space:pre-wrap;margin:0;font-size:.88rem;font-weight:400">{props.value}</p> : <span class="empty-inline">{tr('Žádná poznámka.')} <a class="emptylink" data-menu-toggle="note-field" role="button" tabindex={0}>{tr('Přidat poznámku.')}</a></span>}
      >
        <form hx-post={`${props.base}/pole/note`} hx-target="#f-note" hx-swap="outerHTML" class="m0">
          <div class="opt-group" style="padding-left:0">{tr('Poznámka')}</div>
          <textarea class="input" name="value" rows={3} data-autogrow aria-label={tr('Poznámka')} style="width:100%">{props.value ?? ''}</textarea>
          <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:.4rem">{tr('Uložit')}</button>
        </form>
      </EditField>
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
    <EditField id="f-status" label={tr('Stav')} block value={<StatusChip value={props.value} items={props.items} />}>
      <div class="opt-group">{tr('Stav')}</div>
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
    </EditField>
  );
}

// ---------- Odpovědná osoba: text/odkaz + dropdown panel ----------

export function OwnerBox(props: {
  base: string;
  owner: { id: string; name: string } | null;
  coworkers: Array<{ id: string; name: string }>;
}) {
  return (
    <div class="group" id="owner-box">
      <div class="group-h">{tr('Odpovědná osoba')}</div>
      <EditField
        id="owner-field"
        label={tr('Odpovědná osoba')}
        block
        value={
          props.owner ? (
            <span class="person-row" style="padding:0">
              <span class={`av av-sm ${avColor(props.owner.name)}`}>{initials(props.owner.name)}</span>
              <span class="nm" style="flex:1">{props.owner.name}</span>
            </span>
          ) : (
            <span class="empty-inline">{tr('Žádná odpovědná osoba.')} <a class="emptylink" data-menu-toggle="owner-field" role="button" tabindex={0}>{tr('Přiřadit osobu.')}</a></span>
          )
        }
      >
        <input class="input" data-filter-list placeholder={tr('Hledat kolegu…')} aria-label={tr('Hledat kolegu')} />
        <div class="opt-group">{tr('Kolegové')}</div>
        {props.coworkers.map((u) => (
          <button type="button" class="opt" hx-post={`${props.base}/owner`} hx-vals={JSON.stringify({ owner_id: u.id })} hx-target="#owner-box" hx-swap="outerHTML">
            <span style="display:flex;align-items:center;gap:.5rem">
              <span class={`av av-sm ${avColor(u.name)}`}>{initials(u.name)}</span>
              {u.name}
            </span>
            {props.owner?.id === u.id ? <span class="tick">✓</span> : null}
          </button>
        ))}
        {props.owner ? (
          <button type="button" class="opt" style="color:var(--muted)" hx-post={`${props.base}/owner`} hx-vals={JSON.stringify({ owner_id: '' })} hx-target="#owner-box" hx-swap="outerHTML">
            {tr('Zrušit přiřazení')}
          </button>
        ) : null}
      </EditField>
    </div>
  );
}

// ---------- Štítky: chipy + „+ štítek" panel ----------

export function TagsSection(props: {
  base: string;
  tags: Array<{ id: string; label: string }>;
  allTags?: Array<{ label: string }>;
}) {
  const assigned = new Set(props.tags.map((t) => t.label));
  const available = (props.allTags ?? []).filter((t) => !assigned.has(t.label));
  return (
    <EditField
      id="tags"
      label={tr('Štítky')}
      block
      value={
        props.tags.length ? (
          <span class="id-badges">{props.tags.map((tag) => <span class="chip">{tag.label}</span>)}</span>
        ) : (
          <span class="empty-inline">{tr('Žádné štítky.')} <a class="emptylink" data-menu-toggle="tags" role="button" tabindex={0}>{tr('Přidat štítek.')}</a></span>
        )
      }
    >
      <form hx-post={`${props.base}/stitek`} hx-target="#tags" hx-swap="outerHTML" class="m0">
        <div class="opt-group" style="padding-left:0">{tr('Štítky')}</div>
        <input class="input" name="label" data-filter-list placeholder={tr('Najít nebo vytvořit…')} autocomplete="off" aria-label={tr('Název štítku')} />
        <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-bottom:.35rem">{tr('Přidat napsaný štítek')}</button>
      </form>
      {props.tags.length ? <div class="opt-group">{tr('Přiřazené')}</div> : null}
      {props.tags.map((tag) => (
        <button type="button" class="opt" aria-label={tr('Odebrat štítek {label}', { label: tag.label })} hx-post={`${props.base}/stitek/${tag.id}/smazat`} hx-target="#tags" hx-swap="outerHTML">
          <span>{tag.label}</span>
          <span class="tick">✕</span>
        </button>
      ))}
      {available.length ? <div class="opt-group">{tr('Další štítky')}</div> : null}
      {available.map((t) => (
        <button type="button" class="opt" hx-post={`${props.base}/stitek`} hx-vals={JSON.stringify({ label: t.label })} hx-target="#tags" hx-swap="outerHTML">
          {t.label}
        </button>
      ))}
    </EditField>
  );
}

// ---------- Kontaktní údaje: text + hover akce + rychlé přidání ----------

function contactTypeIcon(t: PersonContactsTable['type']) {
  if (t === 'phone') return <IconPhone />;
  if (t === 'email') return <IconMail />;
  if (t === 'web') return <IconGlobe />;
  return <IconPlus />;
}

/**
 * Editovatelné řádky kontaktů (typ + hodnota + označení) s přidáním/odebráním.
 * Sdílené pro hromadnou editaci kontaktů (firma/osoba) i formulář člena týmu.
 * Posílá pole `c_type[]` / `c_value[]` / `c_label[]`; server je nahradí celé.
 */
export function ContactRowsField(props: { contacts: PersonContactsTable[]; labels: Array<{ label: string }>; label?: string }) {
  const row = (c?: PersonContactsTable) => (
    <div class="crow">
      <select class="input ctype" name="c_type" aria-label={tr('Typ kontaktu')}>
        <option value="phone" selected={c?.type === 'phone'}>{tr('Telefon')}</option>
        <option value="email" selected={c?.type === 'email'}>{tr('E-mail')}</option>
        <option value="web" selected={c?.type === 'web'}>{tr('Web')}</option>
        <option value="other" selected={c?.type === 'other'}>{tr('Jiné')}</option>
      </select>
      <input class="input cval" name="c_value" value={c?.value ?? ''} placeholder={tr('Hodnota')} autocomplete="off" aria-label={tr('Hodnota kontaktu')} />
      <input class="input clab" name="c_label" value={c?.label ?? ''} list="contactLabelsModal" placeholder={tr('Štítek')} autocomplete="off" aria-label={tr('Štítek kontaktu')} />
      <button type="button" class="icon-btn" data-remove-row aria-label={tr('Odebrat řádek')}>✕</button>
    </div>
  );
  return (
    <div class="field">
      <label>{props.label ?? tr('Kontakty')}</label>
      <div id="contactRows">
        {props.contacts.map((c) => row(c))}
        <template id="contactRowTpl">{row()}</template>
      </div>
      <button type="button" class="btn btn-ghost" data-add-row="contactRowTpl">{tr('+ přidat kontakt')}</button>
      <datalist id="contactLabelsModal">{props.labels.map((l) => <option value={l.label}></option>)}</datalist>
    </div>
  );
}

/** Modál „Upravit kontakty" — hromadná správa (typ + hodnota + štítek, přidání/odebrání). */
export function ContactsEditAll(props: { base: string; title: string; contacts: PersonContactsTable[]; labels: Array<{ label: string }> }) {
  return (
    <ModalShell title={props.title}>
      <form hx-post={`${props.base}/kontakty`} hx-target="#contacts" hx-swap="outerHTML">
        <ContactRowsField contacts={props.contacts} labels={props.labels} />
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Uložit')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Hodnota kontaktu jako odkaz (mailto/tel/web), jinak text. */
function ContactValue(props: { c: PersonContactsTable }) {
  const c = props.c;
  if (c.type === 'email') return <a href={`mailto:${c.value}`}>{c.value}</a>;
  if (c.type === 'phone') return <a href={`tel:${c.value.replace(/\s/g, '')}`} style="color:inherit;text-decoration:none">{c.value}</a>;
  if (c.type === 'web')
    return <a href={c.value.startsWith('http') ? c.value : `https://${c.value}`} target="_blank" rel="noreferrer">{c.value}</a>;
  return <>{c.value}</>;
}

/** Osoba přiřazená k firmě vč. svých kontaktů (integrovaná sekce Kontakty firmy). */
export interface PersonWithContacts {
  id: string;
  name: string;
  role_at_client: string | null;
  contacts: PersonContactsTable[];
}

export function ContactsSection(props: {
  base: string;
  contacts: PersonContactsTable[];
  labels: Array<{ label: string }>;
  allTags?: Array<{ label: string }>;
  assignedTags?: Array<{ label: string }>;
  /** Firma: přiřazené osoby se zobrazí PŘED firemními kontakty. */
  people?: PersonWithContacts[];
  /** Firma: panel „přidat osobu" (ikonka v rychlém přidání). */
  personAdd?: Child;
  /** Firma: base pro odebrání vazby osoby (POST …/osoba/:id/odebrat). */
  unlinkBase?: string;
}) {
  const groups: Array<{ type: PersonContactsTable['type']; rows: PersonContactsTable[] }> = (
    ['phone', 'email', 'web', 'other'] as const
  )
    .map((t) => ({ type: t, rows: props.contacts.filter((c) => c.type === t) }))
    .filter((g) => g.rows.length > 0);
  const people = props.people ?? [];
  const isFirm = props.people !== undefined;
  const primaryContact = (cs: PersonContactsTable[]) => {
    const ph = cs.find((c) => c.type === 'phone');
    const em = cs.find((c) => c.type === 'email');
    return ph?.value ?? em?.value ?? '';
  };
  // Hlavička sekce Kontakty: jeden ＋ (výběr typu) + ✎ hromadná editace.
  const contactAdd = (
    <span class="ha" role="group" aria-label={tr('Přidat kontakt')}>
      <Picker id="addContact" trigger={<IconPlus />} triggerClass="icon-btn" triggerLabel={tr('Přidat kontakt')}>
        <form hx-post={`${props.base}/kontakt`} hx-target="#contacts" hx-swap="outerHTML" class="m0">
          <div class="opt-group" style="padding-left:0">{tr('Nový kontakt')}</div>
          <select class="input" name="type" style="margin-bottom:.4rem" aria-label={tr('Typ kontaktu')}>
            <option value="phone">{tr('Telefon')}</option>
            <option value="email" selected>{tr('E-mail')}</option>
            <option value="web">{tr('Web')}</option>
            <option value="other">{tr('Jiné')}</option>
          </select>
          <input class="input" name="value" placeholder={tr('Hodnota')} required autocomplete="off" aria-label={tr('Hodnota kontaktu')} />
          <input class="input" name="label" list="contactLabels" placeholder={tr('Štítek (Práce, Domů…)')} autocomplete="off" aria-label={tr('Štítek kontaktu')} />
          <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center">{tr('Přidat')}</button>
        </form>
      </Picker>
      {props.contacts.length ? (
        <button type="button" class="icon-btn" hx-get={`${props.base}/kontakty/modal`} hx-target="#modal" hx-swap="innerHTML" aria-label={tr('Upravit všechny kontakty')} title={tr('Upravit vše')}>
          <IconPencil />
        </button>
      ) : null}
    </span>
  );

  return (
    <div id="contacts">
      {/* LIDÉ — jen u firmy */}
      {isFirm ? (
        <div class="group hover-area">
          <div class="group-h">
            {tr('Lidé')}
            {props.personAdd ? <span class="ha">{props.personAdd}</span> : null}
          </div>
          {people.length ? (
            people.map((p) => {
              const sub = [p.role_at_client, primaryContact(p.contacts)].filter(Boolean).join(' · ');
              return (
                <div class="prow hover-row">
                  <a href={`/osoby/${p.id}`} style="display:flex;align-items:center;gap:.6rem;flex:1;text-decoration:none;color:inherit">
                    <span class={`av av-sm ${avColor(p.name)}`}>{initials(p.name)}</span>
                    <span>
                      <span class="nm">{p.name}</span>
                      {sub ? <span class="sub" style="display:block">{sub}</span> : null}
                    </span>
                  </a>
                  {props.unlinkBase ? (
                    <span class="row-actions">
                      <KebabMenu id={`pMenu-${p.id}`} label={tr('Možnosti pro {name}', { name: p.name })}>
                        <form method="post" action={`${props.unlinkBase}/osoba/${p.id}/odebrat`} class="m0" onsubmit={`return confirm('${tr('Odebrat osobu z této firmy?')}')`}>
                          <button type="submit" class="opt">{tr('Odebrat z firmy')}</button>
                        </form>
                      </KebabMenu>
                    </span>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p class="empty-inline m0" style="padding:.25rem 0">
              {tr('Žádní lidé.')} <a class="emptylink" data-menu-toggle="personAdd" role="button" tabindex={0}>{tr('Přidat osobu.')}</a>
            </p>
          )}
        </div>
      ) : null}

      {/* KONTAKTY */}
      <div class="group hover-area">
        <div class="group-h">{tr('Kontakty')} {contactAdd}</div>
        {groups.flatMap((g) => g.rows).map((c) => (
          <div class="contact-row hover-row" id={`c-${c.id}`}>
            <span class="cico" aria-hidden="true">{contactTypeIcon(c.type)}</span>
            <span class="val"><ContactValue c={c} /></span>
            {c.label ? <span class="tagaft">{c.label}</span> : null}
            <span class="row-actions" style="margin-left:auto">
              <KebabMenu id={`cMenu-${c.id}`} label={tr('Možnosti kontaktu')}>
                <form hx-post={`${props.base}/kontakt/${c.id}`} hx-target="#contacts" hx-swap="outerHTML" class="m0">
                  <div class="opt-group" style="padding-left:0">{contactTypeLabel(c.type)}</div>
                  <input class="input" name="value" value={c.value} required aria-label={tr('Hodnota kontaktu')} />
                  <input class="input" name="label" value={c.label ?? ''} list="contactLabels" placeholder={tr('Štítek (Práce…)')} autocomplete="off" aria-label={tr('Štítek kontaktu')} />
                  <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center">{tr('Uložit')}</button>
                </form>
                <div style="border-top:1px solid var(--line);margin:.25rem 0 .1rem" />
                <button type="button" class="opt" style="color:var(--red)" hx-post={`${props.base}/kontakt/${c.id}/smazat`} hx-confirm={tr('Smazat tento kontakt?')} hx-target="#contacts" hx-swap="outerHTML">
                  {tr('Smazat')}
                </button>
              </KebabMenu>
            </span>
          </div>
        ))}
        {props.contacts.length === 0 ? (
          <p class="empty-inline m0" style="padding:.25rem 0">
            {tr('Žádné kontakty.')} <a class="emptylink" data-menu-toggle="addContact" role="button" tabindex={0}>{tr('Přidat kontakt.')}</a>
          </p>
        ) : null}
      </div>

      <datalist id="contactLabels">
        {props.labels.map((l) => (
          <option value={l.label}></option>
        ))}
      </datalist>
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
    <nav class="tabs" style="margin-top:0" aria-label={tr('Sekce detailu')}>
      {tab('nastenka', tr('Nástěnka'))}
      {tab('poznamky', tr('Poznámky'))}
      {tab('sluzby', tr('Služby'))}
      {tab('projekty', tr('Projekty'))}
      {tab('historie', tr('Historie'))}
    </nav>
  );
}

export function EventRow(props: { e: { id: string; action: string; created_at: string; person_name: string | null } }) {
  const { e } = props;
  return (
    <div style="display:flex;gap:.7rem;padding:.5rem 0;border-top:1px solid var(--line);font-size:.83rem">
      <span class="sub" style="white-space:nowrap">{fmtDateTime(e.created_at)}</span>
      <span style="font-weight:600;white-space:nowrap">{e.person_name ?? '—'}</span>
      <span style="flex:1">{e.action}</span>
      <span class="sub" title={tr('ID záznamu: {id}', { id: e.id })} style="font-size:.7rem">#{e.id.slice(0, 8)}</span>
    </div>
  );
}
