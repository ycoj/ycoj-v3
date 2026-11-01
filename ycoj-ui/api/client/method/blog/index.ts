import { createBlog, deleteBlog, updateBlog } from './edit';
import { starBlog, unstarBlog } from './star';

const Blog = {
  createBlog,
  updateBlog,
  deleteBlog,
  starBlog,
  unstarBlog,
};

export default Blog;

export type { BlogMutationResponse } from './edit';
export type { BlogStarResponse } from './star';
