# THRUSTLINE QA 记录

## 机械门槛

- [x] `pointerdown` 从 ready 启动并点火；`pointerup/cancel/lostcapture` 立即滑行。
- [x] 不存在 `keydown`、虚拟摇杆或方向按钮。
- [x] 燃料只在点火时减少，归零后推力为 0。
- [x] 水平/垂直速度和自动摆角共同影响轨迹。
- [x] SAFE/HARD/CRASH 阈值边界有单元测试。
- [x] 山脊、两个平台和气流至少各改变一次最优决策。
- [x] 结果说明具体失败指标，结算同帧提供可用重开按钮。
- [x] `30fps` 与 `60fps` 对同一精确输入时间表得到一致结果。
- [x] 隐藏/失焦不推进时间并取消点火；真实浏览器 blur/focus 已复验。

## 真实触控门槛

- [x] 390×844：首触、持续点火、松手、再次点火完整运行。
- [x] 320×568：同一流程无溢出、无遮挡。
- [x] 移动 Chromium `hasTouch` + CDP 原生触摸连续 10 次，THRUST/COAST 断言 10/10 成功；末次使用 `touchCancel`。
- [x] 触控流程完成一次 CRASH，结果显示 `RIDGE CONTACT`、速度/角度阈值和可改变的后悔点。

## 产品门槛

- [ ] 10 名真机玩家中 ≥8 名在 3 秒内说出“按住点火、松开滑行”。
- [ ] ≥7 名无需二次解释完成首次大平台。
- [ ] ≥7 名失败后能指出一个可改变的点火时机，并主动立即重开。
- [ ] 至少出现“保守大平台”和“高分小平台”两种被真实选择的策略。

未完成真实玩家门槛前，结论不得为 Keep，也不得提出视觉化或发布。

## 2026-07-31 执行结果

- `npm run verify`：通过。燃料点火 1 秒后从 `100` 到 `82`；风场相对无风增加 `24px/s` 水平速度；30/60fps 结果一致。
- `npm run verify:static`：通过。四类 Pointer 释放路径齐全，无键盘/虚拟方向控件、无访客栏、无 UUID/海报/平台功能。
- `npm run verify:policies`：固定种子搜索找到：
  - A 宽平台 SAFE：`8.33s`，燃料 `28.9`，`vx=-11.0`、`vy=32.0`、倾角 `7.5°`。
  - B 窄平台 SAFE：`8.13s`，燃料 `25.7`，`vx=3.8`、`vy=22.7`、倾角 `1.0°`。
  - 两个平台也都有 HARD 路径，证明平台价值与着陆质量不是不可达文案。
- `scripts/verify-mobile.mjs`：390×844 连续 `10` 次、320×568 连续 `3` 次原生触摸通过；两尺寸 `scrollWidth/Height` 与视口完全一致，iOS 长按防护为 `none`，blur 后 `180ms` 内游戏时间零推进。
- `npm run build`：通过；`dist/THIRD_PARTY_NOTICES.txt` 存在。
- `ui-foundation --strict`：无功能 Emoji/文本图标发现。

## 2026-07-31 READY spawn 本地修复

### 原设计证据与边界

- 原源码与原需求一致：`(x=64,y=92)`、`(vx=18,vy=5)`、首帧倾角约 `-34°`。原需求唯一明确写出的目的为“不操作会撞上安全区右侧山脊，必须主动刹降”。
- 对原正式引擎执行纯滑行，`4.67s` 后在 `(148.0,529.85)` 发生 `RIDGE CONTACT`，与上述目的吻合。
- 源码使用固定 `360×640` 逻辑坐标，响应式层只缩放 Canvas；因此靠左、靠上不是 CSS 映射误差。
- 没有源码或文档证据说明 `y=92` 是为了给教程留白、展示气流或展示山脊。它确实带来较长的上部下降画面，但只能记录为可观察副作用，不能当作已证实的原始意图。

### 修复数据

