# HYROX 北京训练计划

面向 HYROX 北京站的交互式备赛 Web 应用（目标完赛时间 1:20:00）。
纯前端实现：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts，无后端。

**线上地址**: https://haner199022.github.io/hyrox-training-plan/

## 功能

- **个人状态引擎** — 基础资料录入；BMI / Deurenberg 体脂估算 / 去脂体重；减重判定（目标体重、安全速率、赛前可行性 + 体重轨迹图）；由 5km PB 推算 HYROX 完赛能力与 1:20 可行性评估
- **心率区间** — Tanaka / Gulati（女性）HRmax 估算或手动覆盖；静息心率输入后自动切换 Karvonen 储备心率法；五区间 bpm 范围 + 谈话测试；HYROX 比赛心率策略
- **1:20 目标分解** — 17 段（8×1km + 8 站点 + Roxzone）滑杆微调，总计实时重算；站点目标 vs 当前预估柱状图，自动标出三大短板
- **周期化训练计划** — 6–16 周可缩放（基础/强化/专项/减量），7 种课型，跑步课显示目标配速与心率区间；每日卡片打卡；卡片内嵌「拉伸与恢复」面板（4 套流程按课型匹配，步骤可勾选）
- **饮食计划** — Mifflin-St Jeor BMR + 活动系数 TDEE；减重/维持热量目标；宏量营养素滑杆；碳水周期化（按日课型 ±）；28 种中式食材库自动配餐；饮食禁忌编辑器（默认排除牛肉）；训练/比赛周补给指南
- **体重与执行追踪** — 体重记录 vs 目标轨迹偏差分析；7 日速率 vs 安全区间；训练/饮食完成率 + GitHub 风格 84 天热力图 + 连续打卡 streak；周总结与自动建议
- **装备与比赛日清单** — 分组装备清单（可自定义条目）、起跑时间锚定的比赛日时间线、17 段赛中执行卡、赛后恢复清单，全部可勾选并统计准备度
- **数据管理** — 一键导出/导入 JSON 备份；**GitHub Gist 云同步**（见下）

## 云同步（GitHub Gist）

数据默认保存在浏览器 localStorage。启用云同步后，任何修改会在 2 秒后自动推送到你自己的**私密 Gist**，换设备登录同一 GitHub 账号即可同步：

1. 打开 https://github.com/settings/personal-access-tokens/new
2. 权限只勾选 **Gists: Read and write**（细粒度 Token）
3. 生成后粘贴到应用底部「数据管理 → 云端同步」并点击启用

- Token 仅保存在当前浏览器的独立 localStorage 键中，不进入应用状态、不出现在导出文件、不上传到任何其他地方
- 云端数据存于你自己的私密 Gist（文件名 `hyrox-training-data.json`），源码公开仓库不含任何个人数据
- 冲突规则：多设备同时修改时以最后同步为准（last-write-wins）
- 也可随时用「断开同步」清除本地 Token 与关联（本地与云端数据均保留）

## 本地开发

```bash
npm install
npm run dev        # 默认端口 7107
npm run build      # 产物输出到 dist/
npm run preview    # 本地预览生产构建
```

## 部署（GitHub Pages）

`main` 分支为源码，`gh-pages` 分支为构建产物（`dist/` 内容，含 `.nojekyll`）：

```bash
npm run build
# 将 dist/ 内容推到 gh-pages 分支根目录（示例：临时 worktree + force-push）
```

Pages 来源：`gh-pages` 分支 `/` 根目录。Vite `base` 已配置为 `/hyrox-training-plan/`。

## 隐私说明

本应用无后端、无第三方数据采集。全部个人数据（身体数据、训练打卡、饮食、体重记录）仅存储于：

1. 你当前浏览器的 localStorage
2. （可选）你自己 GitHub 账号下的私密 Gist

公开源码仓库中不包含任何用户数据。训练与营养建议为通用运动科学估算，不构成医疗建议。
