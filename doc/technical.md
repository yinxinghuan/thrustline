# THRUSTLINE 技术文档

## 1. 技术栈

- Vanilla JavaScript + Canvas 2D + CSS，Vite 6 构建，`base: "./"`。
- 逻辑场地固定为 `360×640`，浏览器只负责缩放显示；物理以 `1/120s` 固定步长更新。
- 无第三方游戏代码、素材、音频、身份接口或平台运行时；`public/THIRD_PARTY_NOTICES.txt` 随构建进入 `dist/`。

## 2. 目录结构

- `src/engine.js`：确定性状态机、物理、燃料、风场、地形、碰撞、着陆分类和预测。
- `src/renderer.js`：只读引擎状态，绘制山脊、平台、气流、飞行器、历史轨迹和预测线。
- `src/audio.js`：首次手势解锁、点火持续节点、状态提示、结果音、总线限幅与静音持久化。
- `src/i18n.js`：`zh / en` 字典、语言来源优先级、状态/结果原因/建议格式化。
- `src/main.js`：Pointer 输入、暂停/恢复、HUD、结果与重开。
- `src/style.css`：全屏竖屏布局、双尺寸响应式与可访问状态。
- `scripts/verify-engine.mjs`：阈值、燃料、风场、暂停、预测及 30/60fps 确定性。
- `scripts/search-policies.mjs`：固定种子策略搜索，证明宽/窄平台均可着陆。
- `scripts/verify-mobile.mjs`：移动 Chromium 原生触摸、触摸取消、双尺寸、离屏暂停、结果与重开断言。
- `scripts/verify-i18n.mjs`：双语言、双尺寸、全状态、刷新/重开、宿主优先与外部访客模拟断言。
- `_qa/ui/`：390×844 与 320×568 运行截图。

## 3. 核心模块

### 状态与主循环

`ThrustlineEngine` 维护 `ready / playing / paused / safe / hard / crash / timeout`。`SPAWN` 是唯一出生状态真源：`(x=160,y=160,vx=4,vy=4)`；`angleAt(0)` 为 `-6°`，之后继续使用原有 `0.97rad/s` 自动摆角。`advance(delta)` 把渲染帧时间累积为固定 `1/120s` 步进，单帧最多接收 `50ms`，离屏时不补算。`requestAnimationFrame` 只调度，不定义物理结果。

### 输入

玩法只监听主画布 `pointerdown / pointerup / pointercancel / lostpointercapture`。首个主指针同帧启动并点火，后续指针被忽略；失焦或隐藏会清除点火并进入暂停。结果按钮使用 `click`，不参与飞行控制。

### 几何与预测

`groundY()` 是山脊与平台的唯一高度真源；飞行器机鼻、机身和双脚共同参与碰撞。`predict()` 复制当前物理状态，以同一重力、气流、地形和着陆阈值模拟未来 `1.6s` 的松手轨迹，因此预测碰撞与真实碰撞不会使用两套规则。

### 主角绘制

`ThrustlineRenderer.drawRocketGlyph()` 是 READY、飞行与结算徽记的共享形状真源。非点火轮廓为逻辑宽 `24px`、高 `26px`，接近 `craftPoints()` 的 `22×27px` 权威点范围；火焰、压力刻线、最多 `36` 条喷屑、近地扬尘、风场折线和结果冲击块都只读当前引擎状态，不参与碰撞。`resetFeedback()` 在重开清空所有视觉反馈；reduced-motion 降低数量和持续时间。

### 音频

`ThrustlineAudio` 延迟到首次真实 Canvas Pointer 或声音按钮 click 才创建 `AudioContext`。持续点火由机械基音、带通燃烧噪声与低幅 flutter 组成；启动冲击、持续燃烧、松手泄压分别建模。`pointerup / pointercancel / lostpointercapture / blur / pause / reset / fuel-empty / finish / mute` 均停止或清理节点。风场进出、硬阈值、着陆预测窗口与低燃料使用边沿状态去重。SAFE/HARD/CRASH 分别使用锁扣、重擦碰、断裂失压三种材质语言。所有节点进入 DynamicsCompressor（threshold `-24dB`、ratio `14`）和 master gain `0.15`；瞬态最多 `8` 声部并采用 oldest-first stealing；`thrustline_muted_v1` 保存静音选择。可选 `navigator.vibrate` 受同一开关与能力检测控制。音频状态不写入引擎，也不进入固定步长或碰撞。

