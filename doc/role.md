# THRUSTLINE 岗位与回传合同

玩家是 `Remote Landing Guidance / 远程着陆引导` 岗位的单指操作员。操作台只保留会改变着陆资格的时间、燃料、水平/垂直速度、倾角、风场与预测；任务标签 `LG-02P` 是双平台规则摘要，不是 UUID，也不含身份。

| 状态 | 主焦点 | 玩家动作 | 权威信息 |
|---|---|---|---|
| READY | 火箭、山脊、两平台 | 按住点火 | spawn、预测、燃料 |
| PLAYING | 中央飞行场 | 按住 / 松开 | x/y/vx/vy/angle/fuel、风、平台 |
| PAUSED | 冻结帧 | 松开并返回 | 不补算时间、不生成回传 |
| RESULT LOCKING | 信号锁定 | 可等待 ≤520ms | 结局已冻结 |
| EXTERNAL INPUT | 同一 CRT 切换至山脊固定摄像媒体 | 再次执行 / 声音 | 终局档位、平台、速度、倾角、燃料与改进线索 |

结算照片只读取内存中的终局 `x/y/vx/vy/angle/fuel/pad/kind/history`。SAFE 是火箭与平台闭合和 cyan 锁定框；HARD 是实际倾角、速度方向擦痕和接触裂线；CRASH/TIMEOUT 是终点断裂结构和速度方向碎块。相同快照确定性生成相同结构，不读取头像、用户名、网络图片或平台 session id。
