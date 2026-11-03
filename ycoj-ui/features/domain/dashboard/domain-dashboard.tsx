'use client';

import ClientApis from '@/api/client/method';
import type { DomainDashboardResponse } from '@/api/server/method/domain/types';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import UserSpan from '@/features/user/user-span';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/shared/components/ui/table';
import { LoaderCircle, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  data: DomainDashboardResponse;
  /** Pre-rendered server markup; the Markdown engine is server-only. */
  bulletin?: ReactNode;
};

export default function DomainDashboard({ data, bulletin }: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const initNodes = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const target = await submitDomainMutation(
        ClientApis.Domain.initDiscussionNodes(),
        '/domain'
      );
      toast.success(t('initSuccess'));
      router.push(target);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-llm-visible="true">
      {bulletin && (
        <Card>
          <CardContent className="pt-2">{bulletin}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            <h1
              className="text-lg font-semibold"
              data-llm-text={t('information')}
            >
              {t('information')}
            </h1>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void initNodes()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Wrench aria-hidden="true" />
            )}
            {t('initDiscussionNodes')}
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableHead className="w-40" scope="row">
                  {t('domainName')}
                </TableHead>
                <TableCell data-llm-text={data.domain.name ?? data.domain._id}>
                  {data.domain.name ?? data.domain._id}{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({data.domain._id})
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead className="w-40" scope="row">
                  {t('owner')}
                </TableHead>
                <TableCell>
                  <UserSpan user={data.owner} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead className="w-40" scope="row">
                  {t('avatar')}
                </TableHead>
                <TableCell className="font-mono text-xs">
                  {data.domain.avatar || '-'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p
            className="mt-3 text-sm text-muted-foreground"
            data-llm-text={t('initDiscussionNodesHint')}
          >
            {t('initDiscussionNodesHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
