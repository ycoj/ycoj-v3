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
import { LoaderCircle, Trash2, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  data: DomainDashboardResponse;
  canDelete: boolean;
  isSystemDomain: boolean;
  /** Pre-rendered server markup; the Markdown engine is server-only. */
  bulletin?: ReactNode;
};

export default function DomainDashboard({
  data,
  canDelete,
  isSystemDomain,
  bulletin,
}: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const [busy, setBusy] = useState<'init' | 'delete' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const initNodes = async () => {
    if (busy) return;
    setBusy('init');
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
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('delete');
    try {
      const target = await submitDomainMutation(
        ClientApis.Domain.deleteDomain(),
        '/home/domain'
      );
      toast.success(t('deleteSuccess'));
      router.push(target);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('deleteFailed'));
    } finally {
      setBusy(null);
      setDeleteOpen(false);
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
            disabled={busy !== null}
            onClick={() => void initNodes()}
          >
            {busy === 'init' ? (
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

      {canDelete && !isSystemDomain && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">
              <span data-llm-text={t('deleteDomain')}>{t('deleteDomain')}</span>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p
              className="max-w-prose text-sm text-muted-foreground"
              data-llm-text={t('deleteDomainDescription')}
            >
              {t('deleteDomainDescription')}
            </p>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('deleteDomain')}
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog.Root
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && busy === null) setDeleteOpen(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none">
            <AlertDialog.Title className="text-lg font-semibold">
              {t('deleteDomainTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {t('deleteDomainDescription')}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                >
                  {t('cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  {t('delete')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
