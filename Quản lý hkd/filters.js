// filters.js
// === HỆ THỐNG LỌC & TÔ MÀU CHO POPUP KHỚP TỒN KHO ===

let activeFilters = {
  sort: null,
  priceDiff: null,
  fuzzy: null,
  priceValue: null,
  priceTarget: null
};

let originalExportItems = [];
let originalStockItems = [];

// === GỌI TỪ main.js ===
window.applyFilter = applyFilter;
window.handlePriceValueInput = handlePriceValueInput;
window.resetFilters = resetFilters;
window.filterBothColumns = filterBothColumns;
window.renderFilteredLists = renderFilteredLists;

// === TÌM KIẾM TOÀN CỤC ===
function filterBothColumns(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    document.querySelectorAll('.match-item').forEach(item => {
      item.style.display = 'block';
    });
    return;
  }

  document.querySelectorAll('.match-item').forEach(item => {
    const searchText = (item.dataset.search || '').toLowerCase();
    item.style.display = searchText.includes(q) ? 'block' : 'none';
  });
}

// === ÁP DỤNG LỌC ===
function applyFilter(type, value) {
  console.log('FILTER CLICKED', { type, value });
  switch (type) {
    case 'sort':
      activeFilters.sort = value;
      break;
    case 'priceDiff':
      activeFilters.priceDiff = value;
      break;
    case 'fuzzy':
      activeFilters.fuzzy = value;
      break;
    case 'priceTarget':
      activeFilters.priceTarget = activeFilters.priceTarget === value ? null : value;
      document.getElementById('priceValueInput') && (document.getElementById('priceValueInput').value = '');
      activeFilters.priceValue = null;
      break;
  }
  renderFilteredLists();
}

function handlePriceValueInput(val) {
  const n = parseFloat(val);
  activeFilters.priceValue = isNaN(n) ? null : n;
  activeFilters.priceTarget = null;
  renderFilteredLists();
}

function resetFilters() {
  activeFilters = { sort: null, priceDiff: null, fuzzy: null, priceValue: null, priceTarget: null };
  renderFilteredLists();
  window.showToast('Đã xóa tất cả bộ lọc', 1500, 'info');
}

// === LƯU DỮ LIỆU GỐC ===
function cacheOriginalLists() {
  if (!originalExportItems.length) {
    originalExportItems = Array.from(document.querySelectorAll('#exportItemsList .match-item')).map(el => ({
      html: el.outerHTML,
      name: el.querySelector('b')?.textContent?.trim() || '',
      unit: el.textContent.match(/SL: .*? ([^\s]+)$/)?.[1] || '',
      price: parseFloat(el.textContent.replace(/[^\d]/g, '')) || 0
    }));
  }

  if (!originalStockItems.length) {
    originalStockItems = Array.from(document.querySelectorAll('#stockItemsList .match-item')).map(el => ({
      html: el.outerHTML,
      name: el.querySelector('b')?.textContent?.trim() || '',
      unit: el.textContent.match(/SL: .*? ([^\s]+)$/)?.[1] || '',
      price: parseFloat(el.textContent.replace(/[^\d]/g, '')) || 0
    }));
  }
}

// === ĐỘ TƯƠNG ĐỒNG CHUỖI (substring) ===
function substringSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase(); b = b.toLowerCase();
  let longest = 0;
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        longest = Math.max(longest, dp[i][j]);
      }
    }
  }
  return longest / Math.max(a.length, b.length);
}

function getColorBySim(sim) {
  if (sim >= 0.4) return '#d9f7be';
  if (sim >= 0.3) return '#fff7a3';
  if (sim >= 0.2) return '#ffe0b2';
  if (sim >= 0.1) return '#cce5ff';
  return '';
}

// === RENDER LẠI SAU KHI LỌC ===
function renderFilteredLists() {
  cacheOriginalLists();

  let exportFiltered = [...originalExportItems];
  let stockFiltered = [...originalStockItems];
  const matchedPairs = [];

  // --- SORT ---
  if (activeFilters.sort === 'az') {
    exportFiltered.sort((a, b) => a.name.localeCompare(b.name));
    stockFiltered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (activeFilters.sort === 'za') {
    exportFiltered.sort((a, b) => b.name.localeCompare(a.name));
    stockFiltered.sort((a, b) => b.name.localeCompare(a.name));
  }

  // --- LỌC GIÁ SO SÁNH CẶP ---
  if (activeFilters.priceDiff) {
    let threshold = 0.1;
    if (activeFilters.priceDiff === 'lt10') threshold = 0.1;
    if (activeFilters.priceDiff === 'lt15') threshold = 0.15;
    if (activeFilters.priceDiff === 'eq0') threshold = 0;

    const matchedExport = new Set(), matchedStock = new Set();
    for (const exp of exportFiltered) {
      for (const stock of stockFiltered) {
        const p1 = exp.price, p2 = stock.price;
        if (!p1 || !p2) continue;
        const diffRatio = Math.abs(p1 - p2) / ((p1 + p2) / 2);
        if ((threshold === 0 && Math.abs(p1 - p2) < 1) || diffRatio <= threshold) {
          matchedExport.add(exp);
          matchedStock.add(stock);
        }
      }
    }
    exportFiltered = Array.from(matchedExport);
    stockFiltered = Array.from(matchedStock);
  }

  // --- LỌC GIÁ NHẬP TAY ---
  if (activeFilters.priceValue) {
    const target = activeFilters.priceValue;
    const min = target * 0.85, max = target * 1.15;
    exportFiltered = exportFiltered.filter(e => e.price >= min && e.price <= max);
    stockFiltered = stockFiltered.filter(s => s.price >= min && s.price <= max);
  }

  // --- LỌC GIÁ THEO NÚT NHANH ---
  if (activeFilters.priceTarget) {
    const target = activeFilters.priceTarget;
    const min = target * 0.85, max = target * 1.15;
    exportFiltered = exportFiltered.filter(e => e.price >= min && e.price <= max);
    stockFiltered = stockFiltered.filter(s => s.price >= min && s.price <= max);
  }

  // --- LỌC TƯƠNG ĐỒNG TÊN ---
  if (activeFilters.fuzzy) {
    const threshold = activeFilters.fuzzy;
    const matchedExport = new Set(), matchedStock = new Set();
    for (const exp of exportFiltered) {
      for (const stock of stockFiltered) {
        const sim = substringSimilarity(exp.name, stock.name);
        if (sim >= threshold) {
          matchedExport.add(exp);
          matchedStock.add(stock);
          matchedPairs.push({ expName: exp.name, stockName: stock.name, sim });
        }
      }
    }
    exportFiltered = Array.from(matchedExport);
    stockFiltered = Array.from(matchedStock);
  }

  // --- TÔ MÀU ---
  function colorize(html, name) {
    const pair = matchedPairs.find(p => p.expName === name || p.stockName === name);
    if (!pair) return html;
    const color = getColorBySim(pair.sim);
    return color ? html.replace(/<div class="match-item"/, `<div class="match-item" style="background:${color}"`) : html;
  }

  // --- RENDER ---
  const noData = '<p style="text-align:center;color:#999;">Không có dữ liệu</p>';
  document.getElementById('exportItemsList').innerHTML = exportFiltered.length ? exportFiltered.map(i => colorize(i.html, i.name)).join('') : noData;
  document.getElementById('stockItemsList').innerHTML = stockFiltered.length ? stockFiltered.map(i => colorize(i.html, i.name)).join('') : noData;

  window.showToast('Đã áp dụng bộ lọc', 1200, 'info');
}