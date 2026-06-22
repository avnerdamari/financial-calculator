import qrcode
from PIL import Image, ImageDraw
import os

folder = r"C:\ClaudeProjects\Financial-Calculator\infographic"
src = os.path.join(folder, "flyer_ver_1.png")
out = os.path.join(folder, "flyer_ver_final.png")

img = Image.open(src).convert("RGB")
w, h = img.size
print(f"Image: {w}x{h}")

# מיקום מדויק מ-build_infographic.py: XL=int(W*0.120), YQ=555, size=260
x_left = int(w * 0.120)   # 184
y_qr   = 555
qr_size = 260

print(f"Covering old QR at ({x_left},{y_qr}) size={qr_size}")

# מחק ישן — מלא ברקע
bg = img.getpixel((x_left - 30, y_qr - 30))
draw = ImageDraw.Draw(img)
draw.rectangle([(x_left - 2, y_qr - 2), (x_left + qr_size + 2, y_qr + qr_size + 2)], fill=bg)

# ייצר ברקוד חדש
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
qr.add_data("https://www.youtube.com/watch?v=YJY0pLaUFYQ")
qr.make(fit=True)
qr_img = qr.make_image(fill_color="#1a3a8a", back_color="white").convert("RGB")
qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)
img.paste(qr_img, (x_left, y_qr))
print(f"Pasted new video QR at ({x_left},{y_qr})")

img.save(out)
print(f"Saved: {out}")
