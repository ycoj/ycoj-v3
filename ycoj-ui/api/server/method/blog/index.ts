import { getBlogDetail, getBlogEdit, getBlogList } from './detail';

const Blog = {
  getBlogList,
  getBlogDetail,
  getBlogEdit,
};

export default Blog;

export type {
  BlogAuthor,
  BlogDetailResponse,
  BlogEditResponse,
  BlogListResponse,
  BlogStatus,
} from './detail';
