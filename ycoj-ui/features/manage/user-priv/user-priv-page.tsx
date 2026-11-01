'use client';

import type { UserPrivPageData } from './get-user-priv-page';
import PrivEditor, { normalizePrivMask, PrivDelta } from './priv-editor';
import { toUserPrivOptions } from './priv-utils';
import {
  getUserPrivDetail,
  updateUserPrivilege,
} from '@/api/client/method/system/user-priv';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/shared/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
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
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Props = {
  data: UserPrivPageData;
};

type DialogTarget =
  | { kind: 'account'; uid: number; name: string; priv: number }
  | { kind: 'default'; priv: number };

export default function UserPrivPage({ data }: Props) {
  const t = useTranslations('system');
  const router = useRouter();
  const options = useMemo(() => toUserPrivOptions(data.priv), [data.priv]);
  const [target, setTarget] = useState<DialogTarget | null>(null);
  const [draft, setDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState(false);

  const openAccount = (uid: number, name: string, priv: number) => {
    setTarget({ kind: 'account', uid, name, priv });
    setDraft(normalizePrivMask(priv, options));
    setError('');
  };

  const openDefault = () => {
    setTarget({ kind: 'default', priv: data.defaultPriv });
    setDraft(normalizePrivMask(data.defaultPriv, options));
    setError('');
  };

  const resolveAccount = async () => {
    const value = search.trim();
    if (!value) return;
    setResolving(true);
    setError('');
    try {
      const response = await getUserPrivDetail(value).send();
      throwBackendError(response);
      if (!('udoc' in response) || !response.udoc) {
        setError(t('userPrivEmpty'));
        return;
      }
      openAccount(response.udoc._id, response.udoc.uname, response.udoc.priv);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t('userPrivLoadFailed')
      );
    } finally {
      setResolving(false);
    }
  };

  const save = async () => {
    if (!target) return;
    setError('');
    setSaving(true);
    try {
      const response =
        target.kind === 'default'
          ? await updateUserPrivilege({
              uid: 0,
              priv: draft,
              system: true,
            }).send()
          : await updateUserPrivilege({ uid: target.uid, priv: draft }).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      toast.success(t('userPrivSaved'));
      setTarget(null);
      router.refresh();
    } catch (caught) {
      if (caught instanceof SudoRedirectError) return;
      setError(
        caught instanceof Error ? caught.message : t('userPrivSaveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0 space-y-5" data-llm-visible="true">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('userPrivTitle')}
        >
          <ShieldCheck className="size-5" aria-hidden="true" />
          {t('userPrivTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('userPrivDescription')}
        </p>
      </header>

      <Card className="min-w-0">
        <CardHeader className="space-y-1 border-b">
          <h2 className="text-base font-semibold">{t('userPrivDefault')}</h2>
          <CardDescription>{t('userPrivDefaultHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-sm">
            <div className="font-mono">{data.defaultPriv}</div>
            <PrivDelta
              priv={data.defaultPriv}
              defaultPriv={0}
              options={options}
            />
          </div>
          <Button type="button" variant="outline" onClick={openDefault}>
            <KeyRound aria-hidden="true" />
            {t('userPrivEdit')}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="space-y-1 border-b">
          <h2 className="text-base font-semibold">{t('userPrivSearch')}</h2>
          <CardDescription>{t('userPrivSearchHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field data-disabled={resolving}>
            <FieldLabel htmlFor="user-priv-search">
              {t('userPrivSearch')}
            </FieldLabel>
            <div className="flex flex-wrap gap-2">
              <Input
                id="user-priv-search"
                value={search}
                disabled={resolving}
                placeholder={t('userPrivSearchHint')}
                aria-label={t('userPrivSearch')}
                className="w-full max-w-sm"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void resolveAccount();
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={resolving || !search.trim()}
                onClick={() => void resolveAccount()}
              >
                {resolving ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                {t('userPrivOpen')}
              </Button>
            </div>
            <FieldDescription>{t('userPrivSearchHint')}</FieldDescription>
          </Field>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="p-0">
          {data.accounts.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{t('userPrivEmpty')}</EmptyTitle>
                <EmptyDescription>{t('userPrivDescription')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t('userPrivUid')}</TableHead>
                  <TableHead>{t('userPrivUsername')}</TableHead>
                  <TableHead>{t('userPrivName')}</TableHead>
                  <TableHead className="w-24 text-right">
                    {t('userPrivActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.map((account) => (
                  <TableRow key={account._id}>
                    <TableCell className="font-mono text-xs">
                      {account._id}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {account.uname}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="space-y-1">
                        <span className="font-mono text-xs">
                          {account.priv}
                        </span>
                        <PrivDelta
                          priv={account.priv}
                          defaultPriv={data.defaultPriv}
                          options={options}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={account.priv === -1}
                        onClick={() =>
                          openAccount(account._id, account.uname, account.priv)
                        }
                        aria-label={`${t('userPrivEdit')} ${account.uname}`}
                      >
                        {t('userPrivEdit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog.Root
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            className="bg-background fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5 shadow-xl outline-none"
            data-llm-visible="true"
          >
            <Dialog.Title className="text-lg font-semibold">
              {target?.kind === 'default'
                ? t('userPrivDefaultDialogTitle')
                : t('userPrivDialogTitle', {
                    name: target?.kind === 'account' ? target.name : '',
                  })}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {t('userPrivDialogDescription')}
            </Dialog.Description>
            <div className="mt-4 space-y-4">
              <PrivEditor
                idPrefix={
                  target?.kind === 'account'
                    ? `user-${target.uid}`
                    : 'default-priv'
                }
                options={options}
                mask={draft}
                disabled={saving}
                onToggle={setDraft}
              />
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setTarget(null)}
                >
                  {t('userPrivCancel')}
                </Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound aria-hidden="true" />
                  )}
                  {saving ? t('userPrivSaving') : t('userPrivApply')}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
