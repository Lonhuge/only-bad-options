#!/usr/bin/env python3
"""Replace the off-white product-photo background with pure #FFFFFF,
keeping the product and its contact shadow. Works by flood-filling only the
border-connected 'background-like' region (bright + low saturation), so
interior white areas of the product and the darker shadow are left alone."""
import sys, os, numpy as np
from PIL import Image

# product images only (NOT hero.jpg)
FILES = ["shirt-easy","shirt-dino","vinyl-lp","vinyl-ep","cd","schal","cap","poster-asl","poster-luxor"]
IMG = os.path.join(os.path.dirname(__file__), "images")
ORIG = os.path.join(IMG, "_orig")
os.makedirs(ORIG, exist_ok=True)

def luminance(a):
    return 0.299*a[...,0] + 0.587*a[...,1] + 0.114*a[...,2]

def reconstruct(seed, cand, max_iter=6000):
    """morphological reconstruction: grow seed within cand (8-connected)."""
    cur = seed & cand
    for _ in range(max_iter):
        d = cur.copy()
        d[1:,:]  |= cur[:-1,:]
        d[:-1,:] |= cur[1:,:]
        d[:,1:]  |= cur[:,:-1]
        d[:,:-1] |= cur[:,1:]
        d[1:,1:]   |= cur[:-1,:-1]
        d[:-1,:-1] |= cur[1:,1:]
        d[1:,:-1]  |= cur[:-1,1:]
        d[:-1,1:]  |= cur[1:,:-1]
        d &= cand
        if np.array_equal(d, cur):
            break
        cur = d
    return cur

def process(name, lum_drop=30, sat_pad=10, sat_min=26):
    src = os.path.join(IMG, name + ".jpg")
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    lum = luminance(a)
    sat = a.max(axis=2) - a.min(axis=2)

    # sample the background from a border frame
    bw = max(4, min(a.shape[:2])//40)
    frame = np.zeros(a.shape[:2], bool)
    frame[:bw,:]=frame[-bw:,:]=frame[:,:bw]=frame[:,-bw:]=True
    bg_lum = float(np.median(lum[frame]))
    bg_sat = float(np.median(sat[frame]))

    L = bg_lum - lum_drop
    S = max(bg_sat + sat_pad, sat_min)
    cand = (lum >= L) & (sat <= S)

    seed = np.zeros(a.shape[:2], bool)
    seed[0,:]=seed[-1,:]=seed[:,0]=seed[:,-1]=True
    bg = reconstruct(seed, cand)

    out = a.copy().astype(np.uint8)
    out[bg] = (255,255,255)

    # de-fringe: pixels next to the new white that are still near-bg get pulled
    # to white too, killing the off-white anti-alias halo around the product.
    grew = bg.copy()
    grew[1:,:] |= bg[:-1,:]; grew[:-1,:] |= bg[1:,:]
    grew[:,1:] |= bg[:,:-1]; grew[:,:-1] |= bg[:,1:]
    halo = grew & (~bg) & (lum >= bg_lum - 14) & (sat <= S + 6)
    out[halo] = (255,255,255)

    pct = 100.0*bg.mean()
    if not os.path.exists(os.path.join(ORIG, name+".jpg")):
        im.save(os.path.join(ORIG, name+".jpg"), quality=92)
    Image.fromarray(out).save(src, quality=90)
    print(f"{name:12s} bg_lum={bg_lum:5.1f} sat={bg_sat:4.1f}  L={L:5.1f} S={S:4.1f}  filled={pct:4.1f}%")

if __name__ == "__main__":
    # optional per-file overrides passed as name:lum_drop
    overrides = {}
    for arg in sys.argv[1:]:
        k,v = arg.split(":"); overrides[k]=int(v)
    for f in FILES:
        process(f, lum_drop=overrides.get(f,30))
