import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, MessageSquarePlus, Paperclip, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatEntry } from '@/hooks/useCourseAssistant';
import { cn } from '@/lib/utils';
import { chatImage, deckFiles, imageFiles } from './chatImage';

export function AssistantPanel({
  entries,
  busy,
  status,
  cost,
  canUndo,
  onSend,
  onDeck,
  canFinishDeck,
  onFinishDeck,
  onStop,
  onUndo,
  canClear,
  onClear,
  onClose,
}: {
  entries: ChatEntry[];
  busy: boolean;
  status: string;
  cost: number;
  canUndo: boolean;
  onSend: (text: string, images: string[], decks: File[]) => void;
  onDeck: (file: File) => void;
  canFinishDeck: boolean;
  onFinishDeck: () => void;
  onStop: () => void;
  onUndo: () => void;
  canClear: boolean;
  onClear: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [decks, setDecks] = useState<File[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const picture = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  const attach = async (files: File[]) => {
    setDecks((all) => [...all, ...deckFiles(files)]);
    const urls = await Promise.all(imageFiles(files).map(chatImage));
    setImages((all) => [...all, ...urls]);
  };

  const ready = !!text.trim() || images.length > 0 || decks.length > 0;
  const submit = () => {
    if (!ready || busy) return;
    onSend(text.trim(), images, decks);
    setText('');
    setImages([]);
    setDecks([]);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const files = [...imageFiles(e.dataTransfer.files), ...deckFiles(e.dataTransfer.files)];
        if (!files.length) return;
        e.preventDefault();
        void attach(files);
      }}
      className="fixed bottom-5 right-5 z-40 flex h-[560px] max-h-[calc(100vh-6rem)] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[20px] border border-ph-charcoal/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center gap-2 border-b border-ph-charcoal/10 px-5 py-3">
        <strong className="text-sm font-semibold text-ph-charcoal">AI assistant</strong>
        {cost > 0 && (
          <span
            title="Claude usage cost for this session, in US dollars"
            className="text-xs text-ph-charcoal/50"
          >
            US${cost.toFixed(2)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="flex items-center gap-1 text-xs text-ph-charcoal/60 hover:text-ph-purple"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo last changes
            </button>
          )}
          {canClear && (
            <button
              type="button"
              title="Start a fresh chat. Changes already made stay."
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-ph-charcoal/60 hover:text-ph-purple"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New chat
            </button>
          )}
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-full p-1 text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4 text-sm">
        {entries.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-3 text-center text-ph-charcoal/60">
            <p>
              Import a course plan to build the pages from its slides, or tell the assistant what to
              change.
            </p>
            <Button className="rounded-full" onClick={() => file.current?.click()}>
              <FileUp className="h-4 w-4" />
              Import PowerPoint
            </Button>
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className={cn(
              'whitespace-pre-wrap',
              e.kind === 'user' &&
                'ml-8 self-end rounded-2xl rounded-br-sm bg-ph-purple px-3.5 py-2 text-white',
              e.kind === 'assistant' &&
                'mr-8 rounded-2xl rounded-bl-sm bg-ph-charcoal/5 px-3.5 py-2 text-ph-charcoal',
              e.kind === 'activity' && 'text-xs text-ph-charcoal/50',
              e.kind === 'error' && 'rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800',
            )}
          >
            {e.images?.length ? (
              <span className="mb-1.5 flex flex-wrap gap-1.5">
                {e.images.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-16 rounded-lg object-cover" />
                ))}
              </span>
            ) : null}
            {e.text}
          </div>
        ))}
        {canFinishDeck && (
          <div className="mr-8 flex flex-col items-start gap-2 rounded-2xl bg-ph-purple/5 px-3.5 py-3 text-ph-charcoal">
            <p>
              Check the pages, then let the assistant add the questions, popups and buttons the plan
              asks for. This part uses AI and costs money.
            </p>
            <Button size="sm" className="rounded-full" onClick={onFinishDeck}>
              Add the interactive parts
            </Button>
          </div>
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-ph-charcoal/50">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            {status || 'Working'}
          </div>
        )}
        <div ref={end} />
      </div>

      {images.length + decks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ph-charcoal/10 px-4 pt-3">
          {decks.map((d, i) => (
            <span
              key={`${d.name}${i}`}
              className="flex items-center gap-1 rounded-full bg-ph-charcoal/5 py-1 pl-3 pr-1.5 text-xs text-ph-charcoal"
            >
              {d.name}
              <button
                type="button"
                title="Remove file"
                onClick={() => setDecks((all) => all.filter((_, j) => j !== i))}
                className="rounded-full p-0.5 text-ph-charcoal/60 hover:text-ph-purple"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {images.map((src, i) => (
            <span key={i} className="relative">
              <img src={src} alt="" className="h-14 rounded-lg border border-ph-charcoal/10" />
              <button
                type="button"
                title="Remove picture"
                onClick={() => setImages((all) => all.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-ph-charcoal/60 shadow hover:text-ph-purple"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        className={cn(
          'flex items-end gap-2 px-4 py-3',
          !images.length && !decks.length && 'border-t border-ph-charcoal/10',
        )}
      >
        <button
          type="button"
          title="Import PowerPoint"
          disabled={busy}
          onClick={() => file.current?.click()}
          className="rounded-full p-2 text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple disabled:opacity-40"
        >
          <FileUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Attach a picture or PowerPoint to your message (or paste or drop one)"
          disabled={busy}
          onClick={() => picture.current?.click()}
          className="rounded-full p-2 text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple disabled:opacity-40"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          rows={2}
          value={text}
          placeholder="Tell it what to change"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = imageFiles(e.clipboardData.files);
            if (!files.length) return;
            e.preventDefault();
            void attach(files);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border-[1.5px] border-ph-charcoal/15 px-3 py-2 text-sm focus:border-ph-purple focus:outline-none"
        />
        {busy ? (
          <Button size="sm" variant="outline" className="rounded-full" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" className="rounded-full" disabled={!ready} onClick={submit}>
            Send
          </Button>
        )}
      </div>
      <input
        ref={picture}
        type="file"
        accept="image/*,.pptx"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void attach(files);
        }}
      />
      <input
        ref={file}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onDeck(f);
        }}
      />
    </div>
  );
}
