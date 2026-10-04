import '@/shared/components/code/style/both.css';
import '@/shared/components/code/style/line-numbers.css';
import MarkdownAlert from '@/shared/components/markdown/components/markdown-alert';
import MarkdownAlign from '@/shared/components/markdown/components/markdown-align';
import MarkdownCodeBlock from '@/shared/components/markdown/components/markdown-code-block';
import MarkdownPdf from '@/shared/components/markdown/components/markdown-pdf';
import MarkdownUserSpan from '@/shared/components/markdown/components/markdown-user-span';
import ProblemSample from '@/shared/components/markdown/components/problem-sample';
import {
  markdownRemarkPlugins,
  markdownRehypePlugins,
} from '@/shared/components/markdown/engine';
import '@/shared/components/markdown/markdown.css';
import { markdownSanitizeSchema } from '@/shared/components/markdown/sanitize-schema';
import 'katex/dist/katex.min.css';
import { MarkdownAsync } from 'react-markdown';
import type { Components } from 'react-markdown';
import type { Options as Schema } from 'rehype-sanitize';
import 'server-only';
import type { PluggableList } from 'unified';

export { markdownSanitizeSchema } from '@/shared/components/markdown/sanitize-schema';

type Props = {
  children: string;
  rehypePlugins?: PluggableList;
  sanitizeSchema?: Schema;
  components?: Components;
};

export default function Markdown({
  children,
  rehypePlugins = [],
  sanitizeSchema = markdownSanitizeSchema,
  components = {},
}: Props) {
  return (
    <div className="markdown">
      <MarkdownAsync
        remarkPlugins={markdownRemarkPlugins}
        rehypePlugins={markdownRehypePlugins(rehypePlugins, sanitizeSchema)}
        components={{
          // @ts-expect-error pdf-embed is a custom element
          'pdf-embed': MarkdownPdf,
          samples: ProblemSample,
          'user-span': MarkdownUserSpan,
          'md-alert': MarkdownAlert,
          'md-align': MarkdownAlign,
          pre: MarkdownCodeBlock,
          ...components,
        }}
      >
        {children}
      </MarkdownAsync>
    </div>
  );
}
