import SolutionList from './solution-list';
import { resolveSolutionPermissions } from './solution-reply-permissions';
import type { ProblemSolutionResponse } from '@/api/server/method/problems/solution';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import EntityHoverLink from '@/shared/components/entity-hover/entity-hover-link';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

type Props = {
  data: ProblemSolutionResponse;
  /** Solution opened through its permalink, highlighted in place. */
  highlightedId?: string;
};

export default async function SolutionContent({ data, highlightedId }: Props) {
  const t = await getTranslations('solution');
  const user = await getUser();
  const allowCreate =
    !!user?._id && hasPerm(user, PERM.PERM_CREATE_PROBLEM_SOLUTION);
  const permissions = resolveSolutionPermissions(user);
  const pid = data.pdoc.pid ?? data.pdoc.docId;

  return (
    <div className="space-y-4">
      {data.solutionBlocked && (
        <p role="status" className="text-sm text-destructive">
          {t('errors.blocked')}
        </p>
      )}
      {allowCreate && !data.solutionBlocked && (
        <div className="text-foreground flex items-center">
          <span className="text-muted-foreground">{t('missingYours')}</span>
          <Button variant="outline" size="sm" asChild>
            <EntityHoverLink href={`/problem/${pid}/solution/create`}>
              <Plus className="size-4" />
              {t('create')}
            </EntityHoverLink>
          </Button>
        </div>
      )}
      <Separator />
      <SolutionList
        data={data}
        viewerId={user?._id}
        allowEditAny={permissions.allowEditAny}
        allowEditSelf={permissions.allowEditSelf}
        allowDeleteAny={permissions.allowDeleteAny}
        allowDeleteSelf={permissions.allowDeleteSelf}
        allowReply={permissions.allowReply}
        allowEditReplySelf={permissions.allowEditReplySelf}
        allowDeleteReplyAny={permissions.allowDeleteReplyAny}
        allowDeleteReplySelf={permissions.allowDeleteReplySelf}
        highlightedId={highlightedId}
      />
    </div>
  );
}
