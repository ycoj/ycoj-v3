'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** Matches the legacy homepage widget request. */
const HITOKOTO_ENDPOINT = 'https://v1.hitokoto.cn/?c=a&c=b&c=c&c=d&c=e&c=f';

type State =
  | { status: 'loading' }
  | { status: 'ready'; text: string; from: string }
  | { status: 'error' };

type HitokotoPayload = {
  hitokoto?: unknown;
  from?: unknown;
};

/**
 * A one-line quote from the public Hitokoto service. The legacy page rendered
 * an empty card and filled it from the browser, so a blocked network request
 * degrades to a short notice instead of failing the homepage.
 */
export default function Hitokoto() {
  const t = useTranslations('homepage');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const response = await fetch(HITOKOTO_ENDPOINT, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('request failed');
        const data = (await response.json()) as HitokotoPayload;
        const text = typeof data.hitokoto === 'string' ? data.hitokoto : '';
        if (!text) throw new Error('empty quote');
        setState({
          status: 'ready',
          text,
          from: typeof data.from === 'string' ? data.from : '',
        });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: 'error' });
      }
    };
    void run();
    return () => controller.abort();
  }, []);

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Quote className="size-5" />
          <span data-llm-text={t('hitokoto')}>{t('hitokoto')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground min-h-10 text-sm">
        {state.status === 'ready' && (
          <blockquote className="space-y-1">
            <p data-llm-text={state.text} className="text-foreground">
              {state.text}
            </p>
            {state.from && (
              <footer className="text-xs" data-llm-text={state.from}>
                — {state.from}
              </footer>
            )}
          </blockquote>
        )}
        {state.status === 'error' && (
          <p data-llm-text={t('hitokotoUnavailable')}>
            {t('hitokotoUnavailable')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
