import type { Next } from 'koa';
import type { KoaContext } from '@hydrooj/framework';
import { Time } from '@hydrooj/utils';
import { PRIV } from '../../model/builtin';

export const HOST_REDIRECT_SOURCE = 'ycoj.cc';
export const HOST_REDIRECT_TARGET = 'https://next.ycoj.cc';
export const HOST_REDIRECT_COOLDOWN_COOKIE = 'ycoj_next_redirect_cooldown';

export function shouldRedirectFromLegacyHost(ctx: KoaContext) {
    const { request, user } = ctx.HydroContext;
    const host = request.host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
    const isJson = request.json || request.headers['content-type']?.toLowerCase().includes('application/json');
    return host === HOST_REDIRECT_SOURCE
        && !isJson
        && !ctx.cookies.get(HOST_REDIRECT_COOLDOWN_COOKIE)
        && (user?._id === 0 || user?.priv !== PRIV.PRIV_ALL);
}

export default async (ctx: KoaContext, next: Next) => {
    if (!shouldRedirectFromLegacyHost(ctx)) {
        await next();
        return;
    }
    const query = ctx.HydroContext.request.querystring;
    const path = ctx.originalPath || ctx.HydroContext.request.path;
    ctx.HydroContext.response.redirect = `${HOST_REDIRECT_TARGET}${path}${query ? `?${query}` : ''}`;
    ctx.cookies.set(HOST_REDIRECT_COOLDOWN_COOKIE, '1', {
        maxAge: Time.day,
        httpOnly: false,
        path: '/',
    });
};
