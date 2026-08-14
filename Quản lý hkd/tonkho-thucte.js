// tonkho-thucte.js - Tồn kho thực tế (Tồn kho - Xuất kho)
// ============================================================

// ==================== GLOBAL VARIABLES ====================
var _ttFilterText = '';
var _ttFilterStatus = 'all';
var _ttSortBy = 'name';
var _ttSortDir = 'asc';
var _ttDragItem = null;
var _ttSelectedItems = new Set();
var _manualMatchCache = {};       // xuatkho -> tonkho
var _manualMatchCacheReverse = {}; // tonkho -> xuatkho

// ==================== UTILITY FUNCTIONS ====================

function levenshteinDistance(a, b) {
  var alen = a.length, blen = b.length;
  var matrix = [];
  for (var i = 0; i <= alen; i++) { matrix[i] = [i]; }
  for (var j = 0; j <= blen; j++) { matrix[0][j] = j; }
  for (var i = 1; i <= alen; i++) {
    for (var j = 1; j <= blen; j++) {
      var cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i-1][j] + 1, matrix[i][j-1] + 1, matrix[i-1][j-1] + cost);
    }
  }
  return matrix[alen][blen];
}

function normalizeName(name) {
  if (!name) return '';
  var s = String(name).toLowerCase().trim();
  var map = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a','â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e','ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o','ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u','ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d',
    'À':'A','Á':'A','Ả':'A','Ã':'A','Ạ':'A','Ă':'A','Ắ':'A','Ằ':'A','Ẳ':'A','Ẵ':'A','Ặ':'A','Â':'A','Ấ':'A','Ầ':'A','Ẩ':'A','Ẫ':'A','Ậ':'A',
    'È':'E','É':'E','Ẻ':'E','Ẽ':'E','Ẹ':'E','Ê':'E','Ế':'E','Ề':'E','Ể':'E','Ễ':'E','Ệ':'E',
    'Ì':'I','Í':'I','Ỉ':'I','Ĩ':'I','Ị':'I',
    'Ò':'O','Ó':'O','Ỏ':'O','Õ':'O','Ọ':'O','Ô':'O','Ố':'O','Ồ':'O','Ổ':'O','Ỗ':'O','Ộ':'O','Ơ':'O','Ớ':'O','Ờ':'O','Ở':'O','Ỡ':'O','Ợ':'O',
    'Ù':'U','Ú':'U','Ủ':'U','Ũ':'U','Ụ':'U','Ư':'U','Ứ':'U','Ừ':'U','Ử':'U','Ữ':'U','Ự':'U',
    'Ỳ':'Y','Ý':'Y','Ỷ':'Y','Ỹ':'Y','Ỵ':'Y','Đ':'D'
  };
  var result = '';
  for (var i = 0; i < s.length; i++) { result += map[s[i]] || s[i]; }
  result = result.replace(/[^a-z0-9\s]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;
  var n1 = String(name1).toLowerCase().trim();
  var n2 = String(name2).toLowerCase().trim();
  if (n1 === n2) return 100;
  var norm1 = normalizeName(n1);
  var norm2 = normalizeName(n2);
  if (norm1 === norm2) return 95;
  var dist = levenshteinDistance(n1, n2);
  var maxLen = Math.max(n1.length, n2.length);
  var pct = maxLen > 0 ? Math.round((1 - dist / maxLen) * 100) : 0;
  if (norm1 === norm2 && pct < 90) { pct = Math.max(pct, 90); }
  return Math.min(100, Math.max(0, pct));
}

// ==================== MANUAL MATCH CACHE (xuatkho -> tonkho) ====================

function loadManualMatchCache(taxCode) {
  try {
    var key = 'tt_cache_' + taxCode;
    var data = localStorage.getItem(key);
    _manualMatchCache[taxCode] = data ? JSON.parse(data) : {};
  } catch(e) { _manualMatchCache[taxCode] = {}; }
}

function saveManualMatchCache(taxCode) {
  try {
    var key = 'tt_cache_' + taxCode;
    localStorage.setItem(key, JSON.stringify(_manualMatchCache[taxCode] || {}));
  } catch(e) {}
}

function getXuatItemKey(xuatItem) {
  var name = (xuatItem.name || '').trim();
  var unit = (xuatItem.unit || '').trim();
  var code = (xuatItem.productCode || '').trim();
  return (name + '|' + unit + '|' + code).toLowerCase();
}

// ==================== MANUAL MATCH CACHE REVERSE (tonkho -> xuatkho) ====================

function loadManualMatchCacheReverse(taxCode) {
  try {
    var key = 'tt_cache_rev_' + taxCode;
    var data = localStorage.getItem(key);
    _manualMatchCacheReverse[taxCode] = data ? JSON.parse(data) : {};
  } catch(e) { _manualMatchCacheReverse[taxCode] = {}; }
}

function saveManualMatchCacheReverse(taxCode) {
  try {
    var key = 'tt_cache_rev_' + taxCode;
    localStorage.setItem(key, JSON.stringify(_manualMatchCacheReverse[taxCode] || {}));
  } catch(e) {}
}

function getTonkhoItemKey(tonkhoItem) {
  var name = (tonkhoItem.name || '').trim();
  var unit = (tonkhoItem.unit || '').trim();
  var code = (tonkhoItem.productCode || '').trim();
  return (name + '|' + unit + '|' + code).toLowerCase();
}

// ==================== FIND TOP SUGGESTIONS ====================

function findTopSuggestions(xuatName, xuatUnit, tonkhoItems, limit) {
  limit = limit || 3;
  var suggestions = [];
  for (var i = 0; i < tonkhoItems.length; i++) {
    var item = tonkhoItems[i];
    var pct = calculateNameSimilarity(xuatName, item.name || '');
    var xuatUnitNorm = normalizeName(xuatUnit);
    var tkUnitNorm = normalizeName(item.unit || '');
    if (xuatUnitNorm && tkUnitNorm && xuatUnitNorm === tkUnitNorm) { pct = Math.min(100, pct + 5); }
    suggestions.push({ idx: i, name: item.name || '', unit: item.unit || '', qty: item.quantity, percent: pct });
  }
  suggestions.sort(function(a, b) { return b.percent - a.percent; });
  return suggestions.slice(0, limit);
}

// ==================== FIND TOP SUGGESTIONS REVERSE (tonkho -> xuatkho) ====================

