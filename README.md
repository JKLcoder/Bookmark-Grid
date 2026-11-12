# Bookmark-Grid
Chrome Plugin

轻量的 Chrome Manifest V3 新标签页扩展。将所有层级的书签扁平化为文字网格，支持本地自定义名称、实时搜索与书签变化同步。

## 开发与构建

需要 Node.js **22.12+**（本云环境使用 24.22.1）和 npm。

```bash
npm ci
npm test
npm run build
```

构建结果为 `dist/`，包括 Manifest、React 页面、静态资源和后台清理脚本。所有资源打包在本地，无 CDN、后端、账号或第三方网络请求。

`npm run dev` 可用于页面开发，但普通网页没有 Chrome Bookmarks API，会显示加载扩展的提示，不会伪造书签。验证真实行为请加载 `dist/`。修改后重新构建，在扩展页点击重新加载，并打开新标签页。

## 在 Chrome 安装

也可直接下载仓库中的 [已构建扩展 ZIP](downloads/bookmark-grid-dist.zip)（在 GitHub 文件页点击 Download raw file），解压后按下面第 2–5 步加载解压出的 `dist/`，无需安装 Node.js。ZIP 对应本次提交的构建版本，修改源码后需要重新构建。

1. 运行 `npm ci` 和 `npm run build`。
2. 在 Chrome 地址栏打开 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择本项目的 **dist 目录**，不是项目根目录。
5. 新建标签页；如 Chrome 提示新标签页变更，请保留此扩展。

已有其他新标签页扩展时，请先停用它们以免覆盖冲突。插件离线运行，安装不需要账号或 API 密钥。

## 使用

- 自动读取全部书签，包括多层嵌套目录；保留重复 URL，不显示文件夹分组。
- 默认按显示名称进行中文拼音排序，数字采用自然排序。
- 搜索自定义名称、原标题、URL、域名和原文件夹路径；清空即恢复全部。
- 点击文字在当前标签页打开；Ctrl / Command 点击、中键点击由原生链接处理。
- 悬停或 Tab 聚焦 Item 出现编辑按钮，触屏上按钮始终可见。
- 编辑仅改变显示名称；留空或点击“恢复原标题”删除该别名。无别名时原标题变化会立即反映。
- 设置入口解释使用方式和本地数据规则，没有额外主题或云同步配置。

## 数据与权限

仅申请 `bookmarks`、`storage`，没有 `tabs` 或 `host_permissions`。应用只调用 `chrome.bookmarks.getTree()` 和监听 `onCreated`、`onChanged`、`onMoved`、`onRemoved`，不修改、重命名或删除原始书签。

原始书签是唯一数据源，不复制到持久化存储。自定义名称存入 `chrome.storage.local`，每个书签单独保存为 `name:<bookmarkId>` → 名称，内存中再合并为 ID 到别名的映射。独立键避免多页面编辑不同书签时覆盖整个别名表。多个页面修改同一 ID 时以后一次写入为准。

后台 service worker 在删除书签/整个目录时清理对应别名，即使新标签页没有打开也会运行。页面加载时再次清理遗留记录。存储或读取失败会提示错误和重试，不报告虚假成功。其他扩展页面的 storage 变化也会触发刷新。

## 项目结构

```text
public/
  manifest.json          MV3 新标签页与最小权限
  background.js          删除事件的后台别名清理
src/
  bookmarks.ts           递归扁平化、搜索、拼音排序、名称清理
  api.ts                 真实 Chrome API 和本地存储适配
  App.tsx                网格、搜索、编辑对话框、设置说明
  main.tsx               React 入口
  style.css              响应式布局、键盘焦点、触屏适配
tests/                   数据、API、后台与 React 交互测试
scripts/smoke.mjs        真实 Chromium 解压扩展冒烟测试
dist/                    npm run build 生成，可直接加载
```

## 自动化测试

`npm test` 使用模拟书签树及 Chrome API，覆盖单层/多层/空目录/重复 URL、名称保存恢复、原标题变化、各字段搜索、删除清理、中文排序、空状态，以及错误处理、事件订阅释放和编辑交互。

真实浏览器验证：

```bash
npm run build
npm run test:e2e
```

默认使用 `/usr/lib/chromium/chromium`（直接执行浏览器，避免系统启动包装脚本重写扩展参数）。其他位置可设置 `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`。需要支持加载解压扩展的 Chromium；不需要修改浏览器默认用户配置。测试创建并最终删除独立的临时浏览器配置和测试书签，不操作个人浏览器。覆盖真实 API 读取、多层搜索、别名持久化、原标题保护、实时事件、Escape 关闭对话框、390px 窄屏、无外部页面请求、页面关闭后清理别名和空书签状态。截图输出到 `/tmp/bookmark-grid-desktop.png` 与 `/tmp/bookmark-grid-mobile.png`。

在受管理的云浏览器中，如果扩展参数被忽略或企业策略禁止书签编辑，`test:e2e` 可能无法启动其临时扩展/创建测试书签。不要修改系统企业策略。可运行 `npm run test:browser`：它对生产构建页面注入模拟 Chrome API，验证实际 Chromium 中的搜索、改名、重载持久化、对话框和响应式布局。此检查不能替代真实扩展 API 验证。

本次云环境验证结果：32 项单元/集成测试通过；TypeScript 与 Vite 构建通过；生产页面浏览器测试通过。真实解压扩展测试因受管理 Chromium 未加载命令行指定的扩展而超时，未完成；环境还设置了 `EditBookmarksEnabled: false`。在个人 Chrome 中请按上述步骤加载 `dist/` 完成最终安装验收。
