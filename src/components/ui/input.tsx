import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-ph-charcoal/20 bg-white px-3 py-1 text-sm text-ph-charcoal shadow-sm transition-colors',
        'placeholder:text-ph-charcoal/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ph-purple/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
