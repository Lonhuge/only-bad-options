#!/usr/bin/env python3
"""Isolate product on pure white — remove background AND shadow — then
normalize every product to the same footprint. Flood-fills the border-connected
'background or shadow' region (low saturation + light enough), which stops at
the real product edge; enclosed light product areas (white shirt, cream cover,
white disc) are kept because they aren't border-connected."""
import numpy as np, os
from PIL import Image

IMG = os.path.join(os.path.dirname(__file__), "images")
SRC = os.path.join(IMG, "_orig")
S = 1000; TARGET = 0.90

# per-image (Ssat = max saturation counted as neutral bg/shadow, Llo = darkest gray still bg/shadow)
P = {
    "shirt-easy":  dict(Ssat=22, Llo=135),
    "shirt-dino":  dict(Ssat=22, Llo=228),   # white shirt: only eat near-white
    "vinyl-lp":    dict(Ssat=20, Llo=150),
    "vinyl-ep":    dict(Ssat=9,  Llo=150),   # cream cover: tight saturation so cover is kept
    "cd":          dict(Ssat=12, Llo=150),
    "schal":       dict(Ssat=22, Llo=150),
    "cap":         dict(Ssat=22, Llo=150),
    "poster-asl":  dict(Ssat=22, Llo=150),
    "poster-luxor":dict(Ssat=22, Llo=150),
}
ORDER = list(P.keys())

def reconstruct(seed, cand, max_iter=8000):
    cur = seed & cand
    for _ in range(max_iter):
        d = cur.copy()
        d[1:,:]|=cur[:-1,:]; d[:-1,:]|=cur[1:,:]; d[:,1:]|=cur[:,:-1]; d[:,:-1]|=cur[:,1:]
        d[1:,1:]|=cur[:-1,:-1]; d[:-1,:-1]|=cur[1:,1:]; d[1:,:-1]|=cur[:-1,1:]; d[:-1,1:]|=cur[1:,:-1]
        d &= cand
        if np.array_equal(d,cur): break
        cur = d
    return cur

def process(name, Ssat, Llo):
    im = Image.open(os.path.join(SRC, name+".jpg")).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    lum = 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
    sat = a.max(2)-a.min(2)
    cand = (sat <= Ssat) & (lum >= Llo)
    seed = np.zeros(a.shape[:2], bool); seed[0,:]=seed[-1,:]=seed[:,0]=seed[:,-1]=True
    bg = reconstruct(seed, cand)
    out = a.astype(np.uint8).copy(); out[bg] = (255,255,255)

    prod = ~bg
    cc = prod.sum(0); rr = prod.sum(1)
    cols = np.where(cc>3)[0]; rows = np.where(rr>3)[0]
    x0,x1 = cols.min(),cols.max()+1; y0,y1 = rows.min(),rows.max()+1
    crop = Image.fromarray(out).crop((x0,y0,x1,y1)); cw,ch = crop.size
    sc = TARGET*S/max(cw,ch); nw,nh = max(1,round(cw*sc)),max(1,round(ch*sc))
    crop = crop.resize((nw,nh), Image.LANCZOS)
    canvas = Image.new("RGB",(S,S),(255,255,255)); canvas.paste(crop,((S-nw)//2,(S-nh)//2))
    canvas.save(os.path.join(IMG,name+".jpg"), quality=90)
    return canvas, 100*bg.mean()

if __name__ == "__main__":
    tile=300; cols=3; rows=3
    sheet = Image.new("RGB",(cols*tile, rows*tile),(238,238,238))
    for i,n in enumerate(ORDER):
        img,pct = process(n, **P[n])
        print(f"{n:12s} removed {pct:4.1f}%")
        th = img.resize((tile-2,tile-2)); sheet.paste(th,((i%cols)*tile+1,(i//cols)*tile+1))
    sheet.save(os.path.join(IMG,"_montage.jpg"), quality=88)
    print("montage -> images/_montage.jpg")
