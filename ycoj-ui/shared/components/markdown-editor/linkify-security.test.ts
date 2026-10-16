import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const editorRequire = createRequire(require.resolve('md-editor-rt'));
const markdownItPath = editorRequire.resolve('markdown-it');

describe('Markdown editor linkification', () => {
  it.each(['emails', 'unknown schemes'])(
    'finishes rendering a large paragraph of %s within a bounded subprocess',
    (kind) => {
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          `const MarkdownIt = require(${JSON.stringify(markdownItPath)});
const payload = ${JSON.stringify(kind)} === 'emails'
  ? 'a@b.co\\n'.repeat(20000)
  : 'a://'.repeat(40000);
const html = new MarkdownIt({ linkify: true }).render(payload);
if (!html.includes(${JSON.stringify(kind === 'emails' ? 'mailto:a@b.co' : 'a://')})) process.exit(1);`,
        ],
        { timeout: 5000, encoding: 'utf8' }
      );

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
    }
  );
});
