import ServerApis from '@/api/server/method';
import DomainBulletin from '@/features/domain/bulletin';
import JoinDomainForm from '@/features/domain/join/join-domain-form';
import JoinEntryForm from '@/features/domain/join/join-entry-form';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';

type SearchParams = {
  target?: string;
  code?: string;
  redirect?: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainJoin') };
}

export default async function DomainJoinRoute({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, user, t] = await Promise.all([
    searchParamsPromise,
    getUser(),
    getTranslations('domain'),
  ]);
  if (!user?._id) redirect('/login?redirect=%2Fdomain%2Fjoin');

  const target = params.target?.trim();
  // Without a target the backend falls back to the active domain, which is
  // rarely what a user wants from a generic join link, so collect one first.
  if (!target) return <JoinEntryForm />;

  let response: Awaited<ReturnType<typeof ServerApis.Domain.getDomainJoin>>;
  try {
    response = await ServerApis.Domain.getDomainJoin({
      target,
      ...(params.code ? { code: params.code } : {}),
      ...(params.redirect ? { redirect: params.redirect } : {}),
    });
    if (isSudoRequired(response)) redirect('/user/sudo');
    throwBackendError(response);
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Errored
        error={
          error instanceof BackendResponseError && error.message
            ? error.message
            : t('joinFailed')
        }
      />
    );
  }
  if (!('domainInfo' in response)) return <Errored error={t('joinFailed')} />;
  const current = await ServerApis.Domain.getCurrentDomain();
  const activeDomainId =
    'domain' in current && current.domain?._id ? current.domain._id : 'system';
  return (
    <JoinDomainForm
      data={response}
      target={target}
      activeDomainId={activeDomainId}
      bulletin={
        response.domainInfo.bulletin ? (
          <DomainBulletin content={response.domainInfo.bulletin} />
        ) : undefined
      }
    />
  );
}
