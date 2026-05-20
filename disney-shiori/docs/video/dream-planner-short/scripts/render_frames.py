from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math
import textwrap

ROOT = Path("/Users/uesugikenshiro/開発/disney-shiori/docs/video/dream-planner-short")
FRAMES = ROOT / "frames"
FRAMES.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1920
FPS = 24
DURATION = 22
TOTAL = FPS * DURATION

FONT_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_HEAVY = "/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc"
FONT_REG = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"

PURPLE = (108, 92, 231)
PURPLE_DARK = (72, 60, 190)
PURPLE_LIGHT = (244, 240, 255)
PINK = (255, 128, 188)
BLUE = (75, 190, 232)
INK = (35, 48, 66)
MUTED = (92, 105, 123)
WHITE = (255, 255, 255)


def font(size, bold=False):
    return ImageFont.truetype(FONT_HEAVY if bold else FONT_REG, size)


def ease(t):
    t = max(0, min(1, t))
    return 1 - pow(1 - t, 3)


def lerp(a, b, t):
    return a + (b - a) * t


def rounded(draw, xy, r, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def draw_wrapped(draw, text, xy, fnt, fill, max_width, line_gap=10, anchor=None):
    x, y = xy
    lines = []
    for raw in text.split("\n"):
        line = ""
        for ch in raw:
            trial = line + ch
            if draw.textbbox((0, 0), trial, font=fnt)[2] <= max_width:
                line = trial
            else:
                if line:
                    lines.append(line)
                line = ch
        if line:
            lines.append(line)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill, anchor=anchor)
        y += fnt.size + line_gap
    return y


def shadow_card(base, box, radius=40, fill=WHITE, shadow=(105, 82, 190, 32), offset=(0, 18), blur=22):
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((x1 + offset[0], y1 + offset[1], x2 + offset[0], y2 + offset[1]), radius=radius, fill=shadow)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=fill)


def gradient_bg():
    img = Image.new("RGBA", (W, H), WHITE)
    pix = img.load()
    for y in range(H):
        t = y / H
        r = int(252 * (1 - t) + 232 * t)
        g = int(248 * (1 - t) + 245 * t)
        b = int(255 * (1 - t) + 255 * t)
        for x in range(W):
            pix[x, y] = (r, g, b, 255)
    d = ImageDraw.Draw(img)
    d.ellipse((650, -160, 1250, 440), fill=(130, 185, 255, 62))
    d.ellipse((-220, 1120, 300, 1650), fill=(255, 165, 210, 54))
    return img


