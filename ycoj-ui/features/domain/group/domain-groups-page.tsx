'use client';

import ClientApis from '@/api/client/method';
import type { DomainGroupsResponse } from '@/api/server/method/domain/types';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import {
  isValidGroupName,
  parseGroupImport,
  serializeGroups,
} from '@/features/domain/lib/group-import';
import UserAutoComplete from '@/features/user/user-auto-complete';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Download, FolderPlus, Save, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog, Dialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Props = { data: DomainGroupsResponse; domainId: string };

type GroupDraft = { name: string; uids: string[] };

export default function DomainGroupsPage({ data, domainId }: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const [drafts, setDrafts] = useState<Map<string, string[]>>(
    () =>
      new Map(
        data.groups.map((group) => [group.name, (group.uids ?? []).map(String)])
      )
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMembers, setCreateMembers] = useState<string[]>([]);
  const [createError, setCreateError] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setGroupMembers = (name: string, uids: string[]) => {
    setDrafts((current) => {
      const next = new Map(current);
      next.set(name, uids);
      return next;
    });
  };

  const saveAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const [name, uids] of drafts) {
        const numeric = uids.map(Number).filter(Number.isSafeInteger);
        await submitDomainMutation(
          ClientApis.Domain.updateDomainGroup(name, numeric),
          '/domain/group'
        );
      }
      toast.success(t('groupSaved'));
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('groupSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    const name = createName.trim();
    if (!isValidGroupName(name)) {
      setCreateError(t('groupCreateFailed'));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const uids = createMembers.map(Number).filter(Number.isSafeInteger);
      await submitDomainMutation(
        ClientApis.Domain.updateDomainGroup(name, uids),
        '/domain/group'
      );
      toast.success(t('groupCreateSuccess'));
      setCreateOpen(false);
      setCreateName('');
      setCreateMembers([]);
      setSelected([]);
      // Reflect the new group immediately; the refresh replaces this state.
      setDrafts((current) => {
        const next = new Map(current);
        next.set(name, uids.map(String));
        return next;
      });
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('groupCreateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      for (const name of selected) {
        await submitDomainMutation(
          ClientApis.Domain.deleteDomainGroup(name),
          '/domain/group'
        );
      }
      toast.success(t('deleteGroupsSuccess'));
      setDrafts((current) => {
        const next = new Map(current);
        for (const name of selected) next.delete(name);
        return next;
      });
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

  const importGroups = async () => {
    const { groups, errors } = parseGroupImport(importText);
    if (errors.length) {
      setImportError(errors.join('\n'));
      return;
    }
    if (!groups.size) {
      setImportError(t('importEmpty'));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      for (const [name, uids] of groups) {
        await submitDomainMutation(
          ClientApis.Domain.updateDomainGroup(name, uids),
          '/domain/group'
        );
      }
      toast.success(t('importSuccess'));
      setImportOpen(false);
      setImportText('');
      setSelected([]);
      setDrafts((current) => {
        const next = new Map(current);
        for (const [name, uids] of groups) next.set(name, uids.map(String));
        return next;
      });
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('importFailed'));
    } finally {
      setBusy(false);
    }
  };

  const exportText = useMemo(
    () =>
      serializeGroups(
        Array.from(drafts, ([name, uids]) => ({
          name,
          uids: uids.map(Number).filter(Number.isSafeInteger),
        }))
      ),
    [drafts]
  );

  const groups: GroupDraft[] = Array.from(drafts, ([name, uids]) => ({
    name,
    uids,
  }));

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold" data-llm-text={t('groupsTitle')}>
          {t('groupsTitle')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setImportError('');
              setImportOpen(true);
            }}
          >
            <Upload aria-hidden="true" />
            {t('importGroups')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
          >
            <Download aria-hidden="true" />
            {t('exportGroups')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCreateName('');
              setCreateMembers([]);
              setCreateError('');
              setCreateOpen(true);
            }}
          >
            <FolderPlus aria-hidden="true" />
            {t('createGroup')}
          </Button>
        </div>
      </header>

      {groups.length === 0 ? (
        <Empty className="min-h-40 border">
          <EmptyHeader>
            <EmptyTitle data-llm-text={t('groupsEmpty')}>
              {t('groupsEmpty')}
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
                        selected.length === 0
                          ? false
                          : selected.length === groups.length
                            ? true
                            : 'indeterminate'
                      }
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked === true
                            ? groups.map((group) => group.name)
                            : []
                        )
                      }
                    />
                  </TableHead>
                  <TableHead className="w-48">{t('groupName')}</TableHead>
                  <TableHead>{t('users')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.name}>
                    <TableCell>
                      <Checkbox
                        aria-label={group.name}
                        checked={selected.includes(group.name)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked === true
                              ? Array.from(new Set([...current, group.name]))
                              : current.filter((name) => name !== group.name)
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className="font-medium"
                          data-llm-text={group.name}
                        >
                          {group.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('groupMembers', { count: group.uids.length })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserAutoComplete
                        domainId={domainId}
                        multiple
                        value={group.uids}
                        onValueChange={(uids) =>
                          setGroupMembers(group.name, uids)
                        }
                        placeholder={t('groupMembersCsv')}
                        ariaLabel={`${t('users')} ${group.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !selected.length}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('deleteGroups')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void saveAll()}
            >
              <Save aria-hidden="true" />
              {t('groupSaveAll')}
            </Button>
          </div>
        </>
      )}

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('createGroup')}
            </Dialog.Title>
            <div className="mt-4 space-y-4">
              <Field>
                <FieldLabel htmlFor="create-group-name">
                  {t('groupName')}
                </FieldLabel>
                <Input
                  id="create-group-name"
                  autoFocus
                  value={createName}
                  aria-invalid={!!createError}
                  onChange={(event) => {
                    setCreateName(event.target.value);
                    setCreateError('');
                  }}
                />
                {createError && (
                  <p role="alert" className="text-sm text-destructive">
                    {createError}
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel>{t('users')}</FieldLabel>
                <UserAutoComplete
                  domainId={domainId}
                  multiple
                  value={createMembers}
                  onValueChange={setCreateMembers}
                  placeholder={t('groupMembersCsv')}
                  ariaLabel={t('users')}
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void createGroup()}
              >
                {t('createGroup')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('importTitle')}
            </Dialog.Title>
            <Field className="mt-4">
              <FieldLabel htmlFor="import-groups">{t('importHint')}</FieldLabel>
              <Textarea
                id="import-groups"
                rows={8}
                value={importText}
                placeholder={t('importPlaceholder')}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setImportError('');
                }}
                className="font-mono text-sm"
              />
              {importError && (
                <p
                  role="alert"
                  className="whitespace-pre-wrap text-sm text-destructive"
                >
                  {importError}
                </p>
              )}
              <FieldDescription className="text-xs">
                {t('importHint')}
              </FieldDescription>
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {t('cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={busy || !importText.trim()}
                onClick={() => void importGroups()}
              >
                {t('importGroups')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={exportOpen} onOpenChange={setExportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 outline-none"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('exportTitle')}
            </Dialog.Title>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('exportHint')}
            </p>
            <Textarea
              readOnly
              rows={10}
              value={exportText}
              aria-label={t('exportTitle')}
              className="mt-4 font-mono text-sm"
            />
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {t('cancel')}
                </Button>
              </Dialog.Close>
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
              {t('deleteGroupsTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {t('deleteGroupsDescription')}
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
                  {t('deleteGroups')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
