# Hydro 修复合入与功能更新清单（2026-11-01）

## 范围和完成情况

本次检查范围是上游 `73b2e4d75d2d9a50895fffb1d6f61bceed4356e7` 之后、截至 `5179dca8b2092a68276b8dcd5e2a6ba41b9f8443` 的 53 个提交。逐项检查后，合入其中 25 个提交的全部适用改动或必要适配，包括 VJudge 修复所需的设置服务初始化改动。没有只根据提交标题包含 `fix` 与否筛选。

另有 6 个以修复为主的提交针对尚未引入的 Monaco 0.57 或多题面机制，当前没有对应实现；它们没有被标成已合入，详细依赖见后文。混合提交 `01302e4c` 中适用于当前上传流程的修复已吸收，新题面 renderer/editor 的部分则不适用。`eb13e625` 只移植建题限流，保留当前题面存储。

本次采用补丁移植和本地适配，保留独立前端及现有比赛、权限和题面实现，不创建虚假的全量 upstream merge ancestry。根目录 `HYDRO_COMMIT` 仍为历史全量追踪基线 `73b2e4d75d2d9a50895fffb1d6f61bceed4356e7`；它不会因只挑选 bug fixes 而前移。此文件记录本批已检查的上游 HEAD 和每个提交的处理结果，后续同步可据此识别已移植补丁。

## 已合入的修复

### 后端、工具和初始化

- `a7a49bf7`：递归解包聚合错误，保留内部用户错误的状态、参数及错误页；补齐无 stack 的错误格式化。
- `4cf647c4`：补丁命令识别 `framework/` 路径，并跳过 `package.json`，避免直接改已安装包的依赖声明。
- `a88ff53a`：安装器明确提示缺少 AVX 可能导致 MongoDB 无法运行，并等待用户按回车确认。
- `238b1263`：handler 响应增加 `Vary: Accept`，包括重定向与 304。Origin/Referer 累加部分已由现有品牌 CORS 中间件覆盖，保留其精确来源匹配和动态配置。
- `c77d8181`：CI 环境跳过 monitor 初始化、反馈和周期定时器。
- `b1e79898`：Record WebSocket 使用全零 contest ID 判断自测，不再依赖 `input` 的字符串类型。
- `54ae5505` + `ebfa89c7`：设置模型改为有初始化生命周期的 `model:setting` 服务；VJudge 显式等待设置就绪，单个 provider 加载失败不阻断其他 provider；更新旧 UI 和 ui-next 的设置加载监听。
- `33edcdb7`：批量设置角色逐用户 upsert，支持缺少域记录的用户、空批次和重复 uid。
- `e554ad0b`：文件自然排序处理空文件名、缺少名称及相等权重。
- `eb13e625`：建题默认按用户每 5 秒 2 次限流，限流在建题和移动附件前执行；保留既有配置覆盖及无限访问特权豁免。
- `f5c2ac14`：本地存储写入目标路径后返回 `null`，避免创建未使用的读取流、累积文件描述符；普通读取仍返回流。

### 旧 UI 中仍适用的修复

- `6635257a`：空配置按空 YAML 对象处理。
- `3e4eb626`：评测详情只对实际收到的状态/概要片段执行 DOM patch。
- `f68e299b`：用户组成员选择尚未完成时不保存 NaN uid。
- `a9b7312e`：Markdown 补全处理光标处没有单词的情况。
- `a9db6dd9`：新消息对话补齐 `_id`。
- `2a0101a0`：没有选区时不调用 `getRangeAt(0)`。
- `da3d71ef`：比赛用户操作错误没有 `params` 时仍能显示通知。
- `1746f59d`：榜单没有筛选器时不继续操作。
- `89b88e68`：客观题解析跳过没有子节点的 PRE。
- `a9a47dc9`：跳过禁用的高亮 token。
- `73458a53`：空图片上传列表不读取第一个文件。
- `89b8f8b5`：TypeScript 声明解析同时识别单引号、双引号模块名；适配当前 Monaco 0.52.2 的 API。
- `01302e4c`：已有预览、文件页、题目配置页上传流程消化已由上传器处理的异常，避免未处理的 Promise rejection。

这些旧 UI 补丁不需要修改 `ycoj-ui/` 的组件。

## 完整功能与技术更新列表

以下按功能合并相关提交；后面的逐提交表覆盖了所有 53 个提交，包括不属于功能更新的依赖、版本和 CLA 记录。

