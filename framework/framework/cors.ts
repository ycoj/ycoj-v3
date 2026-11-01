export function isCorsOriginAllowed(origin: string, entries: string[]): boolean {
    try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return false;
        return entries.some((entry) => {
            const value = entry.trim();
            return value.includes('://') ? value === url.origin : value === url.host;
        });
    } catch {
        return false;
    }
}
