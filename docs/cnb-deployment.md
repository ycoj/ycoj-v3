# CNB 前后端持续部署

`master` 推送到 GitHub 后，现有 `.github/workflows/mirror-cnb.yml` 同步代码和 LFS 对象到 `cnb.cool/ycoj-ui/ycoj-v3`。CNB 根据根目录 `.cnb.yml` 在 Linux x86_64、Node.js 22 环境中构建 `ycoj-ui/`。构建成功后，通过 SSH 更新服务器上的后端源码并重启 PM2，再上传前端 standalone 产物并按配置激活。

## 与当前部署的对应关系

后端保留在 `/srv/ycoj-v3`，仍使用原有 PM2 进程 `ycoj`。流水线在服务器执行 `git fetch origin master`，将本地 `master` 快进到本次构建的准确提交，然后执行 `yarn install`、加载器检查、`pm2 restart ycoj`、健康检查和 `pm2 save`。后端启动时通过 `@hydrooj/register` 加载 TypeScript，不需要独立编译；不会执行 `yarn build ui`、`yarn build:ui` 或其他旧 UI 构建。

服务器沿用已有 Git `origin` 和读取凭据，需能无交互拉取代码。源码必须位于 `master`，且可快进到目标提交；服务器已有更新提交时会拒绝降级。服务器本地修改若已原样纳入待发布提交，脚本会将匹配文件暂存后快进，保留其内容，包括已存在的相同 Yarn 发行文件；内容不一致时停止。未跟踪且不与新源码冲突的配置、插件和原有旧 UI 产物保留。首次运行前用 `git -C /srv/ycoj-v3 status` 检查；脚本不会自动清除不匹配的修改。

前端改为运行 `/srv/ycoj-ui/releases/<版本>/server.js`。完成首次迁移后，前端发布不再需要在生产服务器上执行 `pnpm install` 或 `pnpm build`。当前每次推送都会更新后端并重启 `ycoj`。暂时保留 `/srv/ycoj-v3/ycoj-ui` 和原来的构建产物，供首次迁移回退使用。

只有 CNB 构建设置 `YCOJ_STANDALONE=1`，原来的源码构建与 `pnpm start` 仍可使用。前后端发布共享 CNB 部署锁，后端成功后才发布前端；接口变更需兼容切换期间仍在运行的旧前端。

## 1. 准备服务器

以下操作使用**当前管理 PM2 的同一 Linux 用户**执行。该账户的 SSH 登录 shell 需要能找到 Node.js 22.19 及以上、现有 Yarn 和 `pm2`；同时需要 Git、Bash、GNU tar/coreutils、curl 和提供 `flock` 的 util-linux。服务器应为 Linux x86_64、glibc 环境，不能将此产物直接用于 Alpine/musl。

```bash
node --version
pm2 list
uname -m
command -v git yarn curl flock
pm2 describe ycoj
git -C /srv/ycoj-v3 status

# 若该目录尚不存在且当前用户无权在 /opt 创建目录，由管理员执行这两行。
sudo mkdir -p /srv/ycoj-ui
sudo chown "$(id -un):$(id -gn)" /srv/ycoj-ui

mkdir -p /srv/ycoj-ui/{shared,releases,incoming}
chmod 700 /srv/ycoj-ui/shared
```

新建 `/srv/ycoj-ui/shared/runtime.env`，参考当前 `/srv/ycoj-v3/ycoj-ui/.env*` 中的生产配置，保留应用需要的服务器环境变量。例如：

```dotenv
PORT=3000
HOSTNAME=127.0.0.1
BACKEND_BASEURL=http://127.0.0.1:2333
```

`PORT` 必须是当前反向代理访问前端的端口；示例中的 `3000`、后端 `2333` 都需要按实际配置调整。`HOSTNAME=127.0.0.1` 适用于同机 Nginx 等反向代理，按现有网络部署调整。文件按 Node.js dotenv 格式解析，不执行 shell 命令，不展开 `$VARIABLE` 引用。运行 `chmod 600 /srv/ycoj-ui/shared/runtime.env`。

