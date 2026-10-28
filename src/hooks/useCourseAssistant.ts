import { useEffect, useRef, useState } from 'react';
import { assistantTurn, importMedia, uploadMedia, type AssistantMessage } from '@/api/courses';
import { uid, type CourseDoc } from '@/course/doc';
import { ASSISTANT_SYSTEM, deckMessage } from '@/components/courses/assistantPrompt';
import { ASSISTANT_TOOLS, courseOutline, runTool } from '@/components/courses/assistantTools';
import { readPptx } from '@/components/courses/pptx';
import { importDeck, relayoutPhones } from '@/components/courses/deckToPages';
import { updateCourse } from '@/course/edit';

export interface ChatEntry {
  id: string;
  kind: 'user' | 'assistant' | 'activity' | 'error';
  text: string;
}

const MAX_STEPS = 80;

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

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const log = (kind: ChatEntry['kind'], text: string) =>
    setEntries((e) => [...e, { id: uid(), kind, text }]);

  const apply = (next: CourseDoc) => {
    docRef.current = next;
    setDoc(next);
  };

  const userBlocks = () => {
    const last = history.current[history.current.length - 1];
    if (last?.role !== 'user') return null;
    if (typeof last.content === 'string') last.content = [{ type: 'text', text: last.content }];
    return last.content as { type: string; text?: string }[];
  };

  async function run(prompt: string, controller: AbortController) {
    const text = `${prompt}\n\n<course_outline>${courseOutline(docRef.current)}</course_outline>`;
    const pending = userBlocks();
    if (pending) pending.push({ type: 'text', text });
    else history.current.push({ role: 'user', content: text });
    for (let step = 0; step < MAX_STEPS; step++) {
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
      if (!uses.length) return;
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
    log('error', `Stopped after ${MAX_STEPS} steps. Ask it to carry on if there's more to do.`);
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

  const send = (text: string) =>
    start(async (controller) => {
      log('user', text);
      await run(text, controller);
    });

  const importFile = (file: File) =>
    start(async () => {
      log('user', `Import ${file.name}`);
      setStatus('Reading the deck');
      const deck = await readPptx(file);
      const names = Object.keys(deck.media);
      const urls: Record<string, string> = {};
      for (const [i, name] of names.entries()) {
        setStatus(`Uploading pictures (${i + 1} of ${names.length})`);
        const blob = deck.media[name];
        urls[name] = (await uploadMedia(courseId, new File([blob], name, { type: blob.type }))).url;
      }
      const doc = docRef.current;
      const imported = await importDeck(deck, urls, doc, setStatus);
      const blank = doc.pages.length === 1 && doc.pages[0].blocks.length === 0;
      apply(
        updateCourse(
          doc,
          (d) => (d.pages = blank ? imported.pages : [...d.pages, ...imported.pages]),
        ),
      );
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
        log('error', `These pages are still crowded on phones: ${imported.crowded.join(', ')}.`);
      setDeckPrompt(deckMessage(deck, imported.pages, file.name));
    });

  const finishDeck = () =>
    start(async (controller) => {
      if (!deckPrompt) return;
      log('user', 'Add the questions, popups and buttons');
      await run(deckPrompt, controller);
      setDeckPrompt(null);
      setStatus('Laying out the phone pages again');
      apply(await relayoutPhones(docRef.current));
      log('activity', 'Laid out the phone pages again around the new questions');
    });

  return {
    entries,
    busy,
    status,
    cost,
    canUndo: !busy && undo !== null,
    send,
    importDeck: importFile,
    canFinishDeck: !busy && deckPrompt !== null,
    finishDeck,
    stop: () => abort.current?.abort(),
    undo: () => {
      if (!undo) return;
      apply(undo);
      setUndo(null);
      log('activity', "Undid the assistant's last changes");
    },
  };
}