- 最终本地 spawn：`(x=160,y=160)`、`(vx=4,vy=4)`、首帧倾角 `-6°`。
- 权威机身顶部距场地顶边 `145px`（逻辑高度的 `22.7%`）；左右机身边距 `145px / 185px`。
- 教程卡从 `top:42% / 280×90px` 改为 `top:44% / ≤248×78px`；与机身间距在 390×844 为 `74.4px`，320×568 为 `35.0px`，且不遮挡两个平台。
- 首次按住 `350ms` 后：`x=160.58`、`y=158.97`、`vx=-1.38`、`vy=-9.42`、燃料 `93.7`；同帧进入 THRUST，位移小且清楚制止下降。
- 松手预测、重力 `38`、推力 `78`、燃料消耗 `18/s`、碰撞、平台和气流数值均未改变。

### 节奏、可达与确定性

- 纯滑行仍在 `4.12s` 后明确撞上山脊，保留“必须做决定”的开场；30 秒上限未改变。
- 固定种子搜索重新找到 A SAFE（`9.81s`）与 B SAFE（`9.25s`），也找到两平台 HARD 路径。比原基线 A/B SAFE `8.33s / 8.13s` 多约 `0.9–1.5s`，仍留有约 20 秒余量，并给玩家更多读取预测与修正的时间。
- 30/60fps 确定性、燃料、风场、暂停、预测与阈值测试均通过。
- 390×844 原生触控 10 次、320×568 原生触控 3 次通过；首触、松手、`touchCancel`、离屏暂停与立即重开均通过。

匹配证据：

- `_qa/ui/spawn-before-platform-layout-390x844.png`
- `_qa/ui/spawn-after-platform-layout-390x844.png`
- `_qa/ui/spawn-before-platform-layout-320x568.png`
- `_qa/ui/spawn-after-platform-layout-320x568.png`
- `_qa/ui/first-input-platform-layout-390x844.png`
- `_qa/ui/first-input-platform-layout-320x568.png`

结论：本地修复通过，等待用户在 `http://127.0.0.1:5184/` 复验；未推送、未发布。

## 2026-07-31 版画火箭与程序化音效本地改造

### 视觉规则与前后结论

- 旧主角是黑色三角机身 + 两条支脚，在 320px 宽度下更接近方向符号。新主角复用同一约 `24×26` 逻辑像素范围，增加锥形鼻、短舱体、双稳定翼、喷口、米白菱形舷窗和单条斜刻线；仍只使用黑、米白、警戒红和硬边。
- THRUST 只在真实 `engine.thrusting && fuel>0` 时绘制红色短火焰和两条压力线；READY、COAST 和结算徽记无火焰。320×568 截图中舷窗、双翼和喷口仍可区分，没有糊成纯黑块。
- SAFE/HARD/CRASH 结果层复用同一 glyph：SAFE 为稳定红地线，HARD 增加接触压力刻线，CRASH 使用断裂压力刻线；没有卡通爆炸或新的视觉材质。
- `src/engine.js` 改造前后 SHA-1 均为 `a2c002747aea3d88dfb2521d67abb737781711bf`；hitbox、质心、spawn、速度、摆角、预测和碰撞未变化。
- UI 新增 `48×44px`（窄屏 `44×44px`）硬边扬声器 + ON/OFF；与标题、计时器和既有工业仪表体系一致。

匹配截图：

- READY 前/后：`craft-before-ready-*` / `craft-after-ready-*`
- 点火前/后：`craft-before-thrust-*` / `craft-after-thrust-*`
- 滑行前/后：`craft-before-coast-*` / `craft-after-coast-*`
- 接近平台：`craft-near-pad-*`
- 三类结果：`craft-result-safe-*`、`craft-result-hard-*`、`craft-result-crash-*`

视觉 QA：Hierarchy `4/5`、Coherence `5/5`、Readability `4/5`、Game feel `4/5`、Asset quality `4/5`、Responsive UX `5/5`、Polish `4/5`，平均 `4.29/5`，无 P0/P1。

### 音效映射与 QA

