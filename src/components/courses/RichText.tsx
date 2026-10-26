import { useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { SIZES } from '@/course/typography';
import { FontOptions } from './fontContext';

const toolClass = 'rounded p-1.5 text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple';
const pickClass =
  'h-7 rounded border border-ph-charcoal/15 bg-white px-1 text-xs text-ph-charcoal focus:border-ph-purple focus:outline-none';

export function RichText({
  label,
  html,
  onChange,
}: {
  label: string;
  html: string;
  onChange: (v: string) => void;
}) {
  const fonts = useContext(FontOptions);
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(html);
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial.current;
  }, []);

  const remember = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode))
      saved.current = sel.getRangeAt(0).cloneRange();
  };

  const restore = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  };

  const commit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
    remember();
  };

  const run = (command: string, arg?: string) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    commit();
  };

  const setSize = (px: number) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, '7');
    ref.current
      ?.querySelectorAll<HTMLElement>('[style*="xxx-large"], font[size="7"]')
      .forEach((el) => {
        el.removeAttribute('size');
        el.style.fontSize = `${px / 16}em`;
      });
    commit();
  };

  const tools: { icon: ReactNode; title: string; act: () => void }[] = [
    { icon: <Bold className="h-3.5 w-3.5" />, title: 'Bold', act: () => run('bold') },
    { icon: <Italic className="h-3.5 w-3.5" />, title: 'Italic', act: () => run('italic') },
    {
      icon: <Underline className="h-3.5 w-3.5" />,
      title: 'Underline',
      act: () => run('underline'),
    },
    {
      icon: <Strikethrough className="h-3.5 w-3.5" />,
      title: 'Strikethrough',
      act: () => run('strikeThrough'),
    },
    {
      icon: <AlignLeft className="h-3.5 w-3.5" />,
      title: 'Align left',
      act: () => run('justifyLeft'),
    },
    {
      icon: <AlignCenter className="h-3.5 w-3.5" />,
      title: 'Centre',
      act: () => run('justifyCenter'),
    },
    {
      icon: <AlignRight className="h-3.5 w-3.5" />,
      title: 'Align right',
      act: () => run('justifyRight'),
    },
    {
      icon: <AlignJustify className="h-3.5 w-3.5" />,
      title: 'Justify',
      act: () => run('justifyFull'),
    },
    {
      icon: <List className="h-3.5 w-3.5" />,
      title: 'Bullet list',
      act: () => run('insertUnorderedList'),
    },
    {
      icon: <ListOrdered className="h-3.5 w-3.5" />,
      title: 'Numbered list',
      act: () => run('insertOrderedList'),
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: 'Link',
      act: () => {
        const url = window.prompt('Link address (https://...)');
        if (url) run('createLink', url);
      },
    },
    {
      icon: <Eraser className="h-3.5 w-3.5" />,
      title: 'Clear formatting',
      act: () => run('removeFormat'),
    },
  ];

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{label}</span>
      <div className="rounded-md border-[1.5px] border-ph-charcoal/15 bg-white focus-within:border-ph-purple">
        <div className="flex flex-wrap items-center gap-1 border-b border-ph-charcoal/10 px-1.5 py-1">
          <select
            className={`${pickClass} w-28`}
            title="Font"
            value=""
            onMouseDown={remember}
            onChange={(e) => {
              const f = fonts.find((x) => x.id === e.target.value);
              if (f?.css) run('fontName', f.css);
            }}
          >
            <option value="">Font…</option>
            {fonts
              .filter((f) => f.css)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
          </select>
          <select
            className={`${pickClass} w-16`}
            title="Size"
            value=""
            onMouseDown={remember}
            onChange={(e) => e.target.value && setSize(Number(e.target.value))}
          >
            <option value="">Size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label
            title="Text colour"
            className="flex items-center gap-0.5 text-xs text-ph-charcoal/70"
          >
            A
            <input
              type="color"
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              onMouseDown={remember}
              onChange={(e) => run('foreColor', e.target.value)}
            />
          </label>
          <label
            title="Highlight"
            className="flex items-center gap-0.5 text-xs text-ph-charcoal/70"
          >
            <span className="bg-yellow-200 px-0.5">ab</span>
            <input
              type="color"
              defaultValue="#fff59d"
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              onMouseDown={remember}
              onChange={(e) => run('hiliteColor', e.target.value)}
            />
          </label>
          {tools.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.act}
              className={toolClass}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={commit}
          onKeyUp={remember}
          onMouseUp={remember}
          onBlur={remember}
          className="min-h-[110px] px-2.5 py-2 text-sm text-ph-charcoal focus:outline-none [&_a]:text-ph-purple [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  );
}
