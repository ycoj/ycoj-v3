'use client';

import { useEffect, useRef } from 'react';

type Props = {
  source: string;
};

export default function KatexClientRender({ source }: Props) {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = markerRef.current?.parentElement;
    if (!container) {
      return;
    }

    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const renderMath = async () => {
      const { default: renderMathInElement } =
        await import('katex/contrib/auto-render');

      if (cancelled) {
        return;
      }

      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      });
    };

    // Collapsible containers (titled alerts) mount their body only once they
    // are opened, so math can show up after the first pass. Re-render whenever
    // new elements appear; text-only insertions cannot add delimiters, and a
    // pass that finds no delimiters mutates nothing, so the observer converges
    // instead of looping.
    const observer = new MutationObserver((mutations) => {
      const addedElement = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) => node.nodeType === Node.ELEMENT_NODE
        )
      );
      if (!addedElement || pending !== undefined) return;
      pending = setTimeout(() => {
        pending = undefined;
        void renderMath();
      }, 0);
    });
    observer.observe(container, { childList: true, subtree: true });

    void renderMath();

    return () => {
      cancelled = true;
      observer.disconnect();
      if (pending !== undefined) clearTimeout(pending);
    };
  }, [source]);

  return <span ref={markerRef} className="hidden" aria-hidden="true" />;
}