function findTopSuggestionsReverse(tonkhoName, tonkhoUnit, xuatkhoItems, limit) {
  limit = limit || 3;
  var suggestions = [];
  for (var i = 0; i < xuatkhoItems.length; i++) {
    var item = xuatkhoItems[i];
    var pct = calculateNameSimilarity(tonkhoName, item.name || '');
    var tkUnitNorm = normalizeName(tonkhoUnit);
    var xuatUnitNorm = normalizeName(item.unit || '');
    if (tkUnitNorm && xuatUnitNorm && tkUnitNorm === xuatUnitNorm) { pct = Math.min(100, pct + 5); }
    suggestions.push({ idx: i, name: item.name || '', unit: item.unit || '', qty: item.quantity, percent: pct });
  }
  suggestions.sort(function(a, b) { return b.percent - a.percent; });
  return suggestions.slice(0, limit);
}

// ==================== MAKE RESULT ITEM ====================

function makeResultItem(params) {
  return {
    xuatIdx: params.xuatIdx, xuatName: params.xuatName || '', xuatUnit: params.xuatUnit || '', xuatQty: params.xuatQty || 0,
    tonkhoIdx: params.tonkhoIdx, tonkhoName: params.tonkhoName || '', tonkhoUnit: params.tonkhoUnit || '', tonkhoQty: params.tonkhoQty || 0,
    matchPercent: params.matchPercent || 0, status: params.status || 'manual', suggestions: params.suggestions || [], unitMismatch: params.unitMismatch || false
  };
}

// ==================== MATCH COLORS ====================

function getMatchColor(percent) {
  if (percent >= 100) return '#2e7d32';
  if (percent >= 80) return '#1565c0';
  if (percent >= 50) return '#e65100';
  return '#9e9e9e';
}

function getMatchLabel(percent, status) {
  if (status === 'auto') return 'Tự động 100%';
  if (status === 'semi') return percent + '%';
  if (status === 'manual') return 'Thủ công';
  if (status === 'thieu_xuat') return 'Thiếu xuất kho';
  if (status === 'thieu_tonkho') return 'Thiếu tồn kho';
  return status;
}

// ==================== CALCULATE TON KHO THUC TE (2-TIER + thieu_tonkho + 2 chieu) ====================

function calculateTonKhoThucTe(taxCode) {
  var hkd = hkdData[taxCode];
  if (!hkd) return [];
  loadManualMatchCache(taxCode);
  loadManualMatchCacheReverse(taxCode);
  var tonkhoItems = hkd.tonkhoMain || [];
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var results = [];
  var tonkhoMap = {};

  // Build tonkhoMap keyed by name|unit (lowercase)
  for (var i = 0; i < tonkhoItems.length; i++) {
    var item = tonkhoItems[i];
    var name = (item.name || '').trim().toLowerCase();
    var unit = (item.unit || '').trim().toLowerCase();
    var key = name + '|' + unit;
    if (!tonkhoMap[key]) tonkhoMap[key] = [];
    tonkhoMap[key].push(i);
  }

  var matchedTonkhoIndices = {};
  var matchedXuatIndices = {};

  // Process xuatkho items
  for (var xi = 0; xi < xuatkhoItems.length; xi++) {
    var xuatItem = xuatkhoItems[xi];
    var xuatName = (xuatItem.name || '').trim();
    var xuatUnit = (xuatItem.unit || '').trim();
    var xuatQty = parseFloat(xuatItem.quantity) || 0;
    var xuatNameLower = xuatName.toLowerCase();
    var xuatUnitLower = xuatUnit.toLowerCase();
    var matchedTonkhoIdx = -1, matchPercent = 0, matchStatus = 'manual', unitMismatch = false;

    // Check manual match cache FIRST (xuatkho -> tonkho)
    var cacheKey = getXuatItemKey(xuatItem);
    var cache = _manualMatchCache[taxCode] || {};
    if (cache[cacheKey]) {
      var cached = cache[cacheKey];
      if (cached.tonkhoIdx >= 0 && cached.tonkhoIdx < tonkhoItems.length) {
        matchedTonkhoIdx = cached.tonkhoIdx;
        matchPercent = cached.matchPercent || 100;
        matchStatus = 'auto';
        matchedTonkhoIndices[matchedTonkhoIdx] = true;
        matchedXuatIndices[xi] = true;
        results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].name || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: matchPercent, status: matchStatus, suggestions: [], unitMismatch: false }));
        continue;
      } else if (cached.tonkhoIdx === -1) {
        var suggestions = findTopSuggestions(xuatName, xuatUnit, tonkhoItems, 3);
        matchedXuatIndices[xi] = true;
        results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: -1, tonkhoName: '', tonkhoUnit: '', tonkhoQty: 0, matchPercent: 0, status: 'manual', suggestions: suggestions, unitMismatch: false }));
        continue;
      }
    }

    // Check reverse cache (tonkho -> xuatkho): xuat item nay da duoc tonkho nao ghep chua?
    var revCache = _manualMatchCacheReverse[taxCode] || {};
    var foundInReverse = false;
    for (var revKey in revCache) {
      if (revCache[revKey].xuatIdx === xi) {
        var revTonkhoIdx = revCache[revKey].tonkhoIdx;
        if (revTonkhoIdx >= 0 && revTonkhoIdx < tonkhoItems.length) {
          matchedTonkhoIdx = revTonkhoIdx;
          matchPercent = revCache[revKey].matchPercent || 100;
          matchStatus = 'auto';
          matchedTonkhoIndices[matchedTonkhoIdx] = true;
          matchedXuatIndices[xi] = true;
          results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].name || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: matchPercent, status: matchStatus, suggestions: [], unitMismatch: false }));
          foundInReverse = true;
        }
        break;
      }
    }
    if (foundInReverse) continue;

    // TIER 1: Exact match (name + DVT) -> auto 100%
    var key1 = xuatNameLower + '|' + xuatUnitLower;
    if (tonkhoMap[key1] && tonkhoMap[key1].length > 0) {
      matchedTonkhoIdx = tonkhoMap[key1][0];
      matchPercent = 100; matchStatus = 'auto';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
      matchedXuatIndices[xi] = true;
      results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].name || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: 100, status: 'auto', suggestions: [], unitMismatch: false }));
      continue;
    }

    // TIER 2: Fuzzy match -> semi (>=50%) or thieu_tonkho (<50% or no tonkho)
    var bestIdx = -1, bestPct = 0;
    for (var ti = 0; ti < tonkhoItems.length; ti++) {
      var pct = calculateNameSimilarity(xuatName, tonkhoItems[ti].name || '');
      if (pct > bestPct) { bestPct = pct; bestIdx = ti; }
    }
    var suggestions = findTopSuggestions(xuatName, xuatUnit, tonkhoItems, 3);

    if (bestPct >= 50 && bestIdx >= 0) {
      matchedTonkhoIdx = -1; matchPercent = bestPct; matchStatus = 'semi';
      matchedXuatIndices[xi] = true;
    } else {
      matchedTonkhoIdx = -1; matchPercent = bestPct; matchStatus = 'thieu_tonkho';
      matchedXuatIndices[xi] = true;
    }

    results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: '', tonkhoUnit: '', tonkhoQty: 0, matchPercent: matchPercent, status: matchStatus, suggestions: suggestions, unitMismatch: false }));
  }

  // Add tonkho items khong co xuat kho tuong ung -> thieu_xuat
  // Kiem tra ca cache thuan va cache nghich
  for (var ti = 0; ti < tonkhoItems.length; ti++) {
    if (!matchedTonkhoIndices[ti]) {
      // Kiem tra reverse cache: tonkho item nay da duoc ghep voi xuat kho nao chua?
      var revCache2 = _manualMatchCacheReverse[taxCode] || {};
      var foundRev = false;
      for (var rk in revCache2) {
        if (revCache2[rk].tonkhoIdx === ti && revCache2[rk].xuatIdx >= 0) {
          var xIdx = revCache2[rk].xuatIdx;
          if (xIdx < xuatkhoItems.length) {
            var xItem = xuatkhoItems[xIdx];
            matchedTonkhoIndices[ti] = true;
            matchedXuatIndices[xIdx] = true;
            results.push(makeResultItem({ xuatIdx: xIdx, xuatName: xItem.name || '', xuatUnit: xItem.unit || '', xuatQty: parseFloat(xItem.quantity) || 0, tonkhoIdx: ti, tonkhoName: tonkhoItems[ti].name || '', tonkhoUnit: tonkhoItems[ti].unit || '', tonkhoQty: tonkhoItems[ti].quantity || 0, matchPercent: revCache2[rk].matchPercent || 100, status: 'auto', suggestions: [], unitMismatch: false }));
            foundRev = true;
          }
          break;
        }
      }
      if (!foundRev) {
        results.push(makeResultItem({ xuatIdx: -1, xuatName: '', xuatUnit: '', xuatQty: 0, tonkhoIdx: ti, tonkhoName: tonkhoItems[ti].name || '', tonkhoUnit: tonkhoItems[ti].unit || '', tonkhoQty: tonkhoItems[ti].quantity || 0, matchPercent: 100, status: 'thieu_xuat', suggestions: [], unitMismatch: false }));
      }
    }
  }

  // Add xuatkho items khong co tonkho tuong ung -> thieu_tonkho
  for (var xi2 = 0; xi2 < xuatkhoItems.length; xi2++) {
    if (!matchedXuatIndices[xi2]) {
      var xItem = xuatkhoItems[xi2];
      results.push(makeResultItem({ xuatIdx: xi2, xuatName: xItem.name || '', xuatUnit: xItem.unit || '', xuatQty: parseFloat(xItem.quantity) || 0, tonkhoIdx: -1, tonkhoName: '', tonkhoUnit: '', tonkhoQty: 0, matchPercent: 0, status: 'thieu_tonkho', suggestions: [], unitMismatch: false }));
    }
  }

  return results;
}


