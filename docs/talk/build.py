# 把分片拼成三样东西：
#   deck.html  —— 发 Artifact 用（不带 doctype，宿主会包 head/body）
#   index.html —— 离线用的完整 HTML，双击就能放
#   讲稿.md    —— 纯文字讲稿，打印或手机上看
# 用法：python build.py
import base64, html as _html, io, json, pathlib, re

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent            # E:\zombie-world


def read(p):
    return io.open(p, encoding="utf-8").read()


parts = [read(HERE / f) for f in ("_p1_style.html", "_p2_slides.html", "_p3_script.html")]
html = "\n".join(parts)

# --- 内嵌字体子集（make_fonts.py 产出）---
# 不走 fonts.googleapis.com：场地网络取不到就会掉回 SimSun，投影上糊成一片。
fonts = HERE / "fonts.css"
if not fonts.exists():
    raise SystemExit("缺 fonts.css，先跑一次 python make_fonts.py")
html = html.replace("__FONTS_CSS__", "<style>" + read(fonts) + "</style>")

# --- 海报转 data URI ---
poster = base64.b64encode((ROOT / "images" / "poster.png").read_bytes()).decode()
html = html.replace("__POSTER__", "data:image/png;base64," + poster)

# --- 二维码（segno 生成、已做矩阵回读校验，见 qr.json）---
qr = json.loads(read(HERE / "qr.json"))


def svg(o, label):
    return ('<svg viewBox="0 0 {n} {n}" role="img" aria-label="{l}" '
            'shape-rendering="crispEdges"><path d="{d}"/></svg>').format(n=o["n"], d=o["d"], l=label)


html = html.replace("__QR_GAME__", svg(qr["game"], "游戏二维码"))
html = html.replace("__QR_SITE__", svg(qr["site"], "蛛网之上二维码"))
assert "__POSTER__" not in html and "__QR_" not in html, "还有没替换的占位符"

(HERE / "deck.html").write_text(html, encoding="utf-8")

head, _, rest = html.partition("</style>")
standalone = ('<!doctype html>\n<html lang="zh-CN" data-theme="light">\n<head>\n'
              '<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
              + head + "</style>\n</head>\n<body>\n" + rest + "\n</body>\n</html>\n")
(HERE / "index.html").write_text(standalone, encoding="utf-8")

# --- 讲稿：从幻灯片源码里抽，改了片子重跑一次就同步 ---
NL = chr(10)


def plain(x):
    x = re.sub(r"<br\s*/?>", NL, x)
    x = re.sub(r"</(li|p|div|h4|tr)>", NL, x)
    x = x.replace("</span>", "</span> ").replace("</b>", "</b> ").replace("</strong>", "</strong> ")
    x = x.replace("<li>", "- ").replace("<td", " |<td").replace("<th", " |<th")
    x = re.sub(r"<[^>]+>", "", x)
    x = _html.unescape(x).replace("\u00a0", " ")
    lines = [l.strip(" |").strip() for l in x.split(NL)]
    return re.sub(NL + "{3,}", NL * 2, NL.join(lines)).strip()


slides = re.findall(
    r'<section class="slide([^"]*)"[^>]*data-title="([^"]*)"[^>]*>(.*?)</section>', html, re.S)
assert slides, "一张片子都没抓到"

out = ["# 讲稿 · 一小时，让一屋子不写代码的人相信自己也能做出一个游戏", "",
       "> 从 `docs/talk/` 的演示稿自动导出。改了幻灯片就跑一次 `python build.py`。",
       "> 现场放 `index.html`：→ 翻页 · F 全屏 · **P 讲稿** · T 计时 · O 总览 · D 暗色。", ""]
for i, (cls, title, inner) in enumerate(slides, 1):
    note = re.search(r'<template class="note">(.*?)</template>', inner, re.S)
    body = plain(re.sub(r'<template class="note">.*?</template>', "", inner, flags=re.S))
    out.append("## %02d · %s%s" % (i, title, "　（段落页）" if "opener" in cls else ""))
    out.append("")
    if body:
        out.append("**屏幕上：**")
        out.append("")
        out.append(NL.join("> " + l if l else ">" for l in body.split(NL)))
        out.append("")
    if note:
        out.append("**要说的：**")
        out.append("")
        out.append(plain(note.group(1)))
        out.append("")

(HERE / "讲稿.md").write_text(NL.join(out), encoding="utf-8")

for f in ("deck.html", "index.html", "讲稿.md"):
    print(f, "{:,} bytes".format((HERE / f).stat().st_size))
