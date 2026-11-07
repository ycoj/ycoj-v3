import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { describe, it } from 'node:test';
import nunjucks from 'nunjucks';

const source = fs.readFileSync(
    path.resolve(__dirname, '../../ui-default/templates/partials/homepage/checkin.html'),
    'utf8',
);
const env = new nunjucks.Environment(null, { autoescape: true });

function render(payload: unknown, checkin: Record<string, unknown>) {
    return env.renderString(source, { payload, checkin, _: (text: string) => text });
}

const state = {
    date: '2026-11-07',
    canCheckin: true,
    record: null,
    streak: 0,
};

describe('homepage check-in template', () => {
    it('shows the configured card and hides an explicit false value', () => {
        const shown = render(true, state);
        assert.ok(shown.includes('Check In'));
        assert.ok(shown.includes('2026-11-07'));
        assert.equal(render(false, state).trim(), '');
        assert.equal(render({ enabled: false }, state).trim(), '');
    });

    it('shows the quote after check-in', () => {
        const html = render(true, {
            ...state,
            canCheckin: false,
            record: { hitokoto: { text: '用代码表达言语的魅力。' } },
        });
        assert.ok(html.includes('用代码表达言语的魅力。'));
        assert.ok(!html.includes('2026-11-07'));
    });
});
