$path = "C:\Users\cana2\OneDrive\Desktop\thucnganv2-main\tonkho-thucte.js"

$part2 = @'

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
    return r.status === 'manual' || r.status === 'semi' || r.status === 'semi_strong';
  });
  var filtered = applyTTFilterToResults(results);
  var html = '';

  // FILTER BAR
  html += '<div class="tt-filter-bar">';
  html += '<div class="tt-filter-row">';
  html += '<input type="text" id="tt-filter-input" placeholder="🔍 Tìm tên sản phẩm..." value="' + escapeHtml(_ttFilterText) + '" oninput="debounceTTFilter()" style="flex:1;min-width:150px;">';
  html += '<select id="tt-filter-status" onchange="applyTTFilter()">';
  html += '<option value="all"' + (_ttFilterStatus === 'all' ? ' selected' : '') + '>Tất cả</option>';
  html += '<option value="auto"' + (_ttFilterStatus === 'auto' ? ' selected' : '') + '>✅ Tự động</option>';
  html += '<option value="semi_strong"' + (_ttFilterStatus === 'semi_strong' ? ' selected' : '') + '>🔶 Bán tự động >=80%</option>';
  html += '<option value="semi"' + (_ttFilterStatus === 'semi' ? ' selected' : '') + '>🟠 Bán tự động 50-79%</option>';
  html += '<option value="manual"' + (_ttFilterStatus === 'manual' ? ' selected' : '') + '>🔴 Thủ công</option>';
  html += '</select>';
  html += '<select id="tt-sort-by" onchange="applyTTFilter()">';
  html += '<option value="name"' + (_ttSortBy === 'name' ? ' selected' : '') + '>Tên SP</option>';
  html += '<option value="tonkho"' + (_ttSortBy === 'tonkho' ? ' selected' : '') + '>SL Tồn kho</option>';
  html += '<option value="xuatkho"' + (_ttSortBy === 'xuatkho' ? ' selected' : '') + '>SL Xuất kho</option>';
  html += '<option value="thucte"' + (_ttSortBy === 'thucte' ? ' selected' : '') + '>SL Thực tế</option>';
  html += '<option value="percent"' + (_ttSortBy === 'percent' ? ' selected' : '') + '>% Match</option>';
  html += '</select>';
  html += '<button class="tt-btn tt-btn-sort" onclick="toggleTTSortDir()" title="Đảo chiều sắp xếp">';
  html += (_ttSortDir === 'asc' ? '⬆️' : '⬇️');
  html += '</button>';
  if (manualItems.length > 0) {
    html += '<button class="tt-btn tt-btn-quickmatch" onclick="showQuickMatchPopup(\'' + taxCode + '\')" title="Ghép nhanh các item thủ công">';
    html += '⚡ Ghép nhanh (' + manualItems.length + ')';
    html += '</button>';
  }
  if (_ttSelectedItems.size > 0) {
    html += '<button class="tt-btn tt-btn-batch" onclick="batchMatchSelected(\'' + taxCode + '\')" title="Ghép hàng loạt các mục đã chọn">';
    html += '📦 Ghép ' + _ttSelectedItems.size + ' mục';
    html += '</button>';
  }
  html += '<button class="tt-btn tt-btn-reset" onclick="resetTTFilter()">🔄 Reset</button>';
  html += '</div></div>';

  // TABLE
  html += '<div class="tt-table-wrapper">';
  html += '<table class="tt-table"><thead><tr>';
  html += '<th class="tt-col-stt" style="width:40px;"><input type="checkbox" id="tt-select-all" onchange="toggleTTSelectAll(this)" title="Chọn tất cả"></th>';
  html += '<th class="tt-col-stt">STT</th>';
  html += '<th class="tt-col-name">Tên sản phẩm</th>';
  html += '<th class="tt-col-qty">Tồn kho</th>';
  html += '<th class="tt-col-qty">Xuất kho</th>';
  html += '<th class="tt-col-qty">Thực tế</th>';
  html += '<th class="tt-col-status-simple">Trạng thái</th>';
  html += '<th class="tt-col-status-simple">Thao tác</th>';
  html += '</tr></thead><tbody>';

  if (filtered.length === 0) {
    html += '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">Không có dữ liệu phù hợp</td></tr>';
  } else {
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var stt = i + 1;
      var tonkhoQty = parseFloat(r.tonkhoQty) || 0;
      var xuatQty = parseFloat(r.xuatQty) || 0;
      var thucte = tonkhoQty - xuatQty;

      var displayName = '';
      var displayUnit = '';
      if (r.tonkhoName && r.xuatName) {
        if (r.tonkhoName.toLowerCase().trim() === r.xuatName.toLowerCase().trim()) {
          displayName = r.tonkhoName;
          displayUnit = r.tonkhoUnit || r.xuatUnit;
        } else {
          displayName = r.tonkhoName + ' / ' + r.xuatName;
          displayUnit = (r.tonkhoUnit || '') + (r.xuatUnit && r.xuatUnit !== r.tonkhoUnit ? ' / ' + r.xuatUnit : '');
        }
      } else if (r.tonkhoName) { displayName = r.tonkhoName; displayUnit = r.tonkhoUnit; }
      else if (r.xuatName) { displayName = r.xuatName; displayUnit = r.xuatUnit; }

      var statusBadge = '';
      if (r.status === 'auto') { statusBadge = '<span class="tt-status-badge" style="background:#2e7d32;">✅ Tự động</span>'; }
      else if (r.status === 'semi_strong') { statusBadge = '<span class="tt-status-badge" style="background:#1565c0;">🔶 Bán tự động ' + r.matchPercent + '%</span>'; }
      else if (r.status === 'semi') { statusBadge = '<span class="tt-status-badge" style="background:#e65100;">🟠 Bán tự động ' + r.matchPercent + '%</span>'; }
      else { statusBadge = '<span class="tt-status-badge" style="background:#9e9e9e;">🔴 Thủ công</span>'; }

      var thucteClass = 'tt-qty-val';
      if (thucte > 0) thucteClass += ' positive';
      else if (thucte < 0) thucteClass += ' negative';
      else thucteClass += ' zero';

      var itemKey = 'x' + r.xuatIdx + '_t' + r.tonkhoIdx;
      var isChecked = _ttSelectedItems.has(itemKey) ? ' checked' : '';

      var actionBtns = '';
      if (r.status === 'auto') { actionBtns = '<span style="color:#2e7d32;font-size:0.85em;">✓ Đã ghép</span>'; }
      else if (r.status === 'semi_strong' || r.status === 'semi') {
        actionBtns = '<button class="tt-btn tt-btn-compare" onclick="showTTComparePopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + r.tonkhoIdx + ',' + r.matchPercent + ')">🔍 So sánh</button>';
      } else {
        actionBtns = '<button class="tt-btn tt-btn-manual" onclick="showTTManualPopup(\'' + taxCode + '\',' + r.xuatIdx + ')">✏️ Ghép thủ công</button>';
      }

      var suggestionsHtml = '';
      if ((r.status === 'semi' || r.status === 'semi_strong' || r.status === 'manual') && r.suggestions && r.suggestions.length > 0) {
        suggestionsHtml = '<div class="tt-suggestions">';
        suggestionsHtml += '<span class="tt-suggestions-label">Gợi ý:</span>';
        for (var si = 0; si < r.suggestions.length; si++) {
          var sug = r.suggestions[si];
          var sugColor = getMatchColor(sug.percent);
          suggestionsHtml += '<button class="tt-suggestion-btn" style="border-color:' + sugColor + ';color:' + sugColor + ';" onclick="showTTComparePopup(\'' + taxCode + '\',' + r.xuatIdx + ',' + sug.idx + ',' + sug.percent + ')">';
          suggestionsHtml += escapeHtml(sug.name) + ' (' + sug.percent + '%)';
          suggestionsHtml += '</button>';
        }
        suggestionsHtml += '</div>';
      }

      html += '<tr draggable="true" ondragstart="onTTDragStart(event,\'' + taxCode + '\',' + r.xuatIdx + ')" ondragend="onTTDragEnd(event)" ondragover="onTTDragOver(event)" ondrop="onTTDrop(event,\'' + taxCode + '\',' + r.tonkhoIdx + ')">';
      html += '<td style="width:40px;text-align:center;"><input type="checkbox" class="tt-select-item" data-key="' + itemKey + '"' + isChecked + ' onchange="toggleTTSelectItem(this,\'' + itemKey + '\')"></td>';
      html += '<td class="tt-col-stt">' + stt + '</td>';
      html += '<td class="tt-col-name"><div class="tt-sp-name">' + escapeHtml(displayName) + '</div>';
      if (displayUnit) { html += '<div class="tt-sp-unit">' + escapeHtml(displayUnit) + '</div>'; }
      html += suggestionsHtml;
      html += '</td>';
      html += '<td class="tt-col-qty"><span class="tt-qty-val tonkho">' + formatQuantity(tonkhoQty) + '</span></td>';
      html += '<td class="tt-col-qty"><span class="tt-qty-val xuatkho">' + formatQuantity(xuatQty) + '</span></td>';
      html += '<td class="tt-col-qty"><span class="' + thucteClass + '">' + formatQuantity(thucte) + '</span></td>';
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
    _ttFilterText = document.getElementById('tt-filter-input')?.value || '';
    applyTTFilter();
  }, 300);
}

