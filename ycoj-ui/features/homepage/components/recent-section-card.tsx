import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Optional "view all" destination rendered in the card header. */
  href?: string;
  icon?: LucideIcon;
  children: ReactNode;
};

export default function RecentSectionCard({
  title,
  href,
  icon: Icon,
  children,
}: Props) {
  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="size-5" />}
          <span data-llm-text={title}>{title}</span>
          {href && (
            <Link
              href={href}
              prefetch={false}
              className="text-muted-foreground hover:text-foreground ml-auto text-xs font-normal hover:underline"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
