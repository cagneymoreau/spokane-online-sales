#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

slug="${1:-}"
if [[ -z "$slug" ]]; then
  echo "Usage: ./new-product.sh my-product-slug"
  echo "Example: ./new-product.sh tank-sensor"
  exit 1
fi

if [[ ! "$slug" =~ ^[a-z0-9-]+$ ]]; then
  echo "Use a lowercase slug with hyphens only, e.g. tank-sensor"
  exit 1
fi

dest="products/${slug}.md"
if [[ -e "$dest" ]]; then
  echo "Already exists: $dest"
  exit 1
fi

mkdir -p "assets/images/products" "assets/files/${slug}"
cp _templates/product.md "$dest"
sed -i "s/your-slug/${slug}/g" "$dest"

cat > "assets/files/${slug}/README.txt" <<EOF
Put manuals and related files for "${slug}" in this folder.
Then point to them from products/${slug}.md under files:
EOF

echo "Created ${dest}"
echo "Add photos to assets/images/products/ (update image: and gallery: in the markdown)."
echo "Add manuals to assets/files/${slug}/"
echo "Paste a Shopify payment link into shopify_url when you want a Buy button."
echo "Then run: python3 build.py && python3 -m http.server -d _site 4000"