不要把 `ASSET_PREFIX` 写进 `runtime.env`。standalone 进程使用构建时冻结在 `server.js` 里的 `assetPrefix`，运行时环境变量不会改写 HTML 中的 `/_next/static` 地址。

## 2. 配置 SSH 与 CNB 密钥仓库

创建专用 SSH 部署密钥，将公钥加入上述 PM2 用户的 `~/.ssh/authorized_keys`。服务器需允许 CNB 构建节点访问其 SSH 端口。

在 CNB 的**密钥仓库** `ycoj-ui/ycoj-secrets` 中，在其 `main` 分支创建 `ycoj-ui.yml`，以 `.cnb/deploy-secrets.example.yml` 为模板。这个 `main` 是密钥仓库分支；业务仓库发布分支仍为 `master`。若使用其他仓库地址，修改 `.cnb.yml` 的 `imports`。

填写：

| 变量                        | 配置                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_HOST`               | 服务器域名或 IPv4 地址，不带协议和端口                                                                                |
| `DEPLOY_PORT`               | SSH 端口，默认 `22`                                                                                                   |
| `DEPLOY_USER`               | 当前 PM2 所属 Linux 用户                                                                                              |
| `DEPLOY_ROOT`               | 默认 `/srv/ycoj-ui`，使用不含空格和点号的绝对路径                                                                     |
| `DEPLOY_BACKEND_ROOT`       | 后端源码目录，默认 `/srv/ycoj-v3`                                                                                     |
| `DEPLOY_BACKEND_PM2_NAME`   | 后端已有 PM2 进程名称，默认 `ycoj`，只重启该进程                                                                      |
| `DEPLOY_BACKEND_HEALTH_URL` | 可选，默认 `BACKEND_BASEURL` 后接 `/branding?origin=http%3A%2F%2Flocalhost`，须能从生产服务器无认证访问并返回成功状态 |
| `DEPLOY_SSH_KEY`            | 专用部署私钥的完整多行内容，无交互式口令                                                                              |
| `DEPLOY_KNOWN_HOSTS`        | 经独立核对指纹的 SSH 主机公钥记录                                                                                     |
| `DEPLOY_ACTIVATE`           | 首次为字符串 `'false'`，迁移成功后改为 `'true'`                                                                       |
| `BACKEND_BASEURL`           | 与生产服务器一致的后端地址，同时配置在服务器 `runtime.env`                                                            |
| `NEXT_PUBLIC_*`             | 沿用实际生产值；这些配置需要在构建时提供                                                                              |
| `ASSET_PREFIX`              | 可选。`/_next/static` 和 VelociTex 的构建时 CDN 前缀，生产为 `https://next-cdn.ycoj.cc`。设为 `''` 则走本站。密钥里省略时 `.cnb.yml` 使用该 CDN。修改后必须重新构建 |
| `SITE_NAME`                 | 未匹配到 branding 或后端不可用时的默认名称，构建时提供，可省略                                                        |

主机公钥可用 `ssh-keyscan -p <端口> <服务器>` 收集，并与服务器上 `/etc/ssh/ssh_host_*_key.pub` 的指纹核对。非标准端口的 known_hosts 名称应为 `[主机]:端口`。流水线启用严格主机验证，不会自动信任扫描结果。

`BACKEND_BASEURL` 既供运行时服务请求使用，也用于构建时固定的 rewrites。CNB 中的 `127.0.0.1` 不代表生产服务器；如果后续页面预渲染需要访问真实后端，应为构建准备可访问的地址，并评估构建与运行的代理配置。不要将生产运行 `.env` 打进发布包；打包脚本会移除 `.env*` 文件。

