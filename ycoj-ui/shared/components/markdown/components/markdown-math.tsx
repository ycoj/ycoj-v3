'use client';

import '../math.css';
import { loadVelocitex } from '../velocitex';
import { useEffect, useRef, type ReactNode } from 'react';

type Props = { children: ReactNode; className?: string };

export default function MarkdownMath({
  children,
  className = 'markdown',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let active = true;
    const rendered = new WeakMap<Element, string>();

    const container = root;
    function renderFormulas() {
      for (const element of container.querySelectorAll<HTMLElement>(
        '[data-math-source]'
      )) {
        const source = element.dataset.mathSource!;
        const displayMode = element.dataset.mathDisplay === 'true';
        const signature = JSON.stringify([source, displayMode]);
        if (rendered.get(element) === signature) continue;
        rendered.set(element, signature);
        element.dataset.mathState = 'pending';
        void loadVelocitex()
          .then((renderer) =>
            renderer.renderToString(source, {
              displayMode,
              throwOnError: false,
            })
          )
          .then((html) => {
            if (
              !active ||
              !container.contains(element) ||
              rendered.get(element) !== signature
            )
              return;
            element.innerHTML = html;
            element.dataset.mathState = 'ready';
          })
          .catch(() => {
            if (!active || rendered.get(element) !== signature) return;
            element.textContent = source;
            element.dataset.mathState = 'error';
          });
      }
    }

    // Titled alerts mount their bodies on opening; previews replace content.
    const observer = new MutationObserver(renderFormulas);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-math-source', 'data-math-display'],
    });
    renderFormulas();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [children]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
