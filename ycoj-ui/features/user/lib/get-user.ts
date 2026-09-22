import { getNavInfos as getNavInfosApi } from '@/api/server/method/ui/nav';
import { cache } from 'react';

const getNavInfos = cache(async () => {
  return await getNavInfosApi();
});

const getUser = cache(async () => {
  const nav = await getNavInfos();
  return nav.user;
});

export { getNavInfos, getUser };
