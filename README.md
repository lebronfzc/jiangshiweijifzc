# 僵尸危机：方块头 · 经典复刻版

一个 HTML5 Canvas 俯视角射击小游戏，致敬经典 Boxhead 玩法。零依赖、零构建，可直接部署到静态托管或上传至 B 站 toy 网页小游戏平台。

## 项目简介

玩家将在五张不同风格的俯视角战场中抵挡一波波僵尸和特殊敌人的进攻，通过连续击杀提升连击倍率，并逐步解锁更强武器。游戏内置键盘、鼠标和触屏操作，适合直接在浏览器中体验。

## 主要特性

- 纯前端实现（`index.html` + `style.css` + `script.js`），无第三方依赖、无需打包工具
- Canvas 渲染的俯视角动作射击玩法
- 独立地图选择页，五张地图均带实景缩略图卡片
- 美化主菜单，包含动态标题、特色徽章、氛围背景和僵尸剪影
- 菜单、暂停、结算、地图选择和操作说明界面
- 键盘经典模式、鼠标射击模式和移动端触屏摇杆
- 9 种武器、5 张地图、5 级 BOSS、无双大招
- 波次刷怪、连击倍率、武器解锁、掉落补给和爆炸连锁
- Web Audio 实时合成音效，无需额外音频资源

## 如何运行（本地开发）

`index.html` 通过相对路径引用 `style.css` 与 `script.js`，浏览器对 `file://` 直接打开有安全限制，建议起一个本地静态服务：

```bash
# 在项目根目录执行任意一种
python -m http.server 8000
# 或
npx serve .
```

然后浏览器访问 `http://localhost:8000/`。推荐使用 Chrome、Edge、Firefox 等现代浏览器。

## 打包上传（B 站 toy 平台）

平台要求扁平的文件结构（`index.html` 为必需入口），运行打包脚本即可生成符合要求的压缩包：

```powershell
powershell -ExecutionPolicy Bypass -File tools\package.ps1
```

产物为 `release/zombie-world.zip`，包内结构：

```text
zombie-world.zip
├── index.html        # 必需，入口文件
├── style.css
├── script.js
└── images/
    ├── logo.png      # 封面
    └── banner.jpg    # 横幅
```

> 封面/横幅可用 `python tools/make_cover.py` 重新生成，或直接替换 `images/` 下的图片为自己的设计。

## 操作方式

- 移动：`W` `A` `S` `D` 或方向键
- 射击：鼠标左键 / `空格` / `J`
- 切换武器：鼠标滚轮 / `Q` / `E` 或数字键 `1` 到 `9`
- 无双大招：`R`
- 暂停：`P` 或 `Esc`
- 鼠标模式：左键点击或按住朝指针方向攻击，右键点击或按住移动
- 触屏模式：左摇杆移动，右摇杆瞄准射击

## 文件结构

```text
.
├── index.html        # 入口页面（必需）
├── style.css         # 全部样式
├── script.js         # 全部游戏逻辑（渲染、输入、波次、敌人/BOSS AI、Web Audio 音效合成）
├── images/           # 平台封面素材
│   ├── logo.png      #   封面
│   └── banner.jpg    #   横幅
├── tools/            # 开发辅助脚本（不进 zip）
│   ├── make_cover.py #   生成封面/横幅
│   └── package.ps1   #   打包成平台 zip
├── README.md
└── .claude/launch.json   # 本地静态预览配置
```

## 说明

`index.html` / `style.css` / `script.js` 三件套即为部署所需的全部内容，`images/` 为平台展示用素材。
`tools/` 与 `release/` 仅用于本地开发与打包，不影响游戏运行。
