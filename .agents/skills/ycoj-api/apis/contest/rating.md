# Contest Rating contracts

Rating is domain-scoped and independent of the existing combined `rp`/`rpInfo.contest`. No new HTTP route is registered. Existing authentication, content negotiation and ownership checks still apply.

## Create and edit

`POST /contest/create` and `POST /contest/:tid/edit`, operation `update`, accept `ratingPopulation?:'open'|'primary'|'junior'|'senior'` alongside the existing full form body. Example additional fields: `{"rated":true,"ratingPopulation":"junior"}`. Omission preserves an existing population or selects `open` on creation. Unknown nonempty values produce `ValidationError('ratingPopulation')`. Once the stored `beginAt` passes, changing the population produces the same error; model callers enforce this too. Response remains `{tid:ObjectId,url?:string}` with the existing redirect behavior. Existing contest GETs return `tdoc.ratingPopulation`; old contests without the field use `open`.

## Scoreboard result

The existing edit GET also returns `ratingPopulationLocked:boolean` for the editor (false on creation); example `{"ratingPopulationLocked":true,"tdoc":{"ratingPopulation":"junior"}}` means the selector is read-only. This flag is computed by the server and does not replace mutation validation.

`GET /contest/:tid/scoreboard` and explicit `default` view preserve existing scoreboard permissions/visibility checks. Finished, rated, non-homework contests add `rating` to the existing response. Before global end, for unrated contests/homework, and in other scoreboard views/exports, this addition is absent.

```ts
type RatingChange = {
  uid: number; rank: number; before: number; after: number;
  delta: number; provisional: boolean;
};
type ContestRatingResult = {
  status: 'pending' | 'settled' | 'skipped'; changes: RatingChange[];
};
type Response = ExistingScoreboardResponse & { rating?: ContestRatingResult };
```

Illustrative response addition: `{"rating":{"status":"settled","changes":[{"uid":12,"rank":1,"before":1600,"after":1939,"delta":339,"provisional":true}]}}`. Pending example: `{"rating":{"status":"pending","changes":[]}}`; skipped example: `{"rating":{"status":"skipped","changes":[]}}`.

`pending` means no publishable result yet, including locked/hidden results or unfinished judging. `skipped` means fewer than two eligible participants or no observed ordering (all tied). Only positive-UID, attended, ranked users with a journal submission for a contest problem participate; spectators, registration-only users and unranked users do not.

## User profile result

`GET /user/:uid` adds this field to its existing response:

```ts
type RatingHistory = RatingChange & { tid: string; title: string; endAt: string };
type UserContestRating = {
  rating: number; peak: number; contests: number; provisional: boolean;
  history: RatingHistory[];
};
type Response = ExistingUserDetailResponse & { contestRating: UserContestRating | null };
```

Example addition: `{"contestRating":{"rating":1652,"peak":1670,"contests":4,"provisional":true,"history":[{"tid":"665f00000000000000000001","title":"Weekly practice","endAt":"2026-10-20T10:00:00.000Z","uid":12,"rank":2,"before":1670,"after":1652,"delta":-18,"provisional":true}]}}`.

The field is null for unrated users and viewers without `PERM_VIEW_CONTEST_SCOREBOARD`. History contains all permitted entries, newest first, so clients can show the latest three and expand the full list without truncating older contests. Assigned/invitation contest history is limited to the profile owner, contest owner/maintainer or `PERM_EDIT_CONTEST` holders; scoreboard visibility also applies. The summary can aggregate these contests without exposing their names or per-contest changes to other viewers. No inference parameters, uncertainty or covariance matrices are returned.

## Public user summary

Serialized user objects returned by existing endpoints (including `udoc`, `udocs`, user dictionaries and the private current-user object) may add `contestRating:{rating:number;peak:number;contests:number;provisional:boolean}|null`. Example user addition: `{"_id":12,"uname":"alice","contestRating":{"rating":1652,"peak":1670,"contests":4,"provisional":true}}`. This field contains no history, contest names or private user data. It is read from the active domain's last published Rating generation when the user is loaded; unrated users use `null`, and viewers without `PERM_VIEW_CONTEST_SCOREBOARD` receive no field. User loading does not trigger settlement. Publishing a new generation invalidates domain user caches so subsequent requests use the new summaries. The frontend uses the numeric Rating for Codeforces-style username colors; this has no effect on RP or account permissions.

## Settlement and replay side effects

Reading either result triggers deterministic replay when the source fingerprint changes. A worker refreshes domains with rated contests every five minutes and during the daily task. All eligible history is processed, ordered by global `endAt` and `docId`; the old last-ten-contests restriction does not apply. Homework, ongoing contests, hidden scoreboards and locked scoreboards are excluded. Outstanding judging/rejudging pauses processing at that contest; later contests wait. Rank changes, rejudge, contest deletion and disabling `rated` are reflected by the next refresh/read.

`GET /ranking?sort=rating` also triggers this refresh and publishes paginated summary-only standings from one complete generation. It respects domain membership and leaderboard opt-out settings and requires both ranking and scoreboard permissions. See [ranking request/response contracts](../domain/domain.md#get-ranking).

`contest.rating` stores complete generations: source ranks, population definitions, model parameters/version, per-contest changes and user summaries. A single compare-and-swap pointer publishes a complete generation; unchanged input does not duplicate counts. All prior generations are retained. MongoDB transactions/replica sets are not required. If another process publishes first, readers use the active generation. Existing combined `rp` is unaffected.

Population means are initial training-group priors, not verified age-group measurements. Shared calibration uncertainty is retained; internal contests cannot establish an isolated group's global position. Cross-population participation connects the groups. Parameter/prior updates require a versioned replay. This version does not implement calibrated question/IRT observations.

## Verification workflow

1. Create a future rated contest with the intended population and verify it through the edit GET.
2. Finish judging and release/unlock the scoreboard when applicable.
3. Fetch the default scoreboard: continue waiting while `pending`, finish at `settled` or intentionally `skipped`.
4. Fetch an affected `/user/:uid` and verify Rating and permitted history. Repeat reads must not increase the contest count.
5. After a rejudge/eligibility correction, verify the replayed result. Do not change population after the stored contest start.
