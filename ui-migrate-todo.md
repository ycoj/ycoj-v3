# 旧 UI → 新 UI 功能迁移待办

审计日期：2026-11-01。

## 范围与判定方式

- 旧 UI 基线：`packages/ui-default/templates/`、`packages/ui-default/pages/`，结合 `packages/hydrooj/src/handler/` 核对实际路由与操作；另检查仓库内有旧界面的插件。
- 新 UI 基线：`ycoj-ui/app/`、`ycoj-ui/features/`、`ycoj-ui/api/`，以及 `ycoj-ui/next.config.ts` 的重定向和代理。
- 本文是源码静态审计，没有启动服务、使用生产账号或执行真实写操作。已确认缺失的是仓库中的新 UI 页面、入口或交互；不能据此断言生产部署一定返回 404，也不代表现有页面已经通过端到端验收。
- “未迁移”表示没有找到对应的新界面；“部分迁移”表示已有页面，但旧功能仍有缺口；“入口未接通”表示可见入口是占位链接或指向不存在的专用页面。只有 API 封装不算完成 UI 迁移。
- 优先级是排期建议：P1 为核心使用闭环、账号安全及教学管理；P2 为管理效率和功能补齐；P3 为辅助内容与配置兼容。不是安全漏洞评级。
- 插件和部署策略相关事项放在文末，不能直接当作当前线上必需功能。

## 1. 账号与个人中心

旧实现主要见 [user.ts](packages/hydrooj/src/handler/user.ts)、[home.ts](packages/hydrooj/src/handler/home.ts)、[旧安全页面](packages/ui-default/templates/home_security.html)。新实现主要见 [登录页](ycoj-ui/features/auth/login/login-page.tsx)、[Auth API](ycoj-ui/api/client/method/auth/index.ts)、[账号设置](ycoj-ui/app/(app)/home/settings/account/page.tsx)。

- [ ] **AUTH-01 / P1 / 未迁移：自助注册完整流程。** 旧 `/register`、`/register/:code` 支持注册信息提交、发信结果和验证码链接后的账号创建；新 UI 只有登录页，没有注册页面。补齐成功、校验失败、验证码无效/过期等界面，并遵守后端注册开关及权限。
- [ ] **AUTH-02 / P1 / 未迁移：找回用户名或密码。** 旧 `/lostpass`、`/lostpass/:code` 有邮件申请、发送结果和重置密码页面；新 UI 没有页面，登录表单也没有找回入口。验收需覆盖邮件链接返回、新密码确认和无效链接。
- [ ] **AUTH-03 / P1 / 部分迁移：登录时的双因素与 WebAuthn 验证。** 旧 [登录模板](packages/ui-default/templates/user_login.html) 有 `tfa`、`authnChallenge`，由 [验证脚本](packages/ui-default/pages/user_verify.page.ts) 配合完成。新登录 API 虽定义了这两个字段，登录表单只提交用户名、密码和记住登录。补齐二次验证及安全密钥登录；新 UI 已有 sudo 验证，不应重复列为完全缺失。
- [ ] **AUTH-04 / P2 / 未迁移：第三方登录入口及返回流程。** 旧登录页按 `loginMethods` 展示 OAuth 提供方；新登录页没有提供方按钮。按启用的提供方接入，并处理回调、首次登录需要补全注册信息的流程。是否需要部署取决于 OAuth 插件配置。
- [ ] **AUTH-05 / P1 / 未迁移：修改密码与更换邮箱。** 旧 `/home/security` 支持 `change_password`、`change_mail`，邮箱确认还有 `/home/changeMail/:code`；新 `/home/settings/account` 只覆盖资料设置和头像。补齐安全设置、邮件发送结果和确认落地页。
- [ ] **AUTH-06 / P1 / 未迁移：管理验证器。** 旧安全页支持启用/移除 TOTP，以及注册、命名、查看和移除 WebAuthn 验证器；新 UI 没有这些管理界面。复用已迁移的 sudo 能力处理敏感操作。
- [ ] **AUTH-07 / P1 / 未迁移：登录会话管理。** 旧安全页列出会话的设备、IP、位置和更新时间，支持退出单个其他会话或全部会话；新 UI 只有退出当前登录。补齐会话列表和相应操作。
- [ ] **AUTH-08 / P2 / 未迁移：第三方账号绑定/解绑。** 旧安全页使用 `link_account`、`unlink_account` 管理账号关系；新账号设置没有关系列表和操作入口。与 AUTH-04 一起按实际启用的提供方验收。
- [ ] **AUTH-09 / P2 / 未迁移：偏好设置与域内个人设置。** 旧 `/home/settings/preference`、`/home/settings/domain` 与 `account` 是独立类别，新 UI 目前只有 `account`。补齐后端返回的配置项，尤其时区、默认代码语言、代码模板及插件注册的域内个人设置；新菜单已有语言和明暗主题切换，不算完全缺失。依据：[设置分类处理](packages/hydrooj/src/handler/home.ts)、[设置定义](packages/hydrooj/src/model/setting.ts)。
- [ ] **AUTH-10 / P2 / 部分迁移：提交表单使用账号中的语言/模板偏好。** 旧 [提交页脚本](packages/ui-default/pages/problem_submit.page.tsx) 按 `UserContext.codeLang` 选择语言；新 [独立提交表单](ycoj-ui/features/problem/submit/problem-submit-form-client.tsx) 优先值固定为 `cc` / `cc.cc14o2`。打通账号偏好到独立提交表单，并核对其与已有练习工作区本地设置、草稿的优先关系。
- [ ] **AUTH-11 / P2 / 未迁移：账号注销申请及结果页。** 旧 `UserDeleteHandler` 的 `/user/delete` 提交注销任务并显示 [待删除结果](packages/ui-default/templates/user_delete_pending.html)；新 UI 没有对应流程。先按当前后端实际行为实现；旧模板提及可取消，但本次未确认对应取消操作，不能直接把模板文案视为已有完整取消功能。
- [ ] **AUTH-12 / P2 / 未迁移：个人文件空间。** 旧 `/file` 的 [个人文件页](packages/ui-default/templates/home_files.html) 支持文件列表、上传和删除；新 UI 无个人文件管理页。题目文件管理已经迁移，不能代替个人文件空间。

