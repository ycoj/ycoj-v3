'use client';

import {
  securityErrorMessage,
  resolveSecurityResult,
} from './resolve-security-result';
import {
  authenticatorShortId,
  credentialIdBase64,
  generateTotpSecret,
  otpauthUri,
} from './security-utils';
import ClientApis from '@/api/client/method';
import SettingsSection from '@/features/account/settings/settings-section';
import ConfirmActionDialog from '@/shared/components/confirm-action-dialog';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
} from '@/shared/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { useClipboardCopy } from '@/shared/hooks/use-clipboard-copy';
import { formatRecordTime } from '@/shared/lib/format-time';
import type { SecurityAuthenticator } from '@/shared/types/security';
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import {
  Copy,
  Fingerprint,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Smartphone,
  Usb,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Props = {
  uname: string;
  tfaEnabled: boolean;
  authenticators: SecurityAuthenticator[];
};

export default function SecurityAuthenticators({
  uname,
  tfaEnabled,
  authenticators,
}: Props) {
  const t = useTranslations('security');
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);

  useEffect(() => {
    let active = true;
    // Both checks touch browser APIs, so they run after mount and update
    // state only from their async callbacks.
    Promise.resolve()
      .then(() => browserSupportsWebAuthn())
      .then((supported) => {
        if (!active) return;
        setWebAuthnSupported(supported);
        if (!supported) return undefined;
        return platformAuthenticatorIsAvailable()
          .then((available) => {
            if (active) setPlatformAvailable(available);
          })
          .catch(() => {
            if (active) setPlatformAvailable(false);
          });
      })
      .catch(() => {
        if (active) setWebAuthnSupported(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const removeTfa = async () => {
    const response = await ClientApis.Account.disableTfa().send();
    if ('error' in response) throw new Error(parseErrorMessage(response.error));
    if (resolveSecurityResult(response) === 'sudo') return;
    toast.success(t('authenticators.tfa.removed'));
    router.refresh();
  };

  const removeAuthenticator = async (id: string) => {
    const response = await ClientApis.Account.disableWebauthn(id).send();
    if ('error' in response) throw new Error(parseErrorMessage(response.error));
    if (resolveSecurityResult(response) === 'sudo') return;
    toast.success(t('authenticators.webauthn.removed'));
    router.refresh();
  };

  const registerAuthenticator = async (
    type: 'platform' | 'cross-platform',
    name: string
  ) => {
    setAdding(true);
    try {
      const optionsResponse =
        await ClientApis.Account.startWebauthnRegistration(type).send();
      if ('error' in optionsResponse)
        throw new Error(parseErrorMessage(optionsResponse.error));
      if (!('authOptions' in optionsResponse) || !optionsResponse.authOptions)
        throw new Error(t('authenticators.webauthn.registrationFailed'));
      const credential = await startRegistration({
        optionsJSON:
          optionsResponse.authOptions as PublicKeyCredentialCreationOptionsJSON,
      });
      const response = await ClientApis.Account.enableWebauthn(
        name,
        credential
      ).send();
      if ('error' in response)
        throw new Error(parseErrorMessage(response.error));
      toast.success(t('authenticators.webauthn.added'));
      setAddOpen(false);
      router.refresh();
    } catch (error) {
      const message = securityErrorMessage(
        error,
        t('authenticators.webauthn.registrationFailed')
      );
      if (message) toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <SettingsSection
      id="security-authenticators"
      title={t('authenticators.title')}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p
            className="max-w-2xl text-sm text-muted-foreground"
            data-llm-text={t('authenticators.description')}
          >
            {t('authenticators.description')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={adding}
          >
            <Plus aria-hidden="true" />
            {t('authenticators.add')}
          </Button>
        </div>

        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          <li
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            data-llm-visible="true"
          >
            <div className="flex items-start gap-3">
              <Smartphone
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="text-sm font-medium"
                    data-llm-text={t('authenticators.tfa.name')}
                  >
                    {t('authenticators.tfa.name')}
                  </h3>
                  <Badge variant={tfaEnabled ? 'default' : 'outline'}>
                    {tfaEnabled
                      ? t('authenticators.enabled')
                      : t('authenticators.disabled')}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('authenticators.tfa.description')}
                </p>
              </div>
            </div>
            {tfaEnabled && (
              <ConfirmActionDialog
                title={t('authenticators.tfa.removeTitle')}
                description={t('authenticators.tfa.removeDescription')}
                confirmLabel={t('authenticators.remove')}
                cancelLabel={t('cancel')}
                fallbackError={t('actionFailed')}
                confirmVariant="destructive"
                onConfirm={removeTfa}
                trigger={(pending) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                  >
                    {t('authenticators.remove')}
                  </Button>
                )}
              />
            )}
          </li>
          {authenticators.map((authenticator) => {
            const id = credentialIdBase64(authenticator.credentialID);
            const name =
              authenticator.name || t('authenticators.webauthn.unnamed');
            return (
              <li
                key={id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                data-llm-visible="true"
              >
                <div className="flex items-start gap-3">
                  {authenticator.authenticatorAttachment === 'platform' ? (
                    <Fingerprint
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <Usb
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium" data-llm-text={name}>
                      {name}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {authenticatorShortId(authenticator.credentialID)}
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {authenticator.regat
                        ? t('authenticators.webauthn.registeredAt', {
                            time: formatRecordTime(
                              authenticator.regat,
                              'YYYY-MM-DD'
                            ),
                          })
                        : ''}
                      {authenticator.credentialDeviceType
                        ? ` · ${authenticator.credentialDeviceType}`
                        : ''}
                    </p>
                  </div>
                </div>
                <ConfirmActionDialog
                  title={t('authenticators.webauthn.removeTitle')}
                  description={t('authenticators.webauthn.removeDescription', {
                    name,
                  })}
                  confirmLabel={t('authenticators.remove')}
                  cancelLabel={t('cancel')}
                  fallbackError={t('actionFailed')}
                  confirmVariant="destructive"
                  onConfirm={() => removeAuthenticator(id)}
                  trigger={(pending) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                    >
                      {t('authenticators.remove')}
                    </Button>
                  )}
                />
              </li>
            );
          })}
        </ul>

        {authenticators.length === 0 && (
          <Empty className="border">
            <EmptyMedia variant="icon">
              <ShieldCheck aria-hidden="true" />
            </EmptyMedia>
            <EmptyDescription
              data-llm-text={t('authenticators.webauthn.empty')}
            >
              {t('authenticators.webauthn.empty')}
            </EmptyDescription>
          </Empty>
        )}
      </div>

      <AddAuthenticatorDialog
        open={addOpen}
        uname={uname}
        tfaEnabled={tfaEnabled}
        adding={adding}
        webAuthnSupported={webAuthnSupported}
        platformAvailable={platformAvailable}
        onClose={() => setAddOpen(false)}
        onRegistered={registerAuthenticator}
      />
    </SettingsSection>
  );
}

type Method = 'tfa' | 'platform' | 'cross-platform';

type AddProps = {
  open: boolean;
  uname: string;
  tfaEnabled: boolean;
  adding: boolean;
  webAuthnSupported: boolean;
  platformAvailable: boolean;
  onClose: () => void;
  onRegistered: (type: 'platform' | 'cross-platform', name: string) => void;
};

function AddAuthenticatorDialog({
  open,
  uname,
  tfaEnabled,
  adding,
  webAuthnSupported,
  platformAvailable,
  onClose,
  onRegistered,
}: AddProps) {
  const t = useTranslations('security');
  const [method, setMethod] = useState<Method | null>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMethod(null);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg"
          data-llm-visible="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {method === 'tfa'
                  ? t('authenticators.tfa.setupTitle')
                  : t('authenticators.chooseTitle')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {method === 'tfa'
                  ? t('authenticators.tfa.setupDescription')
                  : t('authenticators.chooseDescription')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon-sm">
                <X aria-hidden="true" />
                <span className="sr-only">{t('cancel')}</span>
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-4">
            {method === null ? (
              <ul className="space-y-2">
                <MethodButton
                  icon={Smartphone}
                  label={t('authenticators.tfa.name')}
                  description={t('authenticators.tfa.short')}
                  disabled={tfaEnabled}
                  onSelect={() => setMethod('tfa')}
                />
                <li>
                  <Separator />
                </li>
                {!webAuthnSupported ? (
                  <li className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                    {t('authenticators.webauthn.unsupported')}
                  </li>
                ) : (
                  <>
                    <MethodButton
                      icon={Fingerprint}
                      label={t('authenticators.webauthn.platform')}
                      description={
                        platformAvailable
                          ? t('authenticators.webauthn.platformDescription')
                          : t('authenticators.webauthn.platformUnavailable')
                      }
                      disabled={!platformAvailable || adding}
                      onSelect={() => setMethod('platform')}
                    />
                    <MethodButton
                      icon={Usb}
                      label={t('authenticators.webauthn.crossPlatform')}
                      description={t(
                        'authenticators.webauthn.crossPlatformDescription'
                      )}
                      disabled={adding}
                      onSelect={() => setMethod('cross-platform')}
                    />
                  </>
                )}
              </ul>
            ) : method === 'tfa' ? (
              <TotpSetup
                uname={uname}
                onCancel={() => setMethod(null)}
                onDone={() => {
                  setMethod(null);
                  onClose();
                }}
              />
            ) : (
              <NameForm
                disabled={adding}
                onCancel={() => setMethod(null)}
                onSubmit={(name) => onRegistered(method, name)}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MethodButton({
  icon: Icon,
  label,
  description,
  disabled,
  onSelect,
}: {
  icon: typeof Smartphone;
  label: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium" data-llm-text={label}>
            {label}
          </span>
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </button>
    </li>
  );
}

function TotpSetup({
  uname,
  onCancel,
  onDone,
}: {
  uname: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('security');
  const [secret] = useState(() => generateTotpSecret());
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { copied, onCopy } = useClipboardCopy(secret);
  const uri = otpauthUri(uname, secret);

  const submit = async () => {
    if (submitting) return;
    if (!/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      setError(t('authenticators.tfa.codeInvalid'));
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await ClientApis.Account.enableTfa(
        code.replace(/\s+/g, ''),
        secret
      ).send();
      if ('error' in response)
        throw new Error(parseErrorMessage(response.error));
      toast.success(t('authenticators.tfa.enabled'));
      onDone();
    } catch (caught) {
      setError(securityErrorMessage(caught, t('actionFailed')) ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t('authenticators.tfa.stepScan')}</li>
        <li>{t('authenticators.tfa.stepEnter')}</li>
      </ol>
      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t('authenticators.tfa.secretLabel')}
        </p>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 break-all font-mono text-sm"
            data-llm-text={secret}
          >
            {secret}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={onCopy}>
            <Copy aria-hidden="true" />
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('authenticators.tfa.uriLabel')}
        </p>
        <code className="block break-all font-mono text-xs text-muted-foreground">
          {uri}
        </code>
      </div>
      <Field>
        <FieldLabel htmlFor="security-tfa-code">
          {t('authenticators.tfa.codeLabel')}
        </FieldLabel>
        <Input
          id="security-tfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          disabled={submitting}
          aria-invalid={Boolean(error)}
          onChange={(event) => setCode(event.target.value)}
        />
        <FieldDescription className="text-xs">
          {t('authenticators.tfa.codeHelp')}
        </FieldDescription>
        {error && <FieldError errors={[{ message: error }]} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={submitting}>
          {submitting && <LoaderCircle className="animate-spin" />}
          {submitting ? t('saving') : t('authenticators.tfa.enable')}
        </Button>
      </div>
    </div>
  );
}

function NameForm({
  disabled,
  onSubmit,
  onCancel,
}: {
  disabled: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('security');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) {
      setError(t('authenticators.webauthn.nameRequired'));
      return;
    }
    setError(undefined);
    onSubmit(trimmed);
  };

  return (
    <FieldGroup className="max-w-md gap-4">
      <Field>
        <FieldLabel htmlFor="security-authenticator-name">
          {t('authenticators.webauthn.nameLabel')}
        </FieldLabel>
        <Input
          id="security-authenticator-name"
          value={name}
          maxLength={100}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldDescription className="text-xs">
          {t('authenticators.webauthn.nameHelp')}
        </FieldDescription>
        {error && <FieldError errors={[{ message: error }]} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
        >
          {t('cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={disabled}>
          {disabled && <LoaderCircle className="animate-spin" />}
          {disabled ? t('saving') : t('authenticators.webauthn.register')}
        </Button>
      </div>
    </FieldGroup>
  );
}
