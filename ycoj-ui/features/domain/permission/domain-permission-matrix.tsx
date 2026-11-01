'use client';

import ClientApis from '@/api/client/method';
import type { DomainPermissionsResponse } from '@/api/server/method/domain/types';
import {
  buildPermissionMatrix,
  hasPermission,
  initialPermissionState,
  isEditableRole,
  serializePermissions,
  togglePermission,
} from '@/features/domain/lib/domain-permissions';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import { permissionLabelName } from '@/features/domain/lib/perm-labels';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Props = { data: DomainPermissionsResponse };

export default function DomainPermissionMatrix({ data }: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const families = useMemo(
    () => buildPermissionMatrix(data.PERMS_BY_FAMILY),
    [data.PERMS_BY_FAMILY]
  );
  // Root is excluded from editing and rendered disabled for context.
  const roles = data.roles;
  const [matrix, setMatrix] = useState(() => initialPermissionState(roles));
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Backend descriptions are English; prefer the localized PERM catalog when the
  // bit index maps to a known PERM name, otherwise show the description.
  const permissionLabel = (key: string, fallback: string) => {
    const name = permissionLabelName(key);
    return name && t.has(`permissionNames.${name}`)
      ? t(`permissionNames.${name}`)
      : fallback;
  };

  const toggle = (roleId: string, permissionKey: string) => {
    setMatrix((current) => {
      const next = new Map(current);
      const mask = next.get(roleId) ?? BigInt(0);
      next.set(roleId, togglePermission(mask, { key: permissionKey }));
      return next;
    });
    setDirty(true);
  };

  const submit = async () => {
    if (!dirty || submitting) return;
    setSubmitting(true);
    try {
      const payload = serializePermissions(matrix);
      await submitDomainMutation(
        ClientApis.Domain.saveDomainPermissions(payload),
        '/domain/permission'
      );
      toast.success(t('permissionsSaved'));
      setDirty(false);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('permissionsFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="space-y-1">
        <h1
          className="text-xl font-semibold"
          data-llm-text={t('permissionsTitle')}
        >
          {t('permissionsTitle')}
        </h1>
        <p
          className="text-sm text-muted-foreground"
          data-llm-text={t('permissionsHint')}
        >
          {t('permissionsHint')}
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">
                {t('permissionColumn')}
              </TableHead>
              {roles.map((role) => (
                <TableHead
                  key={role._id}
                  className="w-24 text-center font-mono"
                  data-llm-text={role._id}
                >
                  {role._id}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {families.map((family) => (
            <TableBody key={family.family}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell
                  colSpan={roles.length + 1}
                  className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
                  data-llm-text={
                    t.has(`permissionFamily.${family.family}`)
                      ? t(`permissionFamily.${family.family}`)
                      : family.family
                  }
                >
                  {t.has(`permissionFamily.${family.family}`)
                    ? t(`permissionFamily.${family.family}`)
                    : family.family}
                </TableCell>
              </TableRow>
              {family.permissions.map((permission) => (
                <TableRow key={permission.key}>
                  <TableCell
                    className="whitespace-normal"
                    data-llm-text={permissionLabel(
                      permission.key,
                      permission.desc
                    )}
                  >
                    {permissionLabel(permission.key, permission.desc)}
                  </TableCell>
                  {roles.map((role) => {
                    const editable = isEditableRole(role._id);
                    const mask = matrix.get(role._id) ?? BigInt(0);
                    return (
                      <TableCell key={role._id} className="text-center">
                        <Checkbox
                          aria-label={`${role._id}: ${permissionLabel(permission.key, permission.desc)}`}
                          checked={
                            !editable
                              ? hasPermission(
                                  BigInt(
                                    role.perm.replace(/^BigInt::/, '') || '0'
                                  ),
                                  permission
                                )
                              : hasPermission(mask, permission)
                          }
                          disabled={!editable || submitting}
                          onCheckedChange={() =>
                            toggle(role._id, permission.key)
                          }
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!dirty || submitting}
          onClick={() => void submit()}
        >
          {t('updatePermissions')}
        </Button>
      </div>
    </div>
  );
}