## 2. 域与成员管理

这一组在新 UI 中没有对应页面。旧功能依据：[domain.ts](packages/hydrooj/src/handler/domain.ts)、[home.ts](packages/hydrooj/src/handler/home.ts)。新 [侧边导航](ycoj-ui/features/navigation/sidebar.tsx) 将 `domain_dashboard` 映射到 `/domain`，但 `app/` 中没有 `/domain` 页面。

- [ ] **DOMAIN-01 / P1 / 未迁移：我的域及切换、收藏、退出域。** 旧 `/home/domain` 展示已加入域、角色、访问/管理入口，以及收藏域和退出操作；新用户菜单没有这一入口。依据：[旧我的域页面](packages/ui-default/templates/home_domain.html)。
- [ ] **DOMAIN-02 / P2 / 未迁移：创建域、搜索和加入域。** 补齐旧 `/home/domain/create`、`/domain/search`、`/domain/join` 对应的用户流程，包括邀请码、目标域及加入后的跳转。依据：[创建域模板](packages/ui-default/templates/domain_create.html)、[加入域模板](packages/ui-default/templates/domain_join.html)。
- [ ] **DOMAIN-03 / P1 / 未迁移且入口未接通：域控制台。** 补齐旧 `/domain/dashboard` 的域信息、初始化讨论节点，以及所有者删除域操作；使新导航 `/domain` 有实际落点。依据：[旧控制台](packages/ui-default/templates/domain_dashboard.html)。
- [ ] **DOMAIN-04 / P1 / 未迁移：域设置。** 旧 `/domain/edit` 使用后端动态设置项编辑域信息；新 UI 没有编辑页。需覆盖实际返回的名称、头像、公告、配置等设置，并保留字段权限与类型。依据：[旧域设置](packages/ui-default/templates/domain_edit.html)、[域设置定义](packages/hydrooj/src/model/setting.ts)。
- [ ] **DOMAIN-05 / P1 / 未迁移：成员管理。** 旧 `/domain/user` 支持成员列表、添加、批量移除及批量角色分配，并有原始数据格式；新 UI 无成员管理。依据：[旧成员页](packages/ui-default/templates/domain_user.html)、`DomainUserHandler`。
- [ ] **DOMAIN-06 / P1 / 未迁移：角色与权限矩阵。** 补齐 `/domain/role` 的角色创建/批量删除，以及 `/domain/permission` 的各角色权限编辑；区分内置角色和可修改角色。依据：[角色页](packages/ui-default/templates/domain_role.html)、[权限页](packages/ui-default/templates/domain_permission.html)。
- [ ] **DOMAIN-07 / P1 / 未迁移：用户分组管理。** 旧 `/domain/group` 支持创建、修改成员、删除、导入与导出分组；新 UI 虽能在比赛/作业表单中选择分组，没有分组维护界面。依据：[旧分组页](packages/ui-default/templates/domain_group.html)、[旧交互](packages/ui-default/pages/domain_group.page.ts)。
- [ ] **DOMAIN-08 / P2 / 未迁移：加入域规则和邀请管理。** 旧 `/domain/join_applications` 实际管理加入方式、默认角色/分组、有效期、邀请码及邀请链接；新 UI 无对应页面。该路由名称不能直接解释为“人工审核申请列表”。依据：[旧加入设置](packages/ui-default/templates/domain_join_applications.html)。

