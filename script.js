/* === Config === */
const DEALS_PAGE = 48;
const CATALOG_PAGE = 100;

let allDeals = [];
let allCatalog = [];
let currentTab = 'deals';
let currentSm = 'all';
let displayedCount = 0;
let currentFiltered = [];

/* === Utility === */
const formatPrice = (n) => n != null ? `€${Number(n).toFixed(2)}` : '—';
const safeDiscount = (d) => d.real_discount_pct || d.label_discount || 0;

const badgeClass = (pct) => {
  if (pct >= 50) return 'top';
  if (pct >= 40) return 'high';
  return '';
};

const smLabel = (sm) => {
  if (sm === 'pewex') return 'PEWEX';
  if (sm === 'cts') return 'CTS';
  return sm;
};

const smColor = (sm) => {
  if (sm === 'pewex') return '#28a745';
  if (sm === 'cts') return '#fd7e14';
  return '#666';
};

/* === Load Data === */
async function loadData() {
  try {
    const [dealsResp, catalogResp] = await Promise.all([
      fetch('data/latest.json'),
      fetch('data/catalog.json')
    ]);
    const dealsData = await dealsResp.json();
    const catalogData = await catalogResp.json();

    allDeals = dealsData.deals || [];
    allCatalog = catalogData.products || [];
    const meta = catalogData.supermarkets || {};

    document.getElementById('lastUpdate').textContent = `📅 ${dealsData.date || catalogData.date || '—'}`;

    const totalProducts = allCatalog.length;
    const promoCount = allCatalog.filter(p => p.is_promo).length;
    const smInfo = Object.entries(meta).map(([k, v]) => `${smLabel(k)}: ${v.total || 0} prod.`).join(' · ');
    document.getElementById('totalInfo').textContent =
      `📦 ${totalProducts} prodotti · 🔥 ${promoCount} in offerta · 🏪 ${smInfo}`;

    populateCategories();
    applyFilters();
  } catch (e) {
    document.getElementById('dealsGrid').innerHTML =
      '<p style="text-align:center;padding:40px;color:#666">⏳ Dati in aggiornamento. Riprova tra qualche minuto.</p>';
  }
}

/* === Categorie === */
function populateCategories() {
  const cats = [...new Set(allCatalog.map(p => p.category).filter(Boolean))].sort();
  const sel = document.getElementById('categoryFilter');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

/* === Supermercato Filter === */
function setSupermarket(sm) {
  currentSm = sm;
  document.querySelectorAll('.sm-tab').forEach(b => b.classList.toggle('active', b.dataset.sm === sm));
  displayedCount = 0;
  applyFilters();
}

document.querySelectorAll('.sm-tab').forEach(btn => {
  btn.addEventListener('click', () => setSupermarket(btn.dataset.sm));
});

/* === Tab Switching === */
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id.startsWith(tab)));

  document.querySelectorAll('.deals-only').forEach(el => el.style.display = tab === 'deals' ? 'block' : 'none');
  document.getElementById('catalogHint').style.display = tab === 'catalog' ? 'inline' : 'none';

  displayedCount = 0;
  applyFilters();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

/* === Filtri === */
function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const cat = document.getElementById('categoryFilter').value;
  const sort = document.getElementById('sortBy').value;
  const minD = parseInt(document.getElementById('minDiscount').value) || 0;

  const source = currentTab === 'deals' ? allDeals : allCatalog;

  currentFiltered = source.filter(item => {
    const name = item.name || '';
    const vendor = item.vendor || '';

    // Supermarket filter
    if (currentSm !== 'all' && item.supermarket !== currentSm) return false;

    // Search
    if (currentTab === 'catalog') {
      if (q.length < 2 && !cat) return true;
      if (q.length >= 2 && !name.toLowerCase().includes(q) && !vendor.toLowerCase().includes(q)) return false;
    } else {
      if (q && !name.toLowerCase().includes(q) && !vendor.toLowerCase().includes(q)) return false;
    }

    if (cat && item.category !== cat) return false;

    if (currentTab === 'deals') {
      if (minD > 0 && safeDiscount(item) < minD) return false;
    } else {
      if (minD > 0 && !item.is_promo) return false;
    }

    return true;
  });

  // Sort
  currentFiltered.sort((a, b) => {
    switch (sort) {
      case 'discount': {
        const da = currentTab === 'deals' ? safeDiscount(a) : (a.is_promo ? 100 : 0);
        const db = currentTab === 'deals' ? safeDiscount(b) : (b.is_promo ? 100 : 0);
        return db - da;
      }
      case 'price': return (a.price || 0) - (b.price || 0);
      case 'price-desc': return (b.price || 0) - (a.price || 0);
      case 'name': return (a.name || '').localeCompare(b.name || '');
      default: return (a.price || 0) - (b.price || 0);
    }
  });

  displayedCount = 0;

  const container = currentTab === 'deals' ? 'dealsGrid' : 'catalogGrid';
  document.getElementById('dealsGrid').innerHTML = '';
  document.getElementById('catalogGrid').innerHTML = '';

  const pageSize = currentTab === 'deals' ? DEALS_PAGE : CATALOG_PAGE;
  document.getElementById('loadMoreBtn').style.display = currentFiltered.length > pageSize ? 'inline-block' : 'none';
  updateStats();
  renderMore();
}

