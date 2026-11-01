'use client';

import ClientApis from '@/api/client/method';
import type { DomainRolesResponse } from '@/api/server/method/domain/types';
import {
  ROLE_NAME_PATTERN,
  isBuiltinRole,
  splitRoles,
} from '@/features/domain/lib/domain-permissions';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Empty, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { KeyRound, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog, Dialog } from 'radix-ui';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = { data: DomainRolesResponse };

export default function DomainRolesPage({ data }: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const { editable, builtin } = splitRoles(data.roles);
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggle = (role: string, checked: boolean) => {
    if (isBuiltinRole(role)) return;
    setSelected((current) =>
      checked
        ? Array.from(new Set([...current, role]))
        : current.filter((value) => value !== role)
    );
  };

  const create = async () => {
    const name = roleName.trim();
    if (!name) {
      setNameError(t('roleRequired'));
      return;
    }
    if (busy) return;
    if (!ROLE_NAME_PATTERN.test(name)) {
      setNameError(t('roleNameHint'));
      return;
    }
    if (data.roles.some((role) => role._id === name)) {
      setNameError(t('roleAlreadyExists'));
      return;
    }
    setBusy(true);
    try {
      await submitDomainMutation(
        ClientApis.Domain.createDomainRole(name),
        '/domain/role'
      );
      toast.success(t('createRoleSuccess'));
      setCreateOpen(false);
      setRoleName('');
      setSelected([]);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('createRoleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      await submitDomainMutation(
        ClientApis.Domain.deleteDomainRoles(selected),
        '/domain/role'
      );
      toast.success(t('deleteRolesSuccess'));
      setSelected([]);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('actionFailed'));
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  const rows = [...editable, ...builtin];
  const deletableSelected = selected.filter((role) => !isBuiltinRole(role));

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" data-llm-text={t('roles')}>
          {t('roles')}
        </h1>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <KeyRound aria-hidden="true" />
          {t('createRole')}
        </Button>
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
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={t('selectAll')}
                      checked={
                        editable.length > 0 &&
                        selected.length === editable.length
                          ? true
                          : selected.length
                            ? 'indeterminate'
                            : false
                      }
                      disabled={busy || !editable.length}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked === true
                            ? editable.map((role) => role._id)
                            : []
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{t('roleName')}</TableHead>
                  <TableHead className="w-32">{t('builtin')}</TableHead>
                  <TableHead className="w-32 text-right">
                    {t('users')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((role) => {
                  const builtinRole = isBuiltinRole(role._id);
                  return (
                    <TableRow key={role._id}>
                      <TableCell>
                        <Checkbox
                          aria-label={role._id}
                          checked={selected.includes(role._id)}
                          disabled={busy || builtinRole}
                          onCheckedChange={(checked) =>
                            toggle(role._id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono" data-llm-text={role._id}>
                        {role._id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={builtinRole ? 'secondary' : 'outline'}>
                          {builtinRole ? t('builtin') : t('editable')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {role.count ?? t('roleCountEmpty')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || deletableSelected.length === 0}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('deleteRoles')}
            </Button>
          </div>
        </>
      )}

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('createRole')}
            </Dialog.Title>
            <Field className="mt-4">
              <FieldLabel htmlFor="create-role-name">
                {t('roleName')}
              </FieldLabel>
              <Input
                id="create-role-name"
                autoFocus
                value={roleName}
                aria-invalid={!!nameError}
                onChange={(event) => {
                  setRoleName(event.target.value);
                  setNameError('');
                }}
              />
              {nameError ? (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : (
                <FieldDescription className="text-xs">
                  {t('roleNameHint')}
                </FieldDescription>
              )}
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void create()}
              >
                {t('createRole')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteOpen(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none">
            <AlertDialog.Title className="text-lg font-semibold">
              {t('deleteRolesTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {t('deleteRolesDescription')}
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
                  onClick={() => void remove()}
                >
                  {t('deleteRoles')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