| 功能或技术更新 | 相关提交 | 本次状态与后续价值 |
| --- | --- | --- |
| 团队赛 | `78e898fd` | 未引入。团队创建、改名、邀请、接受/拒绝、离队/移除成员、团队报名、团队提交和成绩处理。建议优先规划的大功能；需要适配本地拆分后的比赛模型并补齐 Next.js 页面。 |
| 多文件、多语言题面及格式渲染扩展 | `377fd345`、`624ebd84`、`d559c01e`、`dd26d78c`、`0dba6c4a`，连同后续修复 | 未引入。独立 `problem.statement` 存储、数组格式、按文件 renderer/editor 注册、Markdown/HTML/PDF、搜索与导入迁移适配。应整组采用最终实现，并验证现有题面、附件权限、引用题目和 VelociTex 渲染。 |
| 用户选择器查询缓存 | `f6a093e4` | 未引入。缓存旧 UI 用户自动补全查询，减少重复请求；属于性能优化。新前端如需同类优化，应按自己的数据获取机制实现。 |
| 自定义备份/恢复工作目录 | `816fc88c` | 未引入。通过 `HYDRO_BACKUP_DIR` 指定目录，便于避开系统临时盘容量限制。 |
| Monaco 0.57 及 worker 构建改造 | `489b2dbe`，连同 `d87fd21d`、`0e0f587e`、`a2fce2f8`、`89b8f8b5` | 保留 0.52.2。新架构移除 webpack 插件，手工注册 worker，并调整语言模块导出及 CDN/同源加载。双引号类型名修复已单独适配，其余应随完整升级处理。 |
| Nix profile 安装模式 | `67b60539` | 未引入。增加 `--use-nix-profile`，支持 `nix profile install` 及 nixpkgs override input。 |
| 安装器 AVX 风险提示与确认 | `a88ff53a` | 已引入，作为安装流程纠错的一部分。 |
| 已安装程序的补丁命令扩展 | `4cf647c4` | 已引入，支持 framework 路径，并跳过依赖清单。 |
| 设置模型服务生命周期 | `54ae5505` | 已引入，作为 VJudge 初始化顺序修复的必要依赖；替代 `system/setting-loaded` 事件，消费者通过 `model:setting` 注入等待初始化。 |
| CI 中关闭 monitor 初始化 | `c77d8181` | 已引入，减少 CI 的监控数据库写入和反馈定时任务。 |
| 建题专用限流 | `eb13e625` | 已引入安全加固部分，不引入该提交附带的新题面处理。 |
| 依赖、工具链和安装策略更新 | `09dd8400`、`900fb7eb`、`52933cef`、`7a0fda29`、`da6fb16a` | 未批量引入。包括依赖升级（例如 Nodemailer/simple-git 主版本变化）、CI Yarn、Nix flake，以及允许所有 Git 仓库/安装脚本和取消最小包龄等待；需要分别评估兼容性与安装策略。 |

`18257e71` 是版本号更新；`d6b63393` 是贡献说明；其余 CLA 签署提交没有运行时功能。

## 未适用的修复与依赖

| 提交 | 原因 |
| --- | --- |
| `d87fd21d` | 修复 Monaco 0.57 移除旧 `createWebWorker` 导出后的 YAML 初始化；当前 0.52.2 仍使用原 API，不能导入不存在的新内部路径。 |
| `0e0f587e` | 针对 0.57 手工 worker 的中间修复；其取消 `workerPublicPath` 和临时修改消息 worker 公共路径的方案随后被 `a2fce2f8` 撤回，不能孤立照搬。 |
| `a2fce2f8` | 0.57 的 worker manifest、入口和 blob/importScripts 方案依赖 `489b2dbe`；当前使用 MonacoWebpackPlugin 并已设置同源 `workerPublicPath: '/'`。 |
| `5964f449` | 修复新 statement 列表的标准化和导入导出文件名；当前仍是旧 content 存储，没有这些新增导出路径。 |
| `424cd16b` | 修复新题面 editorRegistry 的 Proxy fallback；当前没有该 registry。 |
| `5179dca8` | 修复新题面文件/语言标签在 PJAX 切换时的更新；当前没有这套多文件题面标签。 |

`01302e4c` 的 renderer fallback、statement editor model dispose 和新题面草稿处理也依赖多题面功能；该提交对现有上传流程的部分已合入。

## 本地检查中另外修复的问题