// ==================== ESCAPE HTML HELPER ====================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// ==================== FORMAT QUANTITY ====================

function formatQuantity(val) {
  var n = parseFloat(val) || 0;
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ==================== APPLY FILTER TO RESULTS ====================

function applyTTFilterToResults(results) {
  var filtered = results.slice();
  if (_ttFilterText) {
    var search = _ttFilterText.toLowerCase().trim();
    filtered = filtered.filter(function(r) {
      return (r.tonkhoName && r.tonkhoName.toLowerCase().indexOf(search) !== -1) ||
             (r.xuatName && r.xuatName.toLowerCase().indexOf(search) !== -1);
    });
  }
  if (_ttFilterStatus !== 'all') {
    filtered = filtered.filter(function(r) { return r.status === _ttFilterStatus; });
  }
  filtered.sort(function(a, b) {
    var va, vb;
    switch (_ttSortBy) {
      case 'tonkho': va = parseFloat(a.tonkhoQty) || 0; vb = parseFloat(b.tonkhoQty) || 0; break;
      case 'xuatkho': va = parseFloat(a.xuatQty) || 0; vb = parseFloat(b.xuatQty) || 0; break;
      case 'thucte': va = (parseFloat(a.tonkhoQty)||0) - (parseFloat(a.xuatQty)||0); vb = (parseFloat(b.tonkhoQty)||0) - (parseFloat(b.xuatQty)||0); break;
      case 'percent': va = a.matchPercent || 0; vb = b.matchPercent || 0; break;
      default: va = (a.tonkhoName || a.xuatName || '').toLowerCase(); vb = (b.tonkhoName || b.xuatName || '').toLowerCase();
    }
    if (va < vb) return _ttSortDir === 'asc' ? -1 : 1;
    if (va > vb) return _ttSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return filtered;
}

// ==================== RENDER TON KHO THUC TE TAB ====================

function renderTonKhoThucTeTab(taxCode) {
  var content = document.getElementById('tonkhoThucTeContent');
  if (!content) return;
  var results = calculateTonKhoThucTe(taxCode);
  var manualItems = results.filter(function(r) {
    return r.status === 'manual' || r.status === 'semi';
  });
  var filtered = applyTTFilterToResults(results);
  var html = '';

  // Helper: return '' if 0
  function fmtQty(v) {
    var n = parseFloat(v) || 0;
    if (n === 0) return '';
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // FILTER BAR
  html += '<div class="tt-filter-bar">';
  html += '<div class="tt-filter-row">';
  html += '<input type="text" id="tt-filter-input" placeholder="Tìm tên sản phẩm..." value="' + escapeHtml(_ttFilterText) + '" oninput="debounceTTFilter()" style="flex:1;min-width:150px;">';
  html += '<select id="tt-filter-status" onchange="applyTTFilter()">';
  html += '<option value="all"' + (_ttFilterStatus === 'all' ? ' selected' : '') + '>Tất cả</option>';
  html += '<option value="auto"' + (_ttFilterStatus === 'auto' ? ' selected' : '') + '>Tự động</option>';
  html += '<option value="semi"' + (_ttFilterStatus === 'semi' ? ' selected' : '') + '>Bán tự động</option>';
  html += '<option value="manual"' + (_ttFilterStatus === 'manual' ? ' selected' : '') + '>Thủ công</option>';
  html += '<option value="thieu_xuat"' + (_ttFilterStatus === 'thieu_xuat' ? ' selected' : '') + '>Thiếu xuất kho</option>';
  html += '<option value="thieu_tonkho"' + (_ttFilterStatus === 'thieu_tonkho' ? ' selected' : '') + '>Thiếu tồn kho</option>';
  html += '</select>';
  html += '<select id="tt-sort-by" onchange="applyTTFilter()">';
  html += '<option value="name"' + (_ttSortBy === 'name' ? ' selected' : '') + '>Ten SP</option>';
  html += '<option value="tonkho"' + (_ttSortBy === 'tonkho' ? ' selected' : '') + '>SL Ton kho</option>';
  html += '<option value="xuatkho"' + (_ttSortBy === 'xuatkho' ? ' selected' : '') + '>SL Xuat kho</option>';
  html += '<option value="thucte"' + (_ttSortBy === 'thucte' ? ' selected' : '') + '>SL Thuc te</option>';
  html += '<option value="percent"' + (_ttSortBy === 'percent' ? ' selected' : '') + '>% Match</option>';
  html += '</select>';
  html += '<button class="tt-btn tt-btn-sort" onclick="toggleTTSortDir()" title="Dao chieu sap xep">';
  html += (_ttSortDir === 'asc' ? '&#x2B06;' : '&#x2B07;');
  html += '</button>';
  if (manualItems.length > 0) {
    html += '<button class="tt-btn tt-btn-quickmatch" onclick="showQuickMatchPopup(\'' + taxCode + '\')" title="Ghep nhanh cac item thu cong">';
    html += '&#x26A1; Ghep nhanh (' + manualItems.length + ')';
    html += '</button>';
  }
  if (_ttSelectedItems.size > 0) {
    html += '<button class="tt-btn tt-btn-batch" onclick="batchMatchSelected(\'' + taxCode + '\')" title="Ghep hang loat cac muc da chon">';
    html += 'Ghep ' + _ttSelectedItems.size + ' muc';
    html += '</button>';
  }
  html += '<button class="tt-btn tt-btn-reset" onclick="resetTTFilter()">Reset</button>';
  html += '</div></div>';

  // TABLE
  html += '<div class="tt-table-wrapper">';
  html += '<table class="tt-table"><thead><tr>';
  html += '<th class="tt-col-stt" style="width:40px;"><input type="checkbox" id="tt-select-all" onchange="toggleTTSelectAll(this)" title="Chon tat ca"></th>';
  html += '<th class="tt-col-stt">STT</th>';
  html += '<th class="tt-col-name">Ten san pham (Ton kho / Xuat kho)</th>';
  html += '<th class="tt-col-qty">Thuc te</th>';
  html += '<th class="tt-col-status-simple">Trang thai</th>';
  html += '<th class="tt-col-status-simple">Thao tac</th>';
  html += '</tr></thead><tbody>';

  if (filtered.length === 0) {
    html += '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Khong co du lieu phu hop</td></tr>';
  } else {
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var stt = i + 1;
      var tonkhoQty = parseFloat(r.tonkhoQty) || 0;
      var xuatQty = parseFloat(r.xuatQty) || 0;
      var thucte = tonkhoQty - xuatQty;

      // Hien thi ten + so luong rieng cho ton kho (do) va xuat kho (xanh)
      var tonkhoDisplay = '';
      if (r.tonkhoName) {
        tonkhoDisplay = '<div class="tt-sp-tonkho"><span class="tt-sp-label">Tồn:</span> <span class="tt-sp-name">' + escapeHtml(r.tonkhoName) + '</span> <span class="tt-sp-qty tonkho-qty">' + fmtQty(tonkhoQty) + '</span></div>';
      }
      var xuatkhoDisplay = '';
      if (r.xuatName) {
        xuatkhoDisplay = '<div class="tt-sp-xuatkho"><span class="tt-sp-label">Xuất:</span> <span class="tt-sp-name">' + escapeHtml(r.xuatName) + '</span> <span class="tt-sp-qty xuatkho-qty">' + fmtQty(xuatQty) + '</span></div>';
      }

      // Status badges
      var statusBadge = '';
      if (r.status === 'auto') {
        statusBadge = '<span class="tt-status-badge" style="background:#2e7d32;">Tự động</span>';
      } else if (r.status === 'thieu_xuat') {
        statusBadge = '<span class="tt-status-badge" style="background:#e65100;">Thiếu xuất kho</span>';
      } else if (r.status === 'thieu_tonkho') {
        statusBadge = '<span class="tt-status-badge" style="background:#c62828;">Thiếu tồn kho</span>';
      } else if (r.status === 'semi') {
        statusBadge = '<span class="tt-status-badge" style="background:#1565c0;">' + r.matchPercent + '%</span>';
      } else {
        statusBadge = '<span class="tt-status-badge" style="background:#9e9e9e;">Thủ công</span>';
      }

      var thucteClass = 'tt-qty-val thucte-qty';
      if (thucte > 0) thucteClass += ' positive';
      else if (thucte < 0) thucteClass += ' negative';
      else thucteClass += ' zero';

      var itemKey = 'x' + r.xuatIdx + '_t' + r.tonkhoIdx;
      var isChecked = _ttSelectedItems.has(itemKey) ? ' checked' : '';

      // Action buttons - ho tro ca 2 chieu
      var actionBtns = '';
      actionBtns += '<button class="tt-btn tt-btn-view" onclick="showTTMatchHistoryPopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + r.tonkhoIdx + ')" title="Xem lịch sử ghép">Xem</button>';

      if (r.status === 'auto') {
        actionBtns += ' <button class="tt-btn tt-btn-matched" onclick="showTTMatchDetailPopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + r.tonkhoIdx + ')" title="Đã khớp 100%">Khớp</button>';
      } else if (r.status === 'thieu_xuat') {
        // thieu_xuat: tonkho ko co xuat -> cho phep ghep tu tonkho -> xuatkho
        actionBtns += ' <button class="tt-btn tt-btn-manual" onclick="showTTMatchDetailPopupReverse(\'' + taxCode + '\',' + r.tonkhoIdx + ')" title="Ghép thủ công từ tồn kho với xuất kho">Ghép thủ công</button>';
      } else if (r.status === 'thieu_tonkho') {
        actionBtns += ' <button class="tt-btn tt-btn-manual" onclick="showTTMatchDetailPopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + r.tonkhoIdx + ')" title="Ghép thủ công từ xuất kho với tồn kho">Ghép thủ công</button>';
      } else {
        actionBtns += ' <button class="tt-btn tt-btn-manual" onclick="showTTMatchDetailPopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + r.tonkhoIdx + ')" title="Ghép thủ công">Ghép thủ công</button>';
      }

      var suggestionsHtml = '';
      if ((r.status === 'semi' || r.status === 'thieu_tonkho') && r.suggestions && r.suggestions.length > 0) {
        suggestionsHtml = '<div class="tt-suggestions">';
        suggestionsHtml += '<span class="tt-suggestions-label">Gợi ý:</span>';
        for (var si = 0; si < r.suggestions.length; si++) {
          var sug = r.suggestions[si];
          suggestionsHtml += '<button class="tt-btn tt-suggestion-btn" onclick="showTTMatchDetailPopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + sug.idx + ')">';
          suggestionsHtml += escapeHtml(sug.name) + ' (' + sug.percent + '%)';
          suggestionsHtml += '</button>';
        }
        suggestionsHtml += '</div>';
      }

  html += '<tr draggable="true" ondragstart="onTTDragStart(event,\'' + taxCode + '\',' + r.xuatIdx + ')" ondragend="onTTDragEnd(event)" ondragover="onTTDragOver(event)" ondrop="onTTDrop(event,\'' + taxCode + '\',' + r.tonkhoIdx + ')">';
  html += '<td style="width:40px;text-align:center;"><input type="checkbox" class="tt-select-item" data-key="' + itemKey + '"' + isChecked + ' onchange="toggleTTSelectItem(this,\'' + itemKey + '\')"></td>';
  html += '<td class="tt-col-stt">' + stt + '</td>';
  html += '<td class="tt-col-name">';
  html += tonkhoDisplay;
  html += xuatkhoDisplay;
  html += suggestionsHtml;
  html += '</td>';
  html += '<td class="tt-col-qty"><span class="' + thucteClass + '">' + fmtQty(thucte) + '</span></td>';
  html += '<td class="tt-col-status-simple">' + statusBadge + '</td>';
  html += '<td class="tt-col-status-simple">' + actionBtns + '</td>';
  html += '</tr>';
    }
  }
  html += '</tbody></table></div>';
  content.innerHTML = html;
}