### 多语言

`src/i18n.js` 在初始化时一次性确定 `zh / en`：同源 AlterU/Aigram 宿主 `<html lang>` → `?lang=` / `?locale=` → `localStorage.game_locale` → `navigator.language` → 默认英文。项目审计未发现已定义的 `AW.LOCALE` 消息协议，因此跨域宿主不可读时诚实降级，不伪造桥接调用。选定语言写入 `document.documentElement.lang` 与 `data-locale`；DOM、Canvas 标签、ARIA、动态状态、失败原因和建议均走同一字典。重开不重新检测，刷新按相同优先级重建。

### 屏幕、音频与平台

Canvas 内部坐标始终为 `360×640`，DOM HUD 在 `390×844` 与 `320×568` 内部适配。正式版提供单语言 `zh / en`、程序化音效、Aigram 当前玩家资料、永久 UUID、成绩提交与 Top 50 排行榜；平台外以 AlterU 身份和不可用说明诚实降级。

## 4. 扩展点

- 调整重力、推力、燃料、摆角或阈值：修改 `src/engine.js` 顶部常量并重跑三组验证。
- 调整山脊、平台或气流：修改 `TERRAIN / PADS / inWind()`；渲染与碰撞会同时更新。
- 改操作规则：只修改 `src/main.js`，但不得加入键盘、虚拟摇杆或方向按钮。
- 后续视觉化：保持 `engine.js` 权威几何不变，只替换 `renderer.js`；视觉粒子不得进入碰撞。
- 调整火箭版画轮廓或结算徽记：只改 `renderer.js` 的共享 `drawRocketGlyph()` / `drawResultCraft()`，并复验 320px 实际显示与权威碰撞范围。
- 调整音色、提示频率或总音量：只改 `audio.js`；不得从音频回调写入 `engine.js`，持续节点必须保留全部停止路径。
- 调整中英文文案或原因/建议格式：只改 `i18n.js`；不得把引擎内部诊断字符串直接显示给玩家。
- 平台接入位于 `src/identity.js`、`src/leaderboard.js` 与 `src/shared/runtime/`；排行榜以 meta 中永久 UUID `67bc0e3f-ac83-410f-a802-f4a01d177528` 为 session_id。
# 第二阶段现场回传实现（历史记录，已被 CRT 摄像输入替代）

- `showResult()` 在权威 finish 事件后复制冻结 `event + engine.x/y + history`，构造本局短任务标签；不引用后续可变状态。
- `renderer.drawFieldReturn()` 只运行一次：从 `groundY/PADS` 重画山脊和平台，从实际 history 重画航迹，并用终局姿态、速度、结果生成 intact / skid / fracture 三种结构。`evidenceRenderCount` 供 QA 断言单次生成。
- 高屏使用 600×430（约 0.98MiB RGBA），短屏使用 600×360（约 0.82MiB）；证据 Canvas 不进入 rAF 主循环。
- `audio.fieldReturn()` 在数据冻结后播放继电器锁定、窄带视频同步与短 VIDEO LOCK 音，不改变原 SAFE/HARD/CRASH 声音，无 BGM。

## CRT 与预置媒体实现

- `src/main.js::MEDIA` 通过 `new URL('./media/...', document.baseURI)` 创建相对子路径安全 URL；结果档位只由 `event.kind` 选择，图片加载不参与物理或碰撞。
- `public/media/` 含 3 张 1280×720 JPEG；总计约 444KB。默认只加载 safe，其他档位浏览器按需读取；失败时仍保留结果标题、原因和真实遥测。
- `.crt-terminal / .crt-optics / .crt-vsync` 组成物理机体、CSS 像素定标扫描调制、暗角/孔径与一次同步层。所有光学层 `pointer-events:none`；reduced-motion 移除同步动画。
- 旧 `renderer.drawFieldReturn()` 留作改造前证据与测试参考，但用户可见结果不再调用；`evidenceRenderCount` 现在表示媒体选档次数。
## 2026-08-01 结果显示层

结果层由 CSS Grid 将摄像媒体设为唯一弹性区域；`object-fit: cover` 只影响预置媒体裁切，不改动终局数据或物理。CRT 光学层由多重线性/径向背景和玻璃内阴影构成，位于输入层之下且 `pointer-events: none`。
