import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

folder = r"C:\ClaudeProjects\Financial-Calculator\infographic"
img_path = os.path.join(folder, "סימולטור_מחשבון_פיננסי_מקצועי.png")
img = Image.open(img_path).convert("RGBA")
w, h = img.size   # 1536 x 2752
print(f"Image: {w}x{h}")
draw = ImageDraw.Draw(img)

# --- 1. הסרת קטע "גישה לסימולטור הדרכה" ---
banner_y1 = int(h * 0.555)   # 1527
banner_y2 = int(h * 0.795)   # 2188
bottom_part = img.crop((0, banner_y2, w, h))
img.paste(bottom_part, (0, banner_y1))
draw.rectangle([(0, banner_y1 + (h - banner_y2)), (w, h)], fill="white")

# --- 1b. הזזת קטע ליווי מקצועי 40px למטה ---
liat_shift = 15
liat_section = img.crop((0, banner_y1, w, h))
page_bg_top = img.getpixel((50, banner_y1 - 100))[:3]
draw.rectangle([(0, banner_y1), (w, banner_y1 + liat_shift)], fill=page_bg_top)
img.paste(liat_section, (0, banner_y1 + liat_shift))

# --- 2. הסרת לוגו NotebookLM (צבע תואם) ---
notebooklm_y1 = int(h * 0.750)
notebooklm_y2 = int(h * 0.785)
footer_color = img.getpixel((100, notebooklm_y1))[:3]
draw.rectangle([(int(w*0.55), notebooklm_y1), (w, notebooklm_y2)], fill=footer_color)
draw = ImageDraw.Draw(img)

# --- 3. פונטים ---
try:
    font_heading    = ImageFont.truetype("C:/Windows/Fonts/Arialbd.ttf", 72)
    font_subhead    = ImageFont.truetype("C:/Windows/Fonts/Arial.ttf",   42)
    font_banner     = ImageFont.truetype("C:/Windows/Fonts/Arialbd.ttf", 50)
    font_banner_reg = ImageFont.truetype("C:/Windows/Fonts/Arial.ttf",   50)
    font_title      = ImageFont.truetype("C:/Windows/Fonts/Arialbd.ttf", 40)
    font_title_reg  = ImageFont.truetype("C:/Windows/Fonts/Arial.ttf",   40)
    font_sub        = ImageFont.truetype("C:/Windows/Fonts/Arialbd.ttf", 36)
    font_body       = ImageFont.truetype("C:/Windows/Fonts/Arial.ttf",   32)
    font_text       = ImageFont.truetype("C:/Windows/Fonts/Arial.ttf",   30)
except:
    font_heading = font_subhead = font_banner = font_banner_reg = font_title = font_title_reg = font_sub = font_body = font_text = ImageFont.load_default()

