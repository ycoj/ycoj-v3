'use client';

import '@/shared/components/code/style/both.css';
import '@/shared/components/code/style/line-numbers.css';
import MarkdownEntityLink from '@/shared/components/entity-hover/markdown-entity-link';
import MarkdownAlert from '@/shared/components/markdown/components/markdown-alert';
import MarkdownAlign from '@/shared/components/markdown/components/markdown-align';
import MarkdownCodeBlock from '@/shared/components/markdown/components/markdown-code-block';
import MarkdownMath from '@/shared/components/markdown/components/markdown-math';
import MarkdownPdf from '@/shared/components/markdown/components/markdown-pdf';
import MarkdownUserSpan from '@/shared/components/markdown/components/markdown-user-span';
import ProblemSample from '@/shared/components/markdown/components/problem-sample';
import {
  markdownRehypeBasePlugins,
  markdownRemarkPlugins,
} from '@/shared/components/markdown/engine-base';
import '@/shared/components/markdown/markdown.css';
import { markdownSanitizeSchema } from '@/shared/components/markdown/sanitize-schema';
import { use } from 'react';
import { MarkdownAsync } from 'react-markdown';
import type { Components } from 'react-markdown';

type Props = {
  children: string;
  className?: string;
};

const components = {
  // @ts-expect-error pdf-embed is a custom element
  'pdf-embed': MarkdownPdf,
  samples: ProblemSample,
  'user-span': MarkdownUserSpan,
  'md-alert': MarkdownAlert,
  'md-align': MarkdownAlign,
  pre: MarkdownCodeBlock,
  a: MarkdownEntityLink,
} satisfies Components;

/**
 * Browser variant of the shared Markdown renderer for interactive replies.
 *
 * The server renderer adds `rehype-user-span`, which resolves user records
 * through the server API and cannot run in the browser. Replies are edited in
 * place, so the same pipeline and sanitize schema are reused here without that
 * extension; `/user/:uid` links render as ordinary links instead.
 */
export default function ClientMarkdown({ children, className }: Props) {
  const rendered = use(
    MarkdownAsync({
      remarkPlugins: markdownRemarkPlugins,
      rehypePlugins: markdownRehypeBasePlugins([], markdownSanitizeSchema),
      components,
      children,
    })
  );

  return (
    <div className={className} data-llm-text={children}>
      <MarkdownMath>{rendered}</MarkdownMath>
    </div>
  );
}
