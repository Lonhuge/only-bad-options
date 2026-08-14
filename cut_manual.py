#!/usr/bin/env python3
"""Manual-edge cut: crop each product to hand-read boundaries (tight, shadow
excluded), clean the residual corner background to pure white, then normalize
all products to one footprint. No auto-bbox detection."""
import numpy as np, os
from PIL import Image

IMG=os.path.join(os.path.dirname(__file__),"images"); SRC=os.path.join(IMG,"_orig")
S=1000; TARGET=0.90

# name: (x0,y0,x1,y1 as fractions of original), method, params
J = {
 "shirt-easy":   ((.09,.05,.91,.94),"flood",dict(Ssat=22,Llo=135)),
 "shirt-dino":   ((.13,.15,.87,.91),"light",dict(thr=240,Ssat=15)),
 "vinyl-lp":     ((.30,.26,.99,.86),"flood",dict(Ssat=22,Llo=150)),
 "vinyl-ep":     ((.02,.25,.72,.75),"flood",dict(Ssat=9, Llo=150)),
 "cd":           ((.23,.37,.81,.725),"light",dict(thr=238,Ssat=16)),
 "schal":        ((.11,.28,.95,.74),"flood",dict(Ssat=24,Llo=150)),
 "cap":          ((.12,.39,.83,.84),"flood",dict(Ssat=24,Llo=150)),
 "poster-asl":   ((.24,.03,.85,.97),"flood",dict(Ssat=24,Llo=140)),
 "poster-luxor": ((.24,.11,.84,.95),"flood",dict(Ssat=24,Llo=140)),
}
ORDER=list(J)

def reconstruct(seed,cand,mx=8000):
    cur=seed&cand
    for _ in range(mx):
        d=cur.copy()
        d[1:,:]|=cur[:-1,:];d[:-1,:]|=cur[1:,:];d[:,1:]|=cur[:,:-1];d[:,:-1]|=cur[:,1:]
        d[1:,1:]|=cur[:-1,:-1];d[:-1,:-1]|=cur[1:,1:];d[1:,:-1]|=cur[:-1,1:];d[:-1,1:]|=cur[1:,:-1]
        d&=cand
        if np.array_equal(d,cur):break
        cur=d
    return cur

def clean(im, method, p):
    a=np.asarray(im).astype(np.int16)
    lum=0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]; sat=a.max(2)-a.min(2)
    out=a.astype(np.uint8).copy()
    if method=="flood":
        cand=(sat<=p["Ssat"])&(lum>=p["Llo"])
        seed=np.zeros(a.shape[:2],bool); seed[0,:]=seed[-1,:]=seed[:,0]=seed[:,-1]=True
        out[reconstruct(seed,cand)]=(255,255,255)
    else:  # light: only lift near-white low-sat bg, keep product intact
        m=(lum>=p["thr"])&(sat<=p["Ssat"])
        out[m]=(255,255,255)
    return Image.fromarray(out)

def process(n):
    im=Image.open(os.path.join(SRC,n+".jpg")).convert("RGB"); w,h=im.size
    (x0,y0,x1,y1),method,p=J[n]
    crop=im.crop((int(x0*w),int(y0*h),int(x1*w),int(y1*h)))
    crop=clean(crop,method,p)
    cw,ch=crop.size; sc=TARGET*S/max(cw,ch); nw,nh=max(1,round(cw*sc)),max(1,round(ch*sc))
    crop=crop.resize((nw,nh),Image.LANCZOS)
    canvas=Image.new("RGB",(S,S),(255,255,255)); canvas.paste(crop,((S-nw)//2,(S-nh)//2))
    canvas.save(os.path.join(IMG,n+".jpg"),quality=90); return canvas

if __name__=="__main__":
    t=320; sheet=Image.new("RGB",(3*t,3*t),(235,235,235))
    for i,n in enumerate(ORDER):
        img=process(n); print("cut",n)
        sheet.paste(img.resize((t-2,t-2)),((i%3)*t+1,(i//3)*t+1))
    sheet.save(os.path.join(IMG,"_montage.jpg"),quality=88); print("montage ready")
