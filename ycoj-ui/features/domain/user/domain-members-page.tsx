'use client';

import ClientApis from '@/api/client/method';
import type { DomainUsersResponse } from '@/api/server/method/domain/types';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import {
  assignableRoles,
  buildMemberRows,
  canSelectMember,
  serializeMembersRaw,
  toggleAllSelection,
  toggleSelection,
  type MemberRow,
} from '@/features/domain/lib/member-rows';
import UserAutoComplete from '@/features/user/user-auto-complete';
import UserSpan from '@/features/user/user-span';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Empty, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty';
import { Field, FieldLabel } from '@/shared/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Download,
  LoaderCircle,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog, Dialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Props = {
  data: DomainUsersResponse;
  domainId: string;
  ownerId: number;
  viewerId: number;
  canForceJoin: boolean;
};

export default function DomainMembersPage({
  data,
  domainId,
  ownerId,
  viewerId,
  canForceJoin,
}: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const roles = useMemo(() => assignableRoles(data.roles), [data.roles]);
  const rows = useMemo(() => buildMemberRows(data.rudocs), [data.rudocs]);
  const selectableRows = useMemo(
    () => rows.filter((row) => canSelectMember(row, ownerId)),
    [rows, ownerId]
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addUids, setAddUids] = useState<string[]>([]);
  const [addRole, setAddRole] = useState(roles[0]?._id ?? 'default');
  const [addJoin, setAddJoin] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState(roles[0]?._id ?? 'default');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const allSelected =
    selectableRows.length > 0 && selected.length === selectableRows.length;

  const run = async (
    request: { send: () => Promise<unknown> },
    successMessage: string
  ) => {
    setBusy(true);
    try {
      await submitDomainMutation(request, '/domain/user');
      toast.success(successMessage);
      setSelected([]);
      router.refresh();
      return true;
    } catch (error) {
      if (isSudoRedirect(error)) return false;
      toast.error(t('actionFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addMembers = async () => {
    const uids = addUids.map(Number).filter(Number.isSafeInteger);
    if (!uids.length || busy) return;
    const ok = await run(
      ClientApis.Domain.setDomainUsers(uids, addRole, addJoin),
      t('addUserSuccess')
    );
    if (ok) {
      setAddOpen(false);
      setAddUids([]);
      setAddJoin(false);
    }
  };

  const setBulkRoleOnSelection = async () => {
    if (!selected.length || busy) return;
    const ok = await run(
      ClientApis.Domain.setDomainUsers(selected, bulkRole, false),
      t('setRoleSuccess')
    );
    if (ok) setRoleOpen(false);
  };

  const removeSelected = async () => {
    if (!selected.length || busy) return;
    const ok = await run(
      ClientApis.Domain.kickDomainUsers(selected),
      t('removeSuccess')
    );
    if (ok) setRemoveOpen(false);
  };

  const changeRowRole = async (row: MemberRow, role: string) => {
    if (busy) return;
    await run(
      ClientApis.Domain.setDomainUsers([row._id], role, false),
      t('setRoleSuccess')
    );
  };

  // The JSON view of `?format=raw` serializes the page data rather than the
  // legacy text export, so the same `uid,role,uname,displayName` line format is
  // rebuilt from the loaded rows and copied to the clipboard.
  const exportRaw = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await navigator.clipboard.writeText(serializeMembersRaw(rows));
      toast.success(t('exportCopied'));
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" data-llm-text={t('members')}>
          {t('members')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void exportRaw()}
          >
            {exporting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {t('exportRaw')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAddRole(roles[0]?._id ?? 'default');
              setAddOpen(true);
            }}
          >
            <UserPlus aria-hidden="true" />
            {t('addUser')}
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <Empty className="min-h-40 border">
          <EmptyHeader>
            <EmptyTitle data-llm-text={t('loadFailed')}>
              {t('loadFailed')}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="mr-1 text-sm text-muted-foreground"
              data-llm-text={t('selected', { count: selected.length })}
            >
              {t('selected', { count: selected.length })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !selected.length}
              onClick={() => {
                setBulkRole(bulkRole || roles[0]?._id || 'default');
                setRoleOpen(true);
              }}
            >
              <Users aria-hidden="true" />
              {t('setRoleSelected')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !selected.length}
              onClick={() => setRemoveOpen(true)}
            >
              <UserMinus aria-hidden="true" />
              {t('removeSelected')}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={t('selectAll')}
                      checked={
                        allSelected
                          ? true
                          : selected.length
                            ? 'indeterminate'
                            : false
                      }
                      disabled={busy || !selectableRows.length}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          toggleAllSelection(
                            current,
                            selectableRows,
                            checked === true
                          )
                        )
                      }
                    />
                  </TableHead>
                  <TableHead className="w-20">{t('uid')}</TableHead>
                  <TableHead>{t('username')}</TableHead>
                  <TableHead className="w-44">{t('role')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const selectable = canSelectMember(row, ownerId);
                  return (
                    <TableRow key={row._id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`${t('username')} ${row.uname}`}
                          checked={selected.includes(row._id)}
                          disabled={busy || !selectable}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              toggleSelection(
                                current,
                                row._id,
                                checked === true
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {row._id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <UserSpan user={row} />
                          {row.join === false && (
                            <Badge
                              variant="outline"
                              title={t('notJoinedHint')}
                              data-llm-text={t('notJoinedHint')}
                            >
                              {t('notJoinedHint')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.role}
                          disabled={busy || row._id === viewerId}
                          onValueChange={(role) =>
                            void changeRowRole(row, role)
                          }
                        >
                          <SelectTrigger
                            aria-label={`${t('role')} ${row.uname}`}
                            size="sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {roles.map((role) => (
                              <SelectItem key={role._id} value={role._id}>
                                {role._id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('addUserTitle')}
            </Dialog.Title>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('addUserHint')}
            </p>
            <div className="mt-4 space-y-4">
              <UserAutoComplete
                domainId={domainId}
                multiple
                value={addUids}
                onValueChange={setAddUids}
                placeholder={t('username')}
                ariaLabel={t('username')}
              />
              <Field>
                <FieldLabel>{t('role')}</FieldLabel>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {roles.map((role) => (
                      <SelectItem key={role._id} value={role._id}>
                        {role._id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {canForceJoin && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={addJoin}
                    onCheckedChange={(checked) => setAddJoin(checked === true)}
                  />
                  <span>{t('markJoined')}</span>
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy || !addUids.length}
                onClick={() => void addMembers()}
              >
                {t('addUser')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={roleOpen} onOpenChange={setRoleOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('roleForSelected')}
            </Dialog.Title>
            <div className="mt-4">
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger
                  className="w-full"
                  aria-label={t('roleForSelected')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy || !selected.length}
                onClick={() => void setBulkRoleOnSelection()}
              >
                {t('save')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={removeOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoveOpen(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none">
            <AlertDialog.Title className="text-lg font-semibold">
              {t('removeSelectedTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {t('removeSelectedDescription')}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void removeSelected()}
                >
                  {t('removeSelected')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
