import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiHandler, ApiErrors, jsonSafe } from '@/lib/api';
import { requireManager } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile, writeFile, mkdir, access, unlink } from 'fs/promises';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

const schema = z.object({
  articleId: z.string().regex(/^\d+$/),
});

/**
 * 根据文章 ID 生成 6 张卡片图片（1080×1440 竖版 PNG）
 *
 * 前置条件：
 * - 文章的 AI 卡片数据已保存（ai-create 时自动保存为 data/ai-cards/{id}.json）
 * - 服务器需安装 Python3 + Pillow（pip install Pillow）
 */
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    await requireManager();
    const { articleId } = schema.parse(await req.json().catch(() => ({})));

    // 查找文章
    const article = await prisma.article.findUnique({
      where: { id: BigInt(articleId) },
      select: { id: true, title: true },
    });
    if (!article) throw ApiErrors.notFound('文章不存在');

    // 读取卡片数据
    const dataDir = path.join(process.cwd(), 'data', 'ai-cards');
    const cardPath = path.join(dataDir, `${articleId}.json`);
    let cardData: any;
    try {
      const raw = await readFile(cardPath, 'utf-8');
      cardData = JSON.parse(raw);
    } catch {
      throw new Error('未找到该文章的卡片数据，请先通过 AI 创建文章');
    }

    if (!cardData.cards || !Array.isArray(cardData.cards) || cardData.cards.length === 0) {
      throw new Error('卡片数据格式无效');
    }

    // 确保输出目录存在
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'cards', articleId);
    await mkdir(outputDir, { recursive: true });

    // 生成 Python 脚本并执行
    const concept = cardData.concept || article.title;
    const scriptPath = path.join(dataDir, `_gen_${articleId}.py`);
    const pythonScript = buildPythonScript(concept, cardData.cards, outputDir);

    await writeFile(scriptPath, pythonScript, 'utf-8');

    try {
      // 尝试使用 python3 执行
      const { stdout, stderr } = await execFileAsync('python3', [scriptPath], {
        timeout: 120000, // 2 分钟超时
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      // 清理临时脚本
      try { await unlink(scriptPath); } catch { /* ignore */ }

      // 列出生成的文件
      const fs = await import('fs');
      const files = fs.readdirSync(outputDir).filter((f: string) => f.endsWith('.png'));

      if (files.length === 0) {
        return jsonSafe({
          success: false,
          error: '未生成图片文件',
          stderr: stderr.slice(-500),
          stdout: stdout.slice(-200),
        });
      }

      // 更新文章封面为第一张卡片图
      const coverUrl = `/uploads/cards/${articleId}/${files[0]}`;
      await prisma.article.update({
        where: { id: BigInt(articleId) },
        data: { coverUrl },
      });

      return jsonSafe({
        success: true,
        count: files.length,
        files: files.map(f => `/uploads/cards/${articleId}/${f}`),
        coverUrl,
      });
    } catch (execErr: any) {
      // 清理临时脚本
      try { await unlink(scriptPath); } catch { /* ignore */ }

      // Python 不可用时的友好错误
      if (execErr.code === 'ENOENT') {
        throw new Error(
          '服务器未安装 Python3 或 Pillow，无法生成卡片图。' +
          '请先安装：apt-get install python3-pip && pip3 install Pillow'
        );
      }
      throw new Error(`卡片生成失败: ${execErr.message?.slice(0, 300)}`);
    }
  });
}

/**
 * 动态构建 Python 脚本来渲染卡片
 * 基于 XIAOBAI_FINANCE_SKILL 的 generate_cards.py，适配 Linux 环境
 */
