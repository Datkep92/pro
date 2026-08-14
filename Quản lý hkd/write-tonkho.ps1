$path = "C:\Users\cana2\OneDrive\Desktop\thucnganv2-main\tonkho-thucte.js"

$part1 = @'
// tonkho-thucte.js - Tồn kho thực tế (Tồn kho - Xuất kho)
// ============================================================

// ==================== GLOBAL VARIABLES ====================
var _ttFilterText = '';
var _ttFilterStatus = 'all';
var _ttSortBy = 'name';
var _ttSortDir = 'asc';
var _ttDragItem = null;
var _ttSelectedItems = new Set();
var _manualMatchCache = {};

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

// ==================== MANUAL MATCH CACHE ====================

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
  var name = (xuatItem.productName || '').trim();
  var unit = (xuatItem.unit || '').trim();
  var code = (xuatItem.productCode || '').trim();
  return (name + '|' + unit + '|' + code).toLowerCase();
}

// ==================== FIND TOP SUGGESTIONS ====================

function findTopSuggestions(xuatName, xuatUnit, tonkhoItems, limit) {
  limit = limit || 3;
  var suggestions = [];
  for (var i = 0; i < tonkhoItems.length; i++) {
    var item = tonkhoItems[i];
    var pct = calculateNameSimilarity(xuatName, item.productName || '');
    var xuatUnitNorm = normalizeName(xuatUnit);
    var tkUnitNorm = normalizeName(item.unit || '');
    if (xuatUnitNorm && tkUnitNorm && xuatUnitNorm === tkUnitNorm) { pct = Math.min(100, pct + 5); }
    suggestions.push({ idx: i, name: item.productName || '', unit: item.unit || '', qty: item.quantity, percent: pct });
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
  if (status === 'semi_strong') return 'Bán tự động ' + percent + '%';
  if (status === 'semi') return 'Bán tự động ' + percent + '%';
  if (status === 'manual') return 'Thủ công';
  return status;
}

// ==================== CALCULATE TON KHO THUC TE (5-TIER) ====================

function calculateTonKhoThucTe(taxCode) {
  var hkd = hkdData[taxCode];
  if (!hkd) return [];
  loadManualMatchCache(taxCode);
  var tonkhoItems = hkd.tonkhoMain || [];
  var xuatkhoItems = hkd.xuatkhoMain || [];
  var results = [];
  var tonkhoMap = {}, tonkhoMapByName = {}, tonkhoMapByCode = {}, tonkhoMapByNormalized = {};

  for (var i = 0; i < tonkhoItems.length; i++) {
    var item = tonkhoItems[i];
    var name = (item.productName || '').trim().toLowerCase();
    var unit = (item.unit || '').trim().toLowerCase();
    var code = (item.productCode || '').trim().toLowerCase();
    var norm = normalizeName(name);
    var key1 = name + '|' + unit;
    if (!tonkhoMap[key1]) tonkhoMap[key1] = [];
    tonkhoMap[key1].push(i);
    if (!tonkhoMapByName[name]) tonkhoMapByName[name] = [];
    tonkhoMapByName[name].push(i);
    if (code) {
      if (!tonkhoMapByCode[code]) tonkhoMapByCode[code] = [];
      tonkhoMapByCode[code].push(i);
    }
    if (norm) {
      if (!tonkhoMapByNormalized[norm]) tonkhoMapByNormalized[norm] = [];
      tonkhoMapByNormalized[norm].push(i);
    }
  }

  var matchedTonkhoIndices = {};

  for (var xi = 0; xi < xuatkhoItems.length; xi++) {
    var xuatItem = xuatkhoItems[xi];
    var xuatName = (xuatItem.productName || '').trim();
    var xuatUnit = (xuatItem.unit || '').trim();
    var xuatCode = (xuatItem.productCode || '').trim().toLowerCase();
    var xuatQty = parseFloat(xuatItem.quantity) || 0;
    var xuatNameLower = xuatName.toLowerCase();
    var xuatUnitLower = xuatUnit.toLowerCase();
    var xuatNorm = normalizeName(xuatName);
    var matchedTonkhoIdx = -1, matchPercent = 0, matchStatus = 'manual', unitMismatch = false;

    // Check manual match cache FIRST
    var cacheKey = getXuatItemKey(xuatItem);
    var cache = _manualMatchCache[taxCode] || {};
    if (cache[cacheKey]) {
      var cached = cache[cacheKey];
      if (cached.tonkhoIdx >= 0 && cached.tonkhoIdx < tonkhoItems.length) {
        matchedTonkhoIdx = cached.tonkhoIdx;
        matchPercent = cached.matchPercent || 100;
        matchStatus = 'auto';
        matchedTonkhoIndices[matchedTonkhoIdx] = true;
        results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].productName || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: matchPercent, status: matchStatus, suggestions: [], unitMismatch: false }));
        continue;
      } else if (cached.tonkhoIdx === -1) {
        var suggestions = findTopSuggestions(xuatName, xuatUnit, tonkhoItems, 3);
        results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: -1, tonkhoName: '', tonkhoUnit: '', tonkhoQty: 0, matchPercent: 0, status: 'manual', suggestions: suggestions, unitMismatch: false }));
        continue;
      }
    }

    // TIER 1: Exact match (name + unit)
    var key1 = xuatNameLower + '|' + xuatUnitLower;
    if (tonkhoMap[key1] && tonkhoMap[key1].length > 0) {
      matchedTonkhoIdx = tonkhoMap[key1][0];
      matchPercent = 100; matchStatus = 'auto';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
      results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].productName || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: 100, status: 'auto', suggestions: [], unitMismatch: false }));
      continue;
    }

    // TIER 2: Match by product code
    if (xuatCode && tonkhoMapByCode[xuatCode] && tonkhoMapByCode[xuatCode].length > 0) {
      matchedTonkhoIdx = tonkhoMapByCode[xuatCode][0];
      matchPercent = 100; matchStatus = 'auto';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
      results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].productName || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: 100, status: 'auto', suggestions: [], unitMismatch: false }));
      continue;
    }

    // TIER 3: Exact name match (ignore unit)
    if (tonkhoMapByName[xuatNameLower] && tonkhoMapByName[xuatNameLower].length > 0) {
      matchedTonkhoIdx = tonkhoMapByName[xuatNameLower][0];
      var matchedUnit = (tonkhoItems[matchedTonkhoIdx].unit || '').trim().toLowerCase();
      if (matchedUnit !== xuatUnitLower) { unitMismatch = true; matchPercent = 95; }
      else { matchPercent = 100; }
      matchStatus = 'auto';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
      results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].productName || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: matchPercent, status: matchStatus, suggestions: [], unitMismatch: unitMismatch }));
      continue;
    }

    // TIER 4: Normalized name match
    if (xuatNorm && tonkhoMapByNormalized[xuatNorm] && tonkhoMapByNormalized[xuatNorm].length > 0) {
      matchedTonkhoIdx = tonkhoMapByNormalized[xuatNorm][0];
      matchPercent = 95; matchStatus = 'auto';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
      results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: tonkhoItems[matchedTonkhoIdx].productName || '', tonkhoUnit: tonkhoItems[matchedTonkhoIdx].unit || '', tonkhoQty: tonkhoItems[matchedTonkhoIdx].quantity || 0, matchPercent: 95, status: 'auto', suggestions: [], unitMismatch: false }));
      continue;
    }

    // TIER 5: Fuzzy match
    var bestIdx = -1, bestPct = 0;
    for (var ti = 0; ti < tonkhoItems.length; ti++) {
      var pct = calculateNameSimilarity(xuatName, tonkhoItems[ti].productName || '');
      if (pct > bestPct) { bestPct = pct; bestIdx = ti; }
    }
    var suggestions = findTopSuggestions(xuatName, xuatUnit, tonkhoItems, 3);

    if (bestPct >= 80 && bestIdx >= 0) {
      matchedTonkhoIdx = bestIdx; matchPercent = bestPct; matchStatus = 'semi_strong';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
    } else if (bestPct >= 50 && bestIdx >= 0) {
      matchedTonkhoIdx = bestIdx; matchPercent = bestPct; matchStatus = 'semi';
      matchedTonkhoIndices[matchedTonkhoIdx] = true;
    } else {
      matchedTonkhoIdx = -1; matchPercent = bestPct; matchStatus = 'manual';
    }

    results.push(makeResultItem({ xuatIdx: xi, xuatName: xuatName, xuatUnit: xuatUnit, xuatQty: xuatQty, tonkhoIdx: matchedTonkhoIdx, tonkhoName: matchedTonkhoIdx >= 0 ? (tonkhoItems[matchedTonkhoIdx].productName || '') : '', tonkhoUnit: matchedTonkhoIdx >= 0 ? (tonkhoItems[matchedTonkhoIdx].unit || '') : '', tonkhoQty: matchedTonkhoIdx >= 0 ? (tonkhoItems[matchedTonkhoIdx].quantity || 0) : 0, matchPercent: matchPercent, status: matchStatus, suggestions: suggestions, unitMismatch: false }));
  }

  // Add tonkho items khong co xuat kho tuong ung
  for (var ti = 0; ti < tonkhoItems.length; ti++) {
    if (!matchedTonkhoIndices[ti]) {
      results.push(makeResultItem({ xuatIdx: -1, xuatName: '', xuatUnit: '', xuatQty: 0, tonkhoIdx: ti, tonkhoName: tonkhoItems[ti].productName || '', tonkhoUnit: tonkhoItems[ti].unit || '', tonkhoQty: tonkhoItems[ti].quantity || 0, matchPercent: 100, status: 'auto', suggestions: [], unitMismatch: false }));
    }
  }
  return results;
}
'@

Set-Content -Path $path -Value $part1 -Encoding UTF8
Write-Host "Part 1 written successfully"
