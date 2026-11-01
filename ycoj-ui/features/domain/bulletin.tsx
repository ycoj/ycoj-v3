import Markdown from '@/shared/components/markdown';

/** Renders a domain bulletin. Server-only because the Markdown engine is. */
export default function DomainBulletin({ content }: { content: string }) {
  if (!content) return null;
  return (
    <article className="text-sm" data-llm-visible="true">
      <Markdown>{content}</Markdown>
    </article>
  );
}
