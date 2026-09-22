[![Frontend Checks](https://github.com/ycoj/ycoj-v3/actions/workflows/frontend-lint.yml/badge.svg)](https://github.com/ycoj/ycoj-v3/actions/workflows/frontend-lint.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/ycoj/ycoj-v3?utm_source=badge)

## 项目简介

这是一个大型在线测评系统 (YCOJ) 的前端项目，负责提供用户界面和交互功能。采用 Next.js 框架，实现 SSR 等功能。

项目内置中英文双语。

部分功能基于定制的 Hydro 后端，源代码与前端共同维护在 [YCOJ v3](https://github.com/ycoj/ycoj-v3)。上游项目为 [Hydro](https://github.com/hydro-dev/Hydro)。

## 界面展示

![](https://lvj-img.tboj.cn/img.zshfoj.com/8ff3e4ad1dfa92957afd35f6f45722662caf43b2ba072614a1a6dc9e8eaa5274.png)

![](https://lvj-img.tboj.cn/img.zshfoj.com/78f730bbca3b72ba20db3c89708de8e0d1508dceaf498c1913504e148ea27bf0.png)

## 开源

本项目（前端）采用 MIT 开源协议，全文见 [LICENSE](LICENSE)。后端（仓库根目录的 Hydro 代码）采用 AGPL-3.0（含附加条款）开源协议，全文见仓库根目录的 [HYDRO_LICENSE](../HYDRO_LICENSE)。两个许可证各自只覆盖对应目录下的代码。

## LLMs-Ready

对于那些我们希望让 LLM 访问的内容，请为组件添加 `data-llm-visible="true"` 属性：

```html
<div data-llm-visible="true" className="space-y-2">...</div>
```

对于我们希望让 LLM 阅读的文本，请添加 `data-llm-text` 属性：

```html
<p data-llm-text="{blog.title}">{blog.title}</p>
```
