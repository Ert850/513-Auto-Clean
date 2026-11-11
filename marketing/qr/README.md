# Printed QR codes

Made November 11, 2026, for the two print pieces, from the owner's recorded answers that day. **Once printed, these can never change.**

| Piece | The code opens | Files |
|---|---|---|
| Golf course booklet (the half-page handout golfers get at the start of a round) | `https://513autoclean.com/golf` | `513autoclean-golf-qr.*` |
| Prestige Living magazine | `https://513autoclean.com/prestige` | `513autoclean-prestige-qr.*` |

## Send these to the printers

- **First choice:** the **PDF** or **SVG**. They're vector, so they stay sharp at any size.
- **EPS:** for older design software.
- **PNG:** only if they ask for pixels. The 574 px file is about 2 inches at 300 dpi; the 2378 px file is about 4 inches at 600 dpi.

**Print rules for the designer:**
- **Size:** at least **0.75 inch (2 cm) wide**, including the white margin. 1 inch or more is better on a booklet handled outdoors.
- **Margin:** keep the **white margin** around the code (4 squares wide, already in the files). Nothing printed inside it.
- **Colours:** **black on white**, or a very dark colour on a light background. Never light on dark, and never a photo behind it.
- **Don't change the code:** don't stretch it, recolour single squares or put a logo over it.
- **Before the final print run:** scan a printed proof with an iPhone and an Android phone.

## Why these won't break

- **The codes hold only a short address on our own domain.** Where that address leads is set in `netlify.toml` and can change at any time without reprinting. Today `/golf` and `/prestige` land on the home page, tagged so analytics and the booking email name the source. A `golf.html` or `prestige.html` page takes over its address on its own.
- **Highest error correction (H):** up to 30% of the code can be scuffed, torn or dirty and it still scans. Tested with the zxing scanner engine: both codes read after the corner was torn off, a patch in the middle was whited out, a black scratch was drawn across, after heavy blur, and at 0.33 inch.
- **A test guards the addresses.** `web/lib/site/printed-qr.test.ts` fails if either address stops leading somewhere, if a redirect becomes a 301 (a browser keeps a 301 forever, so a later change would never reach anyone who had scanned once), if the generator's addresses change, or if any file below changes.
- **The files are rebuilt byte for byte** by `python3 marketing/qr/make_qr.py` (needs `pip install segno`), so they can always be remade identically.

## Must stay true for as long as the pieces are in circulation (about a year from spring 2027)

1. **The domain `513autoclean.com` stays registered**, with auto-renew on. If it lapses, every printed code dies.
2. **The site stays on Netlify, or its new host serves the same two addresses.** Moving hosts means carrying these redirects over.
3. **The addresses reach the live site before the pieces are handed out.** Today the redirects exist only on the `eNov6` branch: on the live site, `/golf` and `/prestige` show "page not found" until the branch is merged.

## Checksums (SHA-256) of the files as sent

| File | SHA-256 |
|---|---|
| `513autoclean-golf-qr-2378px.png` | `27013ae333b25e5a9df264b8bc1a5eeb6878e811dfe73070be8003b391ad75d7` |
| `513autoclean-golf-qr-574px.png` | `2f6c7cd4486eaa6048cdaa734fd0497736f342315a7caf498496cefe28c59a57` |
| `513autoclean-golf-qr.eps` | `a30421e2cf6d40f809a99d5667d47f9fa9896371ddeca0af6037e91b270492e9` |
| `513autoclean-golf-qr.pdf` | `fb61bd5aea81feb936cc706bac3d68b8fc28ae40c92fbe2cdbbb614a85a07f42` |
| `513autoclean-golf-qr.svg` | `e1d0c9bfa544721822267dff2b48de188d51c551b885e6d2f87d65a830954241` |
| `513autoclean-prestige-qr-2378px.png` | `e9cf7db5000af39535a84e8f87af11dbf68d75f1af1f957376a9425eb2963688` |
| `513autoclean-prestige-qr-574px.png` | `f99a39afb44909c23fd35c663187ccf84f7c90cd96ba0d1c6ce7e7ec2acc8462` |
| `513autoclean-prestige-qr.eps` | `6a4c94158728c213f9c87ad44b92589ea1ace36f70f0168db9a99dba1cca08e7` |
| `513autoclean-prestige-qr.pdf` | `4e949acec4852909a694254dc02b82c1a54d473ec1a112ca8ba7e94246f1e798` |
| `513autoclean-prestige-qr.svg` | `8ba0e3043a61955904088109d1e4e2af31ddf0dceb88acb5ce4e0932ae42dd84` |