## 3. 系统管理与状态

新管理区已经有用户导入、实名、奖项、AI 提供方和账号有效期管理；`/manage` 只是跳转到允许访问的现有页面，并非旧系统控制台的替代。依据：[新管理入口](ycoj-ui/app/(app)/manage/page.tsx)、[新管理菜单](ycoj-ui/features/manage/manage-sidebar.tsx)。

- [ ] **ADMIN-01 / P1 / 未迁移：系统控制台与运行检查。** 旧 `/manage/dashboard` 配合 `/manage/check-conn` 展示系统检查消息，并提供受运行环境约束的重启操作。新 UI 没有控制台和检查连接。依据：[manage.ts](packages/hydrooj/src/handler/manage.ts)、[旧控制台](packages/ui-default/templates/manage_dashboard.html)、[旧检查交互](packages/ui-default/pages/manage_dashboard.page.js)。
- [ ] **ADMIN-02 / P1 / 未迁移：系统设置表单。** 旧 `/manage/setting` 编辑后端 `SYSTEM_SETTINGS`；新 UI 只有专门的 AI 提供方设置，不能替代全部系统设置。依据：[旧系统设置](packages/ui-default/templates/manage_setting.html)、`SystemSettingHandler`。
- [ ] **ADMIN-03 / P2 / 未迁移：系统配置编辑器。** 旧 `/manage/config` 按配置 schema 编辑配置，与 `/manage/setting` 是独立功能；新 UI 没有等价编辑器。依据：[旧配置页](packages/ui-default/templates/manage_config.html)、`SystemConfigHandler`。
- [ ] **ADMIN-04 / P2 / 未迁移：管理脚本执行。** 旧 `/manage/script` 列出脚本、接收参数，执行后跳转记录页查看结果；新 UI 缺少选择脚本和发起执行的界面。需要接通已有 sudo 与记录详情。依据：[旧脚本页](packages/ui-default/templates/manage_script.html)、`SystemScriptHandler`。
- [ ] **ADMIN-05 / P1 / 未迁移：用户全局权限管理。** 旧 `/manage/userpriv` 能选择用户并编辑全局 `priv`；新 UI 的用户导入、域内分配和有效期管理不包含此操作。依据：[旧权限页](packages/ui-default/templates/manage_user_priv.html)、`SystemUserPrivHandler`。
- [ ] **ADMIN-06 / P2 / 未迁移：服务器与评测状态页。** 旧 `/status` 展示节点状态、系统/CPU/内存信息、编译器版本及语言执行命令；新 UI 无状态页。依据：[status.ts](packages/hydrooj/src/handler/status.ts)、[旧状态页](packages/ui-default/templates/status.html)。不需要迁移仅供评测端上报的 `/status/update` 为用户页面。

## 4. 题库、提交与题解

