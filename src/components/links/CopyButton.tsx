import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

export function CopyButton({
  text,
  label,
  ...props
}: { text: string; label: string } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button type="button" onClick={copy} {...props}>
      {copied ? 'Copied' : label}
    </Button>
  );
}
