import AuthShell from '@/features/auth/auth-shell';
import { Button } from '@/shared/components/ui/button';
import { CircleAlert } from 'lucide-react';
import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

/** Terminal state for auth pages: expired links and disabled features. */
export default function AuthStatus({
  title,
  description,
  actionLabel,
  actionHref = '/login',
}: Props) {
  return (
    <AuthShell title={title} description={description}>
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm" role="status">
          <CircleAlert
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span data-llm-text={description}>{description}</span>
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href={actionHref}>{actionLabel ?? title}</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
