import {
  BLOG_TITLE_MAX_LENGTH,
  blogDetailPath,
  buildBlogPayload,
  canCreateBlog,
  canEditBlog,
  getBlogPublishedAt,
  validateBlogValues,
} from './blog-utils';
import { describe, expect, it } from 'vitest';

const messages = {
  titleRequired: 'Title is required',
  titleTooLong: 'Title is too long',
  contentRequired: 'Content is required',
};

describe('validateBlogValues', () => {
  it.each([
    {
      name: 'accepts a complete post',
      values: { title: 'Hello', content: 'Body' },
      expected: {},
    },
    {
      name: 'rejects a blank title after trimming',
      values: { title: '   ', content: 'Body' },
      expected: { title: 'Title is required' },
    },
    {
      name: 'rejects a title past the backend limit',
      values: { title: 'x'.repeat(BLOG_TITLE_MAX_LENGTH + 1), content: 'Body' },
      expected: { title: 'Title is too long' },
    },
    {
      name: 'accepts a title exactly at the backend limit',
      values: { title: 'x'.repeat(BLOG_TITLE_MAX_LENGTH), content: 'Body' },
      expected: {},
    },
    {
      name: 'rejects blank content',
      values: { title: 'Hello', content: ' \n ' },
      expected: { content: 'Content is required' },
    },
    {
      name: 'reports both missing fields at once',
      values: { title: '', content: '' },
      expected: { title: 'Title is required', content: 'Content is required' },
    },
  ])('$name', ({ values, expected }) => {
    expect(validateBlogValues(values, messages)).toEqual(expected);
  });
});

describe('buildBlogPayload', () => {
  it('trims leading and trailing whitespace for the write payload', () => {
    expect(
      buildBlogPayload({ title: '  Post  ', content: '\nBody\n' })
    ).toEqual({ title: 'Post', content: 'Body' });
  });
});

describe('blog paths', () => {
  it('builds the list, detail and edit links used by the pages', () => {
    expect(blogDetailPath(12, 'abc')).toBe('/blog/12/abc');
  });
});

describe('getBlogPublishedAt', () => {
  it('reads the ObjectId time stamp', () => {
    // The first four bytes are Unix seconds.
    expect(getBlogPublishedAt('66000000' + '0'.repeat(16))?.toISOString()).toBe(
      '2024-03-24T10:27:12.000Z'
    );
  });

  it('returns null for a missing or non-ObjectId id', () => {
    expect(getBlogPublishedAt('')).toBeNull();
    expect(getBlogPublishedAt('not-an-id')).toBeNull();
  });
});

describe('blog permissions', () => {
  const blog = { owner: 12 };

  it('lets the author edit and create', () => {
    expect(canEditBlog(12, blog, false)).toBe(true);
    expect(canCreateBlog(12, 12)).toBe(true);
  });

  it('lets a system editor edit but not create on another blog', () => {
    expect(canEditBlog(13, blog, true)).toBe(true);
    expect(canCreateBlog(13, 12)).toBe(false);
  });

  it('hides actions from guests and other visitors', () => {
    expect(canEditBlog(undefined, blog, false)).toBe(false);
    expect(canCreateBlog(undefined, 12)).toBe(false);
    expect(canEditBlog(99, blog, false)).toBe(false);
  });
});
