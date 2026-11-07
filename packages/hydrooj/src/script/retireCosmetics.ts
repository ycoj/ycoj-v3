import Schema from 'schemastery';
import { Context } from '../context';
import { retireRetiredCosmetics } from '../model/coinAdjust';
import UserModel from '../model/user';

/**
 * One-shot, idempotent refund for retired cosmetics.
 * Do not run this against a production database unless that refund is intended.
 *
 * CLI preview: hydrooj cli script retireCosmetics '{"dryRun":true}'
 * CLI apply:   hydrooj cli script retireCosmetics '{"confirm":true}'
 * Admin page:  /manage/script, id retireCosmetics, args {"dryRun":true} or {"confirm":true}
 * A second apply does not refund or message the same user again.
 * The record starts as Waiting and becomes Accepted when the script reports a judge message.
 */
const description = [
    'Refund and unequip retired solid-color frames, name backgrounds, and personal titles.',
    'Pass {"dryRun":true} to preview or {"confirm":true} to apply.',
].join(' ');

export const apply = (ctx: Context) => ctx.addScript(
    'retireCosmetics',
    description,
    Schema.object({
        confirm: Schema.boolean().default(false),
        dryRun: Schema.boolean().default(false),
    }),
    async ({ confirm = false, dryRun = false }, report) => {
        // The admin scripts page forwards this callback to JudgeResultCallbackContext#next,
        // which records body.key and body.message. A string is not a judge payload: the
        // assignment throws, the completion update is skipped, and the record stays Waiting.
        const progress = (message: string) => report({ message });
        if (!confirm && !dryRun) {
            await progress('Refusing to change wallets. Re-run with {"dryRun":true} to preview or {"confirm":true} to apply.');
            return false;
        }
        const preview = Boolean(dryRun) || !confirm;
        const result = await retireRetiredCosmetics({ dryRun: preview }, async (uid) => {
            const udoc = await UserModel.coll.findOne({ _id: uid });
            if (udoc) UserModel._deleteUserCache(udoc);
        });
        await progress([
            `Retired cosmetics: scanned ${result.scanned} wallets,`,
            `refunded ${result.refundedCoins} coins across ${result.refundedUsers} users,`,
            `sent ${result.messages} messages.`,
            preview ? 'Dry run; no data was written.' : 'Applied.',
        ].join(' '));
        return true;
    },
);
