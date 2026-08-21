# 分享会讲稿 · 《一小时，让一屋子不写代码的人相信自己也能做出一个游戏》

2026-08-21 下午。案例用本项目，实操环节用 DeepSeek Harness。

## 文件

| | |
|---|---|
| `_p1_style.html` / `_p2_slides.html` / `_p3_script.html` | 源文件，改这三个 |
| `build.py` | 拼装。改完跑 `python build.py` |
| `deck.html` | Artifact 用（无 doctype，宿主会包 head/body） |
| `index.html` | 离线用的完整 HTML，双击就放 |
| `讲稿.md` | 纯文字讲稿，自动导出 |
| `课前准备.md` / `.html` | 课前预习单。`.md` 粘微信，`.html` 截长图 |
| `qr.json` | segno 生成的二维码路径，已做矩阵回读校验 |

现场快捷键：`→` 翻页 · `F` 全屏 · `P` 讲稿 · `T` 计时 · `O` 总览 · `N` 导航栏 · `D` 暗色 · `K` 清除 Key。
**底部导航栏**鼠标一动就出现、静止 2.6 秒淡出（用遥控笔讲不会碰到它），`N` 可以钉住；
点章节直接跳到那一段的开场页。讲稿面板或总览打开时它自动让位。窄屏只留前后箭头和页码。
**鼠标滚轮**也能翻页（一档一页）；触控板一次滑动只翻一页，惯性余波不会连翻。
讲稿面板、总览、小游戏画面上的滚轮让给它们自己。手机上支持轻点 / 横滑翻页。`Ctrl+P` 导出 49 页 PDF。

## 线上地址（⚠️ 这部分是服务器手工配置，不在任何仓库里）

| 地址 | 内容 |
|---|---|
| `https://tiaozhuxiansheng.com/dsh` | 课前准备单 |
| `https://tiaozhuxiansheng.com/talk` | 完整讲稿 |

**为什么不走 above-the-web 仓库**：站点部署是 `rsync -az --delete dist/ → /var/www/tiaozhuxiansheng/`，
而且有个每 6 小时的定时部署，手工放进站点根目录的文件会被删掉。所以这两页放在
`/var/www/atw-handout/`（`index.html` = 预习单，`talk.html` = 讲稿），
由 `/etc/nginx/snippets/atw-handout.conf` 挂两个 `location =`，
主域 vhost 里 `include snippets/atw-handout.conf;`。

一个坑记在那个 snippet 里：`alias` 指到单个文件时 nginx 按**请求 URI**查 MIME，
`/dsh` 没有扩展名就落到 `application/octet-stream`，浏览器当成下载。必须显式写 `default_type text/html`。

更新页面：

```bash
scp docs/talk/课前准备.html 43.128.2.172:/tmp/k.html && scp docs/talk/index.html 43.128.2.172:/tmp/t.html && ssh 43.128.2.172 'mv /tmp/k.html /var/www/atw-handout/index.html; mv /tmp/t.html /var/www/atw-handout/talk.html; chown -R www-data:www-data /var/www/atw-handout; chmod 644 /var/www/atw-handout/*.html'
```

**⚠️ 待办**：这是临时页。会后要么把它们并回 `above-the-web` 仓库走正规部署，
要么删掉 `/var/www/atw-handout/` 和那个 snippet，并从主域 vhost 里摘掉 include。

## API Key

Key **不在任何文件里**。讲之前在放映的那台电脑上打开「今天的 Key」那页，
粘一次，存 localStorage；散场按 `K` 清掉。所以这个仓库和公开页面都不含密钥。

建议：用一个单独的 DeepSeek 账号、只充小额，这样 Key 万一流出去损失封顶。

## 测试

`test/talk-mini.test.js` 锁住第 03 段里嵌的四个小游戏（刷怪、命中加分、被碰到结束、按 R 重来）。
浏览器里验不了——页面不合成时 `requestAnimationFrame` 不跑，headless 也只给一两帧——
所以照 `aim.test.js` 的办法把 `Mini()` 抠进 vm，配假画布和手拨的表。
