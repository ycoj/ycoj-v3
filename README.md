# YCOJ v3

本仓库统一管理 YCOJ 后端与 Next.js 前端，生产环境仍将它们作为两个服务分别构建、启动和更新。

| 目录 | 内容 | 常用命令 |
| --- | --- | --- |
| 仓库根目录 | 基于 [Hydro](https://github.com/hydro-dev/Hydro) 的后端及旧前端 | `yarn install`、`yarn test`、`yarn start` |
| [`ycoj-ui/`](ycoj-ui/) | 当前开发的 Next.js 前端 | `pnpm install`、`pnpm dev`、`pnpm build`、`pnpm start` |

请在对应目录运行命令；前端通过 `BACKEND_BASEURL` 连接独立运行的后端。部署检出和切换步骤见 [deploy.md](deploy.md)。原仓库 [YCOJ](https://github.com/ycoj/YCOJ) 与 [ycoj-ui](https://github.com/ycoj/ycoj-ui) 保留为历史档案。

CNB 的 [`ycoj-ui/ycoj-v3`](https://cnb.cool/ycoj-ui/ycoj-v3) 只保存 Git 镜像，不运行流水线。GitHub 的 `master` 每次推送后，会由 [Mirror to CNB](.github/workflows/mirror-cnb.yml) 工作流自动同步：推送全部 heads 与 tags 到 CNB，并同步 Git LFS 对象；也可在 Actions 页面手动触发。无需在本地执行同步命令。

## 文档

- 后端（Hydro）文档：[HYDRO_README.md](HYDRO_README.md) / [HYDRO_README_EN.md](HYDRO_README_EN.md)
- 前端文档：[ycoj-ui/README.md](ycoj-ui/README.md)
- 部署说明：[deploy.md](deploy.md)

## 开源协议

本仓库不是单一许可证：

- 仓库根目录的 Hydro 后端基于 [Hydro](https://github.com/hydro-dev/Hydro)，以 AGPL-3.0（含附加条款）发布，全文见 [HYDRO_LICENSE](HYDRO_LICENSE)；
- [`ycoj-ui/`](ycoj-ui/) 下的前端代码以 MIT 发布，全文见 [ycoj-ui/LICENSE](ycoj-ui/LICENSE)。

Hydro 后端的贡献者协议与贡献指南同样是后端专属的：[HYDRO_CLA.md](HYDRO_CLA.md)、[HYDRO_CONTRIBUTING.md](HYDRO_CONTRIBUTING.md)，不适用于 `ycoj-ui/`。