- 在用户模型中补充 rewards 的类型声明引用，修复其他包单独编译 Hydro plugin API 时 `reward.wallet` 不在 `Collections` 中的类型错误。使用 `import type`，不新增运行时初始化依赖。
- 更新账户设置集成测试，分别验证普通用户不可见 `hideRank`、域管理员可见，并在测试结束后还原原角色；保留现有权限限制。
- 新增 `test:upstream` 并接入默认测试链，覆盖文件读取、空名称排序、聚合错误/403、HTML/JSON/304/重定向的 Vary、角色批量 upsert、建题限流前置检查，以及 WebSocket 自测过滤。
- 默认测试链改用 `node --test` 启动应用集成测试，避免应用测试的 `process.exit()` 使失败被普通 Node 入口错误地报告为退出码 0。
- 修复旧 UI 在 Windows 上的 Stylus 导入：显式解析 Rupture 和公共样式路径，使用原生 Stylus 导入及相对样式引用，避免 webpack importer 对扩展长度路径的匹配失败。
- 修复 webpack 规则中只识别正斜杠的路径表达式，使 Windows 下的 `@types` 声明和消息组件进入正确的 loader，避免把声明文件作为 JavaScript 编译。

## 验证

- 默认 `yarn test` 测试链通过：21 组测试运行，共 334 项测试，失败、取消、跳过均为 0；其中包括 8 项新增上游回归测试及 24 项应用集成测试。
- 全仓 TypeScript 项目编译 `tsc -b --pretty false` 通过。
- 所有修改的 JavaScript/TypeScript 文件及新增测试通过 lint。
- 旧 UI 图标字体生成与 webpack 构建通过；最终 webpack 编译用时 20.44 秒。未配置 Sentry 发布凭据的提示不影响构建。
- API 文档本地链接校验及 `git diff --check` 通过。
- `HYDRO_COMMIT` 格式、提交存在性和祖先关系已校验；逐提交记录与本次检查范围的 53 个提交一一对应。

## 逐提交处理记录

