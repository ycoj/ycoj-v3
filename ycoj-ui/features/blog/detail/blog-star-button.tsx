'use client';

import BlogApis from '@/api/client/method/blog';
import { Button } from '@/shared/components/ui/button';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  uid: number;
  did: string;
  starred: boolean;
};

/**
 * Star/unstar toggle. The handler persists the status and redirects back; the
 * new value is not part of the JSON body, so refresh the route data instead of
 * guessing it locally.
 */
export default function BlogStarButton({ uid, did, starred }: Props) {
  const t = useTranslations('blog');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      const action = starred ? BlogApis.unstarBlog : BlogApis.starBlog;
      const response = await action(uid, did).send();
      if ('error' in response) {
        throw new Error(
          typeof response.error?.message === 'string'
            ? response.error.message
            : t('starFailed')
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('starFailed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={starred ? 'secondary' : 'outline'}
      disabled={pending}
      onClick={handleToggle}
      aria-pressed={starred}
    >
      <Star className={starred ? 'fill-current' : undefined} />
      <span data-llm-text={starred ? t('starred') : t('star')}>
        {starred ? t('starred') : t('star')}
      </span>
    </Button>
  );
}
