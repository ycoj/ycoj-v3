# Domain endpoint contracts

Every authenticated call uses `Cookie: sid=<token>` or `Authorization: Bearer <token>`. HTML is server-rendered; mutations return `type Redirect={url:string}` under `Accept: application/json` (example `{"url":"/domain/dashboard"}`) and 302 otherwise.

## `GET /ranking`
Description: paginated domain rank list, with RP or contest Rating ordering. Request `type Query={page?:number;sort?:'rp'|'rating'}`, examples `GET /ranking?page=2` and `GET /ranking?sort=rating&page=1`. Omitted `sort` defaults to `rp`; any other value produces `ValidationError('sort')`. `page` must be a positive integer. Browser requests receive `type Response=HTML`, example `<!doctype html>…ranking…`. With `Accept: application/json`:

```ts
type RatingSummary = {rating:number;peak:number;contests:number;provisional:boolean};
type RankingResponse = {
  udocs:Array<PublicUser & {rp:number;rpInfo?:Record<string,number>;nAccept:number;contestRating?:RatingSummary|null}>;
  upcount:number;ucount:number;page:number;pageSize:number;selfRank:number|null;sort:'rp'|'rating';
};
```

RP response example: `{"udocs":[{"_id":12,"uname":"alice","rp":123,"rpInfo":{"problem":100,"contest":23},"nAccept":7}],"upcount":1,"ucount":1,"page":1,"pageSize":20,"selfRank":null,"sort":"rp"}`. Rating response example: `{"udocs":[{"_id":12,"uname":"alice","rp":0,"nAccept":7,"contestRating":{"rating":1652,"peak":1670,"contests":4,"provisional":true}}],"upcount":1,"ucount":1,"page":1,"pageSize":20,"selfRank":1,"sort":"rating"}`. Empty Rating response: `{"udocs":[],"upcount":0,"ucount":0,"page":1,"pageSize":20,"selfRank":null,"sort":"rating"}`.

