#!/usr/bin/env python3
"""Aggiorna i dati delle offerte per il sito GitHub Pages."""
import json, os, glob, re, shutil

HERMES_DATA = os.path.expanduser("~/.hermes/data/prontospesa")
REPO_DATA = os.path.expanduser("~/prontospesa-offerte/data")

def safe_round(v, digits=1):
    return round(v, digits) if v is not None else None

# Trova l'ultimo file deals
deal_files = sorted(glob.glob(os.path.join(HERMES_DATA, "deals_*.json")), reverse=True)
if not deal_files:
    print("[SILENT]")
    exit(0)

latest = deal_files[0]
date_match = re.search(r"deals_(\d{4}-\d{2}-\d{2})", os.path.basename(latest))
if not date_match:
    print("[SILENT]")
    exit(0)

date_str = date_match.group(1)

with open(latest) as f:
    data = json.load(f)

deals = data.get("deals", data if isinstance(data, list) else [])
if isinstance(data, dict) and "deals" in data:
    deals = data["deals"]

deals.sort(key=lambda d: d.get("real_discount_pct") or d.get("label_discount") or 0, reverse=True)

web_data = {
    "date": date_str,
    "total_deals": len(deals),
    "total_products": 10000,
    "generated_at": os.path.getmtime(latest),
    "deals": [{
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
    } for d in deals]
}

os.makedirs(REPO_DATA, exist_ok=True)
os.makedirs(os.path.join(REPO_DATA, "history"), exist_ok=True)

with open(os.path.join(REPO_DATA, "latest.json"), "w") as f:
    json.dump(web_data, f, indent=2, ensure_ascii=False)

with open(os.path.join(REPO_DATA, "history", f"{date_str}.json"), "w") as f:
    json.dump(web_data, f, indent=2, ensure_ascii=False)

print(f"Dati aggiornati: {date_str} - {len(deals)} offerte ({os.path.getsize(os.path.join(REPO_DATA, 'latest.json')) / 1024:.0f} KB)")
