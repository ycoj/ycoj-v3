'use client';

import BlogApis from '@/api/client/method/blog';
import BlogForm from '@/features/blog/form/blog-form';
import {
  blogDetailPath,
  buildBlogPayload,
  type BlogFormValues,
} from '@/features/blog/lib/blog-utils';
import ConfirmDeleteButton from '@/shared/components/confirm-delete-button';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import type { Blog } from '@/shared/types/blog';

type Props = {
  uid: number;
  blog: Blog;
};

export default function BlogEditForm({ uid, blog }: Props) {
  const did = blog.docId;
  const detailPath = blogDetailPath(uid, did);

  return (
    <BlogForm
      mode="edit"
      defaultValues={{ title: blog.title, content: blog.content }}
      cancelHref={detailPath}
      onSubmit={async (values: BlogFormValues) => {
        const payload = buildBlogPayload(values);
        const response = await BlogApis.updateBlog(
          uid,
          did,
          payload.title,
          payload.content
        ).send();
        if ('error' in response) {
          throw new Error(parseErrorMessage(response.error));
        }
        return detailPath;
      }}
      extraActions={(isSubmitting) => (
        <ConfirmDeleteButton
          id={did}
          namespace="blog"
          listRoute={`/blog/${uid}`}
          disabled={isSubmitting}
          onDelete={(id) => BlogApis.deleteBlog(uid, id).send()}
        />
      )}
    />
  );
}
