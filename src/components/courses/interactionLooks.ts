import type { HoverLook, VisitedLook } from '@/course/doc';

export const HOVER_LOOKS: { value: HoverLook; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'scale', label: 'Scale up 105%' },
  { value: 'glow', label: 'Glow' },
  { value: 'lift', label: 'Lift with shadow' },
  { value: 'border', label: 'Border colour' },
];

export const VISITED_LOOKS: { value: VisitedLook; label: string }[] = [
  { value: 'none', label: 'No change' },
  { value: 'fade', label: 'Fade to 60%' },
  { value: 'tick', label: 'Show a tick' },
];