// ==================== FILTER FUNCTIONS ====================

var _ttFilterTimer = null;

function debounceTTFilter() {
  if (_ttFilterTimer) clearTimeout(_ttFilterTimer);
  _ttFilterTimer = setTimeout(function() {
    _ttFilterText = document.getElementById('tt-filter-input').value;
    applyTTFilter();
  }, 300);
}

function applyTTFilter() {
  var sel = document.getElementById('tt-filter-status');
  if (sel) _ttFilterStatus = sel.value;
  var sort = document.getElementById('tt-sort-by');
  if (sort) _ttSortBy = sort.value;
  renderTonKhoThucTeTab(currentTaxCode);
}

function toggleTTSortDir() {
  _ttSortDir = _ttSortDir === 'asc' ? 'desc' : 'asc';
  applyTTFilter();
}

function resetTTFilter() {
  _ttFilterText = '';
  _ttFilterStatus = 'all';
  _ttSortBy = 'name';
  _ttSortDir = 'asc';
  renderTonKhoThucTeTab(currentTaxCode);
}

// ==================== BATCH SELECTION ====================

function toggleTTSelectAll(checkbox) {
  var checked = checkbox.checked;
  var items = document.querySelectorAll('.tt-select-item');
  for (var i = 0; i < items.length; i++) {
    items[i].checked = checked;
    var key = items[i].getAttribute('data-key');
    if (checked) {
      _ttSelectedItems.add(key);
    } else {
      _ttSelectedItems.delete(key);
    }
  }
}

