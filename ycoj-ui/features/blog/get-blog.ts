import Blog from '@/api/server/method/blog';
import { cache } from 'react';
import 'server-only';

export const getBlogList = cache(async (uid: number, page?: number) =>
  Blog.getBlogList(uid, page)
);

export const getBlogDetail = cache(async (uid: number, did: string) =>
  Blog.getBlogDetail(uid, did)
);

export const getBlogEdit = cache(async (uid: number, did: string) =>
  Blog.getBlogEdit(uid, did)
);
