import assert from 'assert';
import { Context } from 'cordis';
import Koa from 'koa';
import { describe, it } from 'node:test';
import { isCorsOriginAllowed } from '../../../framework/framework/cors';
import { WebService } from '../../../framework/framework/server';
import { getBrandingConfig, normalizeBrandingConfig, resolveBrand } from '../src/lib/branding';

const brand = { origin: 'https://oj.school.edu', name: 'School OJ', logo: 'https://cdn.school.edu/logo.png' };

describe('domain branding and CORS allowlist', () => {
    it('normalizes origins and resolves brands without sharing defaults across origins', () => {
        const config = normalizeBrandingConfig({ brands: [{ ...brand, origin: ' HTTPS://OJ.SCHOOL.EDU:443/ ', name: ' School OJ ' }] });
        assert.deepEqual(config.brands, [brand]);
        assert.deepEqual(resolveBrand(config, 'https://oj.school.edu/'), brand);
        for (const origin of ['http://oj.school.edu', 'https://oj.school.edu:8443', 'https://other.edu', 'invalid']) {
            assert.equal(resolveBrand(config, origin), null);
        }
        assert.deepEqual(getBrandingConfig(JSON.stringify(config)), config);
        assert.deepEqual(getBrandingConfig(undefined), { brands: [] });
    });

    it('rejects duplicate origins, credentials, paths and unsafe or mixed-content logos', () => {
        assert.throws(() => normalizeBrandingConfig({ brands: [brand, { ...brand, origin: `${brand.origin}:443` }] }));
        for (const origin of [
            'https://user:pass@oj.school.edu', 'https://oj.school.edu/path', 'https://oj.school.edu?q=1',
            'https://oj.school.edu#logo', '*.school.edu', 'null',
        ]) {
            assert.throws(() => normalizeBrandingConfig({ brands: [{ ...brand, origin }] }));
        }
        for (const logo of [
            'javascript:alert(1)', 'data:image/png;base64,abc', '/logo.png',
            'http://cdn.school.edu/logo.png', 'https://user:pass@cdn.school.edu/logo.png',
        ]) {
            assert.throws(() => normalizeBrandingConfig({ brands: [{ ...brand, logo }] }));
        }
        assert.throws(() => normalizeBrandingConfig({ brands: [{ ...brand, name: ' ' }] }));
        assert.throws(() => normalizeBrandingConfig({ brands: [{ ...brand, name: 'x'.repeat(101) }] }));
    });

    it('uses exact origin matching for brand access, preserving explicit legacy host entries', () => {
        const entries = [brand.origin, ' legacy.school.edu:3000 '];
        assert.equal(isCorsOriginAllowed(brand.origin, entries), true);
        assert.equal(isCorsOriginAllowed('http://legacy.school.edu:3000', entries), true);
        for (const origin of [
            'null', 'http://oj.school.edu', 'https://oj.school.edu:8443', 'https://oj.school.edu.evil.test',
            'https://sub.oj.school.edu', 'https://user@oj.school.edu', 'https://oj.school.edu/path',
        ]) {
            assert.equal(isCorsOriginAllowed(origin, entries), false);
        }
        assert.equal(isCorsOriginAllowed(brand.origin, []), false);
    });
});

describe('credentialed branding CORS middleware', () => {
    const service = new WebService(new Context(), { keys: ['test'], cors: '', upload: '' } as ConstructorParameters<typeof WebService>[1]);
    let origins = [brand.origin];
    service.corsOrigins = () => origins;
    const app = new Koa();
    app.use(service.server.middleware[1]);
    app.use((ctx) => {
        ctx.vary('Accept-Encoding');
        ctx.set('Content-Disposition', 'attachment; filename="test.txt"');
        ctx.body = 'asset';
    });
    const request = require('supertest');

    it('grants JSON/authorization preflights and exposes file-download headers', async () => {
        const preflight = await request(app.callback()).options('/resource').set('Origin', brand.origin)
            .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,authorization');
        assert.equal(preflight.headers['access-control-allow-origin'], brand.origin);
        assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
        assert.match(preflight.headers['access-control-allow-methods'], /POST/);
        assert.match(preflight.headers['access-control-allow-headers'], /authorization/);
        const asset = await request(app.callback()).get('/resource').set('Origin', brand.origin);
        assert.equal(asset.text, 'asset');
        assert.match(asset.headers['access-control-expose-headers'], /Content-Disposition/);
        assert.match(asset.headers.vary, /Origin/);
        assert.match(asset.headers.vary, /Accept-Encoding/);
    });

    it('revokes grants immediately when a brand is removed and rejects unlisted origins', async () => {
        origins = [];
        await Promise.all([brand.origin, 'https://oj.school.edu.evil.test', 'null'].map(async (origin) => {
            const response = await request(app.callback()).options('/resource').set('Origin', origin);
            assert.equal(response.headers['access-control-allow-origin'], undefined);
            assert.equal(response.headers['access-control-allow-credentials'], undefined);
            assert.match(response.headers.vary, /Origin/);
        }));
        service.config.cors = 'legacy.school.edu:3000';
        const legacy = await request(app.callback()).options('/resource').set('Origin', 'http://legacy.school.edu:3000');
        assert.equal(legacy.headers['access-control-allow-origin'], 'http://legacy.school.edu:3000');
    });
});