function applyTTFilter() {
  _ttFilterText = document.getElementById('tt-filter-input')?.value || '';
  _ttFilterStatus = document.getElementById('tt-filter-status')?.value || 'all';
  _ttSortBy = document.getElementById('tt-sort-by')?.value || 'name';
  if (currentTaxCode) renderTonKhoThucTeTab(currentTaxCode);
}

function toggleTTSortDir() {
  _ttSortDir = _ttSortDir === 'asc' ? 'desc' : 'asc';
  if (currentTaxCode) renderTonKhoThucTeTab(currentTaxCode);
}

function resetTTFilter() {
  _ttFilterText = '';
  _ttFilterStatus = 'all';
  _ttSortBy = 'name';
  _ttSortDir = 'asc';
  _ttSelectedItems = new Set();
  if (currentTaxCode) renderTonKhoThucTeTab(currentTaxCode);
}

// ==================== BATCH SELECTION ====================

function toggleTTSelectAll(checkbox) {
  var items = document.querySelectorAll('.tt-select-item');
  for (var i = 0; i < items.length; i++) {
    items[i].checked = checkbox.checked;
    var key = items[i].getAttribute('data-key');
    if (checkbox.checked) { _ttSelectedItems.add(key); }
    else { _ttSelectedItems.delete(key); }
  }
  if (currentTaxCode) renderTonKhoThucTeTab(currentTaxCode);
}

