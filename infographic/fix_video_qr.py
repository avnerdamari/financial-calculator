import qrcode
from PIL import Image
import os

folder = r"C:\ClaudeProjects\Financial-Calculator\infographic"
src = os.path.join(folder, "flyer_ver2.png")
out = os.path.join(folder, "flyer_ver3.png")

img = Image.open(src).convert("RGBA")
w, h = img.size
print(f"Image: {w}x{h}")

# צור QR חדש לסרטון
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
qr.add_data("https://www.youtube.com/watch?v=YJY0pLaUFYQ")
qr.make(fit=True)
qr_img = qr.make_image(fill_color="#1a3a8a", back_color="white").convert("RGBA")

qr_size = 260
qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)

# מיקום ברקוד שמאל (סרטון) — מחושב מהסקריפט המקורי
orig_h = 2752
x_left = int(w * 0.120)
y_qr   = int(orig_h * 0.185)
print(f"Pasting video QR at ({x_left}, {y_qr})")

# כסה את הישן ברקע לבן
from PIL import ImageDraw
draw = ImageDraw.Draw(img)
draw.rectangle([(x_left, y_qr), (x_left + qr_size, y_qr + qr_size)], fill="white")

# הדבק חדש
img.paste(qr_img, (x_left, y_qr), qr_img)

img.convert("RGB").save(out)
print(f"Saved: {out}")
