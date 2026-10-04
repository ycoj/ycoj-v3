import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'pdf-embed',
    'samples',
    'user-span',
    'md-alert',
    'md-align',
    'details',
    'summary',
    'kbd',
    'sub',
    'sup',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ['className', /^language-./, 'math-inline', 'math-display'],
      ...(defaultSchema.attributes?.code ?? []),
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['target', /^_(?:blank|self|parent|top)$/],
      [
        'rel',
        /^(?:noopener|noreferrer|nofollow|ugc|sponsored)(?:\s+(?:noopener|noreferrer|nofollow|ugc|sponsored))*$/,
      ],
    ],
    'pdf-embed': ['dataSrc', 'data-src'],
    'md-alert': [
      ['dataVariant', /^(info|warning|success|error)$/],
      ['data-variant', /^(info|warning|success|error)$/],
      'dataTitle',
      'data-title',
      ['dataState', /^(opened|closed)$/],
      ['data-state', /^(opened|closed)$/],
    ],
    'md-align': [
      ['dataAlign', /^(center|left|right)$/],
      ['data-align', /^(center|left|right)$/],
    ],
    samples: [
      ['dataIndex', /^\d+$/],
      'dataInput',
      'dataOutput',
      ['data-index', /^\d+$/],
      'data-input',
      'data-output',
    ],
    'user-span': [
      ['dataUid', /^\d+$/],
      'dataUname',
      'dataMail',
      'dataAvatar',
      ['data-uid', /^\d+$/],
      'data-uname',
      'data-mail',
      'data-avatar',
    ],
  },
};