function toggleTTSelectItem(checkbox, key) {
  if (checkbox.checked) {
    _ttSelectedItems.add(key);
  } else {
    _ttSelectedItems.delete(key);
  }
}

function batchMatchSelected(taxCode) {
  if (_ttSelectedItems.size === 0) {
    alert('Chua chon muc nao');
    return;
  }
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var tonkhoItems = hkd.tonkhoMain || [];
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var cache = _manualMatchCache[taxCode] || {};
  var count = 0;

  _ttSelectedItems.forEach(function(key) {
    var parts = key.split('_');
    var xIdx = -1, tIdx = -1;
    for (var p = 0; p < parts.length; p++) {
      if (parts[p].indexOf('x') === 0) xIdx = parseInt(parts[p].substring(1));
      if (parts[p].indexOf('t') === 0) tIdx = parseInt(parts[p].substring(1));
    }
    if (xIdx >= 0 && tIdx >= 0 && xIdx < xuatkhoItems.length && tIdx < tonkhoItems.length) {
      var xItem = xuatkhoItems[xIdx];
      var ck = getXuatItemKey(xItem);
      cache[ck] = { tonkhoIdx: tIdx, matchPercent: 100, timestamp: new Date().toISOString() };
      count++;
    }
  });

  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  _ttSelectedItems.clear();
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep ' + count + ' muc', 'success');
}

// ==================== DRAG & DROP ====================

function onTTDragStart(event, taxCode, xuatIdx) {
  _ttDragItem = { taxCode: taxCode, xuatIdx: xuatIdx };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', xuatIdx);
  event.target.classList.add('tt-drag-source');
}

function onTTDragEnd(event) {
  _ttDragItem = null;
  event.target.classList.remove('tt-drag-source');
  var els = document.querySelectorAll('.tt-drag-over');
  for (var i = 0; i < els.length; i++) { els[i].classList.remove('tt-drag-over'); }
}

function onTTDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  var tr = event.target.closest('tr');
  if (tr) tr.classList.add('tt-drag-over');
}

