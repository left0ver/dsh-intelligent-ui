<div align="center">

# dsh-intelligent-ui

**A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web plugin: the model answers with an interface you can operate, not just text.**

[![DSH CLI](https://img.shields.io/badge/DSH_CLI-0.2.0--rc.2-4f46e5?style=flat-square)](package.json)
[![npm version](https://img.shields.io/npm/v/@left0ver/dsh-intelligent-ui?style=flat-square&logo=npm)](https://www.npmjs.com/package/@left0ver/dsh-intelligent-ui)
[![MIT License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

English · [简体中文](README.zh.md)

</div>

![Demo](./assets/demo.gif)

## Features

- **Appears as it is written**: each piece the model writes shows up at once.
- **Runs locally**: dragging a slider, editing an input or switching a tab recalculates on the spot, with no further request to the model.
- **Common controls**: sliders, inputs, selects, checkboxes, tabs, buttons, tables, and line, bar, area and pie charts.
- **Sandboxed**: the program the model writes runs in a sandbox, with no network and no access to the page's data.

## Quick start

### 1. Install

```sh
dsh plugin --profile web add @left0ver/dsh-intelligent-ui
```

A freshly published version may be held back by pnpm's minimum release age. If so, add these two lines to `~/.dsh/profiles/web/pnpm-workspace.yaml` and install again:

```yaml
minimumReleaseAgeExclude:
  - '@left0ver/dsh-intelligent-ui'
```

### 2. Start

```sh
dsh web
```

### 3. Ask

Ask the way you normally would; there is no need to mention the plugin. For example:

```
Use charts to compare investing a lump sum with investing monthly over 20 years, at different annual returns
```

## Update and uninstall

```sh
dsh plugin --profile web update @left0ver/dsh-intelligent-ui
dsh plugin --profile web remove @left0ver/dsh-intelligent-ui
```

## Known limitations

- The interface's state is not saved: reloading the page resets it.
- The model cannot see what you do in the interface, so a follow-up question does not know where you left the sliders.

## Acknowledgements

Thanks to [Disdjj/intelligent-ui-demo](https://github.com/Disdjj/intelligent-ui-demo) for its analysis of how OpenAI implements Intelligent UI, which this plugin builds on.

## License

[MIT](LICENSE)
