import { ObjectId } from 'mongodb';
import { ProblemConfigError } from '../../error';
import { STATUS } from '../builtin';
import problem from '../problem';
import record from '../record';

export async function rejudgeContest(domainId: string, tid: ObjectId, uid: number) {
    const rdocs = await record.getMulti(domainId, {
        contest: tid,
        status: { $ne: STATUS.STATUS_CANCELED },
        'files.hack': { $exists: false },
    }).project({ _id: 1, pid: 1 }).toArray();
    if (!rdocs.length) return 0;

    const groups = new Map<number, ObjectId[]>();
    for (const rdoc of rdocs) {
        if (!groups.has(rdoc.pid)) groups.set(rdoc.pid, []);
        groups.get(rdoc.pid).push(rdoc._id);
    }
    // Validate every submitted problem before resetting any results.
    for (const pid of groups.keys()) {
        let pdoc = await problem.get(domainId, pid);
        if (pdoc?.reference) pdoc = await problem.get(pdoc.reference.domainId, pdoc.reference.pid);
        if (!pdoc?.config || typeof pdoc.config === 'string') throw new ProblemConfigError();
    }
    const priority = await record.submissionPriority(uid, -10000 - rdocs.length * 5 - 50);
    for (const rids of groups.values()) {
        await record.reset(domainId, rids, true);
        // judge() loads the configuration of the first record's problem for the whole batch.
        await record.judge(domainId, rids, priority, { detail: false }, { rejudge: true });
    }
    return rdocs.length;
}
