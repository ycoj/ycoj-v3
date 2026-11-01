import { z } from 'zod';

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createBrandingSchema(messages: {
  origin: string;
  name: string;
  logo: string;
  duplicate: string;
  secureLogo: string;
}) {
  return z
    .object({
      brands: z.array(
        z
          .object({
            origin: z
              .string()
              .refine(
                (value) => normalizeOrigin(value) !== null,
                messages.origin
              ),
            name: z
              .string()
              .trim()
              .min(1, messages.name)
              .max(100, messages.name),
            logo: z
              .string()
              .trim()
              .refine((value) => {
                try {
                  const url = new URL(value);
                  return (
                    ['http:', 'https:'].includes(url.protocol) &&
                    !url.username &&
                    !url.password
                  );
                } catch {
                  return false;
                }
              }, messages.logo),
          })
          .superRefine((brand, ctx) => {
            if (
              normalizeOrigin(brand.origin)?.startsWith('https:') &&
              brand.logo.toLowerCase().startsWith('http:')
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['logo'],
                message: messages.secureLogo,
              });
            }
          })
      ),
    })
    .superRefine(({ brands }, ctx) => {
      const origins = new Set<string>();
      brands.forEach((brand, index) => {
        const origin = normalizeOrigin(brand.origin);
        if (!origin) return;
        if (origins.has(origin))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['brands', index, 'origin'],
            message: messages.duplicate,
          });
        origins.add(origin);
      });
    });
}