function toggleTTSelectItem(checkbox, itemKey) {
  if (checkbox.checked) { _ttSelectedItems.add(itemKey); }
  else {
    _ttSelectedItems.delete(itemKey);
    var selectAll = document.getElementById('tt-select-all');
    if (selectAll) selectAll.checked = false;
  }
  if (currentTaxCode) renderTonKhoThucTeTab(currentTaxCode);
}

function batchMatchSelected(taxCode) {
  if (_ttSelectedItems.size === 0) {
    window.showToast('Chưa chọn mục nào', 2000, 'warning');
    return;
  }
  var results = calculateTonKhoThucTe(taxCode);
  var matched = 0;
  _ttSelectedItems.forEach(function(itemKey) {
    var parts = itemKey.split('_');
    if (parts.length < 2) return;
    var xuatIdx = parseInt(parts[0].replace('x', ''), 10);
    var tonkhoIdx = parseInt(parts[1].replace('t', ''), 10);
    if (isNaN(xuatIdx) || isNaN(tonkhoIdx) || tonkhoIdx < 0) return;
    for (var i = 0; i < results.length; i++) {
      if (results[i].xuatIdx === xuatIdx) {
        var hkd = hkdData[taxCode];
        if (!hkd) return;
        var xuatItem = hkd.xuatkhoMain[xuatIdx];
        if (!xuatItem) return;
        var cacheKey = getXuatItemKey(xuatItem);
        if (!_manualMatchCache[taxCode]) _manualMatchCache[taxCode] = {};
        _manualMatchCache[taxCode][cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: results[i].matchPercent || 100, timestamp: Date.now() };
        matched++;
        break;
      }
    }
  });
  saveManualMatchCache(taxCode);
  _ttSelectedItems = new Set();
  window.showToast('Đã ghép ' + matched + ' mục thành công!', 3000, 'success');
  renderTonKhoThucTeTab(taxCode);
}