Both modes include joined domain members with UID greater than 1 and omit users who enabled the `hideRank` account setting (see [`GET|POST /home/settings/:category`](../community/home.md#getpost-homesettingscategory)). RP mode additionally requires positive RP and orders by RP descending, UID ascending. Rating mode includes only users with at least one settled rated contest in the current published domain generation, regardless of RP, and orders by `contestRating.rating` descending, UID ascending. Rating summaries contain no contest history or titles. Pagination totals and `selfRank` use the selected mode's exact visibility, eligibility and ordering; `selfRank` is the signed-in profile holder's 1-based position or `null` for guests, hidden, unjoined or ineligible viewers. An out-of-range page returns an empty list while retaining totals and `selfRank`.

Permission: `PERM_VIEW_RANKING`; `sort=rating` additionally requires `PERM_VIEW_CONTEST_SCOREBOARD`. Reading Rating mode triggers domain Rating settlement/replay, with the same judging and publication stopping conditions as [contest Rating](../contest/rating.md). No stored RP or rank is modified. Opting out filters the listing only: RP and Rating continue to be calculated and the user reappears when the setting is turned off. `HomeHandler.getRanking` retains the same visibility filter and RP order; the homepage widgets dispatch the `ranking` entry reflectively as `getRanking`.

## `GET /domain/dashboard`
Description: domain admin overview. Request `type Query={}`, example `GET /domain/dashboard`. Response `HTML`, example `…domain_dashboard…`. Permission: domain management handler.

### POST `initDiscussionNode`
Description: reset the active domain's discussion nodes from `discussion.nodes` system configuration, creating configured missing nodes. Request `type Input={operation:"initDiscussionNode"}`, example `{"operation":"initDiscussionNode"}`. Response `type Redirect={url:string}`, example `{"url":"/domain/dashboard"}`. Permission: domain management. **Source correction:** this operation belongs to `DomainDashboardHandler` and therefore `/domain/dashboard`, not `/domain/edit`.

## `GET|POST /domain/edit`
Description: display/save configured domain properties. GET request `type Query={}`, example `GET /domain/edit`, response `HTML`. POST request `type Input=Record<string,string|number|boolean>` (registered domain-setting fields), example `{"name":"School","bulletin":"Welcome"}`, response `Redirect`, example `{"url":"/domain/dashboard"}`. Permission `PERM_EDIT_DOMAIN`.

## `GET|POST /domain/user`
Description: list and administer domain users. GET request `type Query={format?:"default"|"raw"}`, example `GET /domain/user?format=raw`; response `type Response=HTML|Array<{_id:number;uname:string}>`, example `[{"_id":12,"uname":"alice"}]`. POST request `type Input={operation?:string;uids:number[];role?:string;join?:boolean}`, example `{"operation":"setRole","uids":[12],"role":"member","join":true}`; response `Redirect`, example `{"url":"/domain/user"}`. Permission: domain management.

### POST `setUsers`
Description: assign a role to selected members and optionally mark them joined. Request `type Input={operation:"setUsers";uids:number[];role:string;join?:boolean}`, example `{"operation":"setUsers","uids":[12,13],"role":"member","join":true}`. Response `Redirect`, example `{"url":"/domain/user"}`. The base POST rejects including the domain owner; sudo is required. Inviting when `server.allowInvite` is off additionally needs `PRIV_MANAGE_ALL_DOMAIN`.

### POST `kick`
Description: revoke joined members and return them to `guest`. Request `type Input={operation:"kick";uids:number[]}`, example `{"operation":"kick","uids":[12,13]}`. Response `Redirect`, example `{"url":"/domain/user"}`; if none are joined it returns without a redirect/body. The base POST rejects the owner and sudo is required; affected users receive a message.

## `GET|POST /domain/permission`
Description: view/update permission assignments. GET `type Query={}`, example `GET /domain/permission`, response `HTML`. POST `type Input=Record<string,string|number|boolean>`, example `{"role":"teacher","perm":255}`, response `Redirect`, example `{"url":"/domain/permission"}`. Permission `PERM_EDIT_DOMAIN`.

## `GET|POST /domain/role`
Description: view/update roles. GET `type Query={}`, example `GET /domain/role`, response `HTML`. POST `type Input={operation?:string;role?:string;roles?:string[]}`, example `{"operation":"set","role":"teacher","roles":["teacher"]}`, response `Redirect`, example `{"url":"/domain/role"}`. Permission `PERM_EDIT_DOMAIN`.

## `GET|POST /domain/group`
Description: manage user groups. GET `type Query={}`, example `GET /domain/group`, response `HTML`. POST `type Input={operation?:string;name:string;uids?:number[]}`, example `{"operation":"set","name":"ClassA","uids":[12,13]}`, response `Redirect`, example `{"url":"/domain/group"}`. Permission `PERM_EDIT_DOMAIN`.

## `GET|POST /domain/join_applications`
Description: configure membership application policy. GET `type Query={}`, example `GET /domain/join_applications`, response `HTML`. POST `type Input={method:0|1|2;role?:string;group?:string;expire?:number;invitationCode?:string}`, example `{"method":2,"role":"member","group":"ClassA","expire":1800000000,"invitationCode":"invite"}`, response `Redirect`, example `{"url":"/domain/join_applications"}`. Permission: domain management.

## `GET|POST /domain/join`
Description: show/submit a request to join a domain. GET `type Query={code?:string;target?:string;redirect?:string}`, example `GET /domain/join?target=school&code=invite`, response `HTML|Redirect`, example `…join…`. POST same type, example `{"target":"school","code":"invite","redirect":"/"}`, response `Redirect`, example `{"url":"/"}`. Permission `PRIV_USER_PROFILE`; join policy/code is validated.

## `GET /domain/search`
Description: find accessible domains. Request `type Query={q?:string}`, example `GET /domain/search?q=sch`. Response `type Result=Array<{_id:string;name:string;avatarUrl:string}>`, example `[{"_id":"school","name":"School","avatarUrl":"/img/team_avatar.png"}]`. Permission `PRIV_USER_PROFILE`.