- [ ] **PROBLEM-01 / P1 / 未迁移：上传文件提交，尤其提交答案题。** 旧 [提交模板](packages/ui-default/templates/problem_submit.html) 有 `file` 上传；后端 `ProblemSubmitHandler` 处理普通源码、压缩包/二进制与 `submit_answer` 文件。新 [提交表单](ycoj-ui/features/problem/submit/problem-submit-form-client.tsx) 只有代码输入，[提交 API](ycoj-ui/api/client/method/problem/submit.ts) 也只提交 JSON 字段。补齐按题型的 multipart 上传，保留比赛 `tid`、大小限制及结果跳转；不能因新 UI 已有客观题就认为提交答案题也已迁移。
- [ ] **PROBLEM-02 / P1 / 未迁移：题库批量管理。** 旧题库可进入编辑模式，选择多题后隐藏、取消隐藏、删除、下载题包、复制到目标域；新 [题库列表](ycoj-ui/features/problem/list/problem-list.tsx) 没有选择和批量操作。依据：[旧题库模板](packages/ui-default/templates/problem_main.html)、[旧交互](packages/ui-default/pages/problem_main.page.tsx)、`ProblemMainHandler`。新编辑页已有单题删除，不应误报为单题删除也缺失。
- [ ] **PROBLEM-03 / P2 / 未迁移：题目收藏/取消收藏。** 旧详情页通过 `operation=star` 切换收藏，并有首页收藏题目列表；新 [题目标题](ycoj-ui/features/problem/detail/problem-title.tsx) 和 [侧栏](ycoj-ui/features/problem/sidebar.tsx) 没有收藏操作。依据：[旧详情](packages/ui-default/templates/problem_detail.html)、`ProblemDetailHandler.postStar`。
- [ ] **PROBLEM-04 / P2 / 未迁移：题目统计页。** 旧 `/p/:pid/stat` 展示状态/分数统计和 AC 提交性能列表，可按排序指标、方向、语言及页码筛选；新 UI 只有题目通过数和提交数，以及普通记录列表链接。依据：[旧统计页](packages/ui-default/templates/problem_statistics.html)、`ProblemStatisticsHandler`。普通 `/record?pid=...` 不是完整替代。
- [ ] **PROBLEM-05 / P2 / 未迁移：Hack 提交。** 旧 `/p/:pid/hack/:rid` 可输入或上传数据，选择自动整理输入并提交；旧记录详情有权限控制的 Hack 入口。新 UI 无 Hack 页面，[记录侧栏](ycoj-ui/features/record/detail/record-sidebar.tsx) 只有重测、取消成绩和历史版本。依据：[旧 Hack 页](packages/ui-default/templates/problem_hack.html)、[旧记录详情](packages/ui-default/templates/record_detail.html)、`ProblemHackHandler`。
- [ ] **PROBLEM-06 / P2 / 未迁移：单题全部提交重测。** 旧详情侧栏提供 `operation=rejudge` 的整题重测；新题目侧栏没有该操作。新记录页已有“单条记录重测”，不能替代整题重测。依据：[旧题目侧栏](packages/ui-default/templates/partials/problem_sidebar_normal.html)、`ProblemDetailHandler.postRejudge`。
- [ ] **PROBLEM-07 / P2 / 未迁移：单题题包导出与跨域复制。** 旧详情侧栏提供题包下载、选择目标域并复制；新详情没有对应入口。新文件页已有测试数据/附件下载，仍不能替代题包导出。依据：[旧题目侧栏](packages/ui-default/templates/partials/problem_sidebar_normal.html)、[旧复制交互](packages/ui-default/pages/problem_sidebar.page.ts)。可与 PROBLEM-02 共用实现。
- [ ] **PROBLEM-08 / P2 / 部分迁移：题库可视化筛选、排序和随机选题。** 旧题库有分类树、难度、命名空间等筛选、排序下拉框，以及按当前条件随机选题。新 [搜索栏](ycoj-ui/features/problem/list/problem-search.tsx) 主要是 `q` 输入，新列表中的标签只是展示。保留后端查询表达式能力，同时补齐可操作的筛选/排序/随机入口。依据：[旧题库脚本](packages/ui-default/pages/problem_main.page.tsx)、[随机选题组件](packages/ui-default/templates/partials/problem_lucky.html)。
- [ ] **SOLUTION-01 / P1 / 部分迁移：题解回复的展示与增删改。** 新 UI 已支持题解发布、编辑、删除、投票、审核和未审核折叠，但 [SolutionItem](ycoj-ui/features/problem/solution/solution-item.tsx) 没有渲染 `solution.reply`，也没有回复表单。`replyProblemSolution` 只有 [API 封装](ycoj-ui/api/client/method/problem/solution-reply.ts)，未在题解组件中调用。补齐旧回复内容显示、发表、编辑、删除及对应权限。依据：[旧题解组件](packages/ui-default/templates/components/comments_solution.html)、`ProblemSolutionHandler.postReply/postEditReply/postDeleteReply`。
- [ ] **SOLUTION-02 / P2 / 部分迁移：题解直达链接。** 旧题解支持复制 `/p/:pid/solution/:sid` 链接并定位指定题解；新路由只有题解列表、新建和编辑，没有只读 `/problem/:pid/solution/:sid` 页面，也没有旧 `sid` 路径的适配。补齐只读直达/定位与复制链接；避免被现有 `/p/:path*` 重定向导向缺失页面。依据：[旧题解组件](packages/ui-default/templates/components/comments_solution.html)、[重定向配置](ycoj-ui/next.config.ts)。

