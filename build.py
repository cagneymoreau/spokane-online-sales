#!/usr/bin/env python3
"""Build the static site into _site/."""

from __future__ import annotations

import os
import shutil
from datetime import date
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent
TEMPLATES = ROOT / "templates"
PRODUCTS = ROOT / "products"
PAGES = ROOT / "pages"
ASSETS = ROOT / "assets"
OUT = ROOT / "_site"


def load_yaml(path: Path):
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = yaml.safe_load(parts[1]) or {}
    return meta, parts[2]


def md_to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["extra", "smarty"])


def url_join(baseurl: str, path: str) -> str:
    path = path if path.startswith("/") else f"/{path}"
    if not baseurl:
        return path
    return f"{baseurl.rstrip('/')}{path}"


def write(path: Path, html: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")


def load_products() -> list[dict]:
    items = []
    if not PRODUCTS.exists():
        return items
    for path in sorted(PRODUCTS.glob("*.md")):
        if path.name.startswith("_"):
            continue
        try:
            meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise SystemExit(f"YAML error in {path}: {exc}") from exc
        slug = path.stem
        product = {
            **meta,
            "slug": slug,
            "url": f"/products/{slug}/",
            "body_html": md_to_html(body),
            "gallery": meta.get("gallery") or [],
            "files": meta.get("files") or [],
            "specs": meta.get("specs") or {},
            "status": meta.get("status") or "available",
        }
        items.append(product)
    items.sort(key=lambda p: p.get("title") or p["slug"])
    return items


def main() -> None:
    site = load_yaml(ROOT / "site.yaml")
    baseurl = os.environ.get("BASEURL", site.get("baseurl") or "")
    site["baseurl"] = baseurl
    site["year"] = date.today().year

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html"]),
    )
    env.globals["site"] = site
    env.globals["url"] = lambda path: url_join(baseurl, path)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    (OUT / ".nojekyll").write_text("", encoding="utf-8")

    if ASSETS.exists():
        shutil.copytree(ASSETS, OUT / "assets")

    cname = ROOT / "CNAME"
    if cname.exists():
        shutil.copy2(cname, OUT / "CNAME")

    products = load_products()

    pages = {
        "index.html": ("home.html", {"products": products, "page": {"title": "Home", "url": "/"}}),
        "products/index.html": (
            "catalog.html",
            {"products": products, "page": {"title": "Products", "url": "/products/"}},
        ),
        "contact/index.html": (
            "contact.html",
            {"page": {"title": "Contact", "url": "/contact/"}},
        ),
        "404.html": ("404.html", {"page": {"title": "Page not found", "url": "/404.html"}}),
    }

    for rel, (template_name, ctx) in pages.items():
        html = env.get_template(template_name).render(**ctx)
        write(OUT / rel, html)

    for md_path in sorted(PAGES.glob("*.md")):
        meta, body = split_frontmatter(md_path.read_text(encoding="utf-8"))
        slug = str(meta.get("permalink") or md_path.stem).strip("/")
        body = env.from_string(body).render()
        page = {
            **meta,
            "url": f"/{slug}/",
            "body_html": md_to_html(body),
        }
        html = env.get_template("page.html").render(page=page)
        write(OUT / slug / "index.html", html)

    for product in products:
        html = env.get_template("product.html").render(
            page={**product, "title": product.get("title")},
            product=product,
        )
        write(OUT / "products" / product["slug"] / "index.html", html)

    print(f"Built {OUT} ({len(products)} products)")


if __name__ == "__main__":
    main()
