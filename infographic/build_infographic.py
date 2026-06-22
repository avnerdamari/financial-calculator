import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

folder = r"C:\ClaudeProjects\Financial-Calculator\infographic"
orig   = Image.open(os.path.join(folder, "סימולטור_מחשבון_פיננסי_מקצועי.png")).convert("RGBA")

W         = 1536
PAGE_BG   = (245, 250, 253)
HDR_COL   = (58,  50, 168)
FRAME_COL = (185, 215, 230)

img  = Image.new("RGBA", (W, 3000), PAGE_BG + (255,))
draw = ImageDraw.Draw(img)

def fnt(name, size):
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}.ttf", size)

fH   = fnt("Arialbd", 62)
fS   = fnt("Arial",   36)
fBb  = fnt("Arialbd", 44)
fBr  = fnt("Arial",   44)
fTb  = fnt("Arialbd", 32)
fTr  = fnt("Arial",   32)
fSub = fnt("Arial",   30)
fBy  = fnt("Arial",   26)

def tw(text, f):
    bb = draw.textbbox((0, 0), text, font=f)
    return bb[2] - bb[0]

def ctr(y, text, f, col):
    draw.text(((W - tw(text, f)) // 2, y), text, font=f, fill=col)

def rgt(xr, y, text, f, col):
    draw.text((xr - tw(text, f), y), text, font=f, fill=col)

def banner(y1, text, f):
    t  = tw(text, f)
    bb = draw.textbbox((0, 0), text, font=f)
    th = bb[3] - bb[1]
    px, py = 50, 14
    x1 = (W - t) // 2 - px
    x2 = (W + t) // 2 + px
    y2 = y1 + th + py * 2
    draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=18,
                            fill=HDR_COL, outline=FRAME_COL, width=2)
    draw.text(((W - t) // 2, y1 + py), text, font=f, fill="white")
    return y2

def banner2(y1, title, subtitle, ft, fs):
    tw_t = tw(title,    ft)
    tw_s = tw(subtitle, fs)
    bbt  = draw.textbbox((0, 0), title,    font=ft)
    bbs  = draw.textbbox((0, 0), subtitle, font=fs)
    th_t = bbt[3] - bbt[1]
    th_s = bbs[3] - bbs[1]
    px, py, gap = 50, 14, 8
    box_w = max(tw_t, tw_s) + px * 2
    x1 = (W - box_w) // 2
    x2 = (W + box_w) // 2
    y2 = y1 + th_t + th_s + gap + py * 2
    draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=18,
                            fill=HDR_COL, outline=FRAME_COL, width=2)
    draw.text(((W - tw_t) // 2, y1 + py),              title,    font=ft, fill="white")
    draw.text(((W - tw_s) // 2, y1 + py + th_t + gap), subtitle, font=fs, fill="white")
    return y2

# ══════════════════════════════════════════════════════════════
# 1. HEADER
# ══════════════════════════════════════════════════════════════
draw.rectangle([(0, 0), (W, 210)], fill=HDR_COL)
ctr(40,  "סימולטור מחשבון פיננסי Casio FC-200V", fH, "white")
ctr(125, "גרסה דיגיטלית חינמית, עובד ישירות מהסלולרי ללא הורדה", fS, "white")

# ══════════════════════════════════════════════════════════════
# 2. CALCULATOR
# ══════════════════════════════════════════════════════════════
c_img = Image.open(
    r"C:\ClaudeProjects\Financial-Calculator\flyers\calculator.png"
).convert("RGBA")
cw, ch = c_img.size
th_c   = 780
tw_c   = int(cw * th_c / ch)
c_img  = c_img.resize((tw_c, th_c), Image.LANCZOS)
cx     = (W - tw_c) // 2
cy     = 230
img.paste(c_img, (cx, cy), c_img)
draw = ImageDraw.Draw(img)
draw.rectangle([(cx-3, cy-3), (cx+tw_c+3, cy+th_c+3)], outline=FRAME_COL, width=2)

# ══════════════════════════════════════════════════════════════
# 3. QR CODES
# ══════════════════════════════════════════════════════════════
def make_qr(url):
    q = qrcode.QRCode(version=1,
                      error_correction=qrcode.constants.ERROR_CORRECT_M,
                      box_size=10, border=2)
    q.add_data(url); q.make(fit=True)
    return (q.make_image(fill_color="#1a3a8a", back_color="white")
              .convert("RGBA")
              .resize((260, 260), Image.LANCZOS))

qr_sim = make_qr("https://financial-calculator-rho-orpin.vercel.app")
qr_vid = make_qr("https://youtu.be/YJY0pLaUFYQ")
XR, XL, YQ = int(W * 0.760), int(W * 0.120), 555
img.paste(qr_sim, (XR, YQ), qr_sim)
img.paste(qr_vid, (XL, YQ), qr_vid)
draw = ImageDraw.Draw(img)
rgt(XR + 250, YQ + 274, "כניסה לסימולטור", fBb, "#1a3a8a")
rgt(XL + 250, YQ + 274, "סרטון הדגמה",    fBb, "#1a3a8a")

# ══════════════════════════════════════════════════════════════
# 4. CARDS + BANNER יכולות חישוב עכשוויות
# ══════════════════════════════════════════════════════════════
CY1, CY2 = 1150, 1575
CX1, CX2 = 30,   1506

_bt     = draw.textbbox((0,0), "יכולות חישוב עכשוויות",                    font=fBb)
_bs     = draw.textbbox((0,0), "האפליקציה מתעדכנת באופן שוטף- כדאי לעקוב", font=fSub)
_ban2_h = (_bt[3]-_bt[1]) + (_bs[3]-_bs[1]) + 8 + 14*2
banner2(CY1 - _ban2_h, "יכולות חישוב עכשוויות",
        "האפליקציה מתעדכנת באופן שוטף- כדאי לעקוב",
        fBb, fSub)

cards_orig = orig.crop((0, 1270, W, 1700))
crop_w, crop_h = cards_orig.size
scale    = 0.88
new_w    = int(crop_w * scale)
new_h    = int(crop_h * scale)
cards_sm = cards_orig.resize((new_w, new_h), Image.LANCZOS)
paste_x  = (W - new_w) // 2
paste_y  = CY1 + (CY2 - CY1 - new_h) // 2
img.paste(cards_sm, (paste_x, paste_y), cards_sm)

# צביעת טקסט כהה בכחול
BLUE   = (26, 58, 138)
px_img = img.load()
for yy in range(paste_y, paste_y + new_h):
    for xx in range(paste_x, paste_x + new_w):
        r, g, b, a = img.getpixel((xx, yy))
        if r < 80 and g < 80 and b < 80 and a > 200:
            px_img[xx, yy] = (BLUE[0], BLUE[1], BLUE[2], a)

draw = ImageDraw.Draw(img)

# מחיקת קווים אנכיים מפרידים
CARD_WHITE = (255, 255, 255)
scan_y_mid = paste_y + new_h // 2
for x in range(paste_x, paste_x + new_w):
    col      = img.getpixel((x, scan_y_mid))[:3]
    darkness = sum(abs(col[i] - CARD_WHITE[i]) for i in range(3))
    if darkness > 60:
        draw.rectangle([(x, paste_y), (x, paste_y + new_h)], fill=CARD_WHITE)

draw.rounded_rectangle([(CX1, CY1), (CX2, CY2)], radius=22, outline=FRAME_COL, width=5)

# ══════════════════════════════════════════════════════════════
# 5. BANNER ליווי מקצועי + TUTOR CARD
# ══════════════════════════════════════════════════════════════
TC_Y1, TC_Y2 = 1665, 1855
_bb_tmp = draw.textbbox((0,0), "ליווי מקצועי", font=fBb)
_ban_h  = (_bb_tmp[3] - _bb_tmp[1]) + 14*2
banner(TC_Y1 - _ban_h, "ליווי מקצועי", fBb)

draw.rounded_rectangle([(85, TC_Y1), (1451, TC_Y2)], radius=22,
                        fill=(255, 255, 251), outline=FRAME_COL, width=5)
ctr(TC_Y1 + 25,  "מורה פרטי - יסודות המימון, סטטיסטיקה ומתמטיקה", fBb, "#1a3a8a")
ctr(TC_Y1 + 90,  "ליווי של אבנר דמארי הכולל שיעורים ב-Zoom, פרונטלי או בתיאום מיקום,", fTr, "#222222")
ctr(TC_Y1 + 132, "עם דגש על תרגול ממוקד והכנה לבחינות.", fTr, "#222222")

# ══════════════════════════════════════════════════════════════
# 6. BOTTOM STRIP
# ══════════════════════════════════════════════════════════════
draw.rectangle([(0, 1890), (W, 2090)], fill=HDR_COL)
ctr(1918, "לשאלות, הערות, בקשות בקשר למחשבון או קביעת שיעור פרטי", fTb, "white")
ctr(1970, "טלפון: 054-4242706  |  אימייל: avnerdamari48@gmail.com", fBy, "white")

# ══════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════
final = img.crop((0, 0, W, 2090))
out_path = os.path.join(folder, "output_v6.png")
final.convert("RGB").save(out_path)
print(f"Saved: {out_path}  ({W}x2090)")
