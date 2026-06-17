import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { ModalShell, EmptyState, KebabMenu, initials, avColor } from './components';
import { logEvent } from '../domain/events';
import { clientsOfPerson } from '../domain/clients';
import { createTask } from '../domain/tasks';
import {
  getNote,
  createNote,
  updateNote,
  deleteNote,
  setNoteLinks,
  sanitizeNoteHtml,
  noteExcerpt,
  type NoteRow,
  type NoteLink,
} from '../domain/notes';
import type { PersonsTable, NotesTable } from '../db/schema';
import { tr, relTime } from '../i18n';

export const poznamkyRoutes = new Hono<AppEnv>();

const requireLogin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  await next();
};
poznamkyRoutes.use('/poznamky', requireLogin);
poznamkyRoutes.use('/poznamky/*', requireLogin);

const safeBack = (v: unknown): string => {
  const s = String(v ?? '');
  return s.startsWith('/') ? s : '/';
};
const canEditNote = (person: PersonsTable, note: { created_by_id: string | null }): boolean =>
  person.is_admin === 1 || note.created_by_id === person.id;

// ---------- editor (lišta + plocha) — chování v public/app.js ----------

function NoteToolbar() {
  return (
    <div class="note-toolbar" role="toolbar" aria-label={tr('Formátování')}>
      <span class="note-tb-group">
        <button type="button" data-cmd="bold" aria-pressed="false" aria-label={tr('Tučné')} title={tr('Tučné')} style="font-weight:700">B</button>
        <span class="note-tb-pop" role="group" aria-label={tr('Styl písma')}>
          <button type="button" data-cmd="italic" aria-pressed="false" aria-label={tr('Kurzíva')} title={tr('Kurzíva')} style="font-style:italic">I</button>
          <button type="button" data-cmd="underline" aria-pressed="false" aria-label={tr('Podtržení')} title={tr('Podtržení')} style="text-decoration:underline">U</button>
        </span>
      </span>
      <span class="note-tb-group">
        <button type="button" data-block="H1" aria-pressed="false" aria-label={tr('Nadpis')} title={tr('Nadpis')} style="font-weight:650">H1</button>
        <span class="note-tb-pop" role="group" aria-label={tr('Velikost nadpisu')}>
          <button type="button" data-block="H2" aria-pressed="false" aria-label="Nadpis 2" title="Nadpis 2">H2</button>
          <button type="button" data-block="H3" aria-pressed="false" aria-label="Nadpis 3" title="Nadpis 3">H3</button>
        </span>
      </span>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" data-cmd="insertUnorderedList" aria-pressed="false" aria-label={tr('Odrážkový seznam')} title={tr('Odrážkový seznam')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.1"/><circle cx="4" cy="12" r="1.1"/><circle cx="4" cy="18" r="1.1"/></svg>
      </button>
      <button type="button" data-cmd="insertOrderedList" aria-pressed="false" aria-label={tr('Číslovaný seznam')} title={tr('Číslovaný seznam')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="1" y="10" font-size="10.5" fill="currentColor" stroke="none">1</text><text x="1" y="20" font-size="10.5" fill="currentColor" stroke="none">2</text></svg>
      </button>
      <button type="button" data-block="BLOCKQUOTE" aria-pressed="false" aria-label={tr('Citace')} title={tr('Citace')}>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M12 12a1 1 0 0 0 1-1V8.6a1 1 0 0 0-1-1h-1.4c0-.35.02-.7.06-1.05.06-.37.17-.7.31-.99.15-.29.33-.52.56-.68.23-.19.52-.28.87-.28V3c-.58 0-1.09.12-1.52.37-.44.25-.8.58-1.09.99-.28.42-.49.9-.62 1.46A7.7 7.7 0 0 0 9 7.56V11a1 1 0 0 0 1 1h2Zm-6 0a1 1 0 0 0 1-1V8.6a1 1 0 0 0-1-1H4.6c0-.35.02-.7.06-1.05.06-.37.17-.7.31-.99.15-.29.33-.52.56-.68.23-.19.52-.28.87-.28V3c-.58 0-1.09.12-1.52.37-.44.25-.8.58-1.09.99-.28.42-.49.9-.62 1.46A7.7 7.7 0 0 0 3 7.56V11a1 1 0 0 0 1 1h2Z"/></svg>
      </button>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" data-cmd="createLink" aria-label={tr('Vložit odkaz')} title={tr('Vložit odkaz')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" data-cmd="clearformat" aria-label={tr('Vymazat formátování')} title={tr('Vymazat formátování')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/></svg>
      </button>
    </div>
  );
}

/** Modál nové/upravené poznámky. U osoby (subjekt) nabídne „Týká se i firmy" (i v editaci). */
function NoteEditorModal(props: {
  note: (NotesTable & { links: NoteLink[] }) | null;
  subjectKind: 'client' | 'person';
  subjectId: string;
  back: string;
  companies: Array<{ id: string; name: string }>;
  checkedClientIds: string[];
}) {
  const note = props.note;
  const isPrivate = note ? note.is_private === 1 : false;
  const checked = new Set(props.checkedClientIds);
  return (
    <ModalShell title={note ? tr('Upravit poznámku') : tr('Nová poznámka')}>
      <form method="post" action={note ? `/poznamky/${note.id}` : '/poznamky'}>
        <input type="hidden" name="back" value={props.back} />
        <input type="hidden" name="subject_kind" value={props.subjectKind} />
        <input type="hidden" name="subject_id" value={props.subjectId} />
        {/* app.js přepíše z .note-area při odeslání */}
        <input type="hidden" name="body_html" value={note?.body_html ?? ''} />
        <div class="field">
          <div class="note-editor">
            <NoteToolbar />
            <div
              class={note?.body_html ? 'note-area' : 'note-area is-empty'}
              contenteditable={true}
              data-placeholder={tr('Napiš poznámku…')}
              aria-label={tr('Obsah poznámky')}
              dangerouslySetInnerHTML={{ __html: note?.body_html || '<p><br></p>' }}
            />
          </div>
        </div>
        {props.subjectKind === 'person' && props.companies.length > 0 ? (
          <div class="field">
            <label>{tr('Týká se i firmy')}</label>
            {props.companies.map((co) => (
              <label style="display:flex;align-items:center;gap:.45rem;font-size:.84rem;margin:.15rem 0">
                <input type="checkbox" name="firmy" value={co.id} checked={checked.has(co.id)} /> {co.name}
              </label>
            ))}
            <span class="help">{tr('Poznámka se pak ukáže i ve feedu firmy (se štítkem „u osoby").')}</span>
          </div>
        ) : null}
        <label style="display:flex;align-items:center;gap:.45rem;font-size:.84rem;margin:.2rem 0 1rem">
          <input type="checkbox" name="is_private" value="1" checked={isPrivate} /> {tr('Soukromá (vidí jen já)')}
        </label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{note ? tr('Uložit změny') : tr('Uložit poznámku')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zrušit')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Karta poznámky ve feedu. */
function NoteCard(props: { n: NoteRow; person: PersonsTable; base: string; feedKind: 'client' | 'person'; canTask: boolean }) {
  const { n, person } = props;
  const back = `${props.base}?tab=poznamky`;
  const canEdit = canEditNote(person, n);
  const upravitUrl = `/poznamky/${n.id}/upravit?back=${encodeURIComponent(back)}`;
  // ve feedu firmy ukaž navázané osoby („u osoby X"), ve feedu osoby navázané firmy (štítek firmy)
  const origins = props.feedKind === 'client' ? n.person_origins.map((o) => tr('u osoby {name}', { name: o.name })) : n.client_origins.map((c) => c.name);
  return (
    <div class="hover-row" style="display:flex;gap:.7rem;padding:.7rem 0;border-top:1px solid var(--line)">
      <span class={`av ${avColor(n.author_name ?? '?')}`}>{initials(n.author_name ?? '?')}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          <b style="font-size:.84rem">{n.author_name ?? '—'}</b>
          <span class="sub" style="font-size:.76rem">· {relTime(n.created_at)}</span>
          {n.is_private === 1 ? <span class="chip chip-soft-gray">{tr('Soukromá')}</span> : null}
          {origins.map((label) => <span class="chip chip-soft-gray">{label}</span>)}
          {canEdit || props.canTask ? (
            <span class="row-actions" style="margin-left:auto">
              <KebabMenu id={`nMenu-${n.id}`} label={tr('Možnosti poznámky')}>
                {canEdit ? (
                  <button class="opt" type="button" hx-get={upravitUrl} hx-target="#modal" hx-swap="innerHTML">{tr('Upravit')}</button>
                ) : null}
                {props.canTask ? (
                  <form method="post" action={`/poznamky/${n.id}/ukol`} class="m0">
                    <input type="hidden" name="back" value={back} />
                    <button class="opt" type="submit">{tr('Vytvořit úkol')}</button>
                  </form>
                ) : null}
                {canEdit ? (
                  <form method="post" action={`/poznamky/${n.id}/viditelnost`} class="m0">
                    <input type="hidden" name="back" value={back} />
                    <button class="opt" type="submit">{n.is_private === 1 ? tr('Zveřejnit (sdílet týmu)') : tr('Označit jako soukromou')}</button>
                  </form>
                ) : null}
                {canEdit ? (
                  <form method="post" action={`/poznamky/${n.id}/smazat`} class="m0" onsubmit={`return confirm('${tr('Smazat tuto poznámku?')}')`}>
                    <input type="hidden" name="back" value={back} />
                    <button class="opt" type="submit" style="color:var(--red)">{tr('Smazat')}</button>
                  </form>
                ) : null}
              </KebabMenu>
            </span>
          ) : null}
        </div>
        <div class="note-content" style="margin-top:.3rem" dangerouslySetInnerHTML={{ __html: n.body_html }} />
      </div>
    </div>
  );
}

/** Záložka „Poznámky" na detailu firmy/osoby (vykresluje firmy.tsx / osoby.tsx). */
export function NotesTab(props: {
  base: string;
  kind: 'client' | 'person';
  entityId: string;
  notes: NoteRow[];
  person: PersonsTable;
  canTask: boolean;
}) {
  const back = `${props.base}?tab=poznamky`;
  const novyUrl = `/poznamky/novy?kind=${props.kind}&id=${props.entityId}&back=${encodeURIComponent(back)}`;
  return (
    <div class="card">
      <div class="card-head">
        <h3>{tr('Poznámky')}</h3>
        <button class="btn btn-sm" type="button" hx-get={novyUrl} hx-target="#modal" hx-swap="innerHTML">{tr('Nová poznámka')}</button>
      </div>
      {props.notes.length === 0 ? (
        <EmptyState text={tr('Zatím žádná poznámka.')}>
          <button class="btn btn-sm btn-primary" type="button" hx-get={novyUrl} hx-target="#modal" hx-swap="innerHTML">{tr('Napsat poznámku')}</button>
        </EmptyState>
      ) : (
        <div>{props.notes.map((n) => <NoteCard n={n} person={props.person} base={props.base} feedKind={props.kind} canTask={props.canTask} />)}</div>
      )}
    </div>
  );
}

// ---------- routy ----------

/** Sestaví vazby poznámky z formuláře: subjekt (firma/osoba) + volitelně firmy (propis u osoby). */
async function subjectLinksFromBody(
  t: string,
  body: Record<string, unknown>,
): Promise<{ subjectKind: 'client' | 'person'; subjectId: string; links: NoteLink[] }> {
  const subjectKind: 'client' | 'person' = body.subject_kind === 'person' ? 'person' : 'client';
  const subjectId = String(body.subject_id ?? '');
  const links: NoteLink[] = subjectId ? [{ kind: subjectKind, id: subjectId }] : [];
  if (subjectKind === 'person' && subjectId) {
    const raw = body.firmy;
    const firmIds = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
    const allowed = new Set((await clientsOfPerson(t, subjectId)).map((x) => x.id));
    for (const f of firmIds) if (allowed.has(f)) links.push({ kind: 'client', id: f });
  }
  return { subjectKind, subjectId, links };
}

poznamkyRoutes.get('/poznamky/novy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const kind = c.req.query('kind') === 'person' ? 'person' : 'client';
  const id = c.req.query('id') ?? '';
  const companies = kind === 'person' && id ? (await clientsOfPerson(t, id)).map((x) => ({ id: x.id, name: x.name })) : [];
  return c.html(<NoteEditorModal note={null} subjectKind={kind} subjectId={id} back={safeBack(c.req.query('back'))} companies={companies} checkedClientIds={[]} />);
});

poznamkyRoutes.get('/poznamky/:id/upravit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const note = await getNote(t, c.req.param('id'));
  const back = safeBack(c.req.query('back'));
  if (!note) return c.notFound();
  if (!canEditNote(person, note)) return c.redirect(back);
  // subjekt = navázaná osoba (má-li ji), jinak navázaná firma
  const personLink = note.links.find((l) => l.kind === 'person');
  const subjectKind: 'client' | 'person' = personLink ? 'person' : 'client';
  const subjectId = personLink ? personLink.id : note.links.find((l) => l.kind === 'client')?.id ?? '';
  const companies = subjectKind === 'person' && subjectId ? (await clientsOfPerson(t, subjectId)).map((x) => ({ id: x.id, name: x.name })) : [];
  const checkedClientIds = note.links.filter((l) => l.kind === 'client').map((l) => l.id);
  return c.html(<NoteEditorModal note={note} subjectKind={subjectKind} subjectId={subjectId} back={back} companies={companies} checkedClientIds={checkedClientIds} />);
});

poznamkyRoutes.post('/poznamky', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody({ all: true });
  const back = safeBack(body.back);
  const bodyHtml = String(body.body_html ?? '');
  const { subjectKind, subjectId, links } = await subjectLinksFromBody(t, body);
  if (!subjectId || !sanitizeNoteHtml(bodyHtml)) return c.redirect(back); // prázdnou poznámku nezakládáme
  await createNote(t, person.id, { bodyHtml, isPrivate: String(body.is_private ?? '') === '1', links });
  await logEvent(t, subjectKind, subjectId, person.id, `Přidána poznámka: ${noteExcerpt(bodyHtml)}`);
  return c.redirect(back);
});

poznamkyRoutes.post('/poznamky/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const note = await getNote(t, c.req.param('id'));
  const body = await c.req.parseBody({ all: true });
  const back = safeBack(body.back);
  if (!note) return c.notFound();
  if (!canEditNote(person, note)) return c.redirect(back);
  const bodyHtml = String(body.body_html ?? '');
  if (!sanitizeNoteHtml(bodyHtml)) return c.redirect(back);
  const { subjectKind, subjectId, links } = await subjectLinksFromBody(t, body);
  await updateNote(t, note.id, { bodyHtml, isPrivate: String(body.is_private ?? '') === '1' });
  if (subjectId) await setNoteLinks(t, note.id, links); // přepočti vazby (i propis na firmy)
  await logEvent(t, subjectKind, subjectId || note.links[0]?.id || '', person.id, `Upravena poznámka: ${noteExcerpt(bodyHtml)}`);
  return c.redirect(back);
});

poznamkyRoutes.post('/poznamky/:id/viditelnost', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const note = await getNote(t, c.req.param('id'));
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (!note) return c.notFound();
  if (!canEditNote(person, note)) return c.redirect(back);
  await updateNote(t, note.id, { bodyHtml: note.body_html, isPrivate: note.is_private !== 1 });
  return c.redirect(back);
});

poznamkyRoutes.post('/poznamky/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const note = await getNote(t, c.req.param('id'));
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (!note) return c.notFound();
  if (!canEditNote(person, note)) return c.redirect(back);
  await deleteNote(t, note.id);
  const first = note.links[0];
  if (first) await logEvent(t, first.kind, first.id, person.id, `Smazána poznámka`);
  return c.redirect(back);
});

poznamkyRoutes.post('/poznamky/:id/ukol', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (!c.get('modules').has('ukoly')) return c.redirect(back);
  const note = await getNote(t, c.req.param('id'));
  if (!note) return c.notFound();
  const clientLink = note.links.find((l) => l.kind === 'client');
  const title = noteExcerpt(note.body_html, 90) || tr('Úkol z poznámky');
  await createTask(t, person.id, {
    title,
    categoryItemId: null,
    clientId: clientLink?.id ?? null,
    assigneeId: person.id,
    dueAt: null,
    sourceKind: 'note',
    sourceId: note.id,
  });
  if (clientLink) await logEvent(t, 'client', clientLink.id, person.id, `Úkol z poznámky: ${title}`);
  return c.redirect(back);
});
