import ServerApis from '@/api/server/method';
import DomainSearchPage from '@/features/domain/search/domain-search-page';
import { getUser } from '@/features/user/lib/get-user';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

type SearchParams = { q?: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('domain');
  return { title: t('domainSearchTitle') };
}

export default async function DomainSearchRoute({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, user] = await Promise.all([searchParamsPromise, getUser()]);
  if (!user?._id) redirect('/login?redirect=%2Fdomain%2Fsearch');
  const q = params.q?.trim() ?? '';
  const results = await ServerApis.Domain.searchDomains(q || undefined);
  return (
    <DomainSearchPage
      initialQuery={q}
      initialResults={Array.isArray(results) ? results : []}
    />
  );
}
