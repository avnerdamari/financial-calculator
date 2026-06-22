from PIL import Image

img = Image.open(r"C:\ClaudeProjects\Financial-Calculator\infographic\flyer_ver_1.png").convert("L")
w, h = img.size
print(f"{w}x{h}")

# QR code: בלוק 250x250 עם ~30-50% פיקסלים כהים (לא רקע אחיד ולא כותרת)
results = []
for y0 in range(200, 1200, 25):
    for x0 in range(30, 500, 25):
        size = 250
        if x0+size > w or y0+size > h:
            continue
        block = [img.getpixel((x, y)) for x in range(x0, x0+size) for y in range(y0, y0+size)]
        total = len(block)
        dark  = sum(1 for p in block if p < 80)   # שחור מובהק
        light = sum(1 for p in block if p > 220)  # לבן מובהק
        ratio = dark / total
        if 0.20 < ratio < 0.55 and light > 20000:
            results.append((ratio, y0, x0, dark, light))

results.sort(key=lambda r: r[4], reverse=True)
for ratio, y0, x0, dark, light in results[:8]:
    print(f"  ({x0},{y0}): dark={dark/250**2:.0%}, light={light/250**2:.0%}")
