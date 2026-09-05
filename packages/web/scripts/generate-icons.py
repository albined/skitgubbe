#!/usr/bin/env python3
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
WEB_DIR = os.path.join(REPO_ROOT, "packages/web")
MASTER_SVG = os.path.join(WEB_DIR, "src/lib/assets/skitgubbe_icon.svg")
RES_DIR = os.path.join(WEB_DIR, "android/app/src/main/res")
STATIC_DIR = os.path.join(WEB_DIR, "static")
TMP_DIR = os.path.join(WEB_DIR, ".icon-temp")

os.makedirs(TMP_DIR, exist_ok=True)

# 1. Render high-res master icon (1024x1024)
full_render_png = os.path.join(TMP_DIR, "master_full_1024.png")
subprocess.run([
    "inkscape",
    f"--export-filename={full_render_png}",
    "-w", "1024",
    "-h", "1024",
    MASTER_SVG
], check=True)

# 2. Render high-res transparent foreground (card + text without background)
with open(MASTER_SVG, "r", encoding="utf-8") as f:
    svg_content = f.read()

svg_transparent = svg_content.replace('style="fill:url(#_Linear1);"', 'style="fill:none;"')
svg_transparent_path = os.path.join(TMP_DIR, "master_transparent_1024.svg")
with open(svg_transparent_path, "w", encoding="utf-8") as f:
    f.write(svg_transparent)

fg_render_png = os.path.join(TMP_DIR, "master_fg_1024.png")
subprocess.run([
    "inkscape",
    f"--export-filename={fg_render_png}",
    "-w", "1024",
    "-h", "1024",
    svg_transparent_path
], check=True)

full_img = Image.open(full_render_png).convert("RGBA")
fg_img = Image.open(fg_render_png).convert("RGBA")

BG_COLOR = (29, 70, 24, 255)  # #1d4618 / #1e4819

MIPMAP_CONFIG = {
    "mipmap-mdpi": {"legacy": 48, "foreground": 108},
    "mipmap-hdpi": {"legacy": 72, "foreground": 162},
    "mipmap-xhdpi": {"legacy": 96, "foreground": 216},
    "mipmap-xxhdpi": {"legacy": 144, "foreground": 324},
    "mipmap-xxxhdpi": {"legacy": 192, "foreground": 432},
}

def create_legacy_icon(size: int, is_round: bool) -> Image.Image:
    icon_size = int(size * 0.88)
    corner_radius = int(icon_size * 0.18) if not is_round else icon_size // 2
    
    factor = 4
    canvas_hi = Image.new("RGBA", (size * factor, size * factor), (0, 0, 0, 0))
    icon_size_hi = icon_size * factor
    corner_radius_hi = corner_radius * factor
    
    shape_mask = Image.new("L", (icon_size_hi, icon_size_hi), 0)
    d = ImageDraw.Draw(shape_mask)
    if is_round:
        d.ellipse((0, 0, icon_size_hi, icon_size_hi), fill=255)
    else:
        d.rounded_rectangle((0, 0, icon_size_hi, icon_size_hi), radius=corner_radius_hi, fill=255)
        
    scaled_full = full_img.resize((icon_size_hi, icon_size_hi), Image.Resampling.LANCZOS)
    
    if is_round:
        bg_canvas = Image.new("RGBA", (icon_size_hi, icon_size_hi), BG_COLOR)
        content_scale = 0.80
        content_sz = int(icon_size_hi * content_scale)
        scaled_content = full_img.resize((content_sz, content_sz), Image.Resampling.LANCZOS)
        offset = ((icon_size_hi - content_sz) // 2, (icon_size_hi - content_sz) // 2)
        bg_canvas.paste(scaled_content, offset, scaled_content)
        icon_body = Image.new("RGBA", (icon_size_hi, icon_size_hi), (0, 0, 0, 0))
        icon_body.paste(bg_canvas, (0, 0), shape_mask)
    else:
        icon_body = Image.new("RGBA", (icon_size_hi, icon_size_hi), (0, 0, 0, 0))
        icon_body.paste(scaled_full, (0, 0), shape_mask)

    shadow_mask = Image.new("RGBA", (size * factor, size * factor), (0, 0, 0, 0))
    shadow_offset_y = int(2 * factor)
    pos_x = (size * factor - icon_size_hi) // 2
    pos_y = (size * factor - icon_size_hi) // 2 + shadow_offset_y
    
    shadow_layer = Image.new("RGBA", (icon_size_hi, icon_size_hi), (0, 0, 0, 110))
    shadow_layer.putalpha(shape_mask)
    shadow_mask.paste(shadow_layer, (pos_x, pos_y), shadow_layer)
    shadow_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(radius=int(2.5 * factor)))
    
    canvas_hi.paste(shadow_blurred, (0, 0), shadow_blurred)
    canvas_hi.paste(icon_body, ((size * factor - icon_size_hi) // 2, (size * factor - icon_size_hi) // 2), icon_body)
    
    return canvas_hi.resize((size, size), Image.Resampling.LANCZOS)

def create_adaptive_foreground(fg_canvas_size: int) -> Image.Image:
    scale = 0.68
    content_size = int(fg_canvas_size * scale)
    scaled_fg = fg_img.resize((content_size, content_size), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGBA", (fg_canvas_size, fg_canvas_size), (0, 0, 0, 0))
    offset = ((fg_canvas_size - content_size) // 2, (fg_canvas_size - content_size) // 2)
    canvas.paste(scaled_fg, offset, scaled_fg)
    return canvas

for folder, dims in MIPMAP_CONFIG.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    legacy = create_legacy_icon(dims["legacy"], is_round=False)
    legacy.save(os.path.join(target_dir, "ic_launcher.png"), "PNG")
    
    round_icon = create_legacy_icon(dims["legacy"], is_round=True)
    round_icon.save(os.path.join(target_dir, "ic_launcher_round.png"), "PNG")
    
    fg_icon = create_adaptive_foreground(dims["foreground"])
    fg_icon.save(os.path.join(target_dir, "ic_launcher_foreground.png"), "PNG")
    
    print(f"Generated icons for {folder}")

bg_xml_path = os.path.join(RES_DIR, "values/ic_launcher_background.xml")
with open(bg_xml_path, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1e4819</color>\n</resources>\n')
print("Updated values/ic_launcher_background.xml")

full_512 = full_img.resize((512, 512), Image.Resampling.LANCZOS)
full_512.save(os.path.join(STATIC_DIR, "icon-512.png"), "PNG")

full_192 = full_img.resize((192, 192), Image.Resampling.LANCZOS)
full_192.save(os.path.join(STATIC_DIR, "icon-192.png"), "PNG")

apple_180 = full_img.resize((180, 180), Image.Resampling.LANCZOS)
apple_180.save(os.path.join(STATIC_DIR, "apple-touch-icon.png"), "PNG")

def create_maskable_pwa(size: int) -> Image.Image:
    content_sz = int(size * 0.72)
    scaled = full_img.resize((content_sz, content_sz), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), BG_COLOR)
    offset = ((size - content_sz) // 2, (size - content_sz) // 2)
    canvas.paste(scaled, offset, scaled)
    return canvas

create_maskable_pwa(512).save(os.path.join(STATIC_DIR, "icon-maskable-512.png"), "PNG")
create_maskable_pwa(192).save(os.path.join(STATIC_DIR, "icon-maskable-192.png"), "PNG")
print("Updated web static icons")

# Cleanup temp
import shutil
shutil.rmtree(TMP_DIR, ignore_errors=True)
