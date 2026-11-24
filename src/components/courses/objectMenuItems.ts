import type { Restack } from '@/course/edit';
import type { ObjectMenuItem } from './ObjectMenu';

export function objectMenuItems({
  ids,
  canPaste,
  onCopy,
  onDuplicate,
  onPaste,
  onRemove,
  onRestack,
}: {
  ids: string[];
  canPaste: boolean;
  onCopy: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onPaste: () => void;
  onRemove: (ids: string[]) => void;
  onRestack?: (ids: string[], how: Restack) => void;
}): ObjectMenuItem[] {
  const some = ids.length > 0;
  const restack = (label: string, how: Restack): ObjectMenuItem => ({
    label,
    keys: '',
    run: () => onRestack!(ids, how),
  });
  return [
    ...(some ? [{ label: 'Copy', keys: 'Ctrl+C', run: () => onCopy(ids) }] : []),
    ...(some ? [{ label: 'Duplicate', keys: 'Ctrl+D', run: () => onDuplicate(ids) }] : []),
    ...(canPaste ? [{ label: 'Paste', keys: 'Ctrl+V', run: onPaste }] : []),
    ...(some && onRestack
      ? [
          restack('Bring to front', 'front'),
          restack('Bring forward', 'forward'),
          restack('Send backward', 'backward'),
          restack('Send to back', 'back'),
        ]
      : []),
    ...(some ? [{ label: 'Delete', keys: 'Del', run: () => onRemove(ids), danger: true }] : []),
  ];
}
