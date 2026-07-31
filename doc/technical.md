# THRUSTLINE 正式版技术文档

## 1. 技术栈

- Vanilla JavaScript + Canvas 2D + CSS，Vite 6 构建，`base: "./"`。
- 逻辑场地固定为 `360×640`，浏览器只负责缩放显示；物理以 `1/120s` 固定步长更新。
- 平台通信使用工作区 canonical `src/shared/runtime/bridge.ts`；永久 session UUID 为 `67bc0e3f-ac83-410f-a802-f4a01d177528`。
- 无第三方游戏代码或音频；`public/THIRD_PARTY_NOTICES.txt` 随构建进入 `dist/`。

## 2. 目录结构

- `src/engine.js`：确定性状态机、物理、燃料、风场、地形、碰撞、着陆分类和预测。
- `src/renderer.js`：只读引擎状态，绘制山脊、平台、气流、飞行器、历史轨迹和预测线。
- `src/main.js`：Pointer 输入、暂停/恢复、HUD、结果与重开。
- `src/identity.js`：调试覆盖、Aigram 当前玩家资料与 AlterU/default-avatar 降级。
- `src/leaderboard.js`：成绩提交、前 50 排行、跨用户头像与资料打开、平台外 CTA。
- `src/shared/runtime/bridge.ts`：Aigram postMessage / WKWebView canonical bridge。
- `src/style.css`：全屏竖屏布局、双尺寸响应式与可访问状态。
- `scripts/verify-engine.mjs`：阈值、燃料、风场、暂停、预测及 30/60fps 确定性。
- `scripts/search-policies.mjs`：固定种子策略搜索，证明宽/窄平台均可着陆。
- `scripts/verify-mobile.mjs`：移动 Chromium 原生触摸、触摸取消、双尺寸、离屏暂停、结果与重开断言。
- `_qa/ui/`：390×844 与 320×568 运行截图。
- `meta.json`、`public/poster.png`：平台标题与 Aigram transit 生成的正式列表海报。

## 3. 核心模块

### 状态与主循环

`ThrustlineEngine` 维护 `ready / playing / paused / safe / hard / crash / timeout`。`advance(delta)` 把渲染帧时间累积为固定 `1/120s` 步进，单帧最多接收 `50ms`，离屏时不补算。`requestAnimationFrame` 只调度，不定义物理结果。

### 输入

玩法只监听主画布 `pointerdown / pointerup / pointercancel / lostpointercapture`。首个主指针同帧启动并点火，后续指针被忽略；失焦或隐藏会清除点火并进入暂停。结果按钮使用 `click`，不参与飞行控制。

### 几何与预测

`groundY()` 是山脊与平台的唯一高度真源；飞行器机鼻、机身和双脚共同参与碰撞。`predict()` 复制当前物理状态，以同一重力、气流、地形和着陆阈值模拟未来 `1.6s` 的松手轨迹，因此预测碰撞与真实碰撞不会使用两套规则。

### 屏幕、音频与平台

Canvas 内部坐标始终为 `360×640`，DOM HUD 在 `390×844` 与 `320×568` 内部适配。正式 v1 静音。当前玩家通过 `/note/telegram/user/get/info/by/telegram_id` 读取 `data.name` 与 `head_url`；排行榜通过 `/note/aigram/ai/game/rank/score/save` 和 `/list/by/session_id` 读写。`telegram_id=__alteru_guest__` 明确视为外部访客，不调用平台榜单。平台外使用 `AlterU` 和默认 U 头像，并展示真实降级说明。

## 4. 扩展点

- 调整重力、推力、燃料、摆角或阈值：修改 `src/engine.js` 顶部常量并重跑三组验证。
- 调整山脊、平台或气流：修改 `TERRAIN / PADS / inWind()`；渲染与碰撞会同时更新。
- 改操作规则：只修改 `src/main.js`，但不得加入键盘、虚拟摇杆或方向按钮。
- 后续视觉化：保持 `engine.js` 权威几何不变，只替换 `renderer.js`；视觉粒子不得进入碰撞。
- 调整身份或排行榜展示：修改 `identity.js` / `leaderboard.js`，不得改写 canonical bridge。
- 调整平台 UUID：禁止修改；该 UUID 已永久绑定本游戏。
- 海报更新：必须继续使用 Aigram transit 流程，并同步覆盖游戏仓库与 games 海报目录。