// ==================== DRAG & DROP ====================

function onTTDragStart(event, taxCode, xuatIdx) {
  _ttDragItem = { taxCode: taxCode, xuatIdx: xuatIdx };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', xuatIdx);
  event.target.style.opacity = '0.5';
}

function onTTDragEnd(event) {
  _ttDragItem = null;
  event.target.style.opacity = '1';
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
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  if (!_manualMatchCache[taxCode]) _manualMatchCache[taxCode] = {};
  _manualMatchCache[taxCode][cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: Date.now() };
  saveManualMatchCache(taxCode);
  window.showToast('Đã ghép kéo thả thành công!', 2000, 'success');
  renderTonKhoThucTeTab(taxCode);
}

// ==================== SHOW COMPARE POPUP ====================

function showTTComparePopup(taxCode, xuatIdx, tonkhoIdx, matchPercent) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  var tonkhoItem = hkd.tonkhoMain[tonkhoIdx];
  if (!xuatItem || !tonkhoItem) return;
  var tonkhoItems = hkd.tonkhoMain || [];
  var suggestions = findTopSuggestions(xuatItem.productName || '', xuatItem.unit || '', tonkhoItems, 3);

  var html = '<div style="padding:20px;">';
  html += '<h3 style="margin-bottom:16px;">🔍 So sánh sản phẩm</h3>';
  html += '<div style="display:flex;gap:20px;margin-bottom:20px;">';
  html += '<div style="flex:1;padding:16px;background:#fff3e0;border-radius:8px;border:1px solid #ff9800;">';
  html += '<div style="font-weight:600;color:#e65100;margin-bottom:8px;">📤 Xuất kho</div>';
  html += '<div><strong>' + escapeHtml(xuatItem.productName || '') + '</strong></div>';
  html += '<div style="color:#666;font-size:0.9em;">DVT: ' + escapeHtml(xuatItem.unit || '') + '</div>';
  html += '<div style="color:#e65100;font-weight:700;margin-top:4px;">SL: ' + formatQuantity(xuatItem.quantity) + '</div>';
  html += '</div>';
  html += '<div style="flex:1;padding:16px;background:#e3f2fd;border-radius:8px;border:1px solid #1976d2;">';
  html += '<div style="font-weight:600;color:#1976d2;margin-bottom:8px;">📦 Tồn kho</div>';
  html += '<div><strong>' + escapeHtml(tonkhoItem.productName || '') + '</strong></div>';
  html += '<div style="color:#666;font-size:0.9em;">DVT: ' + escapeHtml(tonkhoItem.unit || '') + '</div>';
  html += '<div style="color:#1976d2;font-weight:700;margin-top:4px;">SL: ' + formatQuantity(tonkhoItem.quantity) + '</div>';
  html += '</div></div>';

  html += '<div style="text-align:center;margin-bottom:16px;">';
  html += '<span style="display:inline-block;padding:4px 16px;border-radius:20px;background:' + getMatchColor(matchPercent) + ';color:#fff;font-weight:600;">Tỉ lệ tương đồng: ' + matchPercent + '%</span>';
  html += '</div>';

  if (suggestions.length > 0) {
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-weight:600;margin-bottom:8px;color:#666;">📋 Các gợi ý khác:</div>';
    for (var si = 0; si < suggestions.length; si++) {
      var sug = suggestions[si];
      if (sug.idx === tonkhoIdx) continue;
      var sugColor = getMatchColor(sug.percent);
      html += '<button onclick="showTTComparePopup(\'' + taxCode + '\',' + xuatIdx + ',' + sug.idx + ',' + sug.percent + ')" style="display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:4px;border:1px solid ' + sugColor + ';border-radius:6px;background:#fff;cursor:pointer;">';
      html += '<span style="color:' + sugColor + ';font-weight:600;">' + escapeHtml(sug.name) + '</span>';
      html += ' <span style="color:#999;">(' + sug.percent + '%)</span>';
      html += '</button>';
    }
    html += '</div>';
  }

  html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">';
  html += '<button onclick="confirmTTMatch(\'' + taxCode + '\',' + xuatIdx + ',' + tonkhoIdx + ')" style="padding:10px 24px;background:#2e7d32;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">✅ Đồng ý ghép</button>';
  html += '<button onclick="rejectTTMatch(\'' + taxCode + '\',' + xuatIdx + ')" style="padding:10px 24px;background:#d32f2f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">❌ Từ chối</button>';
  html += '<button onclick="window.closePopup()" style="padding:10px 24px;background:#e0e0e0;color:#333;border:none;border-radius:8px;cursor:pointer;">Hủy</button>';
  html += '</div></div>';

  window.showPopup(html, 'So sánh sản phẩm');
}

