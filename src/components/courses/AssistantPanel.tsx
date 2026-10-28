import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatEntry } from '@/hooks/useCourseAssistant';
import { cn } from '@/lib/utils';

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
  onClose,
}: {
  entries: ChatEntry[];
  busy: boolean;
  status: string;
  cost: number;
  canUndo: boolean;
  onSend: (text: string) => void;
  onDeck: (file: File) => void;
  canFinishDeck: boolean;
  onFinishDeck: () => void;
  onStop: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[560px] max-h-[calc(100vh-6rem)] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[20px] border border-ph-charcoal/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
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
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="ml-auto flex items-center gap-1 text-xs text-ph-charcoal/60 hover:text-ph-purple"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo last changes
          </button>
        )}
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className={cn(
            'rounded-full p-1 text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple',
            !canUndo && 'ml-auto',
          )}
        >
          <X className="h-4 w-4" />
        </button>
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

      <div className="flex items-end gap-2 border-t border-ph-charcoal/10 px-4 py-3">
        <button
          type="button"
          title="Import PowerPoint"
          disabled={busy}
          onClick={() => file.current?.click()}
          className="rounded-full p-2 text-ph-charcoal/50 hover:bg-ph-charcoal/5 hover:text-ph-purple disabled:opacity-40"
        >
          <FileUp className="h-4 w-4" />
        </button>
        <textarea
          rows={2}
          value={text}
          placeholder="Tell it what to change"
          onChange={(e) => setText(e.target.value)}
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
          <Button size="sm" className="rounded-full" disabled={!text.trim()} onClick={submit}>
            Send
          </Button>
        )}
      </div>
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
