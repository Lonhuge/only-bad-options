#!/usr/bin/env python3
"""Rebuild product tiles from the white-bg WITH-shadow source (images/_white).
Detect the FULL product+shadow extent (anything not near-white) so nothing is
ever sliced, then normalize to a consistent square footprint."""
import numpy as np, os
from PIL import Image

IMG=os.path.join(os.path.dirname(__file__),"images"); SRC=os.path.join(IMG,"_white")
S=1000; TARGET=0.90
ORDER=["shirt-easy","shirt-dino","vinyl-lp","vinyl-ep","cd","schal","cap","poster-asl","poster-luxor"]

def process(n):
    im=Image.open(os.path.join(SRC,n+".jpg")).convert("RGB"); w,h=im.size
    a=np.asarray(im).astype(np.int16)
    lum=0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
    content = lum < 246                         # anything not near-pure-white = product or shadow
    cc=content.sum(0); rr=content.sum(1)
    tx=0.006*h; ty=0.006*w                       # ignore sparse JPEG speckle
    cols=np.where(cc>tx)[0]; rows=np.where(rr>ty)[0]
    x0,x1=cols.min(),cols.max()+1; y0,y1=rows.min(),rows.max()+1
    crop=im.crop((int(x0),int(y0),int(x1),int(y1))); cw,ch=crop.size
    sc=TARGET*S/max(cw,ch); nw,nh=max(1,round(cw*sc)),max(1,round(ch*sc))
    crop=crop.resize((nw,nh),Image.LANCZOS)
    canvas=Image.new("RGB",(S,S),(255,255,255)); canvas.paste(crop,((S-nw)//2,(S-nh)//2))
    canvas.save(os.path.join(IMG,n+".jpg"),quality=90)
    return canvas,(cw,ch)

if __name__=="__main__":
    t=320; sheet=Image.new("RGB",(3*t,3*t),(235,235,235))
    for i,n in enumerate(ORDER):
        img,sz=process(n); print(f"{n:12s} content {sz[0]}x{sz[1]}")
        sheet.paste(img.resize((t-2,t-2)),((i%3)*t+1,(i//3)*t+1))
    sheet.save(os.path.join(IMG,"_montage.jpg"),quality=88); print("montage ready")
