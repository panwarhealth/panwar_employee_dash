import { useEffect, useRef, useState } from 'react';
import {
  assistantTurn,
  downloadMedia,
  importMedia,
  uploadMedia,
  type AssistantMessage,
} from '@/api/courses';
import { uid, type CourseDoc, type Layout } from '@/course/doc';
import { ASSISTANT_SYSTEM, deckMessage } from '@/components/courses/assistantPrompt';
import { ASSISTANT_TOOLS, courseOutline, runTool } from '@/components/courses/assistantTools';
import { deadControls } from '@/components/courses/assistantChecks';
import { polishCourse } from '@/components/courses/polish';
import { readPptx } from '@/components/courses/pptx';
import { importDeck, relayout } from '@/components/courses/deckToPages';
import { deckOverlap, deckReference, usedMedia } from '@/components/courses/deckReference';
import { updateCourse } from '@/course/edit';

export interface ChatEntry {
  id: string;
  kind: 'user' | 'assistant' | 'activity' | 'error';
  text: string;
  images?: string[];
}

export interface PendingDeck {
  file: File;
  pages: number;
  slides: number;
  matched: number;
}

export interface EditorView {
  pageId: string;
  layout: Layout;
  selectedId: string | null;
}

const viewNote = (v: EditorView) => {
  const view = { page: v.pageId, layout: v.layout, selected: v.selectedId };
  return `<editor_view>${JSON.stringify(view)}</editor_view>`;
};

const isBlank = (doc: CourseDoc) =>
  doc.pages.length === 1 && doc.pages[0].blocks.length === 0;

const imageBlock = (dataUrl: string) => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] },
});

const MAX_STEPS = 80;
const FINISH_STEPS = 160;
const MAX_GATES = 3;
const LISTED_DEAD = 60;

