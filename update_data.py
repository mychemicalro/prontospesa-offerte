#!/usr/bin/env python3
"""Aggiorna i dati delle offerte e del catalogo per il sito GitHub Pages (multi-supermercato + prezzi medi)."""
import json, os, glob, re, sqlite3

HERMES_DATA = os.path.expanduser("~/.hermes/data/prontospesa")
REPO_DATA = os.path.expanduser("~/prontospesa-offerte/data")
DB_PATH = os.path.expanduser("~/.hermes/data/prontospesa/price_history.db")

def safe_round(v, digits=1):
    return round(v, digits) if v is not None else None

def load_avg_prices():
    """Carica i prezzi medi (ultimi 30gg) per ogni prodotto+supermercato dal DB."""
    if not os.path.exists(DB_PATH):
        return {}, {}
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Prezzo medio per ogni prodotto (tutti i prezzi, promo e non)
    cur.execute("""
        SELECT product_id, supermarket,
               ROUND(AVG(price), 4) as avg_price,
               COUNT(*) as samples,
               MAX(recorded_at) as last_seen
        FROM price_history
        WHERE recorded_at >= datetime('now', '-30 days', 'localtime')
        GROUP BY product_id, supermarket
    """)
    avg_rows = cur.fetchall()
    
    avg_map = {}  # key: (product_id, supermarket) -> avg_price
    for pid, sm, avg, samples, last in avg_rows:
        avg_map[(pid, sm)] = {"avg_price": avg, "samples": samples}
    
    # Prezzo medio NON-promo per ogni prodotto
    cur.execute("""
        SELECT product_id, supermarket,
               ROUND(AVG(price), 4) as avg_nonpromo,
               COUNT(*) as samples
        FROM price_history
        WHERE recorded_at >= datetime('now', '-30 days', 'localtime')
          AND is_promo = 0
        GROUP BY product_id, supermarket
    """)
    nonpromo_rows = cur.fetchall()
    
    nonpromo_map = {}
    for pid, sm, avg, samples in nonpromo_rows:
        nonpromo_map[(pid, sm)] = {"avg_nonpromo": avg, "samples": samples}
    
    conn.close()
    return avg_map, nonpromo_map

# === Carica medie ===
AVG_MAP, NONPROMO_MAP = load_avg_prices()
print(f"📊 Prezzi medi caricati: {len(AVG_MAP)} prodotti con storico 30gg")

# === 1. Carica catalogo completo ===
catalog_path = os.path.join(HERMES_DATA, "catalog_latest.json")
if not os.path.exists(catalog_path):
    print("[SILENT]")
    exit(0)

with open(catalog_path) as f:
    catalog = json.load(f)

products = catalog.get("products", [])
meta = catalog.get("meta", {})