- 首次原生触摸后 `AudioContext` 状态为 `running`；加载和 READY 未交互阶段没有创建音频节点。
- 390×844 连续 10 次、320×568 连续 3 次真实 touch start/end 通过，THRUST 时 burn node 存在，松手后立即为 false；末次 `touchCancel` 同样停止。
- 快速连按不会叠加 burn node；blur/pause、fuel-empty、结果和 retry 后均无持续节点。focus 不自动恢复燃烧，必须再次按住。
- 风场进入/离开各触发一次；CRASH 预测跨越一次、SAFE/HARD 预测窗口一次；相同状态重复更新不重复提示。低燃料连续更新只产生一次脉冲，`1.4s` 后才允许下一次。
- SAFE/HARD/CRASH 各触发一次对应结果音；静音写入 `thrustline_muted_v1`，刷新后保持 OFF，再开启恢复 ON。
- Master gain 实测 `0.180000007`（Float32），compressor ratio `10`；浏览器无 page error、console warning 或 autoplay 警告。
- `prefers-reduced-motion` 只停止教程脉冲，不移除火箭结构、thrust 火焰状态或文字反馈；声音不是唯一状态通道。
- 以 external guest 与 platform-layout 两态复验：正式 `guest-shell.js` 保留；主构图验收时由 QA harness 隐藏访客栏，不为访客栏永久避让。Canvas、声音、身份降级和排行榜说明均正常。

结论：本地 5184 视觉与音频改造通过自动和截图 QA，等待用户主观试听与主角风格确认；未推送、未发布。

证据截图：

- `_qa/ui/ready-platform-layout-390x844.png`
- `_qa/ui/coast-platform-layout-390x844.png`
- `_qa/ui/result-platform-layout-390x844.png`
- `_qa/ui/ready-platform-layout-320x568.png`
- `_qa/ui/coast-platform-layout-320x568.png`

## 2026-07-31 单语言 i18n 本地修复

- 语言优先级已实测为：同源 AlterU/Aigram 宿主 `<html lang>` → `?lang=` / `?locale=` → `localStorage.game_locale` → `navigator.language` → 默认英文。项目与 `RUNTIME.md` 未定义跨域宿主语言消息，故不可读时直接进入下一层，不臆造 `AW.LOCALE`。
- `zh` 只显示中文，`en` 只显示英文；覆盖标题副标、教程、READY/THRUST/COAST、气流、HUD、安全阈值、暂停、声音开关、SAFE/HARD/CRASH、具体失败原因、后悔建议与重开。
- `390×844`、`320×568` 各验证 `zh / en` 的 READY、真实 touch 点火、滑行、暂停、SAFE、HARD、CRASH、声音关闭/开启、刷新持久性与重开语言稳定，共生成 24 张匹配状态截图。两种语言均无横向/纵向页面溢出，声音按钮保持至少 `44×44px`。
- 宿主模拟证明父页 `lang=zh-CN` 可覆盖子页 `?lang=en`；独立页证明 query 可覆盖 `game_locale`；`?telegram_id=__alteru_guest__&lang=en` 下 Canvas、声音和触控仍可用。
- 浏览器 page error、console warning/error、缺失 key 均为 `0`。`npm run build`、物理确定性、静态 i18n 门禁均通过；本次未修改 `engine.js`、spawn、碰撞、音效映射或火箭绘制。

证据命名：`_qa/ui/i18n-{zh|en}-{ready|flight|pause|safe|hard|crash}-platform-layout-{390x844|320x568}.png`。

## 重复风险复核

证据范围为 `games/games.json`、`skybound-aviator/doc/requirements.md`、`tide-signal/doc/requirements.md` 与 `flappy-bird/doc/requirements.md`：

- Aurora Courier / Skybound Aviator 和 Tide Signal 是无限飞行躲避/收集/射击，Pointer 位置直接控制飞行器。
- Flappy Bird 是单次点按改变竖向速度、穿过障碍的生存计分。
- THRUSTLINE 的核心决策是自动摆角下选择点火时机，用有限燃料同时管理 `vx / vy / tilt`，并以接触几何和速度阈值完成平台着陆。飞行题材相近，但操作、胜负条件和策略骨架均不同。
- 与同期 Recoil Vector 的共同点仅是“推力改变运动”；Recoil 以射击反冲并摧毁目标，THRUSTLINE 不射击、不瞄准敌人，目标是控制接触状态，因此不是其换皮。

