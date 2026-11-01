# Hydro 上游检查（2026-11-01）

> 本文保留最初只读检查结果。随后进行的补丁移植、修复状态、完整功能清单及验证结果见 [Hydro 修复合入记录](hydro-upstream-integration-2026-11-01.md)。下文“本次未合并”和实施建议指最初检查阶段。

## 检查范围和基线

- 上游：https://github.com/hydro-dev/Hydro，默认分支 `master`。
- 当前工作分支检查时的 HEAD：`4f580b8e`。
- 当前分支与上游的共同祖先：`73b2e4d75d2d9a50895fffb1d6f61bceed4356e7`，2026-09-01，`install: fix #1205`。
- 本地 `31de12d7072ac69267d9c50c0905becfcfb57ea9`（2026-09-02）明确记录了同步 ancestry 到该提交，因此用它初始化根目录 `HYDRO_COMMIT`。该历史提交没有相对第一父提交的文件差异：这是历史追踪基线，不能据此保证此前所有上游改动都逐项保留。
- 本次拉取的上游 HEAD：`5179dca8b2092a68276b8dcd5e2a6ba41b9f8443`，2026-10-31，`ui: problem_detail: fix statement switch`。
- `git log HEAD..hydro/master` 共 53 个提交；这是尚不在本地祖先链上的提交数，不等于 53 个独立功能，也不排除本地已有等价实现。
- 本次只检查上游并添加追踪规则，没有合并或 cherry-pick 上游业务代码。

## 安全相关结论

GitHub 仓库公开 Security Advisories 接口在检查时返回一条公告：