## 5. 讨论区

新讨论列表、普通节点筛选、主题详情、一级回复和楼中楼发表已实现，缺口集中在主题创建和后续管理。

- [ ] **DISCUSS-01 / P1 / 入口未接通：发布主题。** 新 [节点筛选栏](ycoj-ui/features/discussion/list/discussion-node-filter.tsx) 链接到 `/discussion/create?node=...`，但没有 `create/page.tsx`；现有 `[did]` 动态路由还可能把 `create` 当作主题 ID 读取。补齐创建页面、内容编辑器、节点选择与提交。依据：[旧创建页](packages/ui-default/templates/discussion_create.html)、`DiscussionCreateHandler`。
- [ ] **DISCUSS-02 / P1 / 未迁移：主题编辑、删除及置顶/高亮等属性维护。** 新 [详情页](ycoj-ui/app/(app)/discussion/[did]/page.tsx) 仅组合标题、正文和回复；没有编辑路由和主题管理操作。标题虽能显示置顶/精选标记，不代表已有设置入口。依据：[旧编辑页](packages/ui-default/templates/discussion_edit.html)、[旧表单](packages/ui-default/templates/partials/discussion_edit_form.html)、`DiscussionEditHandler`。
- [ ] **DISCUSS-03 / P2 / 未迁移：锁定主题与关注/取消关注。** 旧详情支持 `set_lock` 和主题关注状态管理；新详情没有操作。补齐按所有者/管理员权限展示的入口和状态反馈。依据：[旧详情](packages/ui-default/templates/discussion_detail.html)、`DiscussionDetailHandler.postSetLock/postStar`。实际操作字段以 handler 为准，不能直接照搬旧模板字符串。
- [ ] **DISCUSS-04 / P1 / 部分迁移：回复和楼中楼的编辑、删除。** 新 [回复组件](ycoj-ui/features/discussion/detail/discussion-replies-client.tsx) 只使用发表一级回复和楼中楼的方法；[Discussion API](ycoj-ui/api/client/method/discussion/index.ts) 已有编辑/删除封装，但没有 UI 调用。补齐本人、主题所有者及管理员的实际权限分支。
- [ ] **DISCUSS-05 / P2 / 部分迁移：回复 Markdown、编辑历史与表情回应。** 旧 [回复组件](packages/ui-default/templates/components/comments_discussion.html) 渲染 Markdown、支持历史查看及 reaction；新回复以纯文本 `<p>` 显示，没有历史和 reaction 交互。补齐正文格式与历史内容展示，接入主题/一级回复的表情回应。依据：旧 `/raw` 系列路由及 `postReaction`。
- [ ] **DISCUSS-06 / P1 / 入口未接通：题目、比赛、作业的关联讨论。** 新 [题目侧栏](ycoj-ui/features/problem/sidebar.tsx)、[比赛侧栏](ycoj-ui/features/contest/detail/contest-sidebar.tsx)、[作业侧栏](ycoj-ui/features/homework/detail/homework-sidebar.tsx) 的讨论入口均为 `href="#"`。新 [讨论列表](ycoj-ui/app/(app)/discussion/page.tsx) 也只把 `node` 参数解释为普通 `node` 类型。补齐资源 `type/name` 到列表/创建页的上下文，支持旧 `/discuss/:type/:name` 对应的资源节点，不应只换成讨论总列表。

