'use client';

import ClientApis from '@/api/client/method';
import type { MyDomainsResponse } from '@/api/server/method/domain/types';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import {
  buildMyDomainRows,
  domainDisplayName,
  domainHomePath,
  domainManagePath,
  isSameDomain,
  type MyDomainRow,
} from '@/features/domain/lib/my-domains';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';
import { LogOut, Plus, Settings, Star, UserRoundPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type DomainLinkProps = {
  domainId: string;
  activeDomainId: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Same-domain links stay inside the app; other domains are only reachable
 * through the backend's `/d/{id}` prefix, so they need a real navigation.
 */
function DomainLink({
  domainId,
  activeDomainId,
  className,
  children,
}: DomainLinkProps) {
  const href = domainHomePath(domainId, activeDomainId);
  if (isSameDomain(domainId, activeDomainId))
    return (
      <Link href={href} prefetch={false} className={className}>
        {children}
      </Link>
    );
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

type Props = {
  data: MyDomainsResponse;
  userId: number;
  activeDomainId: string;
  canCreate: boolean;
  canJoin: boolean;
};

export default function MyDomainsPage({
  data,
  userId,
  activeDomainId,
  canCreate,
  canJoin,
}: Props) {
  const t = useTranslations('domain');
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<MyDomainRow | null>(null);
  const [starred, setStarred] = useState<string[]>(data.pinnedDomains ?? []);

  const rows = useMemo(() => {
    const pinned = new Set(starred);
    return buildMyDomainRows(data, userId, activeDomainId).map((row) => ({
      ...row,
      starred: pinned.has(row.domain._id),
    }));
  }, [data, userId, starred, activeDomainId]);

  const toggleStar = async (row: MyDomainRow) => {
    if (pending) return;
    const next = !row.starred;
    setPending(`star:${row.domain._id}`);
    // Optimistic: the star list is account state, not this page's data.
    setStarred((current) =>
      next
        ? [...current, row.domain._id]
        : current.filter((id) => id !== row.domain._id)
    );
    try {
      await ClientApis.Domain.setDomainStar(row.domain._id, next).send();
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      setStarred((current) =>
        next
          ? current.filter((id) => id !== row.domain._id)
          : [...current, row.domain._id]
      );
      toast.error(t('loadFailed'));
    } finally {
      setPending(null);
    }
  };

  const leave = async (row: MyDomainRow) => {
    if (pending) return;
    setPending(`leave:${row.domain._id}`);
    try {
      const target = await submitDomainMutation(
        ClientApis.Domain.leaveDomain(row.domain._id),
        '/home/domain'
      );
      toast.success(
        t('leaveSuccess', { domain: domainDisplayName(row.domain) })
      );
      router.push(target);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('leaveFailed'));
    } finally {
      setLeaveTarget(null);
      setPending(null);
    }
  };

  return (
    <section className="space-y-4" data-llm-visible="true">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" data-llm-text={t('title')}>
            {t('title')}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-llm-text={t('count', { count: rows.length })}
          >
            {t('count', { count: rows.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canJoin && (
            <Button asChild variant="outline">
              <Link href="/domain/join">
                <UserRoundPlus aria-hidden="true" />
                {t('join')}
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/home/domain/create">
                <Plus aria-hidden="true" />
                {t('create')}
              </Link>
            </Button>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <Empty className="min-h-48 border">
          <EmptyHeader>
            <EmptyTitle data-llm-text={t('empty')}>{t('empty')}</EmptyTitle>
            <EmptyDescription data-llm-text={t('emptyCanCreate')}>
              {t('emptyCanCreate')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('name')}</TableHead>
                <TableHead className="w-32">{t('role')}</TableHead>
                <TableHead className="w-72 text-right">
                  {t('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.domain._id}>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={row.starred}
                      aria-label={row.starred ? t('unstar') : t('star')}
                      disabled={pending !== null}
                      onClick={() => void toggleStar(row)}
                    >
                      <Star
                        className={cn(
                          'size-4',
                          row.starred
                            ? 'fill-yellow-400 text-yellow-500'
                            : 'text-muted-foreground'
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <DomainLink
                        domainId={row.domain._id}
                        activeDomainId={activeDomainId}
                        className="truncate font-medium hover:text-primary hover:underline"
                      >
                        {domainDisplayName(row.domain)}
                      </DomainLink>
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        data-llm-text={row.domain._id}
                      >
                        {row.domain._id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-llm-text={row.role}>
                      {row.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <DomainLink
                          domainId={row.domain._id}
                          activeDomainId={activeDomainId}
                        >
                          {t('visit')}
                        </DomainLink>
                      </Button>
                      {row.canManage && (
                        <Button asChild variant="ghost" size="sm">
                          {row.active ? (
                            <Link href="/domain" prefetch={false}>
                              <Settings aria-hidden="true" />
                              {t('manage')}
                            </Link>
                          ) : (
                            <a
                              href={domainManagePath(
                                row.domain._id,
                                activeDomainId
                              )}
                            >
                              <Settings aria-hidden="true" />
                              {t('manage')}
                            </a>
                          )}
                        </Button>
                      )}
                      {row.canLeave && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending !== null}
                          onClick={() => setLeaveTarget(row)}
                        >
                          <LogOut aria-hidden="true" />
                          {t('leave')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog.Root
        open={leaveTarget !== null}
        onOpenChange={(open) => {
          if (!open && pending === null) setLeaveTarget(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none">
            <AlertDialog.Title className="text-lg font-semibold">
              {t('leaveTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {t('leaveDescription', {
                domain: leaveTarget
                  ? domainDisplayName(leaveTarget.domain)
                  : '',
              })}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                >
                  {t('backToMyDomains')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending !== null}
                  onClick={() => leaveTarget && void leave(leaveTarget)}
                >
                  {t('leave')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