function confirmTTMatch(taxCode, xuatIdx, tonkhoIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  if (!_manualMatchCache[taxCode]) _manualMatchCache[taxCode] = {};
  _manualMatchCache[taxCode][cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: Date.now() };
  saveManualMatchCache(taxCode);
  window.closePopup();
  window.showToast('Đã ghép thành công!', 2000, 'success');
  renderTonKhoThucTeTab(taxCode);
}

function rejectTTMatch(taxCode, xuatIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  if (!_manualMatchCache[taxCode]) _manualMatchCache[taxCode] = {};
  _manualMatchCache[taxCode][cacheKey] = { tonkhoIdx: -1, matchPercent: 0, timestamp: Date.now() };
  saveManualMatchCache(taxCode);
  window.closePopup();
  window.showToast('Đã từ chối ghép', 2000, 'info');
  renderTonKhoThucTeTab(taxCode);
}

// ==================== SHOW MANUAL POPUP ====================

function showTTManualPopup(taxCode, xuatIdx) {
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var tonkhoItems = hkd.tonkhoMain || [];
  var suggestions = findTopSuggestions(xuatItem.productName || '', xuatItem.unit || '', tonkhoItems, 50);

  var html = '<div style="padding:20px;">';
  html += '<h3 style="margin-bottom:16px;">✏️ Ghép thủ công</h3>';
  html += '<div style="padding:12px;background:#fff3e0;border-radius:8px;margin-bottom:16px;">';
  html += '<div><strong>📤 Xuất kho:</strong> ' + escapeHtml(xuatItem.productName || '') + '</div>';
  html += '<div style="color:#666;">DVT: ' + escapeHtml(xuatItem.unit || '') + ' | SL: ' + formatQuantity(xuatItem.quantity) + '</div>';
  html += '</div>';
  html += '<input type="text" id="tt-manual-search" placeholder="🔍 Tìm sản phẩm tồn kho..." oninput="filterTTManualItems()" style="width:100%;padding:8px 12px;border:1px solid #ccc;border-radius:6px;margin-bottom:12px;">';
  html += '<div id="tt-manual-list" style="max-height:400px;overflow-y:auto;">';
  for (var i = 0; i < suggestions.length; i++) {
    var sug = suggestions[i];
    var sugColor = getMatchColor(sug.percent);
    html += '<div class="tt-manual-item" data-idx="' + sug.idx + '" data-name="' + escapeHtml(sug.name.toLowerCase()) + '" onclick="selectTTManualItem(this,' + sug.idx + ')" style="padding:8px 12px;margin-bottom:4px;border:1px solid ' + sugColor + ';border-radius:6px;cursor:pointer;transition:all 0.2s;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div><strong>' + escapeHtml(sug.name) + '</strong> <span style="color:#999;font-size:0.85em;">(' + escapeHtml(sug.unit || '') + ')</span></div>';
    html += '<div><span style="color:' + sugColor + ';font-weight:600;">' + sug.percent + '%</span> | SL: ' + formatQuantity(sug.qty) + '</div>';
    html += '</div></div>';
  }
  html += '</div>';
  html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">';
  html += '<button id="tt-manual-confirm-btn" onclick="confirmTTManual(\'' + taxCode + '\',' + xuatIdx + ')" disabled style="padding:10px 24px;background:#7b1fa2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;opacity:0.5;">✅ Ghép</button>';
  html += '<button onclick="window.closePopup()" style="padding:10px 24px;background:#e0e0e0;color:#333;border:none;border-radius:8px;cursor:pointer;">Hủy</button>';
  html += '</div></div>';

  window.showPopup(html, 'Ghép thủ công');
  window._ttManualSelectedIdx = -1;
}

