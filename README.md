# THRUSTLINE

30 秒单指 Lunar Lander：按住点火，松开滑行；在燃料、速度、摆角、气流和两个不同价值的平台之间取舍。

正式版保留用户确认的灰盒物理与碰撞核心，并增加 AlterU 当前玩家身份、永久 UUID、成绩提交、带头像与资料跳转的 Top 50 排行榜，以及平台外诚实降级。

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5185
```

本地入口：`http://127.0.0.1:5185/`

验证：

```bash
npm run verify
npm run verify:static
npm run verify:policies
npm run build
```

移动原生触控验证使用项目工作区提供的 Playwright 运行时，详见 `doc/qa.md`。

线上入口：`https://yinxinghuan.github.io/thrustline/`

永久 UUID：`67bc0e3f-ac83-410f-a802-f4a01d177528`