| 上游提交 | 原标题 | 本次处理 |
| --- | --- | --- |
| [`a7a49bf7`](https://github.com/hydro-dev/Hydro/commit/a7a49bf79103f7f88ea264d5c840576d4804b0e2) | framework: fix unwrapAggregatedError | 已适配；保留本地包版本 |
| [`4cf647c4`](https://github.com/hydro-dev/Hydro/commit/4cf647c49b2e891aa1198c610095a6df83972655) | patch: ignore package.json & support framework path | 已合入适用代码 |
| [`18257e71`](https://github.com/hydro-dev/Hydro/commit/18257e71da6a13e2c85ce0c03e2ac32553599dfd) | bump version | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`a88ff53a`](https://github.com/hydro-dev/Hydro/commit/a88ff53a5ca5dfbed6df5b9b5e894b41b06edc2b) | install: warn avx missing | 已合入适用代码 |
| [`67b60539`](https://github.com/hydro-dev/Hydro/commit/67b605393c3c773b2ac371854de75610ae141dfd) | install: add nix profile and override input | 功能/架构更新，未引入（见功能清单） |
| [`6635257a`](https://github.com/hydro-dev/Hydro/commit/6635257ad01f08b8cce742eed0283c7b431ef1aa) | ui: problemconfig: guard empty config load for js-yaml v5 (#1208) | 已合入适用代码 |
| [`238b1263`](https://github.com/hydro-dev/Hydro/commit/238b1263bf45ed407c68cae7f2707b74066a1c63) | framework: fix vary header (#1209) | 已补 Accept；Origin/Referer 现有代码已覆盖 |
| [`78e898fd`](https://github.com/hydro-dev/Hydro/commit/78e898fdfc1e30eb1ff1df68c021dba64f8a1cdf) | core: contest team (#1183) | 功能/架构更新，未引入（见功能清单） |
| [`c77d8181`](https://github.com/hydro-dev/Hydro/commit/c77d81817d87c6797e679945a1013a0d41ba5469) | core: skip telemetry in ci | 已合入适用代码 |
| [`3e4eb626`](https://github.com/hydro-dev/Hydro/commit/3e4eb6267f18e13561ce213008f22a2261d441b2) | ui: record_detail: only apply patch for updates | 已合入适用代码 |
| [`f68e299b`](https://github.com/hydro-dev/Hydro/commit/f68e299b4784b1237df4afbd7fe45e7419289613) | ui: domain_group: only trigger update when item selected | 已合入适用代码 |
| [`402509da`](https://github.com/hydro-dev/Hydro/commit/402509dadfaa1b3dc375dce523c2cc5b5ba2bdc4) | cla: @hanyixuanten has signed the CLA | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`f6a093e4`](https://github.com/hydro-dev/Hydro/commit/f6a093e46841d3ba55d71ee3354b16ffe7db4985) | ui: UserSelectAutoComplete: add query cache | 功能/架构更新，未引入（见功能清单） |
| [`7c960fad`](https://github.com/hydro-dev/Hydro/commit/7c960fad63a6d19169a9cc8a525732b2b9bf9464) | cla: @ReiAccept has signed the CLA | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`816fc88c`](https://github.com/hydro-dev/Hydro/commit/816fc88c01fc53fa8a2cb2d2444624f91d3addfb) | cli: db: support overriding backup/restore dir via HYDRO_BACKUP_DIR (#1215) | 功能/架构更新，未引入（见功能清单） |
| [`b1e79898`](https://github.com/hydro-dev/Hydro/commit/b1e7989894677765fe0c6f01ca2b62ca1f3e5967) | core: RecordConn: fix pretest filter | 已合入适用代码 |
| [`09dd8400`](https://github.com/hydro-dev/Hydro/commit/09dd840097127f8be8fc35957adfd2a19f7b5e78) | upgrade deps | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`80638bf9`](https://github.com/hydro-dev/Hydro/commit/80638bf9ab270524cccbf49fcac52286ed1b9abd) | cla: @LeNotFound has signed the CLA | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`489b2dbe`](https://github.com/hydro-dev/Hydro/commit/489b2dbeecf2d0b4e2e4b376100f7f756a7e8461) | ui: monaco: upgrade to 0.57, drop monaco-editor-webpack-plugin | 功能/架构更新，未引入（见功能清单） |
| [`da6fb16a`](https://github.com/hydro-dev/Hydro/commit/da6fb16acbec333feb13ec0953b39841feb04412) | chore: allow all git repositories and install scripts in yarn config | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`48c358c2`](https://github.com/hydro-dev/Hydro/commit/48c358c29ce127f87bdc5b1003b0c16244f839fc) | cla: @Lirzh has signed the CLA | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`54ae5505`](https://github.com/hydro-dev/Hydro/commit/54ae5505860a4900209f21c36d28f429eba8f1ba) | core: drop system/setting-loaded event | 已合入适用代码 |
| [`ebfa89c7`](https://github.com/hydro-dev/Hydro/commit/ebfa89c7cadbcb07a58b6690cdcc75cfa9a5cc47) | vjudge: fix dep inject | 已合入适用代码 |
| [`7a0fda29`](https://github.com/hydro-dev/Hydro/commit/7a0fda2925330d5ed40f2e034c66431691370d08) | workspace: update flake version | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`900fb7eb`](https://github.com/hydro-dev/Hydro/commit/900fb7eb198c17a5260c6e2c7d16ce8fa86bc290) | upgrade deps | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`52933cef`](https://github.com/hydro-dev/Hydro/commit/52933cef13c2ea4cb82164b1af6d8a4716d7e72a) | workflow: upgrade yarn version | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`33edcdb7`](https://github.com/hydro-dev/Hydro/commit/33edcdb7613b235428a7c896e51f47e1a8b6fa22) | core: fix: upsert each user when setting roles in bulk (#1224) (fix #1223) | 已合入适用代码 |
| [`d6b63393`](https://github.com/hydro-dev/Hydro/commit/d6b633932cb51b6d76b678245b17a698489b826f) | workspace: update CONTRIBUTING.md | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`a9b7312e`](https://github.com/hydro-dev/Hydro/commit/a9b7312ed394f85cb036696fe7286133f6b696ad) | ui: fix markdown completion | 已合入适用代码 |
| [`a9db6dd9`](https://github.com/hydro-dev/Hydro/commit/a9db6dd9b2cfa0874aa67bcf6fa3a3fe8770b8cf) | ui: fix message dialogue IDs | 已合入适用代码 |
| [`2a0101a0`](https://github.com/hydro-dev/Hydro/commit/2a0101a0177aee45e210810fb56fa2548a88c99d) | ui: guard empty marker selections | 已合入适用代码 |
| [`da3d71ef`](https://github.com/hydro-dev/Hydro/commit/da3d71ef84dae634541baa7be2d61d6df5bce7e5) | ui: fix contest error messages | 已合入适用代码 |
| [`1746f59d`](https://github.com/hydro-dev/Hydro/commit/1746f59d21d79a6982958831f3d6c64739365754) | ui: guard missing scoreboard filters | 已合入适用代码 |
| [`89b88e68`](https://github.com/hydro-dev/Hydro/commit/89b88e684b977cf1dc24517af4887d2ade5b45b1) | ui: handle empty objective code blocks | 已合入适用代码 |
| [`a9a47dc9`](https://github.com/hydro-dev/Hydro/commit/a9a47dc91ab3df3f69e8fae6a5cc2f35a2a7eb5a) | ui: skip disabled highlight tokens | 已合入适用代码 |
| [`73458a53`](https://github.com/hydro-dev/Hydro/commit/73458a53c8f2ad155429b9ef567c7d10a91cd01b) | ui: ignore empty image uploads | 已合入适用代码 |
| [`e554ad0b`](https://github.com/hydro-dev/Hydro/commit/e554ad0bb460f0ce19d581a5b187092d7959ad63) | utils: sort empty testcase filenames | 已合入适用代码 |
| [`d87fd21d`](https://github.com/hydro-dev/Hydro/commit/d87fd21d10dd1c364a14820123cfbeb822b164d9) | ui: fix YAML worker initialization | 不适用：依赖尚未引入的新功能（见上表） |
| [`0e0f587e`](https://github.com/hydro-dev/Hydro/commit/0e0f587ef5d4f3778c3ede94f868c15d15eab23a) | ui: fix monaco worker source | 不适用：依赖尚未引入的新功能（见上表） |
| [`a2fce2f8`](https://github.com/hydro-dev/Hydro/commit/a2fce2f84ff410d2f84760ee5d156afce0c10039) | ui: fix monaco worker cors | 不适用：依赖尚未引入的新功能（见上表） |
| [`89b8f8b5`](https://github.com/hydro-dev/Hydro/commit/89b8f8b5088890abc470a691a5e9a43f03d3a2c8) | ui: allow double quotes in types | 已适配到现有 Monaco API；类型声明移除部分已无需应用 |
| [`377fd345`](https://github.com/hydro-dev/Hydro/commit/377fd3459b656b5c0d88ea8dd4c340385075ac10) | problem: statement list with per-file contentRenderer registry | 功能/架构更新，未引入（见功能清单） |
| [`624ebd84`](https://github.com/hydro-dev/Hydro/commit/624ebd849041ec8e0a46871193a58d3fe0b1b200) | plugins: adapt to statement storage | 功能/架构更新，未引入（见功能清单） |
| [`d559c01e`](https://github.com/hydro-dev/Hydro/commit/d559c01e6ea86ae74b9f7351f3167364acd5e1bc) | core&ui: statement: simplify logic | 功能/架构更新，未引入（见功能清单） |
| [`dd26d78c`](https://github.com/hydro-dev/Hydro/commit/dd26d78c6b77affca4aa47c2d3ecfdb0c6c6852b) | core&ui: statement: use array shape storage | 功能/架构更新，未引入（见功能清单） |
| [`01302e4c`](https://github.com/hydro-dev/Hydro/commit/01302e4c8854d0272b6a5a060f5b8c8cc92d4fa8) | review bug fixes | 已有上传流程已合入；新题面部分不适用 |
| [`5964f449`](https://github.com/hydro-dev/Hydro/commit/5964f4492a7d1a575a8e61c31ca713513db7bb9c) | core&ui: statement: fix export&import filename | 不适用：依赖尚未引入的新功能（见上表） |
| [`0dba6c4a`](https://github.com/hydro-dev/Hydro/commit/0dba6c4ac1870a96ef83dc2b0e514142181b7075) | ui: remove useless i18n & simplify registry | 功能/架构更新，未引入（见功能清单） |
| [`424cd16b`](https://github.com/hydro-dev/Hydro/commit/424cd16b48497ee135b08280b4f6d070ff57e018) | ui: statement editor: fix registry get | 不适用：依赖尚未引入的新功能（见上表） |
| [`eb13e625`](https://github.com/hydro-dev/Hydro/commit/eb13e62557d4855696b466dbb7819d63c2794cee) | core: add rate limit for problem create | 建题限流已合入；新题面存储部分不适用 |
| [`f5c2ac14`](https://github.com/hydro-dev/Hydro/commit/f5c2ac14e182b8f1238b1ee1a6e78e4fb0fdd816) | core: fix #1226 | 已合入适用代码 |
| [`d2bf2f3e`](https://github.com/hydro-dev/Hydro/commit/d2bf2f3e97d26b9a2b7eaac9324d9b321778ea30) | cla: @fearlessxjdx has signed the CLA | 依赖/工具链/策略/版本/文档/CLA，未引入 |
| [`5179dca8`](https://github.com/hydro-dev/Hydro/commit/5179dca8b2092a68276b8dcd5e2a6ba41b9f8443) | ui: problem_detail: fix statement switch | 不适用：依赖尚未引入的新功能（见上表） |
