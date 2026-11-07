"""Finish the cinematic: titles, captions, fades, then encode to MP4 with the soundtrack.

usage:
  python3 tools/compose.py <framesDir> <soundtrack.wav> <out.mp4>
  python3 tools/compose.py <framesDir> <soundtrack.wav> <out.mp4> --music track.mp3 [--music-start 12.5] [--music-gain 0.9]
      lays YOUR OWN music (any track you have the rights to) over the rain + sound-effects stem
      (<soundtrack>_fx.wav, written by tools/soundtrack.py) instead of the built-in score.
  python3 tools/compose.py --preview frame.jpg <seconds> out.jpg      (titles on one frame)
"""
import sys, subprocess, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PREVIEW = sys.argv[1] == '--preview'
args = sys.argv[1:]
opts = {}
for k in ('--music', '--music-start', '--music-gain'):
    if k in args:
        i = args.index(k); opts[k] = args[i + 1]; del args[i:i + 2]
if not PREVIEW:
    frames_dir, wav, out = args[0], args[1], args[2]
FPS = 24
W, H = 1280, 544
TOTAL = 1080
DUR = TOTAL / FPS

SANS_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
JP = '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf'
font = lambda p, s: ImageFont.truetype(p, s)


def spaced(draw, xy, text, fnt, fill, spacing, anchor='left'):
    widths = [draw.textlength(c, font=fnt) for c in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x, y = xy
    if anchor == 'center':
        x -= total / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=fnt, fill=fill)
        x += w + spacing
    return total


def scrim(cy, rx, ry, alpha):
    """soft elliptical darkening behind a title block, so type reads over busy neon"""
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).ellipse((W / 2 - rx, cy - ry, W / 2 + rx, cy + ry), fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(ry * 0.8))
    lay = Image.new('RGBA', (W, H), (4, 2, 10, 0))
    lay.putalpha(m)
    return lay


def layer_text(lines, glow=None, blur=8, shade=None):
    """lines: [(text, fontpath, size, rgb, spacing, y)] centered → RGBA layer (with soft glow)"""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for text, fp, size, rgb, sp, y in lines:
        spaced(d, (W / 2, y), text, font(fp, size), rgb + (255,), sp, 'center')
    if glow:
        g = lay.filter(ImageFilter.GaussianBlur(blur))
        tint = Image.new('RGBA', (W, H), glow + (0,))
        tint.putalpha(g.getchannel('A'))
        base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        base = Image.alpha_composite(base, tint)
        base = Image.alpha_composite(base, tint)
        lay = Image.alpha_composite(base, lay)
    if shade:
        lay = Image.alpha_composite(scrim(*shade), lay)
    return lay


def caption(main, jp=None):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rectangle((0, H - 90, 560, H), fill=120)
    m = m.filter(ImageFilter.GaussianBlur(40))
    lay = Image.new('RGBA', (W, H), (4, 2, 10, 0))
    lay.putalpha(m)
    d = ImageDraw.Draw(lay)
    x, y = 46, H - 64
    d.rectangle((x - 14, y + 4, x - 11, y + 36), fill=(255, 42, 109, 230))
    spaced(d, (x, y), main, font(SANS_B, 15), (235, 245, 255, 235), 4.5)
    if jp:
        spaced(d, (x, y + 22), jp, font(JP, 14), (122, 246, 255, 220), 3)
    return lay


TITLE = layer_text([
    ('KOI-TEI BLOCK', SANS_B, 52, (255, 255, 255), 16, H / 2 - 52),
    ('NEO-KABUKICHŌ   ·   SECTOR 7', SANS, 15, (150, 240, 255), 7, H / 2 + 14),
    ('新歌舞伎町  七区', JP, 21, (255, 70, 130), 8, H / 2 + 42),
], glow=(255, 42, 109), blur=10, shade=(H / 2, 430, 85, 150))
END = layer_text([   # lower third, so the koi + roof sign reveal above stays clear
    ('鯉亭', JP, 54, (255, 70, 110), 10, H - 186),
    ('KOI-TEI BLOCK', SANS_B, 22, (255, 255, 255), 12, H - 116),
    ('a hand-built real-time city corner  ·  three.js', SANS, 13, (175, 185, 205), 3, H - 82),
], glow=(255, 42, 109), blur=12, shade=(H - 128, 360, 78, 160))
CAPS = [  # (start, end, layer)
    (6.2, 9.6, caption('ROOFTOP  ·  TWIN KOI HOLOGRAM', '鯉亭ビル 屋上')),
    (15.6, 19.2, caption('SECTOR 7  ·  02:47  ·  RAIN 11 MM/H', '新歌舞伎町 七区')),
    (20.6, 23.6, caption('KOI-TEI RAMEN  ·  OPEN TILL 4 AM', '鯉亭  ラーメン')),
    (35.6, 38.7, caption('MAGLEV LINE 7  ·  LAST TRAIN', 'リニア七号線  最終')),
]


def ramp(t, a, b, fade=0.5):
    if t < a or t > b:
        return 0.0
    return max(0.0, min(1.0, (t - a) / fade, (b - t) / fade))


def overlay(base, lay, alpha):
    if alpha <= 0.001:
        return base
    l = lay.copy()
    l.putalpha(l.getchannel('A').point(lambda v: int(v * alpha)))
    return Image.alpha_composite(base, l)


def finish(im, t):
    im = overlay(im, TITLE, ramp(t, 1.1, 5.0, 0.7))
    for a, b, lay in CAPS:
        im = overlay(im, lay, ramp(t, a, b, 0.45))
    im = overlay(im, END, ramp(t, 41.6, DUR + 1, 0.9))
    fade = min(1.0, t / 0.9, max(0.0, (DUR - t) / 1.3))
    rgb = im.convert('RGB')
    if fade < 1:
        rgb = Image.eval(rgb, lambda v, f=fade: int(v * f))
    return rgb


if PREVIEW:   # --preview in.jpg seconds out.jpg
    im = Image.open(args[1]).convert('RGBA').resize((W, H))
    finish(im, float(args[2])).save(args[3], quality=90)
    sys.exit(0)

cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
if '--music' in opts:
    fx = wav[:-4] + '_fx.wav'
    if not os.path.exists(fx):
        sys.exit(f'{fx} not found: run tools/soundtrack.py first (it writes the _fx stem next to the score)')
    g = float(opts.get('--music-gain', 0.85))
    cmd += ['-i', fx, '-ss', opts.get('--music-start', '0'), '-i', opts['--music'], '-filter_complex',
            f'[2:a]aresample=48000,atrim=0:{DUR},asetpts=PTS-STARTPTS,afade=t=in:d=1.2,'
            f'afade=t=out:st={DUR - 2.6}:d=2.6,volume={g}[m];'
            f'[1:a][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]',
            '-map', '0:v', '-map', '[a]']
else:
    cmd += ['-i', wav]
cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-tune', 'film', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]
enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for i in range(TOTAL):
    t = i / FPS
    im = Image.open(f'{frames_dir}/f{i:05d}.jpg').convert('RGBA')
    enc.stdin.write(finish(im, t).tobytes())
enc.stdin.close()
enc.wait()
print('encoded', out)