## 2026-07-31 反馈层重做（仅本地）

### 声音层级与生命周期

- 操作瞬态：点火启动离合冲击、持续机械燃烧、松手泄压已拆为三层；燃料仅在 `64–72Hz` 基音与 `350–480Hz` 过滤范围内稳定调制，不做漂移音色。
- 状态提示：风场进入/离开为相反方向扫频；速度/倾角跨 HARD、预测跨 CRASH、首次进入 SAFE/HARD 窗口和燃料首次低于 `22` 都采用边沿触发，连续 telemetry 不重复蜂鸣。
- 结算材质：SAFE 为夹具闭合/锁扣，HARD 为低频撞击/干擦，CRASH 为结构断裂/失压；自动测试确认三类分别触发一次。
- 总线为 master `0.15` + compressor threshold `-24dB` / ratio `14`；瞬态声部硬上限 `8`，快速连按测试中始终 `activeVoices≤8`，超额 oldest-first stealing。
- 首次页面加载 `AudioContext=none`，真实 touch 后才变为 running；`touchCancel / lostcapture / pause / blur / reset / mute / finish` 清持续节点。blur 后 `activeVoices=0`，focus 不自动恢复燃烧。
- 静音键为 `48×44px`（窄屏 `44×44px`），`thrustline_muted_v1` 在刷新后保持 OFF，重新开启后保持 ON。可选 vibration 受同一开关与能力检测控制。

### 版画反馈与预算

- 点火压力刻线、定向喷屑、近地扬尘只在真实 `thrusting && fuel>0` 时出现；喷屑上限 `36`。气流折线只在权威风区内变形；预测窗口刻度使用 `engine.predict()` 的真实端点。
- SAFE/HARD/CRASH 分别使用夹具线、冲击线、断裂块和克制的硬边位移；无渐变、模糊、软光、透明烟或烟花。
- reduced-motion 将喷屑降为每次 `1` 条、瞬态时长降到 `90ms` 并关闭教程/结果位移；文字、火焰、轨迹和结果原因仍完整。
- 截图检查：`first-input-platform-layout-{390x844|320x568}.png` 中喷口压力线与小尺寸轮廓不互相遮挡；`craft-result-{safe|hard|crash}-platform-layout-*` 中三类结果材质可仅凭形状区分。

### 回归结果

- `npm run build`、`npm run verify`、`npm run verify:static`、`npm run verify:policies` 全部通过；A/B 两平台 SAFE/HARD 路径仍可达。
- `npm run verify:i18n`：`zh/en × 390×844/320×568` 全状态通过；宿主语言、query、storage 与 external guest 顺序不变，无双语并排。
- `scripts/verify-mobile.mjs`：390×844 原生触摸连续 `10` 次、320×568 连续 `3` 次通过，覆盖快速连按、末次 touchCancel、blur/focus、重开、静音刷新、reduced-motion 与 external guest；page error、console warning/error、autoplay warning 均为 `0`。
- `ui-foundation --strict`：无功能 Emoji 或文本图标问题；布局无横向/纵向溢出。
- `src/engine.js` 改造前后 SHA-1 均为 `a2c002747aea3d88dfb2521d67abb737781711bf`；本轮未修改 spawn、物理、燃料、平台、风场、预测、碰撞或分数。

## FIELD OPERATIONS DESK 第二阶段（2026-07-31）

