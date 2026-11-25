"""Photo-realistic sample receipt for testing Backed.

A fictional store, clearly marked as a sample at the bottom. The receipt is
laid out on an 80 mm thermal printer's dot grid (576 dots, 48 columns), then
printed, folded, curled and photographed on a walnut table in code.
"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter

rng = np.random.default_rng(20261122)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'receipt.jpg'

MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
MONO_B = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
INTER_X = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
INTER_M = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'

COLS, CW, LH, GAP, DOTS = 48, 12, 24, 7, 576
F_REG = ImageFont.truetype(MONO, 20)
F_BOLD = ImageFont.truetype(MONO_B, 20)


# ---------------------------------------------------------------- layout ----
def lr(left, right, width=COLS):
    return left + ' ' * max(1, width - len(left) - len(right)) + right


def center(s, width=COLS):
    pad = (width - len(s)) // 2
    return ' ' * pad + s


def totals(label, amount):
    return lr('', f'{label:<14}{amount:>12}')


def text_row(s, bold=False, scale=1):
    cols = COLS // scale
    s = s[:cols]
    img = Image.new('L', (cols * CW, LH), 255)
    d = ImageDraw.Draw(img)
    for i, ch in enumerate(s):
        d.text((i * CW, -2), ch, font=F_BOLD if bold else F_REG, fill=0)
    arr = np.array(img) < 120
    if scale > 1:
        arr = np.kron(arr, np.ones((scale, scale), bool))
    out = np.zeros((arr.shape[0], DOTS), bool)
    out[:, : arr.shape[1]] = arr
    return out


def logo():
    S = 4
    w, h = DOTS * S, 168 * S
    img = Image.new('L', (w, h), 255)
    d = ImageDraw.Draw(img)
    word = ImageFont.truetype(INTER_X, 50 * S)
    sub = ImageFont.truetype(INTER_M, 18 * S)
    # mark: rounded square with a lightning bolt knocked out, centred on top
    mark = 58 * S
    x0, y0 = (w - mark) / 2, 4 * S
    d.rounded_rectangle([x0, y0, x0 + mark, y0 + mark], radius=14 * S, fill=0)
    bolt = [(0.58, 0.10), (0.26, 0.56), (0.47, 0.56), (0.38, 0.90), (0.74, 0.42), (0.53, 0.42), (0.62, 0.10)]
    d.polygon([(x0 + px * mark, y0 + py * mark) for px, py in bolt], fill=255)
    # spaced wordmark
    text = 'LUMEN & WIRE'
    track = 5 * S
    tw = sum(d.textlength(ch, font=word) for ch in text) + track * (len(text) - 1)
    x, y = (w - tw) / 2, y0 + mark + 6 * S
    for ch in text:
        d.text((x, y), ch, font=word, fill=0)
        x += d.textlength(ch, font=word) + track
    tag = 'ELECTRONICS  +  HOME  +  AUDIO'
    d.text(((w - d.textlength(tag, font=sub)) / 2, y + 62 * S), tag, font=sub, fill=0)
    small = img.resize((DOTS, 168), Image.LANCZOS)
    return np.array(small) < 128


def barcode(digits, height=78):
    pat = {'0': 'nnwwn', '1': 'wnnnw', '2': 'nwnnw', '3': 'wwnnn', '4': 'nnwnw',
           '5': 'wnwnn', '6': 'nwwnn', '7': 'nnnww', '8': 'wnnwn', '9': 'nwnwn'}
    seq = [(True, 'n'), (False, 'n'), (True, 'n'), (False, 'n')]
    for a, b in zip(digits[0::2], digits[1::2]):
        for x, y in zip(pat[a], pat[b]):
            seq += [(True, x), (False, y)]
    seq += [(True, 'w'), (False, 'n'), (True, 'n')]
    widths = [(bar, 5 if k == 'w' else 2) for bar, k in seq]
    total = sum(w for _, w in widths)
    row = np.zeros(DOTS, bool)
    x = (DOTS - total) // 2
    for bar, w in widths:
        if bar:
            row[x : x + w] = True
        x += w
    return np.repeat(row[None, :], height, axis=0)


def build_receipt():
    rows = []
    add = lambda arr, gap=GAP: rows.extend([arr, np.zeros((gap, DOTS), bool)])
    blank = lambda n=1: rows.append(np.zeros((int((LH + GAP) * 0.7 * n), DOTS), bool))
    rule = lambda ch='-': add(text_row(ch * COLS))

    rows.append(np.zeros((10, DOTS), bool))
    add(logo(), 10)
    for s in ['1840 HARBOUR WAY, UNIT 12', 'PORT ELLIS, ON  L4X 2K9', 'TEL (905) 555-0148', 'HST# 81742 3906 RT0001']:
        add(text_row(center(s)))
    blank()
    add(text_row('STORE 0412    REG 03    TRANS 20871'))
    add(text_row(lr('CASHIER: MAYA R.', '11/22/2026  14:41')))
    rule('=')
    add(text_row('SALE', bold=True))
    items = [
        ('65IN 4K UHD SMART TV', '1,099.99', ['SKU 6551204', 'S/N 4K9TQ2M01187']),
        ('WIRELESS NC HEADPHONES BLK', '329.99', ['SKU 4418021', 'S/N SX9W4021557']),
        ('  INSTANT SAVINGS', '-50.00', []),
        ('HDMI 2.1 CABLE 2M', '24.99', ['SKU 7720310']),
        ('TILT WALL MOUNT 40-75IN', '79.99', ['SKU 3390082']),
    ]
    for name, price, extra in items:
        add(text_row(lr(name, price)))
        for e in extra:
            add(text_row('    ' + e))
    rule()
    add(text_row(totals('SUBTOTAL', '1,484.96')))
    add(text_row(totals('HST 13%', '193.04')))
    add(text_row(totals('TOTAL', '$1,678.00'), bold=True))
    rule()
    add(text_row(lr('VISA', '1,678.00')))
    add(text_row('    ************1234    CONTACTLESS'))
    add(text_row('    AUTH 04821C    REF 000412203871'))
    add(text_row(center('APPROVED - THANK YOU')))
    rule()
    add(text_row('ITEMS SOLD: 4'))
    blank()
    add(text_row(center('WARRANTY INFORMATION'), bold=True))
    for s in ['65IN UHD TV: 1 YEAR MANUFACTURER WARRANTY',
              'HEADPHONES: 1 YEAR MANUFACTURER WARRANTY',
              'KEEP THIS RECEIPT AS PROOF OF PURCHASE.']:
        add(text_row(s))
    blank()
    for s in ['RETURNS AND EXCHANGES WITHIN 30 DAYS WITH',
              'RECEIPT. OPENED TVS 15 DAYS. SEE STORE FOR',
              'DETAILS.']:
        add(text_row(s))
    rule()
    blank()
    add(barcode('0412000320871122'), 8)
    add(text_row(center('0412 0003 2087 1122')))
    blank()
    add(text_row(center('THANK YOU FOR SHOPPING AT LUMEN & WIRE')))
    blank()
    add(text_row(center('** SAMPLE RECEIPT FOR APP TESTING **')))
    add(text_row(center('NOT A REAL STORE OR PURCHASE')))
    rows.append(np.zeros((70, DOTS), bool))
    return np.vstack(rows)


# --------------------------------------------------------------- helpers ----
def noise(shape, sigma, scale=4):
    """Smooth noise in about [-1, 1], generated small and scaled up."""
    h, w = shape
    sh, sw = max(4, h // scale), max(4, w // scale)
    n = gaussian_filter(rng.standard_normal((sh, sw)), sigma / scale)
    n /= np.abs(n).max() + 1e-9
    return cv2.resize(n.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)


# ----------------------------------------------------------- print paper ----
def print_paper(dots):
    S = 3
    margin = 32
    H = dots.shape[0]
    ink = np.kron(dots.astype(np.float32), np.ones((S, S), np.float32))
    ink = cv2.GaussianBlur(ink, (0, 0), 0.95)
    ink = np.clip(ink * 1.3, 0, 1)
    h, w = ink.shape
    # thermal density: patchy, fading toward the right edge, banding per head line
    dens = 0.86 + 0.10 * noise((h, w), 60) - 0.10 * (np.linspace(0, 1, w)[None, :] ** 1.6)
    dens *= (0.965 + 0.035 * noise((h, 1), 4, 1))
    col = int(0.37 * w)
    dens[:, col : col + 3] *= 0.45  # a worn element on the print head
    ink *= np.clip(dens, 0, 1)
    ink *= np.clip(1 + 0.25 * gaussian_filter(rng.standard_normal((h, w)), 0.7), 0.6, 1.1)

    PW, PH = (DOTS + 2 * margin) * S, h + 30 * S
    paper = np.empty((PH, PW, 3), np.float32)
    base = np.array([246, 246, 243], np.float32)
    mott = 1.6 * noise((PH, PW), 120)[..., None] + 0.5 * noise((PH, PW), 14)[..., None]
    grain = gaussian_filter(rng.standard_normal((PH, PW)), 0.6)[..., None] * 1.1
    paper[:] = base + mott + grain
    # faint fibres
    fib = np.zeros((PH, PW), np.float32)
    for _ in range(90):
        x, y = rng.integers(0, PW), rng.integers(0, PH)
        ang = rng.uniform(0, np.pi)
        L = rng.uniform(8, 40)
        cv2.line(fib, (x, y), (int(x + L * np.cos(ang)), int(y + L * np.sin(ang))), 1.0, 1, cv2.LINE_AA)
    paper -= 3 * gaussian_filter(fib, 0.6)[..., None]

    ink_full = np.zeros((PH, PW), np.float32)
    oy, ox = 12 * S, margin * S
    ink_full[oy : oy + h, ox : ox + w] = ink
    ink_col = np.array([38, 37, 42], np.float32)
    rgb = paper * (1 - ink_full[..., None]) + ink_col * ink_full[..., None]

    # outline: cutter edge on top, torn serrations at the bottom
    alpha = np.ones((PH, PW), np.float32)
    xs = np.arange(PW)
    top = 3 + 1.5 * noise((1, PW), 6, 1)[0]
    teeth = np.abs(((xs / (11.5 * S)) % 1.0) - 0.5) * 2
    amp = 9 * S * (0.55 + 0.45 * (noise((1, PW), 40, 1)[0] * 0.5 + 0.5))
    bottom = PH - 4 - teeth * amp - 4 * np.abs(noise((1, PW), 3, 1)[0]) * S
    yy = np.arange(PH)[:, None]
    alpha[(yy < top[None, :]) | (yy > bottom[None, :])] = 0
    side = 1.2 * noise((PH, 1), 20, 1)[:, 0]
    for y in range(PH):
        l, r = int(2 + side[y]), int(PW - 3 + side[y])
        alpha[y, :max(l, 0)] = 0
        alpha[y, r:] = 0
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)
    return rgb, alpha


# ------------------------------------------------- fold, curl and shading ----
def deform(rgb, alpha):
    PH, PW = alpha.shape
    y = np.arange(PH, dtype=np.float32)[:, None]
    x = np.arange(PW, dtype=np.float32)[None, :]
    u = (x - PW / 2) / (PW / 2)
    v = y / PH
    h = 34 * u ** 2 + 10 * u ** 3  # curl across the width
    h = h + 26 * (v - 0.5) ** 2 * 1.0  # gentle sag along the length
    for fy, sign, k in [(0.355, 1, 6.0), (0.70, -1, 4.5)]:
        line = fy * PH + 0.02 * (x - PW / 2) + 6 * noise((1, PW), 30, 1)
        dist = np.sqrt((y - line) ** 2 + 5.0 ** 2)
        h = h + sign * k * np.exp(-dist / 80) * (1 + 0.3 * noise((1, PW), 25, 1))
    h = h + 6 * noise((PH, PW), 110) + 0.9 * noise((PH, PW), 30)
    gy, gx = np.gradient(gaussian_filter(h, 1.2))
    n = np.dstack([-gx * 1.6, -gy * 1.6, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    light = np.array([-0.45, -0.62, 0.9])
    light /= np.linalg.norm(light)
    lam = n @ light
    shade = np.clip(1 + 1.25 * (lam - light[2]), 0.72, 1.12)
    spec = np.clip(lam - 0.985, 0, None) * 18  # faint sheen of thermal coating
    rgb = rgb * shade[..., None] + 255 * spec[..., None] * 0.35
    # parallax: higher paper shifts toward the camera
    mapx = (x + 0.10 * h + 0 * y).astype(np.float32)
    mapy = (y - 0.22 * h + 0 * x).astype(np.float32)
    rgb = cv2.remap(rgb, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    alpha = cv2.remap(alpha, mapx, mapy, cv2.INTER_LINEAR, borderValue=0)
    return rgb, alpha, h


# ---------------------------------------------------------- walnut table ----
def walnut(H, W):
    img = np.zeros((H, W, 3), np.float32)
    plank_w = int(W * 0.34)
    yy = np.arange(H, dtype=np.float32)[:, None]
    for x0 in range(-int(plank_w * 0.37), W, plank_w):
        xa, x1 = max(0, x0), min(W, x0 + plank_w)
        if x1 <= xa:
            continue
        pw = x1 - xa
        # grain runs the length of the plank and sways slowly
        def aniso(sy, sx, k=8):
            n = gaussian_filter(rng.standard_normal((H // k, max(4, pw // k))), (sy / k, sx / k))
            n /= np.abs(n).max() + 1e-9
            return cv2.resize(n.astype(np.float32), (pw, H), interpolation=cv2.INTER_CUBIC)
        sway = 80 * aniso(520, 260) + 14 * aniso(160, 60) + 3 * aniso(40, 20, 4)
        u = np.arange(xa, x1, dtype=np.float32)[None, :] - x0 + sway
        U = int(plank_w + 400)
        line1 = gaussian_filter(rng.standard_normal(U), 1.4)
        line2 = gaussian_filter(rng.standard_normal(U), 7)
        line3 = gaussian_filter(rng.standard_normal(U), 30)
        for l in (line1, line2, line3):
            l /= np.abs(l).max()
        ui = np.clip(u + 200, 0, U - 1)
        g = 0.35 * np.interp(ui, np.arange(U), line1) + 0.45 * np.interp(ui, np.arange(U), line2) + 0.5 * np.interp(ui, np.arange(U), line3)
        streak = gaussian_filter(rng.standard_normal((H // 4, pw // 2)), (30, 0.8))
        streak = cv2.resize((streak / np.abs(streak).max()).astype(np.float32), (pw, H), interpolation=cv2.INTER_CUBIC)
        # one soft cathedral figure per plank
        c = plank_w * rng.uniform(0.35, 0.65)
        y0 = rng.uniform(0.2, 0.8) * H
        f = (np.abs(u - c) + (yy - y0) ** 2 / rng.uniform(25000, 60000)) / rng.uniform(22, 30)
        cath = (0.5 + 0.5 * np.cos(2 * np.pi * f)) ** 4
        t = 0.5 + 0.30 * g + 0.12 * streak + 0.16 * cath - 0.08
        t = np.clip(t, 0, 1)
        light = np.array([122, 84, 56], np.float32) * rng.uniform(0.94, 1.06)
        dark = np.array([58, 37, 24], np.float32) * rng.uniform(0.92, 1.08)
        plank = light * (1 - t[..., None]) + dark * t[..., None]
        pores = (rng.random((H, pw)) > 0.997).astype(np.float32)
        pores = gaussian_filter(pores, (7, 0.6)) * 10
        plank *= np.clip(1 - 0.3 * pores, 0.65, 1)[..., None]
        img[:, xa:x1] = plank
        if xa > 0:
            img[:, xa - 2 : xa + 1] *= 0.45
            img[:, xa + 1 : xa + 6] *= np.linspace(0.8, 1, 5)[None, :, None]
    sheen = np.exp(-(((np.arange(W)[None, :] - W * 0.28) / (W * 0.30)) ** 2 + ((yy - H * 0.18) / (H * 0.32)) ** 2))
    img = img * (1 + 0.20 * sheen[..., None])
    return img


# --------------------------------------------------------------- compose ----
def compose(rgb, alpha, height, W=2268, H=3024):
    bg = walnut(H, W)
    PH, PW = alpha.shape
    target_h = H * 0.82
    s = target_h / PH
    rw, rh = PW * s, PH * s
    cx, cy = W * 0.515, H * 0.505
    ang = np.deg2rad(-3.2)
    corners = np.array([[-rw / 2, -rh / 2], [rw / 2, -rh / 2], [rw / 2, rh / 2], [-rw / 2, rh / 2]])
    rot = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    pts = corners @ rot.T + [cx, cy]
    # camera tilt: the far (top) end is a little narrower
    k = 0.045
    pts[0, 0] += rw * k
    pts[1, 0] -= rw * k
    pts[0, 1] += rh * 0.012
    pts[1, 1] += rh * 0.012
    src = np.float32([[0, 0], [PW, 0], [PW, PH], [0, PH]])
    M = cv2.getPerspectiveTransform(src, np.float32(pts))
    warped = cv2.warpPerspective(rgb, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT)
    a = cv2.warpPerspective(alpha, M, (W, H), flags=cv2.INTER_LINEAR)
    hgt = cv2.warpPerspective(height.astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)

    # shadows: a soft one from the window light, a tight contact one, more where the paper lifts
    lift = np.clip(hgt / 40, 0, 1)
    soft = cv2.GaussianBlur(np.roll(np.roll(a * (0.55 + 0.6 * lift), 34, 0), 22, 1), (0, 0), 30)
    contact = cv2.GaussianBlur(np.roll(np.roll(a, 6, 0), 4, 1), (0, 0), 5)
    shadow = np.clip(0.55 * soft + 0.35 * contact, 0, 0.8)
    bg *= (1 - shadow)[..., None]

    img = bg * (1 - a[..., None]) + warped * a[..., None]

    # room light: warm, from the top left, with lens vignetting
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    grad = 1.08 - 0.24 * (0.45 * xx / W + 0.55 * yy / H)
    r2 = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2
    vig = 1 - 0.20 * r2
    img *= (grad * vig)[..., None]
    img *= np.array([1.035, 1.0, 0.94], np.float32)
    return img


def camera(img):
    H, W = img.shape[:2]
    img = cv2.GaussianBlur(img, (0, 0), 0.7)
    # shallow depth of field: the far end is slightly soft
    far = cv2.GaussianBlur(img, (0, 0), 2.2)
    m = np.clip((0.14 - np.arange(H) / H) / 0.14, 0, 1)[:, None, None]
    img = img * (1 - m) + far * m
    # lateral chromatic aberration
    def scale(ch, f):
        Mx = cv2.getRotationMatrix2D((W / 2, H / 2), 0, f)
        return cv2.warpAffine(ch, Mx, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    img[..., 2] = scale(img[..., 2], 0.9993)
    img[..., 0] = scale(img[..., 0], 1.0007)
    # sensor noise, brighter areas noisier
    lum = img.mean(axis=2, keepdims=True)
    img += rng.standard_normal(img.shape).astype(np.float32) * (0.9 + 0.11 * np.sqrt(np.clip(lum, 0, 255)))
    img += gaussian_filter(rng.standard_normal((H, W)), 1.2)[..., None].astype(np.float32) * 2.0
    # mild sharpening, like a phone's image pipeline
    blur = cv2.GaussianBlur(img, (0, 0), 1.6)
    img = img + 0.45 * (img - blur)
    return np.clip(img, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    dots = build_receipt()
    rgb, alpha = print_paper(dots)
    rgb, alpha, height = deform(rgb, alpha)
    img = compose(rgb, alpha, height)
    img = camera(img)
    Image.fromarray(img).save(OUT, quality=90, subsampling=0)
    Image.fromarray(np.uint8(255 - dots * 255)).save('dots.png')
    print('saved', OUT, img.shape)