- [GHSA-94jp-7776-qj6q / CVE-2026-55617](https://github.com/hydro-dev/Hydro/security/advisories/GHSA-94jp-7776-qj6q)，2026-06-17 发布，中危；会话重建后旧 sid 未撤销，持有旧 sid 的攻击者可能继续访问账号。公告列出的修复版本是 5.0.2。
- 修复合入提交 [`8d76be8f`](https://github.com/hydro-dev/Hydro/commit/8d76be8f0b83d911bf7671962b0467e9d4b5719a) 已在本地祖先链中，而且当前 `packages/hydrooj/src/service/layers/base.ts` 确实在重建前调用 `token.del(ctx.session._id, token.TYPE_SESSION)`。
- 后续退出所有会话修复 [`dc5bcff9`](https://github.com/hydro-dev/Hydro/commit/dc5bcff952a2eaec5bbfb30b396a144807994325) 也已在本地历史和 `HomeSecurityHandler.postDeleteAllTokens()` 中保留。

因此，该公开漏洞不是本次待补的缺口。下列建题限流属于新增安全加固；存储泄漏属于可用性修复，不能直接当作上游已确认的安全漏洞。本次没有执行完整依赖漏洞扫描或渗透测试，公开公告列表也不能证明不存在其他漏洞。

## 建议优先吸收的小范围修复

| 优先级 | 上游提交 | 改动与本地核对 | 合并注意事项 |
| --- | --- | --- | --- |
| 高 | [`f5c2ac14`](https://github.com/hydro-dev/Hydro/commit/f5c2ac14e182b8f1238b1ee1a6e78e4fb0fdd816)，10-26 | 本地存储指定保存路径时，复制后直接返回 `null`，避免额外创建无人消费的 ReadStream。当前本地仍是复制后返回流。 | [#1226](https://github.com/hydro-dev/Hydro/issues/1226) 报告了内置评测与 COSFS 场景下文件描述符累积、EMFILE/EIO。补丁很小，建议首先处理；验证保存路径和普通流式读取两个分支。 |
| 高 | [`eb13e625`](https://github.com/hydro-dev/Hydro/commit/eb13e62557d4855696b466dbb7819d63c2794cee)，10-26 | 给建题增加按用户限流，默认每 5 秒 2 次；当前建题 handler 没有这项专用限流，但已有全局限流。 | 同一提交还改了新题面存储逻辑，不能直接当作纯限流补丁应用；可先适配限流部分。实现支持配置覆盖和无限访问特权豁免。须更新建题 API 的限流与错误行为文档。 |
| 高 | [`33edcdb7`](https://github.com/hydro-dev/Hydro/commit/33edcdb7613b235428a7c896e51f47e1a8b6fa22)，10-14 | 批量设置域角色从 `updateMany(..., upsert: true)` 改为逐用户 `bulkWrite/updateOne/upsert`，处理空数组并去重。本地仍是旧实现。 | 避免尚无域用户记录的用户批量设置角色失败或遗漏；这是权限管理正确性修复，未见公告认定为提权漏洞。验证新老域用户混合、空数组、重复 uid。 |
| 中 | [`238b1263`](https://github.com/hydro-dev/Hydro/commit/238b1263bf45ed407c68cae7f2707b74066a1c63)，09-16 | 修复 `Vary`：按 `Accept` 区分响应，使用 `ctx.vary()` 累加 Origin/Referer。本地没有该提交的完整实现。 | 当前分支刚改过品牌与 CORS 逻辑，应结合现有中间件适配；检查缓存是否按响应格式、来源正确隔离，不能覆盖本地 CORS 设置。 |
| 中 | [`b1e79898`](https://github.com/hydro-dev/Hydro/commit/b1e7989894677765fe0c6f01ca2b62ca1f3e5967)，10-01 | Record WebSocket 用特殊 contest ID 判断 pretest，替代检查 `rdoc.input` 是否为字符串。本地仍是旧判断。 | 应验证普通提交和自测的列表推送过滤，涉及连接响应行为，需要同步 API 文档。 |
| 中 | [`a7a49bf7`](https://github.com/hydro-dev/Hydro/commit/a7a49bf79103f7f88ea264d5c840576d4804b0e2)，09-03 | 递归解包聚合错误，改进 handler 错误处理；本地 framework 仍有只解一层的实现。 | 验证嵌套聚合错误、用户可见错误与状态码。 |
| 低 | [`816fc88c`](https://github.com/hydro-dev/Hydro/commit/816fc88c01fc53fa8a2cb2d2444624f91d3addfb)，10-01 | 备份恢复支持 `HYDRO_BACKUP_DIR`。 | 运维可选项，适合系统临时盘不足时指定工作目录。 |

## 值得规划的大功能

### 团队赛

[`78e898fd`](https://github.com/hydro-dev/Hydro/commit/78e898fdfc1e30eb1ff1df68c021dba64f8a1cdf)（2026-09-16，PR #1183）是这一轮最值得考虑的产品功能。

实现包括团队创建、改名、邀请、接受/拒绝邀请、离队/移除成员，以团队身份报名，以及团队提交和成绩处理。后端增加 `allowTeam`、虚拟团队用户和 `/contest/team` 等契约；同时改动比赛、提交、评测、用户模型和旧前端。

本地比赛模型已拆分到 `packages/hydrooj/src/model/contest/`，新前端在 `ycoj-ui/`，因此这项功能需要迁移实现并补齐 Next.js 页面与交互。建议独立安排一次功能集成，重点验证个人赛兼容、成员权限、重复报名限制、团队计分及现有榜单和代码相似度功能；同时更新 `.agents/skills/ycoj-api/`。

### 多题面与按格式渲染

[`377fd345`](https://github.com/hydro-dev/Hydro/commit/377fd345)（2026-10-18）起的一组提交，将题面扩展为有文件名、语言和内容/附件的 statement 列表，支持 Markdown、HTML、PDF 和可扩展 renderer；题面存储到独立 `problem.statement` 集合，更新导入导出和搜索插件适配，并保留旧内容读取兼容逻辑。

这不是一个可以只挑首提交的补丁。应连同 `624ebd84`、`d559c01e`、`dd26d78c`、`01302e4c`、`5964f449` 和后续题面编辑/切换修复一起评估，最终格式采用数组；最新 `5179dca8` 仍在修复题面切换。

本地 Next.js 创建/编辑表单仍使用 `problem.content`，已有多语言解析和 VelociTex 数学渲染。合并需要检查题面读取、保存、引用题目、附件授权、搜索、导入导出与新前端渲染链路，避免仅修改后端后出现题面丢失或格式错配。若暂时没有多文件/PDF 题面的实际需求，可以晚于团队赛安排。

### 其他技术升级

`489b2dbe` 升级旧前端 Monaco 到 0.57 并移除 webpack 插件，后面还有多个 worker/CORS 修复；对我们的 Next.js 前端没有直接替代作用，优先级较低。

`09dd8400`、`900fb7eb` 包含依赖升级，其中存在主版本变化，例如上游相对旧基线的 Nodemailer 9 → 10、simple-git 3 → 4。应单独做兼容性与安全公告核查，不能把整个依赖升级提交笼统标记为安全修复。`da6fb16a` 还修改 Yarn 策略，允许所有 Git 仓库、启用安装脚本并把 `npmMinimalAgeGate` 设为 0；这些属于安装策略，需按本仓库需求决定，不建议不加区分地照搬。

## 建议实施顺序

1. 先单独吸收存储泄漏、建题限流和角色批量设置修复，再处理 Vary、pretest 推送与错误解包，完成各自的验证和 API 文档同步。
2. 团队赛作为独立功能集成，连同 Next.js 支持一并交付。
3. 多题面重构作为独立兼容性升级，按上游最终实现集成并验证历史数据和导入导出。
4. 完成全量上游同步后，才将 `HYDRO_COMMIT` 前移到实际整合的上游 SHA；部分补丁吸收不应让该标记跳过尚未整合的改动。

## 核查方式

通过 Git 拉取上游 master，检查共同祖先、提交列表及重点补丁；通过 GitHub API 查询默认分支、公开安全公告、release 和 #1226。安全修复同时核对当前工作树实现，未仅依据版本号或祖先关系判断。规则与基线文件检查使用 `git diff --check`、SHA 格式和双侧祖先关系验证。本次仅新增文档和追踪标记，未运行应用构建或业务测试。
