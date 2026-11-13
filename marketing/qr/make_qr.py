"""
Print QR codes for the golf booklet and Prestige Living (owner, November 11, 2026).

These codes are PRINTED and cannot be changed after print. They encode only a
short address on our own domain; where that address leads is decided by the
redirect in netlify.toml, which can change at any time without reprinting.
Never change the URLS below for a code that has gone to print: make a new one.

Run:  python3 marketing/qr/make_qr.py   (needs `segno`, pip install segno)
The output is deterministic: running it again gives identical codes.
"""
import pathlib, re, segno

HERE = pathlib.Path(__file__).parent
URLS = {
    "golf": "https://513autoclean.com/golf",
    "prestige": "https://513autoclean.com/prestige",
}
# H = 30% of the code can be damaged and it still scans (scuffs, folds, dirt).
ERROR = "h"
BORDER = 4  # the standard quiet zone, in modules. Never print it smaller.



def pin_dates(pdf, eps):
    """The PDF and EPS carry the time they were made. Pin it to the day the codes
    were sent, so running this again gives byte-identical files and the
    checksums in README.md keep proving nothing changed. Same length, so the
    PDF's byte offsets stay valid."""
    for path, pattern, fixed in (
        (pdf, rb"/CreationDate\(D:\d{14}[^)]*\)", b"/CreationDate(D:20261111000000-05'00')"),
        (eps, rb"%%CreationDate: [^\r\n]*", b"%%CreationDate: 2026-11-11 00:00:00"),
    ):
        data = pathlib.Path(path).read_bytes()
        new, n = re.subn(pattern, lambda m: fixed.ljust(len(m.group(0))), data)
        assert n == 1, f"{path}: creation date not found"
        pathlib.Path(path).write_bytes(new)


for name, url in URLS.items():
    qr = segno.make_qr(url, error=ERROR, boost_error=False)
    base = HERE / f"513autoclean-{name}-qr"
    qr.save(f"{base}.svg", scale=10, border=BORDER, dark="#000000", light="#ffffff", xmldecl=True, svgns=True, title=f"513 Auto Clean, {url}")
    qr.save(f"{base}.pdf", scale=10, border=BORDER, dark="#000000", light="#ffffff")
    qr.save(f"{base}.eps", scale=10, border=BORDER, dark="#000000", light="#ffffff")
    pin_dates(f"{base}.pdf", f"{base}.eps")
    # About 2 inches at 300 dpi and 4 inches at 600 dpi, for anyone who needs pixels.
    width = qr.symbol_size(border=BORDER)[0]
    for px, dpi in ((600, 300), (2400, 600)):
        scale = px // width
        qr.save(f"{base}-{width * scale}px.png", scale=scale, border=BORDER, dark="#000000", light="#ffffff", dpi=dpi)
    print(name, url, "version", qr.version, "error", qr.error, "modules", width)
