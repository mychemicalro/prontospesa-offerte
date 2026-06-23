/* === Config === */
const ITEMS_PER_PAGE = 48;
let allDeals = [];
let displayedCount = 0;
let currentFiltered = [];

/* === Utility === */
const formatPrice = (n) => `€${Number(n).toFixed(2)}`;

const badgeClass = (pct) => {
  if (pct >= 50) return 'top';
  if (pct >= 40) return 'high';
  return '';
};

/* === Load Data === */
async function loadData() {
  try {
    const resp = await fetch('data/latest.json');
    const data = await resp.json();
    allDeals = data.deals || [];
    document.getElementById('lastUpdate').textContent = `📅 ${data.date || '—'}`;
    document.getElementById('totalDeals').textContent = `🏷️ ${allDeals.length} offerte`;
    populateCategories();
    applyFilters();
  } catch (e) {
    document.getElementById('dealsGrid').innerHTML =
      '<p style="text-align:center;padding:40px;color:#666">⏳ Nessun dato disponibile. I dati vengono aggiornati ogni mattina alle 07:20.</p>';
  }
}

/* === Categorie === */
function populateCategories() {
  const cats = [...new Set(allDeals.map(d => d.category).filter(Boolean))].sort();
  const sel = document.getElementById('categoryFilter');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

/* === Filtri === */
function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const cat = document.getElementById('categoryFilter').value;
  const minD = parseInt(document.getElementById('minDiscount').value) || 0;
  const sort = document.getElementById('sortBy').value;

  currentFiltered = allDeals.filter(d => {
    if (q && !d.name.toLowerCase().includes(q) && !d.vendor.toLowerCase().includes(q)) return false;
    if (cat && d.category !== cat) return false;
    if (minD > 0 && (d.real_discount_pct || d.label_discount || 0) < minD) return false;
    return true;
  });

  // Sort
  currentFiltered.sort((a, b) => {
    const da = a.real_discount_pct || a.label_discount || 0;
    const db = b.real_discount_pct || b.label_discount || 0;
    switch (sort) {
      case 'discount': return db - da;
      case 'price': return (a.price || 0) - (b.price || 0);
      case 'name': return a.name.localeCompare(b.name);
      case 'expire': return (a.expire || '').localeCompare(b.expire || '');
      default: return db - da;
    }
  });

  document.getElementById('resultsCount').textContent =
    `Mostrando 0 di ${currentFiltered.length} offerte`;

  displayedCount = 0;
  document.getElementById('dealsGrid').innerHTML = '';
  document.getElementById('loadMoreBtn').style.display = currentFiltered.length > ITEMS_PER_PAGE ? 'inline-block' : 'none';
  renderMore();
}

/* === Render === */
function renderMore() {
  const grid = document.getElementById('dealsGrid');
  const batch = currentFiltered.slice(displayedCount, displayedCount + ITEMS_PER_PAGE);

  batch.forEach(d => {
    const disc = d.real_discount_pct || d.label_discount || 0;
    const card = document.createElement('div');
    card.className = 'deal-card';

    card.innerHTML = `
      <span class="deal-badge ${badgeClass(disc)}">-${Math.round(disc)}%</span>
      <div class="deal-vendor">${escapeHtml(d.vendor || '')}</div>
      <div class="deal-name">${escapeHtml(d.name || '')}</div>
      <div class="deal-prices">
        <span class="deal-price">${formatPrice(d.price)}</span>
        ${d.price_full > d.price ? `<span class="deal-full-price">${formatPrice(d.price_full)}</span>` : ''}
      </div>
      <div class="deal-category">${escapeHtml(d.category || '')}</div>
      ${d.avg_price_2m ? `<div class="deal-category">Media 2 mesi: ${formatPrice(d.avg_price_2m)}</div>` : ''}
      <div class="deal-expire">${d.expire ? `Scade: ${d.expire}` : ''}</div>
    `;
    grid.appendChild(card);
  });

  displayedCount += batch.length;
  document.getElementById('resultsCount').textContent =
    `Mostrando ${displayedCount} di ${currentFiltered.length} offerte`;

  document.getElementById('loadMoreBtn').style.display =
    displayedCount >= currentFiltered.length ? 'none' : 'inline-block';
}

/* === Sanitize === */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* === Eventi === */
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('categoryFilter').addEventListener('change', applyFilters);
document.getElementById('sortBy').addEventListener('change', applyFilters);
document.getElementById('minDiscount').addEventListener('change', applyFilters);
document.getElementById('loadMoreBtn').addEventListener('click', renderMore);

/* === Avvio === */
loadData();