# --- 3b. כותרת עם רקע כחול-סגול וטקסט לבן ---
header_color = (58, 50, 168)   # כחול-סגול
header_h = 210
draw.rectangle([(0, 0), (w, header_h)], fill=header_color)
title_text = "סימולטור מחשבון פיננסי Casio FC-200V"
bbox = draw.textbbox((0, 0), title_text, font=font_heading)
tw = bbox[2] - bbox[0]
draw.text(((w - tw) // 2, 25), title_text, font=font_heading, fill="white")
sub_text = "גרסה דיגיטלית חינמית, עובד ישירות מהסלולרי ללא הורדה"
sbbox = draw.textbbox((0, 0), sub_text, font=font_subhead)
sw = sbbox[2] - sbbox[0]
draw.text(((w - sw) // 2, 118), sub_text, font=font_subhead, fill="white")

# --- 4. החלפת תמונת המחשבון ---
page_bg = img.getpixel((50, 300))[:3]
print(f"Page BG: {page_bg}")
# מחק את האיור הישן — מתחיל ב-y=160 (הכותרת מסתיימת ב-y=155)
draw.rectangle([(380, 210), (1156, 1155)], fill=page_bg)

calc_path = r"C:\ClaudeProjects\Financial-Calculator\flyers\calculator.png"
if os.path.exists(calc_path):
    calc_img = Image.open(calc_path).convert("RGBA")
    cw, ch = calc_img.size
    print(f"calculator.png: {cw}x{ch}")
    # גובה יעד: 780px
    target_h = 780
    target_w = int(cw * (target_h / ch))
    calc_img = calc_img.resize((target_w, target_h), Image.LANCZOS)
    calc_x = (w - target_w) // 2
    calc_y = 295
    img.paste(calc_img, (calc_x, calc_y), calc_img)
    print(f"Pasted calculator: {target_w}x{target_h} at ({calc_x},{calc_y})")
    draw.rectangle([(calc_x-3, calc_y-3), (calc_x+target_w+3, calc_y+target_h+3)],
                   outline=(185, 215, 230), width=2)
else:
    print("WARNING: calculator.png not found!")

draw = ImageDraw.Draw(img)

# --- 5. מחיקת ישן + בנייה מחדש של באנר ומסגרת ---
banner_dark_color = (23, 59, 81)
print(f"Banner color: {banner_dark_color}")
draw.rectangle([(0, 1155), (w, 1310)], fill=page_bg)

# באנר "יכולות חישוב עכשוויות" — סגנון זהה ל"ליווי מקצועי"
text_new = "יכולות חישוב עכשוויות"
bbox = draw.textbbox((0, 0), text_new, font=font_banner)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
pad_x, pad_y = 50, 14
bx1 = (w - tw) // 2 - pad_x
bx2 = (w + tw) // 2 + pad_x
by1 = 1212
by2 = by1 + th + pad_y * 2
draw.rounded_rectangle([(bx1, by1), (bx2, by2)], radius=18, fill=header_color, outline=(185, 215, 230), width=2)
draw.text(((w - tw) // 2, by1 + pad_y), text_new, font=font_banner, fill="white")

# מחיקת קווים שחורים ישנים מהמקור
draw.rectangle([(0,    1155), (82,   1560)], fill=page_bg)   # קו אנכי שמאל (x=72)
draw.rectangle([(1454, 1155), (w,    1560)], fill=page_bg)   # קו אנכי ימין
draw.rectangle([(55,   1548), (1481, 1580)], fill=page_bg)   # קו אופקי תחתון

# מסגרת סביב הכרטיסים
draw.rectangle([(55, 1295), (1481, 1547)], outline=(185, 215, 230), width=3)

# --- 6. שכתוב מחדש קטע "ליווי מקצועי" ---
liat_bg = img.getpixel((1420, 1700))[:3]
print(f"Liat BG: {liat_bg}")
draw.rectangle([(85, 1655), (1451, 1895)], fill=liat_bg)

def rtl_center(draw, y, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, y), text, font=font, fill=fill)

def rtl_right(draw, x_right, y, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((x_right - tw, y), text, font=font, fill=fill)

content_right = 1420
rtl_center(draw, 1708, "מורה פרטי – מימון וסטטיסטיקה", font_banner_reg, "#1a3a8a")
rtl_right(draw, content_right, 1774,
          "ליווי של אבנר דמארי הכולל שיעורים ב-Zoom, פרונטלי או בתיאום מיקום,",
          font_title_reg, "#222222")
rtl_right(draw, content_right, 1826,
          "עם דגש על תרגול ממוקד והכנה לבחינות.",
          font_title_reg, "#222222")

# --- 7. QR codes ---
qr1 = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
qr1.add_data("https://financial-calculator-rho-orpin.vercel.app")
qr1.make(fit=True)
qr1_img = qr1.make_image(fill_color="#1a3a8a", back_color="white").convert("RGBA")

qr2 = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
qr2.add_data("https://www.youtube.com/watch?v=YJY0pLaUFYQ")
qr2.make(fit=True)
qr2_img = qr2.make_image(fill_color="#1a3a8a", back_color="white").convert("RGBA")

qr_size = 260
qr1_img = qr1_img.resize((qr_size, qr_size), Image.LANCZOS)
qr2_img = qr2_img.resize((qr_size, qr_size), Image.LANCZOS)

x_right = int(w * 0.760)
x_left  = int(w * 0.120)
y_qr    = int(h * 0.185)

img.paste(qr1_img, (x_right, y_qr), qr1_img)
img.paste(qr2_img, (x_left,  y_qr), qr2_img)

draw = ImageDraw.Draw(img)

# כיתובי QR
r_edge = x_right + qr_size
ty = y_qr + qr_size + 14

rtl_right(draw, r_edge, ty, "כניסה לסימולטור", font_title, "#1a3a8a")

l_edge = x_left + qr_size
ty2 = y_qr + qr_size + 14
rtl_right(draw, l_edge, ty2, "סרטון הדגמה", font_title, "#1a3a8a")

# --- 8. חיתוך בתחתית (ללא פוטר) ---
content_end = banner_y1 + (h - banner_y2)
draw = ImageDraw.Draw(img)
draw.rectangle([(0, content_end), (w, h)], fill=page_bg)

# סרוק מ-y=1900 למטה — מצא היכן הפוטר הכחול מתחיל
page_bg_color = img.getpixel((50, 50))[:3]
footer_start = content_end
for scan_y in range(1900, content_end):
    px = img.getpixel((768, scan_y))[:3]
    if sum(abs(px[i] - page_bg_color[i]) for i in range(3)) > 40:
        footer_start = scan_y
        break
print(f"footer_start={footer_start}, content_end={content_end}")
draw.rectangle([(0, footer_start), (w, content_end)], fill=page_bg)
strip_h = 210
strip_color = (58, 50, 168)
new_h = footer_start + 20 + strip_h
draw.rectangle([(0, footer_start + 20), (w, new_h)], fill=strip_color)
img = img.crop((0, 0, w, new_h))

out_path = os.path.join(folder, "flyer_ver2.png")
img.convert("RGB").save(out_path)
print(f"Saved: {out_path}, new_h={new_h}")