export function useCourseAssistant(
  courseId: string,
  doc: CourseDoc,
  setDoc: (doc: CourseDoc) => void,
) {
  const docRef = useRef(doc);
  const history = useRef<AssistantMessage[]>([]);
  const abort = useRef<AbortController | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [cost, setCost] = useState(0);
  const [undo, setUndo] = useState<CourseDoc | null>(null);
  const [deckPrompt, setDeckPrompt] = useState<string | null>(null);
  const [pendingDeck, setPendingDeck] = useState<PendingDeck | null>(null);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const log = (kind: ChatEntry['kind'], text: string) =>
    setEntries((e) => [...e, { id: uid(), kind, text }]);

  const apply = (next: CourseDoc) => {
    abort.current?.signal.throwIfAborted();
    docRef.current = next;
    setDoc(next);
  };

  const userBlocks = () => {
    const last = history.current[history.current.length - 1];
    if (last?.role !== 'user') return null;
    if (typeof last.content === 'string') last.content = [{ type: 'text', text: last.content }];
    return last.content as { type: string; text?: string }[];
  };

  async function run(
    prompt: string,
    controller: AbortController,
    finishing = false,
    images: string[] = [],
  ) {
    const text = `${prompt}\n\n<course_outline>${courseOutline(docRef.current)}</course_outline>`;
    const blocks = [...images.map(imageBlock), { type: 'text', text }];
    const pending = userBlocks();
    if (pending) pending.push(...blocks);
    else history.current.push({ role: 'user', content: blocks });
    const steps = finishing ? FINISH_STEPS : MAX_STEPS;
    let gates = 0;
    for (let step = 0; step < steps; step++) {
      const reply = await assistantTurn(
        courseId,
        { system: ASSISTANT_SYSTEM, tools: ASSISTANT_TOOLS, messages: history.current },
        setStatus,
        controller.signal,
      );
      setStatus('');
      setCost((c) => c + (reply.usage?.cost_usd ?? 0));
      for (const b of reply.content)
        if (b.type === 'text' && b.text?.trim()) log('assistant', b.text.trim());
      if (reply.stop_reason === 'refusal') {
        log('error', 'Claude declined that request.');
        return;
      }
      if (reply.stop_reason === 'max_tokens') {
        const nudge = {
          type: 'text',
          text: 'Your last reply was too long and got cut off, so none of it was used. Do less in each reply: one page at a time.',
        };
        const blocks = userBlocks()!;
        if (blocks.some((b) => b.type === 'text' && b.text === nudge.text)) {
          log(
            'error',
            'The reply got cut off for being too long twice in a row. Ask it to carry on.',
          );
          return;
        }
        blocks.push(nudge);
        log('activity', 'Reply was too long, asking for a smaller step');
        continue;
      }
      history.current.push({ role: 'assistant', content: reply.content });
      const uses = reply.content.filter((b) => b.type === 'tool_use');
      if (!uses.length) {
        const dead = finishing ? deadControls(docRef.current) : [];
        if (!dead.length || gates >= MAX_GATES) return;
        gates++;
        log('activity', `${dead.length} objects look like buttons but do nothing yet, sending it back`);
        const more = dead.length > LISTED_DEAD ? [`...and ${dead.length - LISTED_DEAD} more`] : [];
        history.current.push({
          role: 'user',
          content: [
            "Not finished: these objects look like buttons but nothing happens when they're clicked (page, block, text):",
            ...dead.slice(0, LISTED_DEAD),
            ...more,
            '',
            "Wire each one with set_clicks, many per call. If one really isn't meant to be clicked, add_note on it saying why.",
          ].join('\n'),
        });
        continue;
      }
      const results = [];
      for (const use of uses) {
        const outcome = await runTool(docRef.current, use.name ?? '', use.input ?? {}, {
          importMedia: (url) => importMedia(courseId, url).then((r) => r.url),
        });
        if (outcome.doc !== docRef.current) apply(outcome.doc);
        if (outcome.activity) log('activity', outcome.activity);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: outcome.result,
          ...(outcome.error ? { is_error: true } : {}),
        });
      }
      history.current.push({ role: 'user', content: results });
    }
    log('error', `Stopped after ${steps} steps. Ask it to carry on if there's more to do.`);
  }

  async function start(work: (controller: AbortController) => Promise<void>) {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setUndo(docRef.current);
    try {
      await work(controller);
    } catch (e) {
      if (controller.signal.aborted) log('activity', 'Stopped');
      else log('error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setStatus('');
      abort.current = null;
    }
  }

  async function readReference(file: File, signal: AbortSignal) {
    setStatus(`Reading ${file.name}`);
    const deck = await readPptx(file);
    const names = usedMedia(deck);
    const urls: Record<string, string> = {};
    for (const [i, name] of names.entries()) {
      signal.throwIfAborted();
      setStatus(`Uploading pictures from ${file.name} (${i + 1} of ${names.length})`);
      urls[name] = (await uploadMedia(courseId, deck.media[name])).url;
    }
    return deckReference(deck, urls, file.name);
  }

  const send = (view: EditorView, text: string, images: string[] = [], decks: File[] = []) =>
    start(async (controller) => {
      const attached = decks.length ? `\nAttached: ${decks.map((d) => d.name).join(', ')}` : '';
      setEntries((e) => [...e, { id: uid(), kind: 'user', text: text + attached, images }]);
      const references = [];
      for (const deck of decks) references.push(await readReference(deck, controller.signal));
      const prompt = text || 'See the attached files.';
      await run([prompt, viewNote(view), ...references].join('\n\n'), controller, false, images);
    });

  const importFile = (file: File, replace: boolean) =>
    start(async (controller) => {
      log('user', `${replace ? 'Replace the course with' : 'Import'} ${file.name}`);
      setStatus('Reading the deck');
      const deck = await readPptx(file);
      const names = Object.keys(deck.media);
      const urls: Record<string, string> = {};
      for (const [i, name] of names.entries()) {
        controller.signal.throwIfAborted();
        setStatus(`Uploading pictures (${i + 1} of ${names.length})`);
        urls[name] = (await uploadMedia(courseId, deck.media[name])).url;
      }
      const doc = docRef.current;
      const fresh = replace || isBlank(doc);
      const base = fresh ? { ...doc, pages: [] } : doc;
      const imported = await importDeck(deck, urls, base, setStatus);
      apply(
        updateCourse(
          doc,
          (d) => (d.pages = fresh ? imported.pages : [...d.pages, ...imported.pages]),
        ),
      );
      if (replace)
        log('activity', `Replaced the course's ${doc.pages.length} pages. Undo puts them back.`);
      const hidden = deck.slides.length - imported.pages.length;
      log(
        'activity',
        `Imported ${imported.pages.length} slides as pages${hidden ? `, skipping ${hidden} hidden` : ''}. Text, colours, pictures and positions come straight from the deck.`,
      );
      if (imported.missingFonts.length)
        log(
          'activity',
          `The deck uses fonts the course doesn't have yet: ${imported.missingFonts.join(', ')}. Upload them in Course settings so the text matches.`,
        );
      if (imported.crowded.length)
        log(
          'error',
          `These pages don't fit on phones yet: ${imported.crowded.map((p) => p.title).join(', ')}. The assistant will split them.`,
        );
      setDeckPrompt(deckMessage(deck, imported.pages, imported.crowded, file.name));
    });

  const chooseDeck = async (file: File) => {
    const doc = docRef.current;
    if (isBlank(doc)) return importFile(file, false);
    try {
      const deck = await readPptx(file);
      setPendingDeck({ file, pages: doc.pages.length, ...deckOverlap(deck, doc) });
    } catch (e) {
      log('error', e instanceof Error ? e.message : 'That PowerPoint could not be read.');
    }
  };

  const finishDeck = () =>
    start(async (controller) => {
      if (!deckPrompt) return;
      log('user', 'Add the questions, popups and buttons');
      await run(deckPrompt, controller, true);
      setDeckPrompt(null);
      setStatus('Polishing the design');
      const failed = await polishCourse(
        {
          getDoc: () => docRef.current,
          apply,
          turn: (body) => assistantTurn(courseId, body, () => {}, controller.signal),
          fetchMedia: (url) => downloadMedia(courseId, url),
          addCost: (usd) => setCost((c) => c + usd),
          signal: controller.signal,
        },
        setStatus,
      );
      if (!failed.length) log('activity', 'Polished spacing and sizes on every page');
      else
        log(
          'error',
          `Couldn't polish ${failed.length} pages, so they're as imported: ${failed.map((f) => f.pageId).join(', ')}. First error: ${failed[0].error}`,
        );
      setStatus('Laying out the phone pages again');
      const relaid = await relayout(docRef.current);
      apply(relaid.doc);
      log('activity', 'Laid out the phone pages again around the new questions');
      if (relaid.crowded.length)
        log(
          'error',
          `These pages still don't fit on phones, and have a note saying so: ${relaid.crowded.map((p) => p.title).join(', ')}.`,
        );
    });

  return {
    entries,
    busy,
    status,
    cost,
    canUndo: !busy && undo !== null,
    send,
    importDeck: (file: File) => void chooseDeck(file),
    pendingDeck: busy ? null : pendingDeck,
    resolveDeck: (choice: 'replace' | 'add' | null) => {
      const pending = pendingDeck;
      setPendingDeck(null);
      if (pending && choice) void importFile(pending.file, choice === 'replace');
    },
    canFinishDeck: !busy && deckPrompt !== null,
    finishDeck,
    canClear: !busy && entries.length > 0,
    clear: () => {
      history.current = [];
      setEntries([]);
      setDeckPrompt(null);
    },
    stop: () => {
      setStatus('Stopping');
      abort.current?.abort();
    },
    undo: () => {
      if (!undo) return;
      docRef.current = undo;
      setDoc(undo);
      setUndo(null);
      log('activity', "Undid the assistant's last changes");
    },
  };
}