# Estrai solo i campi utili per il web + cross-ref + prezzo medio
def slim_product(p):
    pid = p.get("id")
    sm = p.get("supermarket", "pewex")
    avg_info = AVG_MAP.get((pid, sm), {})
    nonpromo_info = NONPROMO_MAP.get((pid, sm), {})
    
    entry = {
        "id": pid,
        "name": p.get("name", ""),
        "vendor": p.get("vendor", ""),
        "category": p.get("category", ""),
        "price": p.get("price"),
        "price_full": p.get("price_full") if p.get("price_full") and p.get("price_full") > p.get("price", 0) else None,
        "is_promo": p.get("is_promo", False),
        "discount_pct": safe_round(p.get("discount_pct")),
        "promo_expire": p.get("promo_expire", ""),
        "supermarket": sm,
    }
    
    # Prezzo medio 30gg (tutti i prezzi registrati)
    if "avg_price" in avg_info:
        entry["avg_price"] = safe_round(avg_info["avg_price"], 2)
        entry["avg_samples"] = avg_info.get("samples", 0)
    
    # Prezzo medio NON-promo 30gg (migliore indicatore del prezzo "vero")
    if "avg_nonpromo" in nonpromo_info:
        entry["avg_nonpromo"] = safe_round(nonpromo_info["avg_nonpromo"], 2)
    
    # Cross-reference match
    also = p.get("also_at")
    if also:
        also_pid = also.get("product_id")
        also_sm = also.get("supermarket", "cts")
        also_avg = AVG_MAP.get((also_pid, also_sm), {})
        also_np = NONPROMO_MAP.get((also_pid, also_sm), {})
        entry["also_at"] = {
            "price": also.get("price_display") or also.get("price"),
            "price_full": also.get("price"),
            "is_promo": also.get("is_promo", False),
            "discount_pct": safe_round(also.get("discount_pct")),
            "promo_expire": also.get("promo_expire", ""),
        }
        if "avg_price" in also_avg:
            entry["also_at"]["avg_price"] = safe_round(also_avg["avg_price"], 2)

    return entry

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
    raw_deals = data.get("deals", [])
    for d in raw_deals:
        pid = d.get("product_id")
        sm = d.get("supermarket", "pewex")
        nonpromo_info = NONPROMO_MAP.get((pid, sm), {})
        avg_info = AVG_MAP.get((pid, sm), {})
        
        deal_entry = {
            "name": d["name"],
            "vendor": d.get("vendor", ""),
            "price": d["price"],
            "price_full": d.get("price_full", d["price"]),
            "label_discount": safe_round(d.get("label_discount")),
            "real_discount_pct": safe_round(d.get("real_discount_pct") or d.get("label_discount")),
            "category": d.get("category", ""),
            "expire": d.get("expire", ""),
            "avg_price_2m": safe_round(d.get("avg_price_2m"), 2),
            "samples": d.get("samples", 0),
            "supermarket": sm,
        }
        # Prezzo medio non-promo 30gg
        if "avg_nonpromo" in nonpromo_info:
            deal_entry["avg_nonpromo"] = safe_round(nonpromo_info["avg_nonpromo"], 2)
        if "avg_price" in avg_info:
            deal_entry["avg_price_all"] = safe_round(avg_info["avg_price"], 2)
        
        deals.append(deal_entry)

# === 3. Scrivi i file ===
os.makedirs(REPO_DATA, exist_ok=True)
os.makedirs(os.path.join(REPO_DATA, "history"), exist_ok=True)

# Catalogo completo
with open(os.path.join(REPO_DATA, "catalog.json"), "w") as f:
    json.dump({
        "date": meta.get("date", ""),
        "supermarkets": meta.get("supermarkets", {}),
        "products": slim_products
    }, f, indent=2, ensure_ascii=False)

catalog_size_mb = os.path.getsize(os.path.join(REPO_DATA, "catalog.json")) / 1024 / 1024

# Offerte (latest.json)
if deals:
    with open(os.path.join(REPO_DATA, "latest.json"), "w") as f:
        json.dump({"date": deal_date, "total_deals": len(deals), "deals": deals}, f, indent=2, ensure_ascii=False)

    with open(os.path.join(REPO_DATA, "history", f"{deal_date}.json"), "w") as f:
        json.dump({"date": deal_date, "total_deals": len(deals), "deals": deals}, f, indent=2, ensure_ascii=False)

# Stats
sm = meta.get("supermarkets", {})
promo_count = sum(v.get("promo", 0) for v in sm.values())
total_count = sum(v.get("total", 0) for v in sm.values())
avg_count = len(AVG_MAP)
stats = {
    "total_products": total_count,
    "promo_products": promo_count,
    "date": meta.get("date", ""),
    "deals_count": len(deals),
    "supermarkets": sm,
    "products_with_avg": avg_count,
}
with open(os.path.join(REPO_DATA, "stats.json"), "w") as f:
    json.dump(stats, f)

print(f"Dati aggiornati: {stats['date']}")
print(f"  📦 Catalogo: {stats['total_products']} prodotti ({catalog_size_mb:.1f} MB)")
print(f"  🔥 Offerte: {stats['promo_products']} in promo, {stats['deals_count']} con analisi storico")
print(f"  📊 Prezzi medi: {avg_count} prodotti con storico 30gg")
print(f"  🏪 Supermercati: {', '.join(sm.keys())}")