网站名称和 Logo 优先使用后端 `/branding` 按访问 origin 返回的配置；在 `/manage/branding` 修改已匹配站点的名称和 Logo，不需要重新构建前端。`SITE_NAME` 只是兜底名称，不会覆盖 branding，省略时兜底名称为空。当前 `next.config.ts` 将它写入构建产物，因此修改兜底名称需重新构建，仅修改服务器 `runtime.env` 不会更新它。首次启用 branding 前先更新后端，并确保反向代理向前端传递真实的 `Host` 和 `X-Forwarded-Proto`，使协议、域名和端口与 branding 配置一致。

`/_next/static`（脚本、样式、`next/font` 字体和构建产出的媒体文件）在生产构建时加上 `ASSET_PREFIX`。VelociTex 加载器也显式使用此前缀，覆盖 `/velocitex/<version>/` 下的模块、WASM、样式和字体。当前 CDN `https://next-cdn.ycoj.cc` 回源 `next.ycoj.cc`，所以发布包仍须带上 `.next/static/` 和 `public/`，不需要再把文件同步到 CDN；CDN 也须支持 `/velocitex/` 回源并保留其 CORS 响应头。页面、RSC、`/api` 和 `/_next/image` 图片优化继续请求本站。`public/vendor`、打印和 clangd 资源也留在本站，`assetPrefix` 不会改写它们。字体预加载使用匿名 `crossorigin`；CDN 必须对站点源返回 `Access-Control-Allow-Origin`。旧的 `NEXT_PUBLIC_STATIC_ASSET_PREFIX` 和 `NEXT_PUBLIC_PRINT_ASSET_PREFIX` 仍然无效，不要用它们代替 `ASSET_PREFIX`。本地 `next dev` 会忽略 `ASSET_PREFIX`。细节见 `ycoj-ui/STATIC_ASSETS.md`。

要让线上页面改为从 CDN 加载静态资源：在密钥仓库设置 `ASSET_PREFIX`（或保持省略，让流水线使用默认 CDN），然后重新构建并发布。只改服务器 `runtime.env` 不会生效。

保留 `allow_slugs`、`allow_branches`、`allow_events` 限制，并确保仓库/组织的 CNB 构建触发规则允许同步所用 `CNB_TOKEN` 的身份触发。GitHub 仓库仍需配置现有同步流程使用的 `CNB_TOKEN`。

## 3. 首次上传并迁移 PM2

先保持 `DEPLOY_ACTIVATE: 'false'`，此设置只控制前端；后端仍会自动更新并重启 `ycoj`。将配置合并到业务仓库的 `master` 并推送，等待 GitHub 同步及 CNB 构建。CNB 上传成功后，日志会打印具体版本的激活命令，例如：

```bash
bash /srv/ycoj-ui/releases/<版本>/activate-ui.sh /srv/ycoj-ui <版本>
```

此时旧前端仍在运行。登录服务器，记录原前端的启动命令、工作目录、端口和环境配置，并备份当前 PM2 进程清单：

```bash
pm2 show ycoj-ui
pm2 save
cp ~/.pm2/dump.pm2 /srv/ycoj-ui/shared/pm2-before-cnb.json
chmod 600 /srv/ycoj-ui/shared/pm2-before-cnb.json
```

确认该版本目录下已有 `server.js`、`node_modules/`、`public/`、`.next/static/` 和 `ecosystem.config.cjs`。然后执行：

```bash
# 仅删除原前端 PM2 定义，后端继续运行。
pm2 stop ycoj-ui
pm2 delete ycoj-ui

# 粘贴 CNB 日志中打印的完整激活命令，替换下面的 <版本>。
bash /srv/ycoj-ui/releases/<版本>/activate-ui.sh /srv/ycoj-ui <版本>

pm2 show ycoj-ui
```

激活脚本会创建 `current` 链接，使用产物内的 `ecosystem.config.cjs` 创建 PM2 前端进程，验证实际响应来自该版本，然后 `pm2 save`。为防止误覆盖，首次迁移时若仍存在同名源码进程，激活会直接拒绝执行。首次切换会有短暂前端中断。