## 6. 作业、训练与首页

- [ ] **HOMEWORK-01 / P1 / 未迁移：作业文件管理。** 旧 `/homework/:tid/file` 有文件上传、列表和批量删除；新作业只有列表、创建、详情、编辑和成绩表，没有文件管理页。依据：[旧文件页](packages/ui-default/templates/homework_files.html)、[后端路由](packages/hydrooj/src/handler/homework.ts)。
- [ ] **HOMEWORK-02 / P2 / 部分迁移：作业代码导出与提交记录入口。** 旧作业侧栏按权限提供全部代码导出、全部提交或我的提交；新 [作业侧栏](ycoj-ui/features/homework/detail/homework-sidebar.tsx) 未提供。复用已有记录列表，传入 `tid` 和必要的用户过滤条件，并接入后端代码下载。依据：[旧作业侧栏](packages/ui-default/templates/partials/homework_sidebar.html)、`/homework/:tid/code`。
- [ ] **TRAINING-01 / P1 / 未迁移：训练文件管理。** 旧 `/training/:tid/file` 支持上传、列表和批量删除；新训练详情/编辑已实现，但 [侧栏](ycoj-ui/features/training/detail/training-sidebar.tsx) 和路由中没有文件管理。依据：[旧训练文件页](packages/ui-default/templates/training_files.html)、[后端路由](packages/hydrooj/src/handler/training.ts)。
- [ ] **HOME-01 / P2 / 部分迁移：首页作业、训练、排名与收藏题目板块。** 旧首页模板及 `HomeHandler.getHomework/getTraining/getRanking/getStarredProblems` 提供这些内容；新 [Homepage](ycoj-ui/features/homepage/homepage.tsx) 没有渲染它们。按服务端启用的板块补齐，其中作业/训练/排名还缺少相应的首页响应类型。依据：[旧首页板块目录](packages/ui-default/templates/partials/homepage/)、[新首页类型](ycoj-ui/api/server/method/ui/homepage.ts)。
- [ ] **HOME-02 / P3 / 部分迁移：首页其他配置板块与布局。** 旧首页还包括讨论节点、一言和题目搜索；新类型虽包含 `discussion_nodes`、`hitokoto`，实际没有渲染。新首页把服务端列配置展平并使用固定两栏，未保留返回的列宽、板块顺序和位置语义。确定是否继续支持旧配置，再实现或显式给出不支持的替代规则；全局搜索已经存在，搜索板块可以作为产品取舍，不应重复建设搜索能力。

## 7. 插件、帮助与路径兼容（需按部署确认）

- [ ] **PLUGIN-01 / P2 / 未迁移：博客完整页面。** 仓库 [blog 插件](packages/blog/index.ts) 有 `/blog/:uid`、详情、创建和编辑路由，旧模板还提供删除、收藏等操作；新 UI 只有 [首页博客摘要](ycoj-ui/features/homepage/components/blogs.tsx)，标题未链接到详情，且无 `app/blog` 页面。若实际启用该插件，迁移其列表、阅读、写作、管理和收藏闭环；以当前 handler 支持的操作为准，不因模型存在某方法就推断旧 UI 有完整功能。
- [ ] **HELP-01 / P3 / 未迁移：帮助与关于页面。** 旧 UI 注册 `/wiki/help`、`/wiki/about`，并从业务侧栏提供带锚点的帮助链接；新 UI 无相应页面。迁移仍有效的帮助内容与业务入口，或给出明确替代地址。依据：[旧 UI 路由](packages/ui-default/index.ts)、[帮助模板](packages/ui-default/templates/wiki_help.html)、[关于模板](packages/ui-default/templates/about.html)。
- [ ] **ROUTE-01 / P1 / 部分迁移：旧页面深链与域上下文。** 新配置只把 `/p/:path*` 重定向到 `/problem/:path*`，并代理 `/api`、`/fs`、Paste raw；没有通用的旧页面兼容层。按迁移项补齐 `/discuss`、`/file`、`/manage/userimport` 等旧路径到新路径的映射，并核对 `/d/:domainId/...` 域前缀与后端绝对跳转。保留 `tid`、分页、筛选和 return URL；下载、OAuth 回调及 raw 内容应按协议转发。若由部署反向代理承担，应记录配置和验收结果。依据：[next.config.ts](ycoj-ui/next.config.ts)、[proxy.ts](ycoj-ui/proxy.ts)、[侧栏路径映射](ycoj-ui/features/navigation/sidebar.tsx)。

