#!/usr/bin/env python3
"""Aggiorna i dati delle offerte e del catalogo per il sito GitHub Pages."""
import json, os, glob, re

HERMES_DATA = os.path.expanduser("~/.hermes/data/prontospesa")
REPO_DATA = os.path.expanduser("~/prontospesa-offerte/data")

def safe_round(v, digits=1):
    return round(v, digits) if v is not None else None

# === 1. Carica catalogo completo ===
catalog_path = os.path.join(HERMES_DATA, "catalog_latest.json")
if not os.path.exists(catalog_path):
    print("[SILENT]")
    exit(0)

with open(catalog_path) as f:
    catalog = json.load(f)

products = catalog.get("products", catalog if isinstance(catalog, list) else [])
if isinstance(catalog, dict) and "products" in catalog:
    products = catalog["products"]

# Estrai solo i campi utili per il web
def slim_product(p):
    return {
        "id": p.get("id"),
        "name": p.get("name", ""),
        "vendor": p.get("vendor", ""),
        "category": p.get("category", ""),
        "price": p.get("price"),
        "price_full": p.get("price_full") if p.get("price_full") and p.get("price_full") > p.get("price", 0) else None,
        "is_promo": p.get("is_promo", False),
        "discount_pct": safe_round(p.get("discount_pct")),
        "promo_expire": p.get("promo_expire", ""),
    }

slim_products = [slim_product(p) for p in products]

# === 2. Carica deals (offerte con storico) ===
deal_files = sorted(glob.glob(os.path.join(HERMES_DATA, "deals_*.json")), reverse=True)
deals = []
deal_date = ""
if deal_files:
    latest_deals = deal_files[0]
    date_match = re.search(r"deals_(\d{4}-\d{2}-\d{2})", os.path.basename(latest_deals))
    if date_match:
        deal_date = date_match.group(1)
    with open(latest_deals) as f:
        data = json.load(f)
    raw_deals = data.get("deals", data if isinstance(data, list) else [])
    for d in raw_deals:
        deals.append({
            "name": d["name"],
            "vendor": d.get("vendor", ""),
            "price": d["price"],
            "price_full": d.get("price_full", d["price"]),
            "label_discount": safe_round(d.get("label_discount")),
            "real_discount_pct": safe_round(d.get("real_discount_pct") or d.get("label_discount")),
            "category": d.get("category", ""),
            "expire": d.get("expire", ""),
            "avg_price_2m": safe_round(d.get("avg_price_2m"), 2),
            "samples": d.get("samples", 0)
        })

# === 3. Scrivi i file ===
os.makedirs(REPO_DATA, exist_ok=True)
os.makedirs(os.path.join(REPO_DATA, "history"), exist_ok=True)

# Catalogo completo
with open(os.path.join(REPO_DATA, "catalog.json"), "w") as f:
    json.dump({"date": catalog.get("meta", {}).get("date", ""), "products": slim_products}, f, indent=2, ensure_ascii=False)

catalog_size_mb = os.path.getsize(os.path.join(REPO_DATA, "catalog.json")) / 1024 / 1024

# Offerte (latest.json)
if deals:
    with open(os.path.join(REPO_DATA, "latest.json"), "w") as f:
        json.dump({"date": deal_date, "total_deals": len(deals), "deals": deals}, f, indent=2, ensure_ascii=False)

    with open(os.path.join(REPO_DATA, "history", f"{deal_date}.json"), "w") as f:
        json.dump({"date": deal_date, "total_deals": len(deals), "deals": deals}, f, indent=2, ensure_ascii=False)

# Stats
promo_count = sum(1 for p in products if p.get("is_promo"))
stats = {
    "total_products": len(products),
    "promo_products": promo_count,
    "date": catalog.get("meta", {}).get("date", ""),
    "deals_count": len(deals)
}
with open(os.path.join(REPO_DATA, "stats.json"), "w") as f:
    json.dump(stats, f)

print(f"Dati aggiornati: {stats['date']}")
print(f"  📦 Catalogo: {stats['total_products']} prodotti ({catalog_size_mb:.1f} MB)")
print(f"  🔥 Offerte: {stats['promo_products']} in promo, {stats['deals_count']} con analisi storico")
