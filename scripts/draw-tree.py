#!/usr/bin/env python3
"""Hand-drawn 16x16 pixel tree for Garden Plot (src/assets/tree.png).

Edit the rows below to change it: each character is one pixel.
Replace the output with real art any time; the game just loads the PNG.
"""
from pathlib import Path
from PIL import Image

PALETTE = {
    ".": (0, 0, 0, 0),
    "O": (42, 29, 18, 255),     # outline
    "H": (190, 228, 120, 255),  # highlight
    "L": (128, 190, 74, 255),   # light leaves
    "M": (79, 138, 46, 255),    # leaves
    "D": (47, 93, 42, 255),     # shaded leaves
    "T": (122, 80, 46, 255),    # trunk
    "t": (80, 50, 28, 255),     # trunk shade
    "S": (42, 29, 18, 70),      # ground shadow
}

TREE = [
    "................",
    ".....OOOOOO.....",
    "...OOHHLLMMOO...",
    "..OHHLLLMLMMDO..",
    ".OHHLLLMMMMLMDO.",
    ".OHLLMLMMMMMMDO.",
    "OLLLMMMLMMMMDDDO",
    "OLLMMMMMMMLMDMDO",
    "OLMMLMMMMMMDDDDO",
    ".OMMMMMMDMDDDDO.",
    ".ODMMMMDDDDDDDO.",
    "..ODDDDDDDDDDO..",
    "...OOOOTtOOOO...",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]

assert all(len(r) == 16 for r in TREE) and len(TREE) == 16
img = Image.new("RGBA", (16, 16))
for y, row in enumerate(TREE):
    for x, ch in enumerate(row):
        img.putpixel((x, y), PALETTE[ch])
out = Path(__file__).resolve().parent.parent / "src" / "assets" / "tree.png"
img.save(out)
print(f"wrote {out}")
