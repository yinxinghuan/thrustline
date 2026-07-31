# THRUSTLINE 正式版 QA 记录

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

## 产品门槛与发布决定

- [ ] 10 名真机玩家中 ≥8 名在 3 秒内说出“按住点火、松开滑行”。
- [ ] ≥7 名无需二次解释完成首次大平台。
- [ ] ≥7 名失败后能指出一个可改变的点火时机，并主动立即重开。
- [ ] 至少出现“保守大平台”和“高分小平台”两种被真实选择的策略。

广泛的 10 人测试仍未完成。项目所有者已亲自试玩当前 `http://127.0.0.1:5184/` 灰盒并评价“很不错”，随后明确要求先正式发布。正式版完整保留该版本的 `engine.js` 与 `renderer.js`，没有借正式化重做核心手感；本次以所有者的明确发布决定作为 v1 门槛，10 人数据保留为后续迭代研究项。

## 2026-07-31 执行结果

- `npm run verify`：通过。燃料点火 1 秒后从 `100` 到 `82`；风场相对无风增加 `24px/s` 水平速度；30/60fps 结果一致。
- `npm run verify:static`：通过。四类 Pointer 释放路径齐全，无键盘/虚拟方向控件；guest shell、UUID、海报、身份与排行榜接入齐全。
- `npm run verify:policies`：固定种子搜索找到：
  - A 宽平台 SAFE：`8.33s`，燃料 `28.9`，`vx=-11.0`、`vy=32.0`、倾角 `7.5°`。
  - B 窄平台 SAFE：`8.13s`，燃料 `25.7`，`vx=3.8`、`vy=22.7`、倾角 `1.0°`。
  - 两个平台也都有 HARD 路径，证明平台价值与着陆质量不是不可达文案。
- `scripts/verify-mobile.mjs`：390×844 连续 `10` 次、320×568 连续 `3` 次原生触摸通过；两尺寸 `scrollWidth/Height` 与视口完全一致，iOS 长按防护为 `none`，blur 后 `180ms` 内游戏时间零推进。
- Aigram 宿主模拟：资料接口解析为 `Pilot`；榜单显示 2 行，self 行为“你 / YOU”，另一行以首字母头像显示并成功发送用户 `99` 的 `AW.PROFILE.OPEN`。
- 外部访客：远程 guest shell 恰好加载一次且访客栏可见；榜单显示诚实降级与 AlterU CTA，不提交虚假成绩。
- `npm run build`：通过；`dist/THIRD_PARTY_NOTICES.txt` 存在。
- `ui-foundation --strict`：无功能 Emoji/文本图标发现。

证据截图：

- `_qa/ui/ready-platform-layout-390x844.png`
- `_qa/ui/coast-platform-layout-390x844.png`
- `_qa/ui/result-platform-layout-390x844.png`
- `_qa/ui/ready-platform-layout-320x568.png`
- `_qa/ui/coast-platform-layout-320x568.png`
- `_qa/ui/rank-platform-layout-390x844.png`
- `_qa/ui/rank-external-fallback-platform-layout-390x844.png`
- `_qa/ui/external-guest-390x844.png`

## 重复风险复核

证据范围为 `games/games.json`、`skybound-aviator/doc/requirements.md`、`tide-signal/doc/requirements.md` 与 `flappy-bird/doc/requirements.md`：

- Aurora Courier / Skybound Aviator 和 Tide Signal 是无限飞行躲避/收集/射击，Pointer 位置直接控制飞行器。
- Flappy Bird 是单次点按改变竖向速度、穿过障碍的生存计分。
- THRUSTLINE 的核心决策是自动摆角下选择点火时机，用有限燃料同时管理 `vx / vy / tilt`，并以接触几何和速度阈值完成平台着陆。飞行题材相近，但操作、胜负条件和策略骨架均不同。
- 与同期 Recoil Vector 的共同点仅是“推力改变运动”；Recoil 以射击反冲并摧毁目标，THRUSTLINE 不射击、不瞄准敌人，目标是控制接触状态，因此不是其换皮。

## Keep / Rework / Kill

**结论：KEEP / SHIP v1**。

- 核心单指物理、宽/窄平台可达性、气流/燃料/预测决策、确定性与移动触控 QA 全通过。
- 所有者试玩认可并明确要求发布；正式版保持 `src/engine.js` 与 `src/renderer.js` 与该灰盒版本字节一致。
- 残余风险：排行榜需在真实 AlterU iframe / iOS WKWebView 再复验一次；10 人学习性与重玩数据尚未采集，不据此声称群体留存已验证。
