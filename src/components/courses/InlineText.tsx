import { useLayoutEffect, useRef } from 'react';
import type { CourseDoc, HeadingBlock, TextBlock } from '@/course/doc';
import { sanitizeHtml } from '@/course/sanitize';
import { textStyleCss } from '@/course/typography';

export function InlineText({
  block,
  doc,
  onDone,
}: {
  block: HeadingBlock | TextBlock;
  doc: CourseDoc;
  onDone: (value: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = el.current!;
    if (block.type === 'text') node.innerHTML = sanitizeHtml(block.html);
    else node.textContent = block.text;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [block]);

  const commit = () => {
    const node = el.current!;
    onDone(
      block.type === 'text'
        ? sanitizeHtml(node.innerHTML)
        : node.innerText.replace(/\s*\n\s*/g, ' ').trim(),
    );
  };

  return (
    <div
      ref={el}
      contentEditable
      suppressContentEditableWarning
      className={`${block.type === 'text' ? 'cp-text' : `cp-h${block.level}`} cp-${block.align} cursor-text outline-none`}
      style={textStyleCss(block.textStyle, doc)}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (block.type === 'heading' && e.key === 'Enter')) {
          e.preventDefault();
          el.current!.blur();
        }
      }}
    />
  );
}