- `src/engine.js` SHA-256 基线与完成值均为 `a0be98d08a00cb7e7770d9da2b2af7aa870b4ab8918015050aa0002944fc238d`；本阶段未改 engine、spawn、物理、平台、风场、预测、碰撞、燃料或分数。
- 结果快照冻结 `x/y/vx/vy/angle/fuel/pad/kind/history`，`evidenceRenderCount===1`。SAFE / HARD / CRASH 截图分别呈现闭合锁定、方向擦痕/接触裂线、速度方向断裂结构；不是固定照片换标题。
- 390×844 证据 Canvas 为 `600×430`（约 `0.98MiB` RGBA），在高屏结果场中居中；320×568 为 `600×360`（约 `0.82MiB`），照片仍是最大单一元素且结果无 overflow。
- `scripts/verify-mobile.mjs` 覆盖两尺寸 READY、真实 touch hold/release、10 次/3 次连续输入、touchCancel、blur/focus、暂停、SAFE/HARD/CRASH、结果照片一次生成、静音刷新持久、reduced-motion 与 standalone guest；全部通过。
- `scripts/verify-i18n.mjs` 覆盖 `zh/en × 390×844/320×568` 的 READY、飞行、暂停和三种主要结算；developed/evidence 截图均等待 560ms 后采集，中英文不并排，控制台 warning/error 为 0。
- 锁定→7级硬切显影为 `520ms`；reduced-motion 不添加 locking class，直接显示静态证据。回传声音在快照冻结后播放，保留原 SAFE/HARD/CRASH 材质，无 BGM。
- `npm run build`、`npm run verify`、`npm run verify:static`、`npm run verify:i18n` 与移动 QA 均通过；相对路径构建与 notice 保持。

### 视觉自评

- P0：0。玩法触控、结果重开/声音、窄屏布局均可达。
- P1：0。高屏原底部约 200px 单侧黑留白已改为更高证据画幅和垂直居中；320 维持紧凑、不压缩照片到不可读。
- P2：高屏仍保留上下均衡的深色负空间，作为现场相机遮光区；这是有意构图，不用于迁就 external guest 栏。
- 该热敏/打印风险记录已被 CRT 方案取代。

## 2026-07-31 CRT + 预置摄像媒体复验

- `ui-style-library / BSOD Pixel-CRT` 已实际用于硬边终端字体、低饱和磷光色、像素控件与受控切换；Signal Bloom 的 3.5–4px CSS 像素、曲率/孔径/束偏合同只作能力基线，没有复制不可许可 Shadertoy CRT 片段。
- safe/hard/crash 三档均回读为 1280×720 本地 JPEG；权威 kind 与 URL 一一对应，页面无运行时媒体网络请求。
- zh/en × 390×844/320×568 的 READY 与三档结算已截图为 `_qa/ui/crt-thrustline-*`；`overflowX/Y=0`，最小可见按钮 44px，图片自然尺寸正确，console/pageerror=0。
- reduced-motion 实测 `.crt-vsync` animation 为 none，直接显示静态摄像画面。物理外壳和光学层均不接收 pointer。
- `src/engine.js` SHA-256 仍为 `a0be98d08a00cb7e7770d9da2b2af7aa870b4ab8918015050aa0002944fc238d`。

结论：反馈层达到本地复验门槛；主观音色与手机扬声器响度仍需用户真机试听后决定是否进入正式 Thrustline。未 push、未发布。

## Keep / Rework / Kill

**结论：REWORK（保留灰盒，暂停视觉化）**。

- 不 Kill：纯单指物理成立，宽/窄平台均存在 SAFE/HARD 可达策略；气流、燃料、预测和山脊都改变真实决策，机械 QA 全通过。
- 暂不 Keep：尚未执行 10 名真机玩家的 3 秒理解、首次大平台成功和失败后主动重开门槛。自动策略可达不能代替人类可学、可控与想再来一次。
- 下一步只做一轮 10 人、每人最多 3 局的灰盒测试，记录首局结果、首次改变的点火时机、是否主动重开和平台选择。通过 `8/10` 理解、`7/10` 大平台完成、`7/10` 主动重开后，才允许提出视觉化方案；本轮不提出。
## 2026-08-01 CRT / 大图结算复验

- 390×844 与 320×568：READY、SAFE、HARD、CRASH，zh/en 均完成截图复验。
- 结算照片填满标题、遥测和操作之间的弹性区域；320×568 不再受 178px 上限约束。
- CRT 扫描线、边缘暗角、玻璃曲率证据在游玩与结算状态均可见；无闪烁，光学层不拦截触控。
- `npm run verify` 与 `npm run build` 通过，权威引擎未修改。