function filterTTManualItems() {
  var search = (document.getElementById('tt-manual-search')?.value || '').toLowerCase().trim();
  var items = document.querySelectorAll('.tt-manual-item');
  for (var i = 0; i < items.length; i++) {
    var name = items[i].getAttribute('data-name') || '';
    items[i].style.display = (!search || name.indexOf(search) !== -1) ? 'block' : 'none';
  }
}

function selectTTManualItem(el, idx) {
  var items = document.querySelectorAll('.tt-manual-item');
  for (var i = 0; i < items.length; i++) {
    items[i].style.background = '#fff';
    items[i].style.borderColor = getMatchColor(parseInt(items[i].getAttribute('data-idx')));
  }
  el.style.background = '#f3e5f5';
  el.style.borderColor = '#7b1fa2';
  el.style.borderWidth = '2px';
  window._ttManualSelectedIdx = idx;
  var btn = document.getElementById('tt-manual-confirm-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

function confirmTTManual(taxCode, xuatIdx) {
  var tonkhoIdx = window._ttManualSelectedIdx;
  if (tonkhoIdx === undefined || tonkhoIdx < 0) {
    window.showToast('Vui lòng chọn sản phẩm tồn kho', 2000, 'warning');
    return;
  }
  var hkd = hkdData[taxCode];
  if (!hkd) return;
  var xuatItem = hkd.xuatkhoMain[xuatIdx];
  if (!xuatItem) return;
  var cacheKey = getXuatItemKey(xuatItem);
  if (!_manualMatchCache[taxCode]) _manualMatchCache[taxCode] = {};
  _manualMatchCache[taxCode][cacheKey] = { tonkhoIdx: tonkhoIdx, matchPercent: 100, timestamp: Date.now() };
  saveManualMatchCache(taxCode);
  window.closePopup();
  window.showToast('Đã ghép thủ công thành công!', 2000, 'success');
  renderTonKhoThucTeTab(taxCode);
}

// ==================== QUICK MATCH POPUP ====================

function showQuickMatchPopup(taxCode) {
  var results = calculateTonKhoThucTe(taxCode);
  var manualItems = results.filter(function(r) {
    return r.status === 'manual' || r.status === 'semi' || r.status === 'semi_strong';
  });
  if (manualItems.length === 0) {
    window.showToast('Không có item nào cần ghép', 2000, 'info');
    return;
  }

  var html = '<div style="padding:20px;">';
  html += '<h3 style="margin-bottom:16px;">⚡ Ghép nhanh (' + manualItems.length + ' item)</h3>';
  html += '<p style="color:#666;margin-bottom:16px;">Chọn sản phẩm tồn kho phù hợp cho từng item xuất kho:</p>';
  html += '<div style="max-height:500px;overflow-y:auto;">';

  for (var i = 0; i < manualItems.length; i++) {
    var r = manualItems[i];
    html += '<div style="margin-bottom:16px;padding:12px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    html += '<div><strong>#' + (i+1) + ' 📤 ' + escapeHtml(r.xuatName) + '</strong> <span style="color:#999;">(' + escapeHtml(r.xuatUnit) + ', SL: ' + formatQuantity(r.xuatQty) + ')</span></div>';
    html += '<span class="tt-status-badge" style="background:' + getMatchColor(r.matchPercent) + ';">' + r.matchPercent + '%</span>';
    html += '</div>';

    if (r.suggestions && r.suggestions.length > 0) {
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      for (var si = 0; si < r.suggestions.length; si++) {
        var sug = r.suggestions[si];
        var sugColor = getMatchColor(sug.percent);
        html += '<button onclick="quickMatchConfirm(\'' + taxCode + '\',' + r.xuatIdx +