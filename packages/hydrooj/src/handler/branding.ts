import { Context } from '../context';
import { ValidationError } from '../error';
import { BRANDING_CONFIG_KEY, getBrandingConfig, normalizeBrandingConfig, resolveBrand } from '../lib/branding';
import { PRIV } from '../model/builtin';
import system from '../model/system';
import { Handler, param, requireSudo, Types } from '../service/server';

class BrandingHandler extends Handler {
    skipRealnameCheck = true;
    noCheckPermView = true;

    @param('origin', Types.String)
    async get(domainId: string, origin: string) {
        this.response.type = 'application/json';
        this.response.body = {
            brand: resolveBrand(getBrandingConfig(system.get(BRANDING_CONFIG_KEY)), origin),
        };
        this.response.addHeader('Cache-Control', 'no-store');
    }
}

class ManageBrandingHandler extends Handler {
    async prepare() {
        this.checkPriv(PRIV.PRIV_EDIT_SYSTEM);
    }

    @requireSudo
    async get() {
        this.response.type = 'application/json';
        this.response.body = { config: getBrandingConfig(system.get(BRANDING_CONFIG_KEY)) };
        this.response.addHeader('Cache-Control', 'no-store');
    }

    @requireSudo
    @param('value', Types.Content)
    async post(domainId: string, value: string) {
        let config;
        try {
            config = normalizeBrandingConfig(JSON.parse(value));
        } catch (error) {
            throw new ValidationError('value', '', error.message);
        }
        await system.set(BRANDING_CONFIG_KEY, JSON.stringify(config));
        this.response.body = { config };
    }
}

export function apply(ctx: Context) {
    ctx.Route('branding', '/branding', BrandingHandler);
    ctx.Route('manage_branding', '/manage/branding', ManageBrandingHandler);
}
