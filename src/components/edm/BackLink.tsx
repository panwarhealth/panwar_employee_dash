import { Link } from '@tanstack/react-router';

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
    >
      ← {children}
    </Link>
  );
}