function buildPythonScript(
  concept: string,
  cards: any[],
  outputDir: string
): string {
  // 将卡片数据序列化为 Python 字面量
  const cardsPy = JSON.stringify(cards, null, 2)
    .replace(/"/g, "'")  // Python 用单引号
    .replace(/'/g, "\\'")
    .replace(/\\'/g, "'");

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auto-generated card renderer for: ${concept}"""
import os, sys, json, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1440
OUT_DIR = "${outputDir.replace(/\\/g, '/')}"
CONCEPT = "${concept.replace(/"/g, '\\"')}"

# 字体配置（Linux 兼容）
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]
def font(size, bold=False):
    idx = 0 if bold else 1
    for f in FONTS:
        if os.path.exists(f):
            try: return ImageFont.truetype(f, size)
            except: pass
    return ImageFont.load_default()

C = {
    "blue_deep": (30,58,138), "blue": (37,99,235), "blue_light": (59,130,246),
    "blue_pale": (219,234,254), "orange": (245,158,11), "red": (220,38,38),
    "red_pale": (254,226,226), "green": (5,150,105), "gray": (107,114,128),
    "gray_dark": (55,65,81), "white": (255,255,255), "bg": (245,247,251),
}

def new_canvas():
    img = Image.new("RGBA", (W,H), C["bg"])
    d = ImageDraw.Draw(img)
    for y in range(H):
        t=y/(H-1); r=int(C["bg"][0]+(C["white"][0]-C["bg"][0])*t)
        g=int(C["bg"][1]+(C["white"][1]-C["bg"][1])*t)
        b=int(C["bg"][2]+(C["white"][2]-C["bg"][2])*t)
        d.line([(0,y),(W,y)], fill=(r,g,b,255))
    return img

def wrap(text, fnt, max_w, d):
    lines, cur = [], ""
    for ch in text:
        if ch=="\\n": lines.append(cur); cur=""; continue
        if d.textlength(cur+ch, font=fnt)<=max_w: cur+=ch
        else:
            if cur: lines.append(cur)
            cur=ch
    if cur: lines.append(cur)
    return lines

def draw_header(img, title_lines, subtitle, page, total):
    d = ImageDraw.Draw(img)
    hh = 320
    for y in range(hh):
        t=y/(hh-1); r=int(C["blue_deep"][0]+(C["blue_light"][0]-C["blue_deep"][0])*t)
        g=int(C["blue_deep"][1]+(C["blue_light"][1]-C["blue_deep"][1])*t)
        b=int(C["blue_deep"][2]+(C["blue_light"][2]-C["blue_deep"][2])*t)
        d.line([(0,y),(W,y)], fill=(r,g,b,255))
    d = ImageDraw.Draw(img)
    tf = font(48, True)
    y = 120
    for ln in title_lines:
        w=d.textlength(ln, font=tf)
        d.text(((W-w)//2,y), ln, font=tf, fill=C["white"])
        y += 64
    sf = font(24)
    sw=d.textlength(subtitle, font=sf)
    d.text(((W-sw)//2,y+8), subtitle, font=sf, fill=(219,234,254,230))
    pg = font(22)
    d.text((W-50,hh+16), f"{page}/{total}", font=pg, fill=C["gray"])

def draw_footer(img, page, total):
    d = ImageDraw.Draw(img)
    fy = H-80
    d.line([(50,fy-22),(W-50,fy-22)], fill=(229,231,235), width=2)
    f = font(24, True)
    d.text((50,fy), f"小白学财经 · {CONCEPT}", font=f, fill=C["blue_deep"])
    fp = font(36, True)
    d.text((W-50,fy), f"{page}/{total}", font=fp, fill=C["blue"])
    fd = font(18)
    d.text((50,fy+36), "仅供学习交流，不构成投资建议", font=fd, fill=C["gray"])

def draw_dialogue(img, who, y, text):
    d = ImageDraw.Draw(img)
    fnt = font(26)
    av_r = 44; gap = 18; pad_x=26; pad_y=16; line_h=38
    max_w = W-120-(av_r*2+gap)-pad_x*2
    lines = wrap(text, fnt, max_w, d)
    text_h = line_h * len(lines)
    bub_h = text_h + pad_y*2
    block_h = av_r*2+28
    bubble_top = y+(block_h-bub_h)/2
    bx_l = 60+av_r*2+gap; bx_r = W-60
    bg_c = C["white"] if who=="left" else C["blue_pale"]
    border = (31,41,55,255) if who=="left" else C["blue"]+(255,)
    tail_side = "left" if who=="right" else "right"
    # shadow
    d.rounded_rectangle([bx_l+4,bubble_top+8,bx_r+4,bubble_top+bub_h+8], radius=18, fill=(30,58,138,20))
    d.rounded_rectangle([bx_l,bubble_top,bx_r,bubble_top+bub_h], radius=18, fill=bg_c, outline=border, width=3)
    cy = bubble_top+bub_h/2
    if tail_side=="left":
        d.polygon([(bx_l,cy-14),(bx_l,cy+14),(bx_l-16,cy)], fill=bg_c)
    else:
        d.polygon([(bx_r,cy-14),(bx_r,cy+14),(bx_r+16,cy)], fill=bg_c)
    ty2=bubble_top+pad_y
    for ln in lines:
        d.text((bx_l+pad_x,ty2), ln, font=fnt, fill=C["gray_dark"])
        ty2+=line_h
    acy = y+av_r
    name_color = C["orange"] if who=="left" else C["blue"]
    d.ellipse([60+av_r-acy+acy-av_r, acy-av_r, 60+av_r+acy+av_r, acy+av_r], outline=name_color, width=4)
    nf = font(20, True)
    nm = "小白" if who=="left" else "师傅"
    d.text((60, y+av_r*2+8), nm, font=nf, fill=name_color)
    return block_h+16

def draw_def_card(img, y, title, text, accent=None):
    accent = accent or C["blue"]
    d = ImageDraw.Draw(img)
    pad=28; tf=font(34,True); bf=font(26)
    body_lines=wrap(text,bf,W-pad*2-80,d)
    body_h=40*len(body_lines); card_h=pad*2+42+12+body_h
    box=[50,y,W-50,y+card_h]
    d.rounded_rectangle(box, radius=18, fill=C["white"])
    d.rounded_rectangle([58,y+16,66,y+card_h-16], radius=4, fill=accent)
    d.text((76,y+pad), title, font=tf, fill=accent)
    ty=y+pad+42+12
    for ln in body_lines: d.text((76,ty),ln,font=bf,fill=C["gray_dark"]); ty+=40
    return card_h+18

def draw_formula_card(img, y, lines):
    d = ImageDraw.Draw(img); pad=32; lh=52; f=font(40,True)
    card_h=pad*2+lh*len(lines)
    grad_w=W-100
    for py_ in range(card_h):
        t=py_/max(card_h-1,1)
        r=int(C["blue_deep"][0]+(C["blue"][0]-C["blue_deep"][0])*t)
        g=int(C["blue_deep"][1]+(C["blue"][1]-C["blue_deep"][1])*t)
        b=int(C["blue_deep"][2]+(C["blue"][2]-C["blue_deep"][2])*t)
        d.line([(50,y+py_),(50+grad_w,y+py_)], fill=(r,g,b,255))
    d = ImageDraw.Draw(img)
    ty=y+pad
    for ln in lines:
        w=d.textlength(ln,font=f); d.text(((W-w)//2,ty),ln,font=f,fill=C["white"]); ty+=lh
    return card_h+18

def draw_mnemonic(img, y, lines, title="速记口诀"):
    d = ImageDraw.Draw(img); pad=30; lh=46; tf=font(28,True); bf=font(28)
    card_h=pad*2+30+8+lh*len(lines)
    grad_w=W-100
    for py_ in range(card_h):
        t=py_/max(card_h-1,1)
        r=int(C["blue_deep"][0]+(C["blue"][0]-C["blue_deep"][0])*t)
        g=int(C["blue_deep"][1]+(C["blue"][1]-C["blue_deep"][1])*t)
        b=int(C["blue_deep"][2]+(C["blue"][2]-C["blue_deep"][2])*t)
        d.line([(50,y+py_),(50+grad_w,y+py_)], fill=(r,g,b,255))
    d = ImageDraw.Draw(img)
    d.text((80,y+pad), title, font=tf, fill=C["orange"])
    ty=y+pad+30+8
    for ln in lines:
        w=d.textlength(ln,font=bf); d.text(((W-w)//2,ty),ln,font=bf,fill=C["white"]); ty+=lh
    return card_h+18

def draw_hero(img, y, title, sub):
    d = ImageDraw.Draw(img); pad=26; card_h=pad*2+48+10+30
    grad_w=W-100
    for py_ in range(card_h):
        t=py_/max(card_h-1,1)
        r=int(C["blue_deep"][0]+(C["blue_light"][0]-C["blue_deep"][0])*t)
        g=int(C["blue_deep"][1]+(C["blue_light"][1]-C["blue_deep"][1])*t)
        b=int(C["blue_deep"][2]+(C["blue_light"][2]-C["blue_deep"][2])*t)
        d.line([(50,y+py_),(50+grad_w,y+py_)], fill=(r,g,b,255))
    d = ImageDraw.Draw(img)
    tf=font(38,True); sf=font(24)
    tw=d.textlength(title,font=tf); d.text(((W-tw)//2,y+pad),title,font=tf,fill=C["white"])
    sw=d.textlength(sub,font=sf); d.text(((W-sw)//2,y+pad+48+10),sub,font=sf,fill=(219,234,254,240))
    return card_h+18

def draw_table(img, y, headers, rows, col_w, hi_col=2):
    d = ImageDraw.Draw(img); head_h=54; row_h=60
    total_w=sum(col_w); x0=(W-total_w)//2
    d.rounded_rectangle([x0,y,x0+total_w,y+head_h], radius=12, fill=C["blue_deep"])]
    cx=x0
    for h in headers:
        d.text((cx+col_w[headers.index(h)]//2,y+head_h//2),h,font=font(28,True),fill=C["white"],anchor="mm"); cx+=col_w[headers.index(h)]
    cy=y+head_h
    for i,row in enumerate(rows):
        bg=C["white"] if i%2==0 else C["blue_pale"]
        d.rounded_rectangle([x0,cy,x0+total_w,cy+row_h], radius=10, fill=bg)
        cx=x0
        for j,cell in enumerate(row):
            if j==hi_col: d.rounded_rectangle([cx,cy,cx+col_w[j],cy+row_h],radius=10,fill=(219,234,254,255))
            fill=C["gray_dark"] if j>0 else C["text"]; if j==hi_col: fill=C["blue_deep"]
            d.text((cx+col_w[j]//2,cy+row_h//2),cell,font=font(26 if j>0 else 24),fill=fill,anchor="mm"); cx+=col_w[j]
        cy+=row_h
    return (head_h+len(rows)*row_h)+20

def draw_strategy(img, y, items):
    d = ImageDraw.Draw(img); h=78; gap=12
    for i,(name,desc,color) in enumerate(items):
        yy=y+i*(h+gap)
        d.rounded_rectangle([50,yy,W-50,yy+h], radius=14, fill=C["white"])
        d.rounded_rectangle([58,yy+14,66,yy+h-14], radius=4, fill=color)
        d.text((82,yy+h//2-12),name,font=font(28,True),fill=color)
        d.text((82,yy+h//2+16),desc,font=font(22),fill=C["gray"])
    return (h*len(items)+gap*(len(items)-1))+20

def draw_risk(img, y, items):
    d = ImageDraw.Draw(img); h=98; gap=12
    for i,(title,desc) in enumerate(items):
        yy=y+i*(h+gap)
        d.rounded_rectangle([50,yy,W-50,yy+h], radius=14, fill=C["red_pale"])
        cy=yy+h//2
        d.ellipse([68,cy-16,104,cy+16], fill=C["red"])
        d.text((86,cy),"!",font=font(26,True),fill=C["white"],anchor="mm")
        d.text((124,yy+46),title,font=font(28,True),fill=C["red"])
        d.text((124,yy+78),desc,font=font(22),fill=C["gray_dark"])
    return (h*len(items)+gap*(len(items)-1))+20

def draw_timeline(img, y, items):
    d = ImageDraw.Draw(img); h=70; gap=8
    for i,(num,title,desc) in enumerate(items):
        yy=y+i*(h+gap)
        d.rounded_rectangle([50,yy,W-50,yy+h], radius=12, fill=C["white"])
        cx,cy=58+16,yy+h//2,r=16
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=C["blue"])
        d.text((cx,cy),str(num),font=font(22,True),fill=C["white"],anchor="mm")
        d.text((92,yy+32),title,font=font(22,True),fill=C["blue_deep"])
        d.text((92,yy+58),desc,font=font(18),fill=C["gray_dark"])
    return (h*len(items)+gap*(len(items)-1))+16

def draw_keywords(img, y, words):
    fnt=font(22,True); pad_x,pad_y=16,6; gap_x,gap_y=10,10
    cx,cy=50,y; max_x=W-50; line_h=fnt.size+pad_y*2; th=22
    positions=[]
    for w_ in words:
        wd=d_textlength(fnt,w_)+pad_x*2
        if cx+wd>max_x: cx=50; cy+=line_h+gap_y
        positions.append((cx,cy,wd,w_)); cx+=wd+gap_x
    total_h=(cy-y)+line_h+14
    layer=Image.new("RGBA",img.size,(0,0,0,0)); dd=ImageDraw.Draw(layer)
    colors=[C["blue"],C["orange"],C["red"],C["green"]]
    for i,(bx,by,bwd,w_) in enumerate(positions):
        c=colors[i%4]; dd.rounded_rectangle([bx,by,bx+bwd,by+line_h],radius=line_h//2,fill=(c[0],c[1],c[2],30),outline=(c[0],c[1],c[2],130),width=2)
    img.alpha_composite(layer)
    layer2=Image.new("RGBA",img.size,(0,0,0,0)); dd2=ImageDraw.Draw(layer2)
    for i,(bx,by,bwd,w_) in enumerate(positions):
        c=colors[i%4]; ty=by+(line_h-th)/2; dd2.text((bx+pad_x,ty),w_,font=fnt,fill=(c[0],c[1],c[2],255))
    img.alpha_composite(layer2)
    return total_h

def d_textlength(fnt,text):
    tmp=Image.new("RGB",(10,10)); return ImageDraw.Draw(tmp).textlength(text,font=fnt)

def draw_block(img, y, block):
    kind=block[0]
    if kind=="dia": return draw_dialogue(img,block[1],y,block[2])
    if kind=="def": return draw_def_card(img,y,block[1],block[2],block[3] if len(block)>3 else None)
    if kind=="hero": return draw_hero(img,y,block[1],block[2])
    if kind=="formula": return draw_formula_card(img,y,block[1])
    if kind=="table": return draw_table(img,y,block[1],block[2],block[3],block[4] if len(block)>4 else 2)
    if kind=="strategy": return draw_strategy(img,y,block[1])
    if kind=="risk": return draw_risk(img,y,block[1])
    if kind=="mnemonic": return draw_mnemonic(img,y,block[1],block[2] if len(block)>2 else "速记口诀")
    if kind=="timeline": return draw_timeline(img,y,block[1])
    if kind=="keywords": return draw_keywords(img,y,block[1])
    if kind=="gap": return block[1]
    raise ValueError(f"Unknown block type: {kind}")

NAMES=["1-是什么","2-怎么算","3-怎么读","4-怎么用","5-风险点","6-总结"]

CARDS=${cardsPy}

os.makedirs(OUT_DIR, exist_ok=True)
total=len(CARDS)
for i,(title_lines,subtitle,blocks) in enumerate(CARDS,start=1):
    img=new_canvas()
    draw_header(img,title_lines,subtitle,i,total)
    y=360
    for b in blocks:
        y+=draw_block(img,y,b)
        if y>1300: print(f"[{i}] overflow y={y}")
    draw_footer(img,i,total)
    name=f"{CONCEPT}卡片{NAMES[i-1]}.png"
    img.convert("RGB").save(os.path.join(OUT_DIR,name),"PNG")
    print(f"[{i}/{total}] {name}")
print(f"DONE -> {OUT_DIR}")
`;
}