def phone_frame(base, x, y, w, h, screen_kind, progress=1):
    d = ImageDraw.Draw(base)
    shadow_card(base, (x, y, x + w, y + h), 54, WHITE, shadow=(80, 65, 150, 35), offset=(0, 20), blur=24)
    rounded(d, (x + 20, y + 20, x + w - 20, y + h - 20), 42, (250, 248, 255), outline=(220, 212, 255), width=2)
    d.rounded_rectangle((x + w // 2 - 72, y + 28, x + w // 2 + 72, y + 42), radius=8, fill=(224, 219, 244))
    sx, sy = x + 42, y + 70
    sw, sh = w - 84, h - 120
    if screen_kind == "home":
        d.rounded_rectangle((sx, sy, sx + sw, sy + 86), radius=28, fill=WHITE, outline=(220, 212, 255), width=2)
        d.text((sx + 28, sy + 24), "Dream Schedule Planner", font=font(24, True), fill=PURPLE)
        cy = sy + 125
        d.rounded_rectangle((sx, cy, sx + sw, cy + 430), radius=32, fill=WHITE, outline=(220, 212, 255), width=2)
        d.text((sx + 28, cy + 26), "5月 2026", font=font(28, True), fill=INK)
        days = ["日", "月", "火", "水", "木", "金", "土"]
        cellw = sw // 7
        for i, day in enumerate(days):
            color = (210, 45, 65) if i == 0 else (35, 95, 210) if i == 6 else MUTED
            d.text((sx + i * cellw + cellw / 2, cy + 86), day, font=font(18, True), fill=color, anchor="mm")
        n = 1
        for row in range(5):
            for col in range(7):
                px = sx + col * cellw + 4
                py = cy + 120 + row * 58
                fill = (252, 247, 255) if n != 20 else (108, 92, 231)
                txt = WHITE if n == 20 else INK
                d.rounded_rectangle((px, py, px + cellw - 8, py + 48), radius=14, fill=fill)
                d.text((px + cellw / 2 - 4, py + 24), str(n), font=font(20, True), fill=txt, anchor="mm")
                n += 1
        my = cy + 466
        d.rounded_rectangle((sx, my, sx + sw, my + 220), radius=28, fill=WHITE, outline=(220, 212, 255), width=2)
        d.text((sx + 28, my + 28), "入園後やることメモ", font=font(25, True), fill=INK)
        tasks = ["DPA", "スタンバイパス", "レストラン予約"]
        for i, t in enumerate(tasks):
            yy = my + 78 + i * 44
            d.ellipse((sx + 28, yy, sx + 60, yy + 32), fill=PURPLE_LIGHT)
            d.text((sx + 44, yy + 16), str(i + 1), font=font(16, True), fill=PURPLE, anchor="mm")
            d.text((sx + 74, yy + 2), t, font=font(18, True), fill=INK)
    elif screen_kind == "select":
        d.text((sx + sw / 2, sy + 55), "見たいショーを\n選択してください", font=font(36, True), fill=PURPLE, anchor="mm", align="center")
        shows = ["ハーモニー・イン・カラー", "Reach for the Stars", "エレクトリカルパレード", "スカイ・フル・オブ・カラーズ"]
        for i, show in enumerate(shows):
            yy = sy + 150 + i * 112
            d.rounded_rectangle((sx, yy, sx + sw, yy + 88), radius=24, fill=WHITE, outline=(220, 212, 255), width=2)
            d.ellipse((sx + 24, yy + 26, sx + 58, yy + 60), fill=PURPLE if i < 3 else (238, 235, 255))
            d.text((sx + 76, yy + 18), show, font=font(20, True), fill=INK)
            d.rounded_rectangle((sx + sw - 104, yy + 25, sx + sw - 24, yy + 63), radius=18, fill=PURPLE_LIGHT)
            d.text((sx + sw - 64, yy + 44), "詳細", font=font(15, True), fill=PURPLE, anchor="mm")
        d.rounded_rectangle((sx + sw - 160, sy + sh - 90, sx + sw, sy + sh - 30), radius=24, fill=PURPLE)
        d.text((sx + sw - 80, sy + sh - 60), "次へ", font=font(20, True), fill=WHITE, anchor="mm")
    elif screen_kind == "timeline":
        d.text((sx + sw / 2, sy + 50), "ショーの時間を\n選択してください", font=font(32, True), fill=PURPLE, anchor="mm", align="center")
        start_y = sy + 132
        times = ["09:00", "10:55", "13:00", "15:00", "19:15", "20:15"]
        for i, t in enumerate(times):
            yy = start_y + i * 95
            d.text((sx + 8, yy), t, font=font(17, True), fill=MUTED)
            d.line((sx + 70, yy + 12, sx + sw, yy + 12), fill=(226, 226, 238), width=2)
        events = [(1, "マジカルミュージック", "10:55-11:20"), (2, "ハーモニー・イン・カラー", "13:00-13:45"), (3, "スウィーツフルタイム", "15:00-15:35"), (4, "エレクトリカルパレード", "19:15-20:00")]
        for idx, name, tm in events:
            yy = start_y + idx * 95 - 16
            d.rounded_rectangle((sx + 92, yy, sx + sw - 14, yy + 74), radius=22, fill=WHITE, outline=PURPLE, width=3)
            d.text((sx + 112, yy + 12), tm, font=font(18, True), fill=PURPLE)
            d.text((sx + 112, yy + 40), name, font=font(18, True), fill=INK)
        d.rounded_rectangle((sx + sw - 160, sy + sh - 90, sx + sw, sy + sh - 30), radius=24, fill=PURPLE)
        d.text((sx + sw - 80, sy + sh - 60), "次へ", font=font(20, True), fill=WHITE, anchor="mm")
    else:
        d.text((sx + sw / 2, sy + 76), "予定の作成が\n完了しました", font=font(34, True), fill=PURPLE, anchor="mm", align="center")
        d.rounded_rectangle((sx + 70, sy + 160, sx + sw - 70, sy + 222), radius=26, fill=PURPLE)
        d.text((sx + sw / 2, sy + 191), "画像を保存する", font=font(20, True), fill=WHITE, anchor="mm")
        rows = [("09:00 - 10:55", "予定なし"), ("10:55 - 11:20", "マジカルミュージックワールド"), ("13:00 - 13:45", "ハーモニー・イン・カラー"), ("19:15 - 20:00", "エレクトリカルパレード")]
        yy = sy + 260
        for i, (tm, title) in enumerate(rows):
            c = (230, 224, 255) if title == "予定なし" else WHITE
            d.rounded_rectangle((sx, yy, sx + sw, yy + 86), radius=22, fill=c, outline=(220, 212, 255), width=2)
            d.ellipse((sx + 22, yy + 28, sx + 48, yy + 54), fill=PURPLE if title != "予定なし" else (185, 170, 245))
            d.text((sx + 66, yy + 16), tm, font=font(18, True), fill=INK)
            d.text((sx + 66, yy + 46), title, font=font(17, True), fill=INK)
            yy += 105 if title != "予定なし" else 74


def draw_scene(base, scene, local_t, global_t):
    d = ImageDraw.Draw(base)
    # top small pill
    d.rounded_rectangle((70, 58, 410, 112), radius=27, fill=WHITE)
    d.text((94, 72), "夢のしおり", font=font(28, True), fill=PURPLE)
    if scene == 0:
        title = "ショーの予定、\nかんたんに決めたい？"
        subtitle = "Dream Schedule Plannerなら\n時間を見ながら1日の予定を作れます"
        d.text((82, 230), title, font=font(74, True), fill=INK, spacing=14)
        draw_wrapped(d, subtitle, (86, 460), font(37, True), MUTED, 850, 12)
        phone_frame(base, 270, 705, 540, 930, "home", local_t)
    elif scene == 1:
        d.text((82, 182), "まずは日付を選ぶ", font=font(65, True), fill=INK)
        d.text((86, 270), "ホームのカレンダーから\n行く日をタップ", font=font(38, True), fill=MUTED, spacing=10)
        phone_frame(base, 250, 485, 580, 1060, "home", local_t)
        d.rounded_rectangle((120, 1580, 960, 1685), radius=40, fill=WHITE)
        d.text((540, 1632), "予定がある日もホームで確認", font=font(34, True), fill=PURPLE, anchor="mm")
    elif scene == 2:
        d.text((82, 180), "見たいショーを選択", font=font(64, True), fill=INK)
        d.text((86, 270), "詳細ボタンで内容や場所も確認できます", font=font(34, True), fill=MUTED)
        phone_frame(base, 250, 440, 580, 1110, "select", local_t)
    elif scene == 3:
        d.text((82, 174), "自動 or 手動で作成", font=font(62, True), fill=INK)
        d.text((86, 264), "自動なら、選んだショーを\n1回ずつ見られる候補を作成", font=font(35, True), fill=MUTED, spacing=10)
        shadow_card(base, (110, 600, 970, 860), 42, WHITE)
        d.rounded_rectangle((152, 650, 506, 810), radius=36, fill=PURPLE_LIGHT, outline=(210, 200, 255), width=3)
        d.text((329, 700), "自動で作成", font=font(38, True), fill=PURPLE, anchor="mm")
        d.text((329, 756), "おすすめ", font=font(26, True), fill=MUTED, anchor="mm")
        d.rounded_rectangle((574, 650, 928, 810), radius=36, fill=(248, 249, 252), outline=(220, 224, 232), width=3)
        d.text((751, 700), "手動で作成", font=font(38, True), fill=INK, anchor="mm")
        d.text((751, 756), "自分で選ぶ", font=font(26, True), fill=MUTED, anchor="mm")
        phone_frame(base, 270, 920, 540, 740, "timeline", local_t)
    elif scene == 4:
        d.text((82, 168), "時間の重なりを確認", font=font(62, True), fill=INK)
        d.text((86, 258), "ショーとショーの間の時間も見えるので\n空き時間に食事や休憩を追加できます", font=font(32, True), fill=MUTED, spacing=10)
        phone_frame(base, 235, 420, 610, 1160, "timeline", local_t)
    else:
        d.text((82, 160), "完成したら画像保存", font=font(62, True), fill=INK)
        d.text((86, 250), "LINE共有や当日の確認に便利。\n入園後やることメモも一緒に使えます", font=font(33, True), fill=MUTED, spacing=10)
        phone_frame(base, 260, 450, 560, 1070, "complete", local_t)
        d.rounded_rectangle((100, 1580, 980, 1700), radius=42, fill=PURPLE)
        d.text((540, 1640), "Dream Schedule Planner", font=font(40, True), fill=WHITE, anchor="mm")


def make_frame(frame_no):
    t = frame_no / FPS
    scene = min(5, int(t // (DURATION / 6)))
    scene_len = DURATION / 6
    local = (t - scene * scene_len) / scene_len
    img = gradient_bg()
    # subtle scene entrance
    content = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_scene(content, scene, local, t)
    offset = int(lerp(50, 0, ease(min(local / 0.22, 1))))
    opacity = int(255 * ease(min(local / 0.22, 1)))
    shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shifted.alpha_composite(content, (0, offset))
    if opacity < 255:
        alpha = shifted.getchannel("A").point(lambda p: p * opacity // 255)
        shifted.putalpha(alpha)
    img.alpha_composite(shifted)
    # progress bar
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((70, 1810, 1010, 1830), radius=10, fill=(225, 218, 250))
    d.rounded_rectangle((70, 1810, int(70 + 940 * ((frame_no + 1) / TOTAL)), 1830), radius=10, fill=PURPLE)
    return img.convert("RGB")


for i in range(TOTAL):
    img = make_frame(i)
    img.save(FRAMES / f"frame_{i:04d}.jpg", quality=88, subsampling=1)
    if i % 48 == 0:
        print(f"frame {i}/{TOTAL}")

print(f"generated {TOTAL} frames in {FRAMES}")

