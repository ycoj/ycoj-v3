# 生产环境迁移

统一仓库使用**一份检出、两个服务**。后端位于仓库根目录，Next.js 前端位于 `ycoj-ui/`；保留现有端口、反向代理、环境变量和两套独立进程。本操作由服务器管理员在验证新仓库后执行。

## 迁移前

1. 记录两个现有服务的工作目录、启动命令、PM2 配置及环境变量，备份未纳入 Git 的配置文件。保留旧检出和当前进程，作为回退点。
2. 确认新仓库 `master` 的 GitHub Actions 已通过，Git LFS 文件和后端子模块可读取。不要在切换生产前归档旧仓库。
3. 选择一个新的绝对路径作为统一检出目录；下面用 `/srv/ycoj-v3` 举例。部署账户需有 GitHub、Git LFS 及两个子模块的读取权限。

## 准备统一检出

```bash
git clone --branch master --recurse-submodules https://github.com/ycoj/ycoj-v3.git /srv/ycoj-v3
cd /srv/ycoj-v3
git lfs install --local
git lfs pull
git submodule status
git lfs ls-files
```

将现有后端运行配置放到 `/srv/ycoj-v3` 下原有的相对位置；将现有前端 `.env` 等配置放到 `/srv/ycoj-v3/ycoj-ui` 下原有的相对位置。不要把密钥提交进 Git。后端继续使用项目原有的 Yarn 4 安装与构建命令；前端执行：

```bash
cd /srv/ycoj-v3/ycoj-ui
pnpm install --frozen-lockfile
pnpm build
```

前端的 `BACKEND_BASEURL` 和其他环境变量应沿用现有值。两个服务使用同一份检出，但依赖分别安装在各自目录。

## 切换两个进程

1. 将现有后端服务的工作目录改为 `/srv/ycoj-v3`，按原启动命令重启后端；检查健康状态、日志及数据库连接。
2. 将现有前端 PM2 服务 `ycoj-ui` 的工作目录改为 `/srv/ycoj-v3/ycoj-ui`，按原启动命令重建或重载进程。仅执行 `pm2 restart ycoj-ui` 不会自动修改一个既有进程的工作目录。
3. 验证前端页面、后端 API、上传与静态资源。服务仍按原端口分别运行。
4. 如使用 `ycoj-ui/scripts/build.js` 远程更新前端，将本地 `ycoj-ui/scripts/.env.local` 中的 `FRONTEND_DIR` 指向 `/srv/ycoj-v3/ycoj-ui`。脚本会在父目录执行 `git pull --ff-only` 和 `git lfs pull`，随后仅构建并重启前端。

以后一次 `git pull` 会更新检出中的前后端文件；按需要分别安装、构建和重启两个服务。若需要两套服务长期停留在不同提交，应改用两份检出。

## 回退与收尾

任一服务出现问题时，将该服务的工作目录及启动配置指回保留的旧检出，按原命令重启；另一服务可独立处理。新检出及旧检出均不要删除。确认两个服务稳定运行且后续更新链路正常后，再将旧仓库 README 指向新仓库并归档；旧 PR 将保持只读。