检查页面、登录、API、上传、WebSocket、Clangd 和打印资源。若 Nginx 以前通过 `alias` 直接读取 `/srv/ycoj-v3/ycoj-ui/public` 或 `.next/static`，也要将该配置改为读取 `/srv/ycoj-ui/current/public` 和 `/srv/ycoj-ui/current/.next/static`，或统一代理给新前端服务。

首次迁移失败时还没有上一份 standalone 产物，脚本会移除失败的新进程。此时按记录的原始 PM2 命令，从 `/srv/ycoj-v3/ycoj-ui` 恢复源码前端。不要重新安装或清除旧目录。也可结合备份清单恢复，但避免影响仍在运行的后端。

确认成功后，将密钥仓库中的 `DEPLOY_ACTIVATE` 改成字符串 `'true'`。此后每次业务仓库 `master` 推送都会自动上传并激活；更改密钥本身不会触发业务流水线。

## 自动部署与回退

- CNB 前端构建失败不会开始发布。后端依赖安装或检查失败时，不执行 PM2 重启和前端上传。后端重启后检查指定进程均为 online，且 HTTP 健康检查成功，最多等待约 150 秒。
- 后端是原目录源码更新，并非原子发布；安装失败时源码可能已更新，运行中的进程也可能读取新文件。失败后需要检查 `pm2 logs ycoj`，手动恢复源码和依赖。脚本不会自动回滚源码、依赖或数据库。后端成功但前端上传/激活失败时，后端保持新版本。
- 前端上传后校验 SHA-256，再解压到独立版本目录。
- Next.js standalone 显式包含服务端代码高亮使用的 `onig.wasm`；打包时按 pnpm 实际模块路径检查文件并解析 WebAssembly，缺失或损坏时停止发布。
- 构建前校验并检出 `CNB_COMMIT`，Git 和 LFS 下载失败时分别重试，避免 CNB 检出服务遇到 HTTP 429 却留下空仓库后继续构建。各步骤通过 `CNB_BUILD_WORKSPACE` 定位源码。
- CNB 的部署步骤使用锁串行执行，并在锁内检查当前 `master`，跳过已经过时的构建；服务器再通过 `flock` 防止手动激活和自动部署相互覆盖。
- 更新时将 `current` 原子切换到新版本，删除旧的 `ycoj-ui` PM2 定义，再按新版本路径重新创建前端进程，确保脚本和工作目录切换。`pm2 restart` 或 `startOrRestart` 可能继续使用原先的路径；回退时也重新创建目标旧版本的进程。切换期间有短暂前端中断。
- 健康检查访问本机前端端口的版本专属静态文件，确认该进程正在服务新产物；这不替代完整的后端和业务功能检查。重启或健康检查失败时，恢复上一版本的链接及 PM2 启动配置。
- 版本目录和上传包暂不自动删除，便于回退；定期清理确认不再使用的历史目录，保留当前版本与回退版本。

手动回退时，以 PM2 用户执行目标旧版本目录中的激活脚本：

```bash
bash /srv/ycoj-ui/releases/<旧版本>/activate-ui.sh /srv/ycoj-ui <旧版本>
```

参考 CNB 官方的“配置文件”“语法手册”“密钥仓库”文档，以及 Next.js 随包文档 `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`。本地验证打包、上传和回退行为：

```bash
bash .cnb/tests/deploy-ui.test.sh
bash .cnb/tests/activate-ui.test.sh
bash .cnb/tests/checkout-ui.test.sh
bash .cnb/tests/deploy-backend.test.sh
```

在 Git for Windows 中运行上述模拟测试时，可以设置 `MSYS=winsymlinks:lnk`，避免测试目录的符号链接被复制为普通目录。实际生产部署及发布包必须使用 Linux 构建。
