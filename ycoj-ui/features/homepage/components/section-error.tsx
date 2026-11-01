import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  /** Raw message from the backend section getter. */
  message: string;
};

/**
 * The backend replaces a section whose getter threw with `['error', message]`.
 * Showing it keeps a broken widget visible without taking down the homepage.
 */
export default function SectionError({ message }: Props) {
  const t = useTranslations('homepage');
  const title = t('sectionError');
  const text = message || t('sectionErrorDescription');

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TriangleAlert className="size-5 text-amber-600" />
          <span data-llm-text={title}>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        <p data-llm-text={text}>{text}</p>
      </CardContent>
    </Card>
  );
}
