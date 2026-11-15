import {
    DocumentModel, Logger, ProblemDoc, ProblemModel, yaml,
} from 'hydrooj';
import { isOpenVJudgePid, OPEN_VJUDGE_PROVIDER } from './open-vjudge-utils';

const logger = new Logger('migration/open-vjudge');

interface MigrationProblem extends Pick<ProblemDoc, 'domainId' | 'docId' | 'pid' | 'config' | 'data' | 'reference'> { }

interface MigrationStore {
    findProblems: () => AsyncIterable<MigrationProblem>;
    saveConfig: (domainId: string, docId: number, config: string) => Promise<unknown>;
}

const defaultStore: MigrationStore = {
    findProblems: () => DocumentModel.coll.find({
        docType: DocumentModel.TYPE_PROBLEM,
        pid: { $regex: /^(?:CF|abc|arc|agc)/ },
    }).project({
        domainId: 1, docId: 1, pid: 1, config: 1, data: 1, reference: 1,
    }),
    saveConfig: (domainId, docId, config) => ProblemModel.addTestdata(domainId, docId, 'config.yaml', Buffer.from(config)),
};

export function hasLocalTestdata(files: ProblemDoc['data'] = []) {
    return (files || []).some((file) => !/^config\.ya?ml$/i.test(file.name));
}

export function openVJudgeMigrationConfig(pdoc: MigrationProblem) {
    if (pdoc.reference || !isOpenVJudgePid(pdoc.pid) || hasLocalTestdata(pdoc.data)) return null;
    const parsed: any = typeof pdoc.config === 'string' ? yaml.load(pdoc.config || '{}') : pdoc.config;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.type !== 'remote_judge') return null;
    if (parsed.subType === OPEN_VJUDGE_PROVIDER && parsed.target === pdoc.pid) return null;
    return {
        ...parsed,
        type: 'remote_judge',
        subType: OPEN_VJUDGE_PROVIDER,
        target: pdoc.pid,
    };
}

export async function migrateOpenVJudgeProblems(store: MigrationStore = defaultStore) {
    let migrated = 0;
    for await (const pdoc of store.findProblems()) {
        const config = openVJudgeMigrationConfig(pdoc);
        if (!config) continue;
        await store.saveConfig(pdoc.domainId, pdoc.docId, yaml.dump(config));
        migrated++;
    }
    logger.info('Migrated %d AtCoder/Codeforces problem(s) to OpenVJudge.', migrated);
    return true;
}
