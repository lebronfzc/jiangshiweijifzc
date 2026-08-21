# 把演示稿真正用到的那些字，从 Google Fonts 上取来做成子集，base64 内嵌。
# 目的不是省流量，是**不再依赖 fonts.googleapis.com**：
# 场地网络取不到它，标题就掉回 Windows 自带的 SimSun——宋体横画极细，
# 66px 投到对比度本来就低的投影仪上会糊成一片。子集嵌进去之后，
# 断网、没 VPN、离线双击打开，都拿得到该有的粗笔画衬线。
#
# 用法：python make_fonts.py   （产出 fonts.css，由 build.py 内联进 deck）
import base64, io, pathlib, re, subprocess, sys, urllib.request

HERE = pathlib.Path(__file__).parent
UA_TTF = "Mozilla/4.0"   # 老 UA → Google Fonts 直接回 TTF 单文件，省得处理 unicode-range 分片
UA_MOD = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# 只做真正用到的字重：正文原来还用了 300，这里统一提到 400——
# 投影仪上更细的字重只会更难看，顺带省掉一整套 CJK 子集。
FACES = [
    ("Noto Serif SC", 700, "zwserif"),
    ("Noto Sans SC",  400, "zwsans"),
    ("Noto Sans SC",  500, "zwsans"),
    ("Noto Sans SC",  700, "zwsans"),
    ("JetBrains Mono", 500, "zwmono"),
    ("JetBrains Mono", 700, "zwmono"),
]


def fetch(url, ua):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    return urllib.request.urlopen(req, timeout=60).read()


def download(url, ua, dest):
    """字体文件十几 MB，走代理常断流，交给 curl 重试续传。"""
    subprocess.run(["curl", "-sSL", "--retry", "5", "--retry-delay", "2", "-C", "-",
                    "--connect-timeout", "20", "--max-time", "300",
                    "-A", ua, "-o", str(dest), url], check=True)
    if dest.stat().st_size < 100000:
        raise RuntimeError("下载的字体太小，八成没拿全：%s" % dest)


def charset():
    """演示稿里出现过的所有字符（含讲稿备注，按 P 会显示出来）。"""
    html = io.open(HERE / "deck.html", encoding="utf-8").read()
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", " ", text)
    import html as _h
    text = _h.unescape(text)
    # 键盘提示、数字、标点这些也得在
    text += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    text += "→←↑↓·、。，；：！？「」『』（）《》—…％·／" + "'\"()[]{}<>@#$%&*+-=/\\|~^"
    return "".join(sorted(set(c for c in text if c.strip())))


def main():
    chars = charset()
    print("演示稿用到 %d 个不同字符" % len(chars))
    (HERE / "_fontwork").mkdir(exist_ok=True)
    css_parts, total = [], 0

    for family, weight, alias in FACES:
        key = family.replace(" ", "+")
        css = fetch("https://fonts.googleapis.com/css2?family=%s:wght@%d" % (key, weight),
                    UA_TTF).decode("utf-8")
        m = re.search(r"src:\s*url\((https://[^)]+)\)", css)
        if not m:
            print("  !! %s %d 拿不到字体地址" % (family, weight)); sys.exit(1)
        raw = HERE / "_fontwork" / ("%s-%d.ttf" % (alias, weight))
        if not raw.exists() or raw.stat().st_size < 100000:
            download(m.group(1), UA_MOD, raw)

        out = HERE / "_fontwork" / ("%s-%d.woff2" % (alias, weight))
        subprocess.run([sys.executable, "-m", "fontTools.subset", str(raw),
                        "--text=" + chars, "--flavor=woff2", "--layout-features=*",
                        "--output-file=" + str(out)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        b = out.read_bytes(); total += len(b)
        print("  %-16s %d  %6.1f KB → %5.1f KB" %
              (family, weight, raw.stat().st_size / 1024, len(b) / 1024))
        css_parts.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2')}"
            % (alias, weight, base64.b64encode(b).decode()))

    (HERE / "fonts.css").write_text("\n".join(css_parts), encoding="utf-8")
    print("\nfonts.css 写好，内嵌字体共 %.0f KB（base64 后约 %.0f KB）"
          % (total / 1024, total * 4 / 3 / 1024))


if __name__ == "__main__":
    main()
