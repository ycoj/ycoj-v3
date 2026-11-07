import Schema from 'schemastery';
import { Context } from '../context';
import { retireRetiredCosmetics } from '../model/coinAdjust';
import UserModel from '../model/user';

/**
 * One-shot, idempotent refund for retired cosmetics.
 * Do not run this against a production database unless that refund is intended.
 *
 * Preview: hydrooj cli script retireCosmetics '{"dryRun":true}'
 * Apply:   hydrooj cli script retireCosmetics '{"confirm":true}'
 * A second apply does not refund or message the same user again.
 */
export const apply = (ctx: Context) => ctx.addScript(
    'retireCosmetics',
    'Refund and unequip retired solid-color frames, name backgrounds, and personal titles',
    Schema.object({
        confirm: Schema.boolean().default(false),
        dryRun: Schema.boolean().default(false),
    }),
    async ({ confirm = false, dryRun = false }, report) => {
        if (!confirm && !dryRun) {
            report('Refusing to change wallets. Re-run with {"dryRun":true} to preview or {"confirm":true} to apply.');
            return false;
        }
        const preview = Boolean(dryRun) || !confirm;
        const result = await retireRetiredCosmetics({ dryRun: preview }, async (uid) => {
            const udoc = await UserModel.coll.findOne({ _id: uid });
            if (udoc) UserModel._deleteUserCache(udoc);
        });
        report([
            `Retired cosmetics: scanned ${result.scanned} wallets,`,
            `refunded ${result.refundedCoins} coins across ${result.refundedUsers} users,`,
            `sent ${result.messages} messages.`,
            preview ? 'Dry run; no data was written.' : 'Applied.',
        ].join(' '));
        return true;
    },
);
