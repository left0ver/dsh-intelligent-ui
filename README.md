# dsh-intelligent-ui

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：让模型直接「回答出一个界面」。

> 开发中。模型调用 `render_ui` 写出一段界面源码，插件边生成边把它渲染成可操作的界面：滑块、页签这类交互在浏览器里本地计算，不再请求模型。界面状态暂不保存，也不会回传给模型。

## 工作方式

1. 模型在 `render_ui` 的 `source` 参数里写界面源码：Markdown 说明文字、`{@body …}` 状态与计算、`<slider …/>` 这类元素。语言说明和可用元素见 `src/host/index.ts` 里的工具描述。
2. 浏览器端把已经写完的部分编译成一个渲染函数（`src/dil/`），源码每变长一段就重新编译。
3. 渲染函数在沙箱里运行：一个没有源、不能联网的 iframe，里面再套一个 Worker。它只能交出一棵描述界面的数据树。
4. 页面用自己的组件把这棵树画出来（`src/client/`），用户操作再发回沙箱。

## 开发

需要 Node ≥ 22.19、pnpm，以及全局安装的 `dsh`（当前按 0.2.0-rc.2 开发）。

```sh
pnpm install
pnpm dev            # 构建并启动 dsh web，使用你已配置的模型
pnpm dev:scripted   # 同上，但换成不需要密钥的脚本模型：任何提问都流式返回 src/dil/example.dil
pnpm test
pnpm typecheck
```

## 安装

```sh
dsh plugin --profile web add @left0ver/dsh-intelligent-ui
```

从本地源码安装：

```sh
pnpm build
dsh plugin --profile web add /path/to/dsh-intelligent-ui
```

## 发布

推送 `v` 开头的标签会触发 `.github/workflows/publish.yml`，类型检查、测试和构建通过后自动发布到 npm。

```sh
npm version patch        # 改版本号、提交并打标签
git push --follow-tags
```

在 GitHub 上手动运行这个工作流只做检查和打包演练，不会发布。