function onTTDrop(event, taxCode, tonkhoIdx) {
  event.preventDefault();
  var tr = event.target.closest('tr');
  if (tr) tr.classList.remove('tt-drag-over');
  if (!_ttDragItem || _ttDragItem.taxCode !== taxCode) return;
  var xuatIdx = _ttDragItem.xuatIdx;
  if (xuatIdx < 0 || tonkhoIdx < 0) return;

  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var xuatItem = xuatkhoItems[xuatIdx];
  if (!xuatItem) return;

  var cacheKey = getXuatItemKey(xuatItem);
  var cache = _manualMatchCache[taxCode] || {};
  cache[cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: new Date().toISOString() };
  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep bang keo tha', 'success');
}

// ==================== COMPARE POPUP ====================

function showTTComparePopup(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  var tonkhoItem = hkd.tonkhoMain[tonkhoIdx];
  if (!xuatItem || !tonkhoItem) return;

  var html = '<div style="padding:20px;">';
  html += '<h3 style="margin-bottom:16px;">So sanh san pham</h3>';
  html += '<table style="width:100%;border-collapse:collapse;">';
  html += '<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Truong</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Xuat kho</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Ton kho</th></tr>';
  html += '<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">Ten</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(xuatItem.name || '') + '</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(tonkhoItem.name || '') + '</td></tr>';
  html += '<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">DVT</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(xuatItem.unit || '') + '</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(tonkhoItem.unit || '') + '</td></tr>';
  html += '<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">So luong</td><td style="padding:8px;border-bottom:1px solid #eee;">' + formatQuantity(xuatItem.quantity) + '</td><td style="padding:8px;border-bottom:1px solid #eee;">' + formatQuantity(tonkhoItem.quantity) + '</td></tr>';
  html += '<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">Ma SP</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(xuatItem.productCode || '') + '</td><td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(tonkhoItem.productCode || '') + '</td></tr>';
  html += '</table>';

  var pct = calculateNameSimilarity(xuatItem.name || '', tonkhoItem.name || '');
  html += '<div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:8px;text-align:center;">';
  html += '<span style="font-weight:600;">Do tuong dong: </span>';
  html += '<span style="font-weight:700;color:' + getMatchColor(pct) + ';">' + pct + '%</span>';
  html += '</div>';

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-manual" onclick="confirmTTMatch(\'' + taxCode + '\',' + xuatIdx + ',' + tonkhoIdx + ')">Xac nhan ghep</button>';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Huy</button>';
  html += '</div></div>';

  showPopup(html, 'So sanh san pham');
}

function confirmTTMatch(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  var cache = _manualMatchCache[taxCode] || {};
  cache[cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: new Date().toISOString() };
  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  closePopup();
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep thanh cong', 'success');
}

function rejectTTMatch(taxCode, xuatIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  var cache = _manualMatchCache[taxCode] || {};
  cache[cacheKey] = { tonkhoIdx: -1, matchPercent: 0, timestamp: new Date().toISOString() };
  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  closePopup();
  renderTonKhoThucTeTab(taxCode);
  toast('Da huy ghep', 'info');
}

// ==================== MANUAL MATCH POPUP ====================

function showTTManualPopup(taxCode, xuatIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var tonkhoItems = hkd.tonkhoMain || [];
  var suggestions = findTopSuggestions(xuatItem.name || '', xuatItem.unit || '', tonkhoItems, 10);

  var html = '<div style="padding:20px;">';
  html += '<h3 style="margin-bottom:12px;">Ghep thu cong: ' + escapeHtml(xuatItem.name) + '</h3>';
  html += '<p style="margin-bottom:16px;color:#666;">Chon san pham ton kho de ghep:</p>';

  if (suggestions.length > 0) {
    html += '<div style="margin-bottom:16px;">';
    html += '<strong>Goi y:</strong>';
    html += '</div>';
    for (var si = 0; si < suggestions.length; si++) {
      var sug = suggestions[si];
      var color = getMatchColor(sug.percent);
      html += '<div style="padding:8px 12px;margin:4px 0;border:1px solid #ddd;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="selectTTManualItem(\'' + taxCode + '\',' + xuatIdx + ',' + sug.idx + ')">';
      html += '<div><strong>' + escapeHtml(sug.name) + '</strong> <span style="color:#666;">(' + escapeHtml(sug.unit) + ', SL: ' + formatQuantity(sug.qty) + ')</span></div>';
      html += '<span style="font-weight:700;color:' + color + ';">' + sug.percent + '%</span>';
      html += '</div>';
    }
  } else {
    html += '<p style="color:#999;">Khong co san pham ton kho de goi y</p>';
  }

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Dong</button>';
  html += '</div></div>';

  showPopup(html, 'Ghep thu cong - Xuat kho');
}

function selectTTManualItem(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  var cache = _manualMatchCache[taxCode] || {};
  cache[cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: new Date().toISOString() };
  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  closePopup();
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep thu cong', 'success');
}

function confirmTTManual(taxCode, xuatIdx, tonkhoIdx) {
  selectTTManualItem(taxCode, xuatIdx, tonkhoIdx);
}

// ==================== QUICK MATCH POPUP ====================

function showQuickMatchPopup(taxCode) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var results = calculateTonKhoThucTe(taxCode);
  var manualItems = results.filter(function(r) {
    return r.status === 'manual' || r.status === 'semi';
  });
  if (manualItems.length === 0) {
    alert('Khong co muc nao can ghep nhanh');
    return;
  }

  var html = '<div style="padding:20px;max-height:60vh;overflow-y:auto;">';
  html += '<h3 style="margin-bottom:12px;">Ghep nhanh (' + manualItems.length + ' muc)</h3>';
  html += '<p style="margin-bottom:16px;color:#666;">Kiem tra va xac nhan cac ghep duoi day:</p>';

  for (var i = 0; i < manualItems.length; i++) {
    var r = manualItems[i];
    html += '<div style="padding:10px;margin:6px 0;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div><strong>' + escapeHtml(r.xuatName) + '</strong></div>';
    html += '<span style="font-weight:600;color:' + getMatchColor(r.matchPercent) + ';">' + r.matchPercent + '%</span>';
    html += '</div>';

    if (r.suggestions && r.suggestions.length > 0) {
      html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">';
      for (var si = 0; si < r.suggestions.length; si++) {
        var sug = r.suggestions[si];
        html += '<button class="tt-btn tt-btn-manual" onclick="quickMatchConfirm(\'' + taxCode + '\',' + r.xuatIdx + ',' + sug.idx + ')" style="font-size:0.85em;">';
        html += escapeHtml(sug.name) + ' (' + sug.percent + '%)';
        html += '</button>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Dong</button>';
  html += '</div></div>';

  showPopup(html, 'Ghep nhanh');
}

function quickMatchConfirm(taxCode, xuatIdx, tonkhoIdx) {
  confirmTTMatch(taxCode, xuatIdx, tonkhoIdx);
  showQuickMatchPopup(taxCode);
}

// ==================== MATCH HISTORY POPUP ====================

function showTTMatchHistoryPopup(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var cache = _manualMatchCache[taxCode] || {};
  var revCache = _manualMatchCacheReverse[taxCode] || {};
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var tonkhoItems = hkd.tonkhoMain || [];

  var html = '<div style="padding:20px;max-height:60vh;overflow-y:auto;">';
  html += '<h3 style="margin-bottom:12px;">Lich su ghep</h3>';

  // Forward cache entries
  var fwdEntries = [];
  for (var key in cache) {
    var entry = cache[key];
    var xuatName = key.split('|')[0];
    // Tim ten goc tu xuatkhoItems
    for (var xi = 0; xi < xuatkhoItems.length; xi++) {
      var xItem = xuatkhoItems[xi];
      var xKey = getXuatItemKey(xItem);
      if (xKey === key) {
        xuatName = xItem.name || xuatName;
        break;
      }
    }
    var tonkhoName = '';
    if (entry.tonkhoIdx >= 0 && entry.tonkhoIdx < tonkhoItems.length) {
      tonkhoName = tonkhoItems[entry.tonkhoIdx].name || '';
    }
    fwdEntries.push({
      type: 'Xuat -> Ton',
      xuatName: xuatName,
      tonkhoName: tonkhoName,
      percent: entry.matchPercent || 0,
      time: entry.timestamp || ''
    });
  }

  // Reverse cache entries
  for (var rkey in revCache) {
    var rentry = revCache[rkey];
    var tonkhoName = rkey.split('|')[0];
    // Tim ten goc tu tonkhoItems
    for (var ti = 0; ti < tonkhoItems.length; ti++) {
      var tItem = tonkhoItems[ti];
      var tKey = getTonkhoItemKey(tItem);
      if (tKey === rkey) {
        tonkhoName = tItem.name || tonkhoName;
        break;
      }
    }
    var xuatName2 = '';
    if (rentry.xuatIdx >= 0 && rentry.xuatIdx < xuatkhoItems.length) {
      xuatName2 = xuatkhoItems[rentry.xuatIdx].name || '';
    }
    fwdEntries.push({
      type: 'Ton -> Xuat',
      tonkhoName: tonkhoName,
      xuatName: xuatName2,
      percent: rentry.matchPercent || 0,
      time: rentry.timestamp || ''
    });
  }

  if (fwdEntries.length === 0) {
    html += '<p style="color:#999;">Chua co lich su ghep</p>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Huong</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Xuat kho</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Ton kho</th><th style="text-align:center;padding:8px;border-bottom:2px solid #ddd;">%</th><th style="text-align:center;padding:8px;border-bottom:2px solid #ddd;">Thoi gian</th></tr>';
    for (var ei = 0; ei < fwdEntries.length; ei++) {
      var e = fwdEntries[ei];
      html += '<tr>';
      html += '<td style="padding:8px;border-bottom:1px solid #eee;">' + e.type + '</td>';
      html += '<td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(e.xuatName || '') + '</td>';
      html += '<td style="padding:8px;border-bottom:1px solid #eee;">' + escapeHtml(e.tonkhoName || '') + '</td>';
      html += '<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:' + getMatchColor(e.percent) + ';">' + e.percent + '%</td>';
      html += '<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-size:0.85em;color:#666;">' + (e.time ? new Date(e.time).toLocaleTimeString('vi-VN') + ' ' + new Date(e.time).toLocaleDateString('vi-VN') : '') + '</td>';
      html += '</tr>';
    }
    html += '</table>';
  }

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Dong</button>';
  html += '</div></div>';

  showPopup(html, 'Lich su ghep');
}

// ==================== MATCH DETAIL POPUP (xuatkho -> tonkho) ====================

function showTTMatchDetailPopup(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var tonkhoItems = hkd.tonkhoMain || [];
  var xuatItem = xuatkhoItems[xuatIdx];
  if (!xuatItem) return;

  var html = '<div style="padding:20px;max-height:70vh;overflow-y:auto;">';
  html += '<h3 style="margin-bottom:8px;">Ghep thu cong: ' + escapeHtml(xuatItem.name || '') + '</h3>';
  html += '<p style="margin-bottom:12px;color:#666;">Tim va chon san pham ton kho de ghep:</p>';

  // Search box
  html += '<input type="text" id="tt-detail-search" placeholder="Tim san pham ton kho..." oninput="filterTTDetailItems(\'' + taxCode + '\',' + xuatIdx + ')" style="width:100%;padding:8px 12px;border:1px solid #ccc;border-radius:6px;margin-bottom:12px;box-sizing:border-box;">';

  // Ton kho list
  html += '<div id="tt-detail-list" style="max-height:400px;overflow-y:auto;">';
  for (var ti = 0; ti < tonkhoItems.length; ti++) {
    var tItem = tonkhoItems[ti];
    var pct = calculateNameSimilarity(xuatItem.name || '', tItem.name || '');
    html += '<div class="tt-detail-item" data-idx="' + ti + '" style="padding:8px 12px;margin:4px 0;border:1px solid #e0e0e0;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="selectTTDetailItem(\'' + taxCode + '\',' + xuatIdx + ',' + ti + ')">';
    html += '<div><strong>' + escapeHtml(tItem.name || '') + '</strong> <span style="color:#666;">(' + escapeHtml(tItem.unit || '') + ', SL: ' + formatQuantity(tItem.quantity) + ')</span></div>';
    html += '<span style="font-weight:700;color:' + getMatchColor(pct) + ';">' + pct + '%</span>';
    html += '</div>';
  }
  html += '</div>';

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Dong</button>';
  html += '</div></div>';

  showPopup(html, 'Ghep thu cong - Xuat kho');
}

function filterTTDetailItems(taxCode, xuatIdx) {
  var search = document.getElementById('tt-detail-search').value.toLowerCase().trim();
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var tonkhoItems = hkd.tonkhoMain || [];
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  var list = document.getElementById('tt-detail-list');
  if (!list) return;

  var html = '';
  for (var ti = 0; ti < tonkhoItems.length; ti++) {
    var tItem = tonkhoItems[ti];
    var name = (tItem.name || '').toLowerCase();
    if (search && name.indexOf(search) === -1) continue;
    var pct = xuatItem ? calculateNameSimilarity(xuatItem.name || '', tItem.name || '') : 0;
    html += '<div class="tt-detail-item" data-idx="' + ti + '" style="padding:8px 12px;margin:4px 0;border:1px solid #e0e0e0;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="selectTTDetailItem(\'' + taxCode + '\',' + xuatIdx + ',' + ti + ')">';
    html += '<div><strong>' + escapeHtml(tItem.name || '') + '</strong> <span style="color:#666;">(' + escapeHtml(tItem.unit || '') + ', SL: ' + formatQuantity(tItem.quantity) + ')</span></div>';
    html += '<span style="font-weight:700;color:' + getMatchColor(pct) + ';">' + pct + '%</span>';
    html += '</div>';
  }
  if (!html) {
    html = '<p style="color:#999;text-align:center;padding:20px;">Khong tim thay san pham phu hop</p>';
  }
  list.innerHTML = html;
}

function selectTTDetailItem(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  var cache = _manualMatchCache[taxCode] || {};
  cache[cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: new Date().toISOString() };
  _manualMatchCache[taxCode] = cache;
  saveManualMatchCache(taxCode);
  closePopup();
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep thanh cong', 'success');
}

function confirmTTDetail(taxCode, xuatIdx, tonkhoIdx) {
  selectTTDetailItem(taxCode, xuatIdx, tonkhoIdx);
}

// ==================== MATCH DETAIL POPUP REVERSE (tonkho -> xuatkho) ====================

function showTTMatchDetailPopupReverse(taxCode, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var tonkhoItems = hkd.tonkhoMain || [];
  var tonkhoItem = tonkhoItems[tonkhoIdx];
  if (!tonkhoItem) return;

  var html = '<div style="padding:20px;max-height:70vh;overflow-y:auto;">';
  html += '<h3 style="margin-bottom:8px;">Ghep thu cong: ' + escapeHtml(tonkhoItem.name || '') + ' (Ton kho -> Xuat kho)</h3>';
  html += '<p style="margin-bottom:12px;color:#666;">Tim va chon san pham xuat kho de ghep:</p>';

  // Search box
  html += '<input type="text" id="tt-detail-search-rev" placeholder="Tim san pham xuat kho..." oninput="filterTTDetailItemsReverse(\'' + taxCode + '\',' + tonkhoIdx + ')" style="width:100%;padding:8px 12px;border:1px solid #ccc;border-radius:6px;margin-bottom:12px;box-sizing:border-box;">';

  // Xuat kho list
  html += '<div id="tt-detail-list-rev" style="max-height:400px;overflow-y:auto;">';
  for (var xi = 0; xi < xuatkhoItems.length; xi++) {
    var xItem = xuatkhoItems[xi];
    var pct = calculateNameSimilarity(tonkhoItem.name || '', xItem.name || '');
    html += '<div class="tt-detail-item" data-idx="' + xi + '" style="padding:8px 12px;margin:4px 0;border:1px solid #e0e0e0;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="selectTTDetailItemReverse(\'' + taxCode + '\',' + tonkhoIdx + ',' + xi + ')">';
    html += '<div><strong>' + escapeHtml(xItem.name || '') + '</strong> <span style="color:#666;">(' + escapeHtml(xItem.unit || '') + ', SL: ' + formatQuantity(xItem.quantity) + ')</span></div>';
    html += '<span style="font-weight:700;color:' + getMatchColor(pct) + ';">' + pct + '%</span>';
    html += '</div>';
  }
  html += '</div>';

  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="tt-btn tt-btn-reset" onclick="closePopup()">Dong</button>';
  html += '</div></div>';

  showPopup(html, 'Ghep thu cong - Ton kho -> Xuat kho');
}

function filterTTDetailItemsReverse(taxCode, tonkhoIdx) {
  var search = document.getElementById('tt-detail-search-rev').value.toLowerCase().trim();
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var tonkhoItem = hkd.tonkhoMain[tonkhoIdx];
  var list = document.getElementById('tt-detail-list-rev');
  if (!list) return;

  var html = '';
  for (var xi = 0; xi < xuatkhoItems.length; xi++) {
    var xItem = xuatkhoItems[xi];
    var name = (xItem.name || '').toLowerCase();
    if (search && name.indexOf(search) === -1) continue;
    var pct = tonkhoItem ? calculateNameSimilarity(tonkhoItem.name || '', xItem.name || '') : 0;
    html += '<div class="tt-detail-item" data-idx="' + xi + '" style="padding:8px 12px;margin:4px 0;border:1px solid #e0e0e0;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="selectTTDetailItemReverse(\'' + taxCode + '\',' + tonkhoIdx + ',' + xi + ')">';
    html += '<div><strong>' + escapeHtml(xItem.name || '') + '</strong> <span style="color:#666;">(' + escapeHtml(xItem.unit || '') + ', SL: ' + formatQuantity(xItem.quantity) + ')</span></div>';
    html += '<span style="font-weight:700;color:' + getMatchColor(pct) + ';">' + pct + '%</span>';
    html += '</div>';
  }
  if (!html) {
    html = '<p style="color:#999;text-align:center;padding:20px;">Khong tim thay san pham phu hop</p>';
  }
  list.innerHTML = html;
}

function selectTTDetailItemReverse(taxCode, tonkhoIdx, xuatIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var tonkhoItem = hkd.tonkhoMain[tonkhoIdx];
  if (!tonkhoItem) return;
  var cacheKey = getTonkhoItemKey(tonkhoItem);
  var revCache = _manualMatchCacheReverse[taxCode] || {};
  revCache[cacheKey] = { tonkhoIdx: tonkhoIdx, xuatIdx: xuatIdx, matchPercent: 100, timestamp: new Date().toISOString() };
  _manualMatchCacheReverse[taxCode] = revCache;
  saveManualMatchCacheReverse(taxCode);
  closePopup();
  renderTonKhoThucTeTab(taxCode);
  toast('Da ghep thanh cong (Ton -> Xuat)', 'success');
}

function confirmTTDetailReverse(taxCode, tonkhoIdx, xuatIdx) {
  selectTTDetailItemReverse(taxCode, tonkhoIdx, xuatIdx);
}
