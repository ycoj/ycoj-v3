'use client';

import ClientApis from '@/api/client/method';
import HtmlToMarkdownSection from '@/features/problem/form/html-to-markdown-section';
import ProblemForm, {
  normalizeProblemPayload,
} from '@/features/problem/form/problem-form';
import ConfirmDeleteButton from '@/shared/components/confirm-delete-button';
import { backendPathname } from '@/shared/lib/backend-response';
import type { PublicProjectionProblem } from '@/shared/types/problem';

type Props = {
  problem: PublicProjectionProblem;
  tags: Record<string, string[]>;
};

export default function ProblemEditForm({ problem, tags }: Props) {
  const pid = problem.pid || String(problem.docId);

  // The backend redirects a deleted problem to its `/p` list route; map it to
  // the UI problem list and keep any other redirect (e.g. login) untouched.
  const handleDelete = async (id: string) => {
    const response = await ClientApis.Problem.deleteProblem(id).send();
    if ('error' in response) return response;
    return {
      ...response,
      url:
        typeof response.url === 'string' &&
        backendPathname(response.url) === '/p'
          ? '/problem'
          : response.url,
    };
  };

  return (
    <ProblemForm
      mode="edit"
      tags={tags}
      cancelHref={`/problem/${pid}`}
      defaultValues={{
        pid: problem.pid ?? '',
        title: problem.title,
        tag: problem.tag.join(', '),
        difficulty: problem.difficulty ?? 0,
        hidden: problem.hidden ?? false,
        content: problem.content,
      }}
      renderAsideExtra={({ content, getContent, setContent, disabled }) => (
        <HtmlToMarkdownSection
          pid={pid}
          originalContent={problem.content}
          content={content}
          getContent={getContent}
          onApply={setContent}
          disabled={disabled}
        />
      )}
      extraActions={(isSubmitting) => (
        <ConfirmDeleteButton
          id={pid}
          namespace="problemEdit"
          listRoute="/problem"
          disabled={isSubmitting}
          onDelete={handleDelete}
        />
      )}
      onSubmit={async (values) => {
        const response = await ClientApis.Problem.editProblem(
          pid,
          normalizeProblemPayload(values)
        ).send();

        if (response?.url?.startsWith('/p/'))
          return `/problem/${response.url.slice(3)}`;
        return `/problem/${values.pid.trim() || pid}`;
      }}
    />
  );
}
