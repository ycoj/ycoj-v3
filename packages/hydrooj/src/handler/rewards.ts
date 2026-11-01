import { Context } from '../context';
import { RewardError } from '../lib/rewards';
import { PRIV } from '../model/builtin';
import * as rewards from '../model/rewards';
import { Handler, param, Types } from '../service/server';

class RewardsHandler extends Handler {
    async get() {
        this.response.body = await rewards.get(this.user._id);
    }

    @param('action', Types.Range(['claim', 'buy', 'equip', 'unequip']))
    @param('id', Types.String)
    async post(domainId: string, action: 'claim' | 'buy' | 'equip' | 'unequip', id: string) {
        await this.limitRate('rewards', 60, 60, '{{user}}');
        try {
            this.response.body = await rewards.act(this.user._id, { action, id });
        } catch (error) {
            if (!(error instanceof RewardError)) throw error;
            this.response.status = error.message === 'busy' ? 409 : 400;
            this.response.body = { error: { name: 'RewardError', message: error.message } };
        }
    }
}

export function apply(ctx: Context) {
    ctx.Route('rewards', '/rewards', RewardsHandler, PRIV.PRIV_USER_PROFILE);
}
