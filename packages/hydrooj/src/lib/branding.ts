export const BRANDING_CONFIG_KEY = 'branding.config';

export interface Brand { origin: string, name: string, logo: string }
export interface BrandingConfig { brands: Brand[] }

export function normalizeBrandingOrigin(value: string): string {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
        || url.pathname !== '/' || url.search || url.hash) throw new Error('Enter an HTTP(S) origin without a path.');
    return url.origin;
}

export function normalizeBrandingConfig(raw: unknown): BrandingConfig {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as BrandingConfig).brands)) {
        throw new Error('Expected a brands array.');
    }
    const origins = new Set<string>();
    const brands = (raw as BrandingConfig).brands.map((brand) => {
        if (!brand || typeof brand.origin !== 'string' || typeof brand.name !== 'string' || typeof brand.logo !== 'string') {
            throw new Error('Each brand requires an origin, name and logo URL.');
        }
        const origin = normalizeBrandingOrigin(brand.origin);
        if (origins.has(origin)) throw new Error('Each origin can have only one brand.');
        origins.add(origin);
        const name = brand.name.trim();
        if (!name || name.length > 100) throw new Error('Brand names must contain 1–100 characters.');
        const logo = brand.logo.trim();
        const url = new URL(logo);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            throw new Error('Enter an absolute HTTP(S) logo URL.');
        }
        if (origin.startsWith('https:') && url.protocol !== 'https:') throw new Error('HTTPS sites require an HTTPS logo URL.');
        return { origin, name, logo: url.href };
    });
    return { brands };
}

export function getBrandingConfig(raw: unknown): BrandingConfig {
    if (!raw) return { brands: [] };
    return normalizeBrandingConfig(typeof raw === 'string' ? JSON.parse(raw) : raw);
}

export function resolveBrand(config: BrandingConfig, origin: string): Brand | null {
    try {
        const normalized = normalizeBrandingOrigin(origin);
        return config.brands.find((brand) => brand.origin === normalized) || null;
    } catch {
        return null;
    }
}
