#!/usr/bin/env python3
"""Objective speed-blur check: mean |gradient| in center vs periphery rings.

Compares a blur-ENGAGED frame against a blur-OFF frame of the same scene:
the periphery ring must lose edge energy (smeared) while the center window
stays sharp. Usage: edge_energy.py engaged.png off.png
"""
import sys
from PIL import Image
import numpy as np


def energy(img: Image.Image) -> dict:
    g = np.asarray(img.convert("L"), dtype=np.float32)
    dx = np.abs(np.diff(g, axis=1))[:-1, :]
    dy = np.abs(np.diff(g, axis=0))[:, :-1]
    grad = dx + dy
    h, w = grad.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = (w - 1) / 2, (h - 1) / 2
    r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2)
    return {
        "center": float(grad[(r < 0.35)].mean()),
        "mid": float(grad[(r >= 0.35) & (r < 0.7)].mean()),
        "periphery": float(grad[(r >= 0.7) & (r <= 1.0)].mean()),
    }


def main():
    on = energy(Image.open(sys.argv[1]))
    off = energy(Image.open(sys.argv[2]))
    print(f"{'ring':<12}{'OFF(no blur)':>14}{'ON(blur)':>12}{'delta%':>10}")
    for k in ("center", "mid", "periphery"):
        d = (on[k] / off[k] - 1) * 100 if off[k] else 0
        print(f"{k:<12}{off[k]:>14.2f}{on[k]:>12.2f}{d:>9.1f}%")


if __name__ == "__main__":
    main()
