import assert from 'assert';
import Koa from 'koa';
import { describe, it } from 'node:test';
import { Handler } from '@hydrooj/framework';
import base from '@hydrooj/framework/base';
import { ValidationError } from '@hydrooj/framework/error';
import { errorMessage, sortFiles, unwrapAggregateError } from '@hydrooj/utils';

describe('upstream framework regressions', () => {
    it('preserves the first nested user-facing error and its status', async () => {
        const error = new ValidationError('pid');
        const nested = new AggregateError([new AggregateError([error]), new Error('ignored')]);
        assert.equal(unwrapAggregateError(nested), error);
        assert.equal(errorMessage(nested), error);
        const empty = new AggregateError([]);
        assert.equal(unwrapAggregateError(empty), empty);
        const noStack = new Error('message without a stack');
        noStack.stack = '';
        assert.equal(errorMessage(noStack).stack, 'message without a stack');
        const handler = Object.create(Handler.prototype);
        handler.response = {};
        const originalError = console.error;
        console.error = () => {};
        try {
            await handler.onerror(nested);
        } finally {
            console.error = originalError;
        }
        assert.equal(handler.response.status, 403);
        assert.equal(handler.response.template, 'error.html');
        assert.deepEqual(handler.response.body.error.params, ['pid']);
    });

    it('sorts empty filenames without crashing or disturbing natural order', () => {
        assert.deepEqual(sortFiles(['10.in', '', '2.in', '']), ['', '', '2.in', '10.in']);
        assert.deepEqual(sortFiles([{ name: '10.in' }, {}, { name: '2.in' }]), [{}, { name: '2.in' }, { name: '10.in' }]);
        const files = [{ name: '', marker: 1 }, { name: '', marker: 2 }];
        assert.deepEqual(sortFiles(files), files);
    });

    it('varies HTML, JSON, redirects and conditional responses on Accept while preserving existing headers', async () => {
        const app = new Koa();
        app.use((ctx, next) => {
            ctx.vary('Origin');
            ctx.vary('Accept-Encoding');
            return next();
        });
        app.use(base(console, undefined, undefined));
        app.use((ctx: any) => {
            ctx.handler = { renderHTML: async () => '<p>problem</p>' };
            const response = ctx.HydroContext.response;
            response.body = { pid: 'P1000' };
            response.template = 'problem_detail.html';
            if (ctx.path === '/redirect') response.redirect = '/p/P1000';
            if (ctx.path === '/cached') response.etag = 'problem-v1';
        });
        const request = require('supertest')(app.callback());
        await Promise.all(['/', '/redirect', '/cached'].flatMap((path) =>
            ['text/html', 'application/json'].map(async (accept) => {
                const response = await request.get(path).set('Accept', accept).set('If-None-Match', 'problem-v1');
                const vary = response.headers.vary.toLowerCase().split(/,\s*/);
                for (const header of ['accept', 'origin', 'accept-encoding']) assert.ok(vary.includes(header));
                assert.equal(response.status, path === '/cached' ? 304 : path === '/redirect' && accept === 'text/html' ? 302 : 200);
                if (path === '/' && accept === 'application/json') assert.equal(response.body.pid, 'P1000');
                if (path === '/' && accept === 'text/html') assert.equal(response.text, '<p>problem</p>');
            })));
    });
});
