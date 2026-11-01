'use client';

import BlogApis from '@/api/client/method/blog';
import BlogForm from '@/features/blog/form/blog-form';
import {
  buildBlogPayload,
  type BlogFormValues,
} from '@/features/blog/lib/blog-utils';
import parseErrorMessage from '@/shared/components/errored/parse-message';

type Props = {
  uid: number;
};

export default function BlogCreateForm({ uid }: Props) {
  return (
    <BlogForm
      mode="create"
      defaultValues={{ title: '', content: '' }}
      cancelHref={`/blog/${uid}`}
      onSubmit={async (values: BlogFormValues) => {
        const payload = buildBlogPayload(values);
        const response = await BlogApis.createBlog(
          uid,
          payload.title,
          payload.content
        ).send();
        if ('error' in response) {
          throw new Error(parseErrorMessage(response.error));
        }
        // The handler redirects to the new post; use that destination when the
        // API answered with one, otherwise stay on the blog.
        const url = typeof response?.url === 'string' ? response.url : '';
        const path = url.replace(/^\/api(?=\/)/, '');
        return /^\/blog\/\d+\/[^/?#]+$/.test(path) ? path : `/blog/${uid}`;
      }}
    />
  );
}