/* === Sm Badge === */
function smBadge(sm) {
  const label = smLabel(sm);
  const color = smColor(sm);
  return `<span class="sm-badge" style="background:${color};color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;white-space:nowrap">${label}</span>`;
}

/* === Render: Offerte (cards) === */
function renderDeals(batch) {
  const grid = document.getElementById('dealsGrid');
  batch.forEach(d => {
    const disc = safeDiscount(d);
    const card = document.createElement('div');
    card.className = 'deal-card';
    let alsoHtml = '';
    if (d.also_at && currentSm !== 'all') {
      alsoHtml = `<div class="deal-also" style="margin-top:6px;font-size:11px;color:#888">🔄 Anche su CTS: ${formatPrice(d.also_at.price)}</div>`;
    }
    card.innerHTML = `
      <span class="deal-badge ${badgeClass(disc)}">-${Math.round(disc)}%</span>
      ${smBadge(d.supermarket)}
      <div class="deal-vendor">${esc(d.vendor)}</div>
      <div class="deal-name">${esc(d.name)}</div>
      <div class="deal-prices">
        <span class="deal-price">${formatPrice(d.price)}</span>
        ${d.price_full > d.price ? `<span class="deal-full-price">${formatPrice(d.price_full)}</span>` : ''}
      </div>
      <div class="deal-category">${esc(d.category)}</div>
      ${d.avg_price_2m ? `<div class="deal-category">Media 2 mesi: ${formatPrice(d.avg_price_2m)}</div>` : ''}
      <div class="deal-expire">${d.expire ? `Scade: ${d.expire}` : ''}</div>
      ${alsoHtml}
    `;
    grid.appendChild(card);
  });
}

/* === Render: Catalogo (table rows) === */
function renderCatalog(batch) {
  const container = document.getElementById('catalogGrid');

  // Create table if first batch
  if (displayedCount === 0) {
    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="catalog-table">
          <thead>
            <tr>
              <th>Prodotto</th>
              <th class="hide-mobile">Categoria</th>
              <th>Prezzo</th>
              <th>Offerta</th>
              <th style="text-align:center">Supermercato</th>
            </tr>
          </thead>
          <tbody id="catalogBody"></tbody>
        </table>
      </div>
    `;
  }

  const tbody = document.getElementById('catalogBody');
  batch.forEach(p => {
    const tr = document.createElement('tr');
    let alsoHtml = '';
    if (p.also_at && currentSm !== 'all') {
      alsoHtml = `<div style="font-size:11px;color:#888;margin-top:2px">🔄 CTS: ${formatPrice(p.also_at.price)}</div>`;
    }
    tr.innerHTML = `
      <td>
        <div class="cat-name">${esc(p.name)}</div>
        <div class="cat-vendor">${esc(p.vendor)}</div>
        ${alsoHtml}
      </td>
      <td class="hide-mobile">${esc(p.category)}</td>
      <td class="cat-price ${p.is_promo ? 'promo' : ''}">
        ${formatPrice(p.price)}
        ${p.price_full ? `<span class="cat-full-price">${formatPrice(p.price_full)}</span>` : ''}
      </td>
      <td style="text-align:center">
        ${p.is_promo ? `<span class="cat-promo-badge">-${Math.round(p.discount_pct || 0)}%</span>` : '—'}
      </td>
      <td style="text-align:center">
        ${smBadge(p.supermarket)}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* === Render More === */
function renderMore() {
  const pageSize = currentTab === 'deals' ? DEALS_PAGE : CATALOG_PAGE;
  const batch = currentFiltered.slice(displayedCount, displayedCount + pageSize);

  if (currentTab === 'deals') {
    renderDeals(batch);
  } else {
    renderCatalog(batch);
  }

  displayedCount += batch.length;
  updateStats();

  document.getElementById('loadMoreBtn').style.display =
    displayedCount >= currentFiltered.length ? 'none' : 'inline-block';
}

/* === Stats === */
function updateStats() {
  document.getElementById('resultsCount').textContent =
    `Mostrando ${displayedCount} di ${currentFiltered.length} risultati`;
}

/* === Sanitize === */
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* === Eventi === */
document.getElementById('searchInput').addEventListener('input', (e) => {
  if (currentTab === 'deals') {
    displayedCount = 0;
    applyFilters();
  }
  if (currentTab === 'catalog' && e.target.value.length >= 2) {
    displayedCount = 0;
    applyFilters();
  }
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    displayedCount = 0;
    applyFilters();
  }
});

document.getElementById('categoryFilter').addEventListener('change', () => {
  displayedCount = 0;
  applyFilters();
});

document.getElementById('sortBy').addEventListener('change', () => {
  displayedCount = 0;
  applyFilters();
});

document.getElementById('minDiscount').addEventListener('change', () => {
  displayedCount = 0;
  applyFilters();
});

document.getElementById('loadMoreBtn').addEventListener('click', renderMore);

/* === Avvio === */
loadData();
