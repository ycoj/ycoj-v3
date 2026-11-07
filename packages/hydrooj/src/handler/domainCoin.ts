import { Context } from '../context';
import { RewardError } from '../lib/rewards';
import { PERM } from '../model/builtin';
import * as coinAdjust from '../model/coinAdjust';
import domain from '../model/domain';
import * as oplog from '../model/oplog';
import {
    Handler, param, requireSudo, Types,
} from '../service/server';

class DomainCoinHandler extends Handler {
    async prepare({ domainId }) {
        this.checkPerm(PERM.PERM_EDIT_DOMAIN);
        this.domain = await domain.get(domainId);
    }

    async get() {
        this.response.body = {
            domain: { _id: this.domain._id, name: this.domain.name },
        };
    }

    @requireSudo
    @param('uids', Types.NumericArray)
    @param('direction', Types.Range(['grant', 'deduct']))
    @param('amount', Types.PositiveInt)
    @param('reason', Types.Content)
    @param('requestId', Types.String)
    async postAdjust(
        domainId: string, uids: number[], direction: 'grant' | 'deduct',
        amount: number, reason: string, requestId: string,
    ) {
        // Enforce again on the mutation itself so a skipped prepare cannot grant coins.
        this.checkPerm(PERM.PERM_EDIT_DOMAIN);
        await this.limitRate('domain_coins', 60, 30, '{{user}}');
        try {
            const result = await coinAdjust.adjustDomainCoins({
                domainId,
                operatorUid: this.user._id,
                operatorName: this.user.uname,
                domainName: this.domain.name,
                uids,
                direction,
                amount,
                note: reason,
                requestId,
            });
            await oplog.log(this, 'domain.coinAdjust', {
                uids, direction, amount, requestId, reason,
            });
            this.response.body = result;
        } catch (error) {
            if (!(error instanceof RewardError)) throw error;
            this.response.status = error.message === 'busy' ? 409 : 400;
            this.response.body = { error: { name: 'RewardError', message: error.message } };
        }
    }
}

export function apply(ctx: Context) {
    ctx.Route('domain_coins', '/domain/coins', DomainCoinHandler);
}
