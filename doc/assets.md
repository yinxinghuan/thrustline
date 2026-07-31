# Thrustline 结算媒体资产

生成日期：2026-07-31。生成方式：OpenAI 内置 `image_gen`，项目自制生成资产；无第三方图片、品牌、人物或运行时网络依赖。

| 槽位 | 最终文件 | 原始生成文件 | 权威映射 |
|---|---|---|---|
| safe | `public/media/thrustline-safe.jpg` | `_production/media/thrustline-safe-source.png` | `kind === safe` |
| hard | `public/media/thrustline-hard.jpg` | `_production/media/thrustline-hard-source.png` | `kind === hard` |
| crash | `public/media/thrustline-crash.jpg` | `_production/media/thrustline-crash-source.png` | `crash / timeout` |

三张均为同一 1988–1994 年代偏远山脊固定工业监控机位：直立锁定、倾斜支脚擦碰、方向性残骸。基础 prompt 要求 16:9、写实档案 CCTV、低饱和灰绿、320px 可辨、无文字/时间戳/水印/人物/品牌/烘焙扫描线；hard 与 crash 以 safe 为参考图定向编辑，严格保持机位、天气、火箭身份和照明。

原图 1536×864 PNG；发布图使用 `sips` 缩至 1280×720、JPEG quality 72，单张约 148KB。当前只交付高质量静态媒体；未用缩放图片冒充视频。短片待办：safe 3 秒尘雾落定与轻微模拟摄像机抖动，必须另有同名静态 fallback。
