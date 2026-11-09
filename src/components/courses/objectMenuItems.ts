import type { ObjectMenuItem } from './ObjectMenu';

export function objectMenuItems({
  ids,
  canPaste,
  onCopy,
  onDuplicate,
  onPaste,
  onRemove,
}: {
  ids: string[];
  canPaste: boolean;
  onCopy: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onPaste: () => void;
  onRemove: (ids: string[]) => void;
}): ObjectMenuItem[] {
  const some = ids.length > 0;
  return [
    ...(some ? [{ label: 'Copy', keys: 'Ctrl+C', run: () => onCopy(ids) }] : []),
    ...(some ? [{ label: 'Duplicate', keys: 'Ctrl+D', run: () => onDuplicate(ids) }] : []),
    ...(canPaste ? [{ label: 'Paste', keys: 'Ctrl+V', run: onPaste }] : []),
    ...(some ? [{ label: 'Delete', keys: 'Del', run: () => onRemove(ids), danger: true }] : []),
  ];
}
