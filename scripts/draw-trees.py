#!/usr/bin/env python3
"""Hand-drawn 16x16 pixel trees for Garden Plot -> src/assets/trees.png.

One frame per garden bed, in bed order (frame k is planted in bed k), so
each bed grows its own kind of tree. Each tree is chosen to stand out
against its bed's colour (see --bed-k in styles.css).

Edit a shape or palette below and re-run:  python3 scripts/draw-trees.py
"""
from pathlib import Path

from PIL import Image

OUTLINE = (42, 29, 18, 255)
TRUNK = (122, 80, 46, 255)
TRUNK_DARK = (80, 50, 28, 255)
SHADOW = (42, 29, 18, 70)

# Shapes: '.' clear, O outline, H/L/M/D leaf shades light→dark, T/t trunk,
# S ground shadow, R fruit, W blossom.
ROUND = [
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
APPLE = [
    "................",
    ".....OOOOOO.....",
    "...OOHHLLMMOO...",
    "..OHHLRLMLMMDO..",
    ".OHHLLLMMMMLMDO.",
    ".OHLLMLMMRMMMDO.",
    "OLRLMMMLMMMMDDDO",
    "OLLMMMMMMMLMDMDO",
    "OLMMLMMRMMMDDRDO",
    ".OMMMMMMDMDDDDO.",
    ".ODMRMMDDDDDDDO.",
    "..ODDDDDDDDDDO..",
    "...OOOOTtOOOO...",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]
CHERRY = [
    "................",
    ".....OOOOOO.....",
    "...OOHWLLMMOO...",
    "..OHHLLLMWMMDO..",
    ".OWHLLLMMMMLMDO.",
    ".OHLLMLMWMMMMDO.",
    "OLLWMMMLMMMMDDDO",
    "OLLMMMMMMMLMDWDO",
    "OLMMLMWMMMMDDDDO",
    ".OMMMMMMDMDDWDO.",
    ".ODMMWMDDDDDDDO.",
    "..ODDDDDDDDDDO..",
    "...OOOOTtOOOO...",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]
MAPLE = [  # lobed, ragged edge
    "................",
    "....OO.OOO.OO...",
    "...OHHOLLMOMDO..",
    "..OHHLLLMLMMDO..",
    ".OOHLLLMMMMLMDOO",
    "OHHLLMLMMMMMMDDO",
    "OLLLMMMLMMMMDDDO",
    ".OLMMMMMMMLMDMO.",
    "OLMMLMMMMMMDDDDO",
    ".OMMMMMMDMDDDDO.",
    "..OMMDMDDDODDO..",
    "...OOODDDOOOO...",
    "......OTtO......",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]
PINE = [
    ".......OO.......",
    "......OLDO......",
    ".....OLMMDO.....",
    "....OLLMMDDO....",
    ".....OLMMDO.....",
    "....OLLMMMDO....",
    "...OLLMMMMDDO...",
    "..OLLMMMMMMDDO..",
    "....OLMMMMDO....",
    "...OLLMMMMMDO...",
    "..OLLMMMMMMMDO..",
    ".OLLMMMMMMMMMDO.",
    ".OOOOOOTtOOOOOO.",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]
SPRUCE = [  # fuller, droopier tiers
    ".......OO.......",
    "......OHLO......",
    ".....OHLMDO.....",
    "....OHLMMDDO....",
    "...OLLMMMMDDO...",
    "....OLMMMMDO....",
    "...OLLMMMMMDO...",
    "..OLLMMMMMMDDO..",
    ".OLLMMMMMMMMDDO.",
    "...OLMMMMMMDO...",
    "..OLLMMMMMMMDDO.",
    ".OLLMMMMMMMMMDDO",
    "OOOOOOOTtOOOOOOO",
    "......OTtO......",
    ".....SOTtOS.....",
    "....SSSSSSSS....",
]
CYPRESS = [  # tall and narrow
    ".......OO.......",
    "......OLDO......",
    "......OLMDO.....",
    ".....OLLMDO.....",
    ".....OLMMDO.....",
    ".....OLLMDDO....",
    ".....OLMMMDO....",
    ".....OLLMDDO....",
    ".....OLMMMDO....",
    ".....OLMMDDO....",
    ".....OLMMDDO....",
    "......OMDDO.....",
    ".......OTO......",
    ".......OtO......",
    "......SOtOS.....",
    ".....SSSSSSS....",
]


def pal(h, l, m, d, extra=None):
    p = {"H": h, "L": l, "M": m, "D": d}
    p.update(extra or {})
    return {k: (*bytes.fromhex(v[1:]), 255) for k, v in p.items()}


# Frame k = bed k. Comments: bed colour -> tree.
TREES = [
    ("maple", MAPLE, pal("#ffd27a", "#f29a3a", "#d9622b", "#a83a22")),  # sage
    ("pine", PINE, pal("#7fa860", "#4f7f3c", "#2f5a2c", "#1e3d22")),  # wheat
    ("oak", ROUND, pal("#bee478", "#80be4a", "#4f8a2e", "#2f5d2a")),  # terracotta
    ("spruce", SPRUCE, pal("#b8d8d0", "#7fb0a8", "#4f7f86", "#2f5560")),  # clay
    ("aspen", ROUND, pal("#fff2a0", "#f2d24a", "#d9a92b", "#a8781e")),  # heather
    ("cherry", CHERRY, pal("#ffe4ec", "#f7b8cc", "#e88aa8", "#c05a80", {"W": "#ffffff"})),  # slate
    ("copper beech", ROUND, pal("#e09a8a", "#b0585a", "#7f3242", "#53202c")),  # eucalyptus
    ("cypress", CYPRESS, pal("#6f9a58", "#4a7a3a", "#2f5a2c", "#1c3a20")),  # ochre
    ("apple", APPLE, pal("#bee478", "#80be4a", "#4f8a2e", "#2f5d2a", {"R": "#d8402f"})),  # stone
]

sheet = Image.new("RGBA", (16 * len(TREES), 16))
for k, (name, shape, colours) in enumerate(TREES):
    assert len(shape) == 16 and all(len(r) == 16 for r in shape), name
    lookup = {".": (0, 0, 0, 0), "O": OUTLINE, "T": TRUNK, "t": TRUNK_DARK, "S": SHADOW, **colours}
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            sheet.putpixel((16 * k + x, y), lookup[ch])
out = Path(__file__).resolve().parent.parent / "src" / "assets" / "trees.png"
sheet.save(out)
print(f"wrote {out}: {', '.join(n for n, _, _ in TREES)}")