### 暂不直接列为“已确认待迁移”

- **赛时 IP 绑定管理 `/contestmode`：** 后端在配置允许时注册路由，`ContestModeHandler` 引用 `contest_mode.html`，但本仓库旧模板目录未找到该模板。先确认该部署是否启用、旧页面从何处提供，再决定迁移；不能只凭 handler 认定旧 UI 可用。
- **管理员切换账号 `/account/:uid`：** 后端存在能力，但本次未确认旧 UI 的用户入口。先核对实际使用方式，再决定是否需要新 UI 管理入口。
- **课程、直播：** 新导航映射中有 `course_list`、`live_main`，没有对应页面，但仓库内未找到完整旧 UI 功能基线，不能只凭导航名认定为迁移遗漏。
- **OnlyOffice、XCPCIO、现场工具等插件：** 需要按实际启用配置验收。新成绩表已经按 `availableViews` 生成后端视图入口，不能简单将所有插件成绩表报为未迁移；文件预览也已经存在，不宜因没有原插件同名页面就判定功能缺失。

## 已发现的新 UI 覆盖，避免重复排期

以下仅代表找到页面与交互实现，不代表本次做过运行验收：

- 题目列表、创建/编辑/删除、Hydro/FPS/HOJ/QDUOJ/LVJ 导入、配置编辑、测试数据/附件管理、AI 生成测试数据和 HTML 转 Markdown。
- 普通代码提交、客观题答题、练习工作区及自测；记录列表/详情实时更新、单条重测、取消成绩、历史评测版本。
- 题解发布/编辑/删除/投票、审核及作者解封；题目反馈提交和处理。旧 `/manage/problem-feedback` 已由新 `/problem/feedback` 承接，不能按旧路径不存在误报。
- 比赛创建/编辑/管理、参赛者、气球、答疑、批量提交、打印、题解、成绩表及导出、解封榜单、比赛分析和查重。旧单独题目列表可以由比赛详情中的题目列表承接，不要求同路径再建页。
- 作业列表/创建/编辑/领取/克隆/成绩表，训练列表/创建/编辑/报名/章节及进度，初赛试卷管理/答题/历史作答。
- 私信、用户资料与比赛 Rating、签到、个人奖项、实名认证及审核、用户批量导入、账号有效期、奖项管理、AI 提供方管理、Paste 列表/创建/编辑/详情与 raw。
- 账号资料设置、头像上传与导入、sudo 二次确认、语言和明暗主题切换。画板、图编辑器及部分新交互属于新增能力，不影响旧功能缺口判定。

## 实施与复核要求

1. 建议先完成 AUTH-03/05/06/07、PROBLEM-01、DISCUSS-01/04/06、域成员/分组与作业/训练文件管理，再推进管理效率和辅助内容。
2. 每项按“入口 → 页面 → API → 成功/错误反馈 → 权限 → 返回/深链”验收；相关 API 类型存在、按钮存在或页面文件存在都不能单独作为完成依据。
3. 对选择不再保留的旧功能，记录产品决定、替代流程和旧链接处理方案，再关闭待办。
4. 如迁移涉及后端路由、参数、权限、响应或副作用变化，按根目录 `AGENTS.md` 同步更新 `.agents/skills/ycoj-api/`；本次仅添加审计文档，没有修改后端协议或应用代码。
