# Spokane Online Sales website

Static site for **Spokane Online Sales LLC**. Host it on **GitHub Pages** (free). Point a cheap domain at it. Sell with **Stripe Payment Links** on each product page. Quote contract work, then send a **Stripe Invoice**.

Images and manuals are files in this folder. GitHub Pages will serve them. Do not put Stripe secret keys in this repo — GitHub Pages is public static files.

## What you get

- **Home** — landing page, product cards, contract-work pitch
- **Products** — catalog
- **Each product** — photos, description, specs, manuals, Stripe buy button
- **Contract work** — hire for electronics design (invoiced after a quote)
- **Contact** — email, optional form

## Cost

- **GitHub Pages:** free
- **This site:** free
- **Domain:** about $10–15 / year (Porkbun, Cloudflare, Namecheap)
- **Stripe:** no monthly fee. US cards are typically 2.9% + $0.30 per successful payment.
- **Email on your domain:** GitHub Pages does not include email. Use the registrar mailbox, Google Workspace, Fastmail, or similar.
- **Contact form:** optional free [Formspree](https://formspree.io) tier

GitHub Pages **can** host product photos and PDF manuals. Practical limits: about **100 MB per file**, keep the whole repo well under **1 GB**. Do not put large videos in the repo.

A payment link is one product per click. There is no multi-item cart.

## Preview on your computer

From this folder (Python 3):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python build.py
python -m http.server -d _site 4000
```

Open http://127.0.0.1:4000/

## Put it on GitHub Pages

Repo: [github.com/cagneymoreau](https://github.com/cagneymoreau) (work account).

1. Push `main` to GitHub.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After the workflow runs: `https://cagneymoreau.github.io/spokane-online-sales/`

If links look broken on that project URL, set in `site.yaml`:

```yaml
url: "https://cagneymoreau.github.io"
baseurl: "/spokane-online-sales"
```

With a custom domain, set `url` to that domain and `baseurl` to `""`.

## Cheap custom domain

1. Buy the domain.
2. Add a `CNAME` file containing only the domain, for example `spokaneonlinesales.com`
3. GitHub **Settings → Pages → Custom domain**, same name, wait for HTTPS.
4. At the registrar, use GitHub’s DNS instructions (A records for the apex, or CNAME for `www`).

## Add a product

```bash
./new-product.sh tank-sensor
```

That copies `_templates/product.md` to `products/tank-sensor.md` and makes a files folder.

Then:

1. Drop photos in `assets/images/products/` (`.jpg`, `.png`, `.webp`, or `.svg`).
2. Set `image:` and optional `gallery:` in the markdown file.
3. Drop PDFs in `assets/files/tank-sensor/` and list them under `files:`.
4. Write the sales copy in the markdown body.
5. In Stripe: [Payment links](https://dashboard.stripe.com/payment-links) → create a link for that SKU (collect shipping address). Paste it into `stripe_url:`, set `status: available`.
6. Run `python build.py` to preview, then push.

`status` can be `available`, `coming_soon`, or `sold_out`.

## Look like a real business

Edit `site.yaml`:

- `email` — use an address on your domain when you have one
- `phone` — optional
- `formspree_id` — optional, turns on the contact form
- `title` / `legal_name` / `tagline`

Replace the sample caliper listing when the real pack is ready. Replace `assets/images/logo.svg` if you want a different mark.

## Layout

```
site.yaml              # name, email, Formspree
products/              # one .md file per product
pages/                 # contract work, etc.
_templates/product.md
assets/images/
assets/files/          # manuals
build.py
new-product.sh
```
