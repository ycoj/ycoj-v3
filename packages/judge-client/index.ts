import {
    Context, db, ObjectId, SettingModel, SystemModel,
} from 'hydrooj';
import { migrateOpenVJudgeProblems, migrateYbtOpenVJudgeProblems } from './migration';
import OpenVJudgeProvider from './open-vjudge';
import { addOpenVJudgeLanguageMappings, OPEN_VJUDGE_PROVIDER } from './open-vjudge-utils';
import JudgeClientProvider from './provider';

declare module 'hydrooj' {
    interface Model {
        judgeclient: {
            addAccount: typeof addAccount;
        };
    }
    interface SystemKeys {
        'open-vjudge.endpoint': string;
        'open-vjudge.apiKey': string;
    }
}

async function addAccount(token: string) {
    // eslint-disable-next-line ts/no-unused-vars
    const provider = new JudgeClientProvider({
        _id: 'test', type: 'judgeclient', handle: '', password: token,
    }, async () => { });

    await db.collection('vjudge').insertOne({
        _id: new ObjectId().toHexString(),
        handle: '',
        password: token,
        type: 'judgeclient',
    });
    return 'success';
}

global.Hydro.model.judgeclient = {
    addAccount,
};

async function updateOpenVJudgeLanguages() {
    const current = SystemModel.get('hydrooj.langs');
    const updated = addOpenVJudgeLanguageMappings(current);
    if (updated !== current) await SystemModel.set('hydrooj.langs', updated);
}

export async function apply(ctx: Context) {
    ctx.setting.SystemSetting(
        SettingModel.Setting(
            'setting_server', 'open-vjudge.endpoint', '', 'text',
            'OpenVJudge Endpoint', 'Base URL of the OpenVJudge service used for AtCoder, Codeforces, and YBT submissions.',
        ),
        SettingModel.Setting(
            'setting_server', 'open-vjudge.apiKey', '', 'password',
            'OpenVJudge User API Key', 'User API key for OpenVJudge submissions. Leave blank to keep the current key.',
            SettingModel.FLAG_SECRET,
        ),
    );
    ctx.inject(['migration'], (c) => {
        c.migration.registerChannel('judge-client', [
            async function migrateToOpenVJudge() {
                return await migrateOpenVJudgeProblems();
            },
            async function migrateYbtToOpenVJudge() {
                return await migrateYbtOpenVJudgeProblems();
            },
        ]);
    });
    ctx.inject(['vjudge'], async (c) => {
        const vjudge = (c as any).vjudge;
        vjudge.addProvider('judgeclient', JudgeClientProvider);
        await updateOpenVJudgeLanguages();
        if (process.env.NODE_APP_INSTANCE === '0' && !process.env.HYDRO_CLI
            && !vjudge.accounts.some((account) => account.type === OPEN_VJUDGE_PROVIDER)) {
            vjudge.accounts.push({
                _id: OPEN_VJUDGE_PROVIDER,
                type: OPEN_VJUDGE_PROVIDER,
                handle: 'OpenVJudge',
                password: '',
            });
        }
        vjudge.addProvider(OPEN_VJUDGE_PROVIDER, OpenVJudgeProvider);
    });
}
