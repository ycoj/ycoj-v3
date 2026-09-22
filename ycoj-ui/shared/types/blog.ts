import { ObjectId } from './shared';

export const BLOG_CATEGORIES = ['算法', '文化课', '游记', '随笔'] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_VISIBILITIES = ['public', 'private', 'invisible'] as const;
export type BlogVisibility = (typeof BLOG_VISIBILITIES)[number];

export type BlogReply = {
  _id: ObjectId;
  content: string;
  owner: number;
  ip: string;
};

export type Blog = {
  docType: 70;
  docId: ObjectId;
  owner: number;
  title: string;
  content: string;
  tags: string[];
  category?: BlogCategory;
  visibility: BlogVisibility;
  ip: string;
  updateAt: Date;
  nReply: number;
  likeCount: number;
  views: number;
  reply: BlogReply[];
  react: Record<string, number>;
};
