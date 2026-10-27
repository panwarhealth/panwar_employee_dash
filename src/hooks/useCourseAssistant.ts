import { useEffect, useRef, useState } from 'react';
import { assistantTurn, importMedia, uploadMedia, type AssistantMessage } from '@/api/courses';
import { uid, type CourseDoc } from '@/course/doc';
import { ASSISTANT_SYSTEM, deckMessage } from '@/components/courses/assistantPrompt';
import { ASSISTANT_TOOLS, courseOutline, runTool } from '@/components/courses/assistantTools';
import { readPptx } from '@/components/courses/pptx';

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

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const log = (kind: ChatEntry['kind'], text: string) =>
    setEntries((e) => [...e, { id: uid(), kind, text }]);

  const apply = (next: CourseDoc) => {
    docRef.current = next;
    setDoc(next);
  };

  async function run(prompt: string, controller: AbortController) {
    history.current.push({
      role: 'user',
      content: `${prompt}\n\n<course_outline>${courseOutline(docRef.current)}</course_outline>`,
    });
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
        const last = history.current[history.current.length - 1];
        const nudge = {
          type: 'text',
          text: 'Your last reply was too long and got cut off, so none of it was used. Do less in each reply: one put_page call at a time.',
        };
        if (typeof last.content === 'string') last.content = [{ type: 'text', text: last.content }];
        const blocks = last.content as { type: string; text?: string }[];
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
    const mark = history.current.length;
    try {
      await work(controller);
    } catch (e) {
      history.current.length = mark;
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

  const buildFromDeck = (file: File) =>
    start(async (controller) => {
      log('user', `Build the course from ${file.name}`);
      log('activity', 'Reading the deck');
      const deck = await readPptx(file);
      const names = Object.keys(deck.media);
      const urls: Record<string, string> = {};
      log('activity', `Uploading ${names.length} images`);
      for (const name of names) {
        const blob = deck.media[name];
        urls[name] = (await uploadMedia(courseId, new File([blob], name, { type: blob.type }))).url;
      }
      await run(deckMessage(deck, urls, file.name), controller);
    });

  return {
    entries,
    busy,
    status,
    cost,
    canUndo: !busy && undo !== null,
    send,
    buildFromDeck,
    stop: () => abort.current?.abort(),
    undo: () => {
      if (!undo) return;
      apply(undo);
      setUndo(null);
      log('activity', "Undid the assistant's last changes");
    },
  };
}
