// ============================
// CHUẨN HÓA ĐVT (ĐƠN VỊ TÍNH)
// ============================
// Bỏ dấu tiếng Việt, viết thường để tạo key so sánh
function removeVietnameseTones(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hóa ĐVT: trim, viết thường, bỏ dấu -> tạo key để gom nhóm
function normalizeUnit(unit) {
  return removeVietnameseTones(unit.trim().toLowerCase());
}

// So sánh 2 cách viết ĐVT, chọn cách "đẹp hơn" (viết hoa chữ cái đầu)
function isBetterUnit(candidate, current) {
  const a = candidate.trim();
  const b = current.trim();
  // Ưu tiên viết hoa chữ cái đầu
  const aCapitalized = a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();
  const bCapitalized = b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
  if (a === aCapitalized && b !== bCapitalized) return true;
  if (b === bCapitalized && a !== aCapitalized) return false;
  // Nếu cùng mức độ, ưu tiên ngắn hơn
  return a.length < b.length;
}

// ============================
// PHÂN TRANG (PAGINATION) CHO BẢNG TỒN KHO
// ============================
const TONKHO_PAGE_SIZE = 100;
let _tonkhoPage = {}; // { "taxCode|type": currentPage }
let _tonkhoShowAll = {}; // { "taxCode|type": true/false } — chế độ hiển thị tất cả

function getTonKhoPage(taxCode, type) {
  const key = taxCode + '|' + type;
  return _tonkhoPage[key] || 0;
}

function setTonKhoPage(taxCode, type, page) {
  const key = taxCode + '|' + type;
  _tonkhoPage[key] = page;
}

function isTonKhoShowAll(taxCode, type) {
  const key = taxCode + '|' + type;
  return _tonkhoShowAll[key] || false;
}

function setTonKhoShowAll(taxCode, type, showAll) {
  const key = taxCode + '|' + type;
  _tonkhoShowAll[key] = showAll;
}

function renderPagination(totalItems, currentPage, taxCode, type, containerId) {
  const totalPages = Math.ceil(totalItems / TONKHO_PAGE_SIZE);
  const showAll = isTonKhoShowAll(taxCode, type);
  if (totalPages <= 1 && !showAll) return '';
  
  let html = `<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin:10px 0;padding:8px;background:#f5f5f5;border-radius:6px;">`;
  html += `<span style="font-size:0.85em;color:#666;">Tổng: ${totalItems} dòng</span>`;
  
  if (!showAll) {
    // Nút Prev
    html += `<button onclick="changeTonKhoPage('${taxCode}','${type}',${currentPage - 1})" style="padding:4px 12px;border:1px solid #ccc;border-radius:4px;background:${currentPage > 0 ? '#fff' : '#eee'};cursor:${currentPage > 0 ? 'pointer' : 'default'};" ${currentPage <= 0 ? 'disabled' : ''}>&#9664; Trước</button>`;
    
    // Các nút trang (tối đa 5 nút)
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);
    for (let p = startPage; p <= endPage; p++) {
      const active = p === currentPage;
      html += `<button onclick="changeTonKhoPage('${taxCode}','${type}',${p})" style="padding:4px 10px;border:1px solid ${active ? '#1976d2' : '#ccc'};border-radius:4px;background:${active ? '#1976d2' : '#fff'};color:${active ? '#fff' : '#333'};font-weight:${active ? 'bold' : 'normal'};cursor:pointer;">${p + 1}</button>`;
    }
    
    // Nút Next
    html += `<button onclick="changeTonKhoPage('${taxCode}','${type}',${currentPage + 1})" style="padding:4px 12px;border:1px solid #ccc;border-radius:4px;background:${currentPage < totalPages - 1 ? '#fff' : '#eee'};cursor:${currentPage < totalPages - 1 ? 'pointer' : 'default'};" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Sau &#9654;</button>`;
  }
  
  // Nút All / Phân trang
  html += `<button onclick="toggleTonKhoShowAll('${taxCode}','${type}')" style="padding:4px 12px;border:1px solid ${showAll ? '#1976d2' : '#ccc'};border-radius:4px;background:${showAll ? '#1976d2' : '#fff'};color:${showAll ? '#fff' : '#333'};font-weight:bold;cursor:pointer;">${showAll ? '📄 Phân trang' : '📋 All'}</button>`;

  html += `</div>`;
  return html;
}

function changeTonKhoPage(taxCode, type, page) {
  const key = taxCode + '|' + type;
  const totalPages = Math.ceil(getTotalItemsForPage(taxCode, type) / TONKHO_PAGE_SIZE);
  if (page < 0 || page >= totalPages) return;
  setTonKhoPage(taxCode, type, page);
  setTonKhoShowAll(taxCode, type, false);
  renderTonKhoTab(taxCode, type);
}

function toggleTonKhoShowAll(taxCode, type) {
  const showAll = !isTonKhoShowAll(taxCode, type);
  setTonKhoShowAll(taxCode, type, showAll);
  renderTonKhoTab(taxCode, type);
}

/**
 * Đặt lại toàn bộ bộ lọc tồn kho:
 * - Xóa giá trị tất cả input/select
 * - Clear flatpickr
 * - Reset phân trang về trang 0
 * - Tắt chế độ All
 * - Render lại bảng
 */
function resetTonKhoFilters() {
  // Xác định taxCode và type từ tab đang hiển thị (giống applyAutoFilter)
  const taxCode = currentTaxCode;
  if (!taxCode || !hkdData[taxCode]) return;
  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const div = document.getElementById(`tonKho-${t}`);
    if (div && div.style.display !== 'none') type = t;
  });

  // Clear flatpickr date inputs
  const fpFrom = document.getElementById('filterFrom')?._flatpickr;
  const fpTo = document.getElementById('filterTo')?._flatpickr;
  if (fpFrom) fpFrom.clear();
  if (fpTo) fpTo.clear();

  // Clear text inputs
  const numInput = document.getElementById('filterNumber');
  if (numInput) numInput.value = '';
  const searchInput = document.getElementById('filterSearch');
  if (searchInput) searchInput.value = '';

  // Reset dropdowns về giá trị mặc định
  const selects = ['filterTen', 'filterThueSuat', 'filterDVT', 'filterMatchPct', 'filterSort'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset pagination về trang 0
  setTonKhoPage(taxCode, type, 0);
  // Tắt chế độ All
  setTonKhoShowAll(taxCode, type, false);

  // Render lại bảng
  renderTonKhoTab(taxCode, type);
}
window.resetTonKhoFilters = resetTonKhoFilters;

function getTotalItemsForPage(taxCode, type) {
  if (!hkdData[taxCode]) return 0;
  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const arr = (hkdData[taxCode][map[type]] || []).filter(item => {
    if (type === 'main') return item.category === 'hang_hoa';
    if (type === 'km') return item.category === 'KM';
    if (type === 'ck') return item.category === 'chiet_khau';
    return true;
  });
  return arr.length;
}

function switchTonKhoTab(tab) {
  if (!currentTaxCode) {
    showToast("Vui lòng chọn một HKD trước", 2000, 'error');
    return;
  }

  const tabs = ['main', 'km', 'ck'];
  tabs.forEach(t => {
    const div = document.getElementById(`tonKho-${t}`);
    if (div) div.style.display = (t === tab ? 'block' : 'none');
  });

  renderTonKhoTab(currentTaxCode, tab);
  updateMainTotalDisplay(currentTaxCode);
}

function renderTonKhoTab(taxCode, type) {
  addMissingProductCodes(taxCode);

  if (!hkdData[taxCode]) {
    hkdData[taxCode] = {
      tonkhoMain: [],
      tonkhoKM: [],
      tonkhoCK: [],
      invoices: [],
      exports: []
    };
  }

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const divMap = { main: 'tonKho-main', km: 'tonKho-km', ck: 'tonKho-ck' };
  const spanMap = { main: 'total-tonkho-main', km: 'total-tonkho-km', ck: 'total-tonkho-ck' };

  const arr = (hkdData[taxCode][map[type]] || []).filter(item => {
    if (type === 'main') return item.category === 'hang_hoa';
    if (type === 'km') return item.category === 'KM';
    if (type === 'ck') return item.category === 'chiet_khau';
    return true;
  });

  const zeroStockCount = arr.filter(item => parseFloat(item.quantity) <= 0).length;

  // ============================================================
  // THANH FILTER: Lịch chọn ngày + Tìm số HĐ real-time + Dropdown
  // ============================================================
  if (!document.getElementById('tonkho-filters')) {
    const filterDiv = document.createElement('div');
    filterDiv.id = 'tonkho-filters';
    filterDiv.style = 'margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';
    filterDiv.innerHTML = `
      <label>📅 Từ: <input type="text" id="filterFrom" class="flatpickr-input" placeholder="Chọn ngày" readonly="readonly"></label>
      <label>📅 Đến: <input type="text" id="filterTo" class="flatpickr-input" placeholder="Chọn ngày" readonly="readonly"></label>
      <label>🔍 Số HĐ: <input type="text" id="filterNumber" list="numberList" placeholder="Gõ số hóa đơn..." style="width:160px;"></label>
      <datalist id="numberList"></datalist>
      <label>🔎 Tìm: <input type="text" id="filterSearch" placeholder="Tên hoặc mã hàng..." style="width:180px;"></label>
      <label>Tên: <select id="filterTen" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>Thuế suất: <select id="filterThueSuat" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>ĐVT: <select id="filterDVT" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>% Khớp: <select id="filterMatchPct" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
        <option value="100">100%</option>
        <option value="75-99">75% - 99%</option>
        <option value="50-74">50% - 74%</option>
        <option value="25-49">25% - 49%</option>
        <option value="1-24">< 25%</option>
        <option value="none">Chưa đồng bộ</option>
      </select></label>
      <label>Sắp xếp: <select id="filterSort" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Mặc định</option>
        <option value="ten-asc">Tên A-Z</option>
        <option value="ten-desc">Tên Z-A</option>
      </select></label>
      ${zeroStockCount > 0 ? `
        <button id="deleteZeroStockBtn" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
          Xóa ${zeroStockCount} tồn kho = 0
        </button>
      ` : ''}
      <button id="resetFiltersBtn" style="background: #ff9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight:bold;">
        🔄 Đặt lại
      </button>
    `;
    const container = document.getElementById(divMap[type]);
    if (container) container.insertAdjacentElement('beforebegin', filterDiv);

    // Khởi tạo flatpickr cho lịch chọn ngày
    flatpickr("#filterFrom", {
      dateFormat: "Y-m-d",
      onChange: () => applyAutoFilter()
    });
    flatpickr("#filterTo", {
      dateFormat: "Y-m-d",
      onChange: () => applyAutoFilter()
    });

    // Gán sự kiện real-time cho các input/dropdown
    // Sử dụng applyAutoFilter() không tham số để tự động xác định taxCode và type từ DOM
    // Debounce cho input text để tránh render quá nhiều khi gõ
    let _debounceTimer;
    document.getElementById('filterNumber').addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => applyAutoFilter(), 300);
    });
    document.getElementById('filterSearch').addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => applyAutoFilter(), 300);
    });
    document.getElementById('filterTen').addEventListener('change', () => applyAutoFilter());
    document.getElementById('filterThueSuat').addEventListener('change', () => applyAutoFilter());
    document.getElementById('filterDVT').addEventListener('change', () => applyAutoFilter());
    document.getElementById('filterMatchPct').addEventListener('change', () => applyAutoFilter());
    document.getElementById('filterSort').addEventListener('change', () => applyAutoFilter());
    // Nút Đặt lại — xóa toàn bộ filter, reset phân trang, tắt All mode
    document.getElementById('resetFiltersBtn').addEventListener('click', () => resetTonKhoFilters());
    // Thêm thanh công cụ batch actions (chỉ tạo 1 lần)
    if (!document.getElementById('tonkho-batch-actions')) {
      const batchDiv = document.createElement('div');
      batchDiv.id = 'tonkho-batch-actions';
      batchDiv.style = 'margin: 5px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 6px 10px; background: #f0f4ff; border-radius: 6px; border: 1px solid #cce;';
      batchDiv.innerHTML = `
        <label style="font-size:0.9em;font-weight:bold;margin-right:4px;">
          <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll(this)"> Chọn tất cả
        </label>
        <span id="selectedCount" style="font-size:0.85em;color:#555;">(0 đã chọn)</span>
        <button id="batchDeleteBtn" onclick="batchDeleteItems()" style="background:#f44336;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🗑 Xóa</button>
        <button id="batchMoveBtn" onclick="batchMoveItems()" style="background:#ff9800;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🔁 Chuyển</button>
        <button id="batchMergeBtn" onclick="batchMergeItems()" style="background:#4caf50;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🔗 Gộp</button>
      `;
      const container = document.getElementById(divMap[type]);
      if (container) container.insertAdjacentElement('beforebegin', batchDiv);
    }
  }

  // Cập nhật số lượng đã chọn
  updateSelectedCount();

  // Lưu giá trị filter hiện tại trước khi cập nhật options
  const prevSearch = document.getElementById('filterSearch')?.value || '';
  const prevTen = document.getElementById('filterTen')?.value || '';
  const prevThueSuat = document.getElementById('filterThueSuat')?.value || '';
  const prevDVT = document.getElementById('filterDVT')?.value || '';
  const prevMatchPct = document.getElementById('filterMatchPct')?.value || '';

  // Cập nhật datalist số HĐ và dropdown Tên/Thuế suất/ĐVT
  const allNumbers = [
    ...new Set((hkdData[taxCode].invoices || []).map(inv => inv.invoiceInfo?.number).filter(Boolean))
  ];
  const numberList = document.getElementById('numberList');
  if (numberList) numberList.innerHTML = allNumbers.map(n => `<option value="${n}">`).join('');

  // Cập nhật dropdown Tên (giữ lại giá trị đã chọn)
  const filterTen = document.getElementById('filterTen');
  if (filterTen) {
    const tenValues = [...new Set(arr.map(item => (item.name || '').trim()).filter(Boolean))].sort();
    filterTen.innerHTML = '<option value="">Tất cả</option>' + tenValues.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    filterTen.value = prevTen;
  }

  // Cập nhật dropdown Thuế suất (giữ lại giá trị đã chọn)
  const filterThueSuat = document.getElementById('filterThueSuat');
  if (filterThueSuat) {
    const thueValues = [...new Set(arr.map(item => item.taxRate).filter(v => v !== undefined && v !== ''))].sort((a,b) => a-b);
    filterThueSuat.innerHTML = '<option value="">Tất cả</option>' + thueValues.map(v => `<option value="${v}">${v}%</option>`).join('');
    filterThueSuat.value = prevThueSuat;
  }

  // Cập nhật dropdown ĐVT (giữ lại giá trị đã chọn) — đã chuẩn hóa để gộp trùng
  const filterDVT = document.getElementById('filterDVT');
  if (filterDVT) {
    // Gom nhóm các ĐVT theo key chuẩn hóa, chọn hiển thị dạng đẹp nhất
    const unitMap = {};
    arr.forEach(item => {
      const raw = (item.unit || '').trim();
      if (!raw) return;
      const key = normalizeUnit(raw);
      // Ưu tiên dạng viết hoa chữ cái đầu (đẹp hơn)
      if (!unitMap[key] || isBetterUnit(raw, unitMap[key])) {
        unitMap[key] = raw;
      }
    });
    const dvtValues = Object.keys(unitMap).sort().map(k => unitMap[k]);
    filterDVT.innerHTML = '<option value="">Tất cả</option>' + dvtValues.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    filterDVT.value = prevDVT;
  }

  // Khôi phục giá trị filterSearch và filterMatchPct
  const filterSearchEl = document.getElementById('filterSearch');
  if (filterSearchEl) filterSearchEl.value = prevSearch;
  const filterMatchPctEl = document.getElementById('filterMatchPct');
  if (filterMatchPctEl) filterMatchPctEl.value = prevMatchPct;

  if (zeroStockCount > 0) {
    document.getElementById('deleteZeroStockBtn')?.addEventListener('click', () => {
      deleteZeroStock(taxCode, type);
    });
  }

  // Kiểm tra nếu có filter đang active → dùng applyAutoFilter thay vì render full
  const hasActiveFilter =
    (document.getElementById('filterFrom')?.value || '') ||
    (document.getElementById('filterTo')?.value || '') ||
    (document.getElementById('filterNumber')?.value?.trim() || '') ||
    (document.getElementById('filterSearch')?.value?.trim() || '') ||
    (document.getElementById('filterTen')?.value || '') ||
    (document.getElementById('filterThueSuat')?.value || '') ||
    (document.getElementById('filterDVT')?.value || '') ||
    (document.getElementById('filterMatchPct')?.value || '') ||
    (document.getElementById('filterSort')?.value || '');

  if (hasActiveFilter) {
    // Nếu có filter, dùng applyAutoFilter để render bảng đã lọc
    // Nhưng vẫn cần cập nhật tổng số trong span
    const total = arr.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const totalSpan = document.getElementById(spanMap[type]);
    if (totalSpan) totalSpan.innerText = total.toLocaleString() + ' đ';
    if (type === 'main' || type === 'ck') updateMainTotalDisplay(taxCode);
    applyAutoFilter();
    return;
  }

  const total = arr.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  let html = `
  <table border="1" cellpadding="6" cellspacing="0" style="margin-top:10px; width:100%; background:#fff;">
    <thead>
      <tr>
        <th style="width:40px;"><input type="checkbox" id="selectAllCheckboxHeader" onchange="toggleSelectAll(this)"></th>
        <th>STT</th><th>Số HĐ</th><th>Mã SP</th><th>Tên</th><th>ĐVT</th><th>SL</th>
        <th>Đơn giá</th><th>CK</th><th>Thành tiền</th><th>Thuế</th><th>TTST</th>
        <th>Thao tác</th>
      </tr>
    </thead>
    <tbody>`;

  // Phân trang: chỉ render các item trong trang hiện tại (hoặc tất cả nếu bật All)
  const showAll = isTonKhoShowAll(taxCode, type);
  const currentPage = getTonKhoPage(taxCode, type);
  const startIdx = showAll ? 0 : currentPage * TONKHO_PAGE_SIZE;
  const pageItems = showAll ? arr : arr.slice(startIdx, startIdx + TONKHO_PAGE_SIZE);

  pageItems.forEach((item, idx) => {
    const i = startIdx + idx; // index thật trong mảng gốc
    const isEditing = (tonkhoEditing.index === i && tonkhoEditing.type === type && tonkhoEditing.taxCode === taxCode);
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const discount = parseFloat(item.discount || item.lineDiscount || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = quantity * price - discount;
    const afterTax = amount + (amount * taxRate / 100);

    const rowStyle = quantity <= 0 ? 'background:#ffebee;' : '';

    // Lấy số HĐ (có fallback cho dữ liệu cũ)
    let invNumber = (item.number || '').trim();
    if (!invNumber && item.mccqt) {
      const inv = (hkdData[taxCode].invoices || []).find(i => i.invoiceInfo?.mccqt === item.mccqt);
      invNumber = (inv?.invoiceInfo?.number || '').trim();
    }
    const invNumberDisplay = invNumber || item.mccqt || '';

    html += `<tr style="${rowStyle}"><td style="text-align:center;"><input type="checkbox" class="tonkho-checkbox" data-index="${i}" onchange="updateSelectedCount()"></td><td>${i + 1}</td>`;
    // Cột số HĐ clickable
    if (invNumberDisplay) {
      html += `<td style="text-align:center;"><a href="#" onclick="event.preventDefault(); renderInvoiceDetail('${taxCode}', '${item.mccqt}'); return false;" style="color:#1976d2;text-decoration:underline;cursor:pointer;font-size:0.85em;">${invNumberDisplay}</a></td>`;
    } else {
      html += `<td style="text-align:center;color:#999;">-</td>`;
    }

    if (isEditing) {
      html += `
        <td><input value="${item.productCode || ''}" id="edit-code-${i}" style="width:100%"></td>
        <td><input value="${item.name}" id="edit-name-${i}" style="width:100%"></td>
        <td><input value="${item.unit}" id="edit-unit-${i}" style="width:100%"></td>
        <td><input type="number" value="${item.quantity}" id="edit-qty-${i}" style="width:60px"></td>
        <td><input type="number" value="${item.price}" id="edit-price-${i}" style="width:80px"></td>
        <td>${amount.toLocaleString()}</td>
        <td><input value="${item.taxRate}" id="edit-tax-${i}" style="width:60px"></td>
        <td>${Math.round(afterTax).toLocaleString()}</td>
        <td>
          <button onclick="confirmEditProduct('${taxCode}', '${type}', ${i})">Lưu</button>
          <button onclick="cancelEditProduct()">Hủy</button>
        </td>`;
    } else {
      const qtyColor = quantity <= 0 ? 'color:#f44336; font-weight:bold;' : '';
      // Màu nền cho mã SP dựa trên _misaMatchPercent
      const matchPct = item._misaMatchPercent;
      let codeBg = '';
      let codeTitle = '';
      if (matchPct !== undefined && matchPct !== null) {
        codeBg = 'background:' + getMatchColor(matchPct) + ';';
        codeTitle = ` title="Tỷ lệ match MISA: ${matchPct}%"`;
      }
      html += `
        <td style="${codeBg}text-align:center;${codeTitle}">
          <a href="#" onclick="event.preventDefault(); quickEditProductCode('${taxCode}', '${type}', ${i}); return false;"
             style="color:${matchPct !== undefined && matchPct !== null ? '#fff' : '#1976d2'};text-decoration:underline;cursor:pointer;font-size:0.85em;font-family:monospace;font-weight:bold;">
            ${item.productCode || 'N/A'}
          </a>
        </td>
        <td>${item.name}</td>
        <td>${item.unit}</td>
        <td style="${qtyColor}">${item.quantity}</td>
        <td>${item.price}</td>
        <td>${discount.toLocaleString()}</td>
        <td>${amount.toLocaleString()}</td>
        <td>${item.taxRate}</td>
        <td>${Math.round(afterTax).toLocaleString()}</td>
        <td>
          <button onclick="createTonKhoItem('${taxCode}', '${type}')">Thêm</button>
          <button onclick="startEditProduct('${taxCode}', '${type}', ${i})">Sửa</button>
          ${quantity <= 0 ? `
            <button onclick="deleteStockItem('${taxCode}', '${type}', ${i})"
                    style="background: #f44336; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
              Xóa
            </button>
          ` : `
            <button onclick="deleteTonKhoItem('${taxCode}', '${type}', ${i})">Xóa</button>
          `}
          <button onclick="moveTonKhoItemPrompt('${taxCode}', '${type}', ${i})">Chuyển</button>
        </td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // Phân trang
  html += renderPagination(arr.length, currentPage, taxCode, type, divMap[type]);

  if (type === 'ck') {
    html += `<div style="margin-top:10px; font-weight:bold; color:#b00;">
      Tổng chiết khấu: ${total.toLocaleString()} đ
    </div>`;
  }

  const container = document.getElementById(divMap[type]);
  if (container) container.innerHTML = html;

  const totalSpan = document.getElementById(spanMap[type]);
  if (totalSpan) totalSpan.innerText = total.toLocaleString() + ' đ';

  if (type === 'main' || type === 'ck') updateMainTotalDisplay(taxCode);

  // GÁN ONCLICK CHỈ SAU KHI DOM ĐÃ CẬP NHẬT
  setTimeout(() => {
    const editButtons = container?.querySelectorAll('.btn-edit-stock');
    editButtons?.forEach((btn, idx) => {
      if (btn) btn.onclick = () => openEditStockPopup(taxCode, type, idx);
    });
  }, 50);
}

// Xóa tất cả tồn kho = 0 trong loại cụ thể
function deleteZeroStock(taxCode, type) {
  const hkd = hkdData[taxCode];
  if (!hkd) return;

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const stockKey = map[type];
  const items = hkd[stockKey] || [];
  
  // Lọc ra chỉ những items có số lượng > 0
  const remainingItems = items.filter(item => parseFloat(item.quantity) > 0);
  
  const deletedCount = items.length - remainingItems.length;
  
  if (deletedCount > 0) {
    hkd[stockKey] = remainingItems;
    
    window.saveDataToLocalStorage();
    window.renderTonKhoTab(taxCode, type);
    
    window.showToast(`✅ Đã xóa ${deletedCount} tồn kho = 0`, 2000, 'success');
  } else {
    window.showToast('Không có tồn kho = 0 để xóa', 2000, 'info');
  }
}

// Xóa từng dòng tồn kho = 0
function deleteStockItem(taxCode, type, index) {
  const hkd = hkdData[taxCode];
  if (!hkd) return;

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const stockKey = map[type];
  const items = hkd[stockKey] || [];
  
  if (index >= 0 && index < items.length) {
    const itemName = items[index].name;
    const quantity = parseFloat(items[index].quantity) || 0;
    
    if (quantity > 0) {
      window.showToast('Chỉ có thể xóa tồn kho có số lượng = 0', 2000, 'warning');
      return;
    }
    
    // Xác nhận trước khi xóa
    if (confirm(`Bạn có chắc muốn xóa "${itemName}" (SL = 0)?`)) {
      items.splice(index, 1);
      
      window.saveDataToLocalStorage();
      window.renderTonKhoTab(taxCode, type);
      
      window.showToast(`✅ Đã xóa "${itemName}"`, 2000, 'success');
    }
  }
}
function renderFilteredTonKhoTable(taxCode, type, filtered) {
  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const divMap = { main: 'tonKho-main', km: 'tonKho-km', ck: 'tonKho-ck' };
  const spanMap = { main: 'total-tonkho-main', km: 'total-tonkho-km', ck: 'total-tonkho-ck' };
  // Mảng gốc để tra cứu index thật (vì filtered là subset, index trong filtered khác với index trong mảng gốc)
  const fullArr = hkdData[taxCode]?.[map[type]] || [];

  let html = `
  <table border="1" cellpadding="6" cellspacing="0" style="margin-top:5px; width:100%; background:#fff;">
    <thead>
      <tr>
        <th style="width:40px;"><input type="checkbox" id="selectAllCheckboxHeader" onchange="toggleSelectAll(this)"></th>
        <th>STT</th><th>Số HĐ</th><th>Mã SP</th><th>Tên</th><th>ĐVT</th><th>SL</th>
        <th>Đơn giá</th><th>CK</th><th>Thành tiền</th>
        <th>Thuế</th><th>TTST</th><th>Thao tác</th>
      </tr>
    </thead>
    <tbody>`;

  // Phân trang cho filtered (hoặc tất cả nếu bật All)
  const showAll = isTonKhoShowAll(taxCode, type);
  const currentPage = getTonKhoPage(taxCode, type);
  const startIdx = showAll ? 0 : currentPage * TONKHO_PAGE_SIZE;
  const pageItems = showAll ? filtered : filtered.slice(startIdx, startIdx + TONKHO_PAGE_SIZE);

  pageItems.forEach((item, idx) => {
    const i = startIdx + idx; // index trong filtered (để tính STT)
    // Tìm index thật trong mảng gốc (vì filtered là subset, i là index trong filtered không phải trong fullArr)
    const realIndex = fullArr.indexOf(item);
    const isEditing = (tonkhoEditing.index === realIndex && tonkhoEditing.type === type && tonkhoEditing.taxCode === taxCode);
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const discount = parseFloat(item.discount || item.lineDiscount || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = quantity * price - discount;
    const afterTax = amount + (amount * taxRate / 100);

    // Lấy số HĐ (có fallback cho dữ liệu cũ)
    let invNumber = (item.number || '').trim();
    if (!invNumber && item.mccqt) {
      const inv = (hkdData[taxCode].invoices || []).find(i => i.invoiceInfo?.mccqt === item.mccqt);
      invNumber = (inv?.invoiceInfo?.number || '').trim();
    }
    const invNumberDisplay = invNumber || item.mccqt || '';

    html += `<tr><td style="text-align:center;"><input type="checkbox" class="tonkho-checkbox" data-index="${realIndex}" onchange="updateSelectedCount()"></td><td>${i + 1}</td>`;
    // Cột số HĐ clickable
    if (invNumberDisplay) {
      html += `<td style="text-align:center;"><a href="#" onclick="event.preventDefault(); renderInvoiceDetail('${taxCode}', '${item.mccqt}'); return false;" style="color:#1976d2;text-decoration:underline;cursor:pointer;font-size:0.85em;">${invNumberDisplay}</a></td>`;
    } else {
      html += `<td style="text-align:center;color:#999;">-</td>`;
    }

    if (isEditing) {
      html += `
        <td><input value="${item.productCode || ''}" id="edit-code-${realIndex}" style="width:100%"></td>
        <td><input value="${item.name}" id="edit-name-${realIndex}" style="width:100%"></td>
        <td><input value="${item.unit}" id="edit-unit-${realIndex}" style="width:100%"></td>
        <td><input type="number" value="${item.quantity}" id="edit-qty-${realIndex}" style="width:60px"></td>
        <td><input type="number" value="${item.price}" id="edit-price-${realIndex}" style="width:80px"></td>
        <td>${amount.toLocaleString()}</td>
        <td><input value="${item.taxRate}" id="edit-tax-${realIndex}" style="width:60px"></td>
        <td>${Math.round(afterTax).toLocaleString()}</td>
        <td>
          <button onclick="confirmEditProduct('${taxCode}', '${type}', ${realIndex})">💾</button>
          <button onclick="cancelEditProduct()">⛔</button>
        </td>`;
    } else {
      // Màu nền cho mã SP dựa trên _misaMatchPercent
      const matchPct = item._misaMatchPercent;
      let codeBg = '';
      let codeTitle = '';
      if (matchPct !== undefined && matchPct !== null) {
        codeBg = 'background:' + getMatchColor(matchPct) + ';';
        codeTitle = ` title="Tỷ lệ match MISA: ${matchPct}%"`;
      }
      html += `
        <td style="${codeBg}text-align:center;${codeTitle}">
          <a href="#" onclick="event.preventDefault(); quickEditProductCode('${taxCode}', '${type}', ${realIndex}); return false;"
             style="color:${matchPct !== undefined && matchPct !== null ? '#fff' : '#1976d2'};text-decoration:underline;cursor:pointer;font-size:0.85em;font-family:monospace;font-weight:bold;">
            ${item.productCode || 'N/A'}
          </a>
        </td>
        <td>${item.name}</td>
        <td>${item.unit}</td>
        <td>${item.quantity}</td>
        <td>${price.toLocaleString()}</td>
        <td>${discount.toLocaleString()}</td>
        <td>${amount.toLocaleString()}</td>
        <td>${item.taxRate}</td>
        <td>${Math.round(afterTax).toLocaleString()}</td>
        <td>
          <button onclick="createTonKhoItem('${taxCode}', '${type}')">➕</button>
          <button onclick="startEditProduct('${taxCode}', '${type}', ${realIndex})">✏️</button>
          <button onclick="deleteTonKhoItem('${taxCode}', '${type}', ${realIndex})">❌</button>
          <button onclick="moveTonKhoItemPrompt('${taxCode}', '${type}', ${realIndex})">🔁</button>
        </td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // Phân trang cho filtered
  html += renderPagination(filtered.length, currentPage, taxCode, type, divMap[type]);

  // Hiển thị trong khung
  const container = document.getElementById(divMap[type]);
  if (container) container.innerHTML = html;

  const totalSpan = document.getElementById(spanMap[type]);
  if (totalSpan) totalSpan.innerText = tongHang.toLocaleString() + ' đ';
}



// Hàm mới để xử lý prompt di chuyển
function moveTonKhoItemPrompt(taxCode, fromType, index) {
  const toType = prompt('Chuyển sang kho nào? (main/km/ck)', 'km')?.toLowerCase();
  if (['main', 'km', 'ck'].includes(toType)) {
    moveTonKhoItem(taxCode, fromType, index, toType);
  } else {
    alert('Loại kho không hợp lệ!');
  }
}

// Cập nhật tổng tiền thực tế (phiên bản chính xác)
function updateMainTotalDisplay(taxCode) {
  if (!hkdData[taxCode]) return;
  
  // Hàm này chỉ cập nhật span total-tonkho-main (cho tab title)
  // Các cột summary-grid được cập nhật bởi hàm cùng tên trong main.js
  const main = hkdData[taxCode].tonkhoMain || [];
  const ck = hkdData[taxCode].tonkhoCK || [];
  const tongHang = main.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongCK = ck.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  
  const totalSpan = document.getElementById("total-tonkho-main");
  if (totalSpan) {
    totalSpan.innerText = (tongHang + tongCK).toLocaleString() + ' đ';
  }
}

// Bắt đầu chỉnh sửa sản phẩm
function startEditProduct(taxCode, type, index) {
  tonkhoEditing = { taxCode, type, index };
  renderTonKhoTab(taxCode, type);
}

// Hủy chỉnh sửa
function cancelEditProduct() {
  tonkhoEditing = { taxCode: '', type: '', index: -1 };
  renderTonKhoTab(currentTaxCode, tonkhoEditing.type || 'main');
}

// Xác nhận chỉnh sửa
function confirmEditProduct(taxCode, type, index) {
  const key = type === 'main' ? 'tonkhoMain' : (type === 'km' ? 'tonkhoKM' : 'tonkhoCK');
  const item = hkdData[taxCode][key][index];

  // Thêm dòng này để cập nhật mã sản phẩm khi chỉnh sửa
  item.productCode = document.getElementById(`edit-code-${index}`).value.trim();
  item.name = document.getElementById(`edit-name-${index}`).value.trim();
  item.unit = document.getElementById(`edit-unit-${index}`).value.trim();
  const qty = parseFloat(document.getElementById(`edit-qty-${index}`).value || '0');
  const price = parseFloat(document.getElementById(`edit-price-${index}`).value || '0');
  item.quantity = qty.toString();
  item.price = price.toString();
  item.amount = parseFloat((qty * price).toFixed(2));
  item.taxRate = document.getElementById(`edit-tax-${index}`).value.trim();

  tonkhoEditing = { taxCode: '', type: '', index: -1 };
  updateMainTotalDisplay(taxCode);
  renderTonKhoTab(taxCode, type);
  saveDataToLocalStorage();
  renderHKDTab(taxCode);
}
// Tạo mới item tồn kho

// Xóa item tồn kho
function deleteTonKhoItem(taxCode, type, index) {
  const key = type === 'main' ? 'tonkhoMain' : (type === 'km' ? 'tonkhoKM' : 'tonkhoCK');
  if (!confirm("Bạn có chắc chắn muốn xóa dòng này?")) return;
  hkdData[taxCode][key].splice(index, 1);
updateMainTotalDisplay(taxCode);
  renderTonKhoTab(taxCode, type);
    renderHKDTab(taxCode); // ✅ gọi lại toàn bộ tab

  saveDataToLocalStorage(); // ✅
  updateMainTotalDisplay(taxCode); // ✅ Thêm dòng này

}

// Di chuyển item giữa các kho
function moveTonKhoItem(taxCode, fromType, index, toType) {
  if (fromType === toType) return alert("Kho đích trùng kho hiện tại.");
  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const fromKey = map[fromType], toKey = map[toType];

  const item = hkdData[taxCode][fromKey].splice(index, 1)[0];
  item.category = toType === 'main' ? 'hang_hoa' : (toType === 'km' ? 'KM' : 'chiet_khau');
  hkdData[taxCode][toKey].push(item);
  renderTonKhoTab(taxCode, 'km');
  renderTonKhoTab(taxCode, 'main');
  renderTonKhoTab(taxCode, 'ck');
  saveDataToLocalStorage(); // ✅
  updateMainTotalDisplay(taxCode); // ✅ Thêm dòng này
  renderHKDTab(taxCode); // ✅ gọi lại toàn bộ tab


}
function exportAllInventoryToExcel(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) return;

  const all = [
    ...hkd.tonkhoMain.map(i => ({ ...i, loai: 'Hàng hóa' })),
    ...hkd.tonkhoKM.map(i => ({ ...i, loai: 'Khuyến mại' })),
    ...hkd.tonkhoCK.map(i => ({ ...i, loai: 'Chiết khấu' })),
  ];

  const rows = [
    ['Loại', 'Mã SP', 'Tên hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Thuế suất']
  ];

  all.forEach(item => {
    rows.push([
      item.loai,
      item.productCode || '',
      item.name,
      item.unit,
      item.quantity,
      item.price,
      item.amount,
      item.taxRate
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `toan_bo_ton_kho_${taxCode}.csv`;
  a.click();
}

// ✅ Hàm loại bỏ dấu tiếng Việt
// ============================
function removeVietnameseAccents(str) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// ============================
// ✅ TẠO MÃ SẢN PHẨM THEO ĐỊNH DẠNG HHxxx
// ============================
// Sử dụng cơ chế đếm tăng dần giống exportExcel.js để đồng bộ
let _localProductCounter = 0;
let _localProductMap = {};

function resetLocalProductMap() {
  _localProductCounter = 0;
  _localProductMap = {};
}

function generateProductCodeByName(taxCode, type, productName) {
  // Khởi tạo counter dựa trên mã HH cao nhất hiện có nếu chưa khởi tạo
  if (_localProductCounter === 0) {
    const stocks = ['tonkhoMain', 'tonkhoKM', 'tonkhoCK'];
    let maxNum = 0;
    stocks.forEach(stock => {
      (hkdData[taxCode]?.[stock] || []).forEach(item => {
        if (item.productCode) {
          const match = item.productCode.match(/^HH(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });
    });
    _localProductCounter = maxNum;
  }

  // Tạo key từ tên sản phẩm
  const key = (productName || '').trim().toLowerCase();
  if (!_localProductMap[key]) {
    _localProductCounter++;
    _localProductMap[key] = 'HH' + String(_localProductCounter).padStart(3, '0');
  }
  return _localProductMap[key];
}

// Hàm kiểm tra mã tồn tại
function isProductCodeExist(taxCode, code) {
  const stocks = ['tonkhoMain', 'tonkhoKM', 'tonkhoCK'];
  return stocks.some(stock =>
    hkdData[taxCode][stock]?.some(item => item.productCode === code)
  );
}
// ============================
// ✅ Hàm tạo mới item tồn kho
// ============================
function createTonKhoItem(taxCode, type) {
  const name = prompt("Tên sản phẩm:");
  if (!name) return;

  const productCode = prompt("Mã sản phẩm (để trống để tự động tạo HHxxx):") || '';
  const unit = prompt("Đơn vị tính:", "cái") || "";
  const quantity = parseFloat(prompt("Số lượng:", "1") || "0");
  const price = parseFloat(prompt("Đơn giá:", "0") || "0");
  const taxRate = parseFloat(prompt("Thuế suất (%):", "0")) || 0;

  const key = type === 'main' ? 'tonkhoMain' : (type === 'km' ? 'tonkhoKM' : 'tonkhoCK');
  const list = hkdData[taxCode][key];

  const existing = list.find(item =>
    item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    parseFloat(item.price) === price
  );

  if (existing) {
    existing.quantity = (parseFloat(existing.quantity) + quantity).toString();
    existing.amount = parseFloat((parseFloat(existing.quantity) * price).toFixed(2));
    existing.taxRate = taxRate;
    existing.afterTax = parseFloat((existing.amount * (1 + taxRate / 100)).toFixed(2));
    showToast("Đã cộng dồn vào sản phẩm đã có", 2000, 'success');
  } else {
    const amount = parseFloat((quantity * price).toFixed(2));
    const afterTax = parseFloat((amount * (1 + taxRate / 100)).toFixed(2));
    // Tự động tạo mã HHxxx nếu người dùng không nhập
    const finalCode = productCode || generateProductCodeByName(taxCode, type, name);
    const item = {
      productCode: finalCode,
      name,
      unit,
      quantity: quantity.toString(),
      price: price.toString(),
      amount,
      taxRate: taxRate.toString(),
      afterTax,
      category: type === 'main' ? 'hang_hoa' : (type === 'km' ? 'KM' : 'chiet_khau')
    };
    list.push(item);
  }

  updateMainTotalDisplay(taxCode);
  renderTonKhoTab(taxCode, type);
  saveDataToLocalStorage();
  renderHKDTab(taxCode);
}
// Thêm hàm này để bổ sung mã sản phẩm cho các sản phẩm hiện có
// Dùng cache _codesInitialized để chỉ chạy 1 lần cho mỗi HKD (tránh lag khi render lại)
function addMissingProductCodes(taxCode) {
  if (!hkdData[taxCode]) return;
  
  // Nếu đã khởi tạo mã cho HKD này rồi thì bỏ qua (chỉ chạy 1 lần)
  if (hkdData[taxCode]._codesInitialized) return;

  // Reset counter để quét mã HH hiện có
  resetLocalProductMap();
  _localProductCounter = 0;

  const types = ['tonkhoMain', 'tonkhoKM', 'tonkhoCK'];
  
  types.forEach(type => {
    hkdData[taxCode][type].forEach((item, index) => {
      if (!item.productCode) {
        // Tạo mã HHxxx mới nếu chưa có
        item.productCode = generateProductCodeByName(taxCode, type.replace('tonkho',''), item.name);
      }
    });
  });
  
  // Tự động gộp các item trùng tên + ĐVT + mã SP
  deduplicateTonKho(taxCode);
  
  // Đánh dấu đã khởi tạo để lần sau không chạy lại
  hkdData[taxCode]._codesInitialized = true;
  
  saveDataToLocalStorage();
}

// ============================
// LỌC TỰ ĐỘNG REAL-TIME
// ============================
/**
 * Áp dụng tất cả bộ lọc hiện tại (ngày, số HĐ, tên, thuế suất, ĐVT, sắp xếp)
 * Gọi real-time khi người dùng thay đổi bất kỳ filter nào
 */
function applyAutoFilter() {
  // Tự động xác định taxCode và type từ tab đang hiển thị
  const taxCode = currentTaxCode;
  if (!taxCode || !hkdData[taxCode]) return;

  // Xác định type từ tab đang visible
  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const div = document.getElementById(`tonKho-${t}`);
    if (div && div.style.display !== 'none') type = t;
  });

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const arr = (hkdData[taxCode][map[type]] || []).filter(item => {
    if (type === 'main') return item.category === 'hang_hoa';
    if (type === 'km') return item.category === 'KM';
    if (type === 'ck') return item.category === 'chiet_khau';
    return true;
  });

  const from = document.getElementById('filterFrom')?.value || '';
  const to = document.getElementById('filterTo')?.value || '';
  const filterNumber = document.getElementById('filterNumber')?.value.trim() || '';
  const filterSearch = document.getElementById('filterSearch')?.value.trim() || '';
  const filterTen = document.getElementById('filterTen')?.value || '';
  const filterThueSuat = document.getElementById('filterThueSuat')?.value || '';
  const filterDVT = document.getElementById('filterDVT')?.value || '';
  const filterMatchPct = document.getElementById('filterMatchPct')?.value || '';
  const filterSort = document.getElementById('filterSort')?.value || '';

  // Hàm chuẩn hóa để so sánh: bỏ dấu, viết thường, trim, xóa khoảng trắng thừa
  function normalizeForCompare(str) {
    return removeVietnameseTones(str.trim().toLowerCase()).replace(/\s+/g, ' ');
  }

  let filtered = arr.filter(item => {
    // Lọc ngày
    const date = item.invoiceDate || '';
    const dateMatch = (!from || date >= from) && (!to || date <= to);

    // Lọc số HĐ
    let invNumber = (item.number || '').trim();
    if (!invNumber && item.mccqt) {
      const inv = (hkdData[taxCode].invoices || []).find(i => i.invoiceInfo?.mccqt === item.mccqt);
      invNumber = (inv?.invoiceInfo?.number || '').trim();
    }
    const numberMatch = !filterNumber || invNumber.includes(filterNumber);

    // Lọc tìm kiếm theo tên hoặc mã hàng (đã chuẩn hóa bỏ dấu)
    const searchNorm = normalizeForCompare(filterSearch);
    const searchMatch = !filterSearch ||
      normalizeForCompare(item.name || '').includes(searchNorm) ||
      normalizeForCompare(item.productCode || '').includes(searchNorm);

    // Lọc tên (đã chuẩn hóa bỏ dấu)
    const tenMatch = !filterTen || normalizeForCompare(item.name || '') === normalizeForCompare(filterTen);

    // Lọc thuế suất
    const thueMatch = !filterThueSuat || String(item.taxRate) === filterThueSuat;

    // Lọc ĐVT (đã chuẩn hóa bỏ dấu)
    const dvtMatch = !filterDVT || normalizeForCompare(item.unit || '') === normalizeForCompare(filterDVT);

    // Lọc % khớp mã hàng
    const pct = item._misaMatchPercent;
    let pctMatch = true;
    if (filterMatchPct) {
      if (filterMatchPct === 'none') {
        pctMatch = (pct === undefined || pct === null);
      } else if (filterMatchPct === '100') {
        pctMatch = (pct !== undefined && pct !== null && pct === 100);
      } else if (filterMatchPct === '75-99') {
        pctMatch = (pct !== undefined && pct !== null && pct >= 75 && pct <= 99);
      } else if (filterMatchPct === '50-74') {
        pctMatch = (pct !== undefined && pct !== null && pct >= 50 && pct <= 74);
      } else if (filterMatchPct === '25-49') {
        pctMatch = (pct !== undefined && pct !== null && pct >= 25 && pct <= 49);
      } else if (filterMatchPct === '1-24') {
        pctMatch = (pct !== undefined && pct !== null && pct >= 1 && pct <= 24);
      }
    }

    return dateMatch && numberMatch && searchMatch && tenMatch && thueMatch && dvtMatch && pctMatch;
  });

  // Sắp xếp (đã chuẩn hóa bỏ dấu)
  if (filterSort === 'ten-asc') {
    filtered.sort((a, b) => normalizeForCompare(a.name || '').localeCompare(normalizeForCompare(b.name || '')));
  } else if (filterSort === 'ten-desc') {
    filtered.sort((a, b) => normalizeForCompare(b.name || '').localeCompare(normalizeForCompare(a.name || '')));
  }

  renderFilteredTonKhoTable(taxCode, type, filtered);
}
window.applyAutoFilter = applyAutoFilter;

// ============================
// BATCH ACTIONS: CHỌN NHIỀU - XÓA - CHUYỂN - GỘP
// ============================

/**
 * Lấy danh sách index các item đang được check
 */
function getSelectedIndexes() {
  const checkboxes = document.querySelectorAll('.tonkho-checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
}

/**
 * Lấy taxCode và type từ tab đang hiển thị
 */
function getCurrentTabInfo() {
  const taxCode = currentTaxCode;
  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const div = document.getElementById(`tonKho-${t}`);
    if (div && div.style.display !== 'none') type = t;
  });
  return { taxCode, type };
}

/**
 * Cập nhật hiển thị số lượng đã chọn
 */
function updateSelectedCount() {
  const count = getSelectedIndexes().length;
  const el = document.getElementById('selectedCount');
  if (el) el.textContent = `(${count} đã chọn)`;
}
window.updateSelectedCount = updateSelectedCount;

/**
 * Chọn / bỏ chọn tất cả checkbox
 */
function toggleSelectAll(checkbox) {
  document.querySelectorAll('.tonkho-checkbox').forEach(cb => {
    cb.checked = checkbox.checked;
  });
  updateSelectedCount();
}
window.toggleSelectAll = toggleSelectAll;

/**
 * Xóa hàng loạt các item đã chọn
 */
function batchDeleteItems() {
  const indexes = getSelectedIndexes();
  if (indexes.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 item', 2000, 'warning');
    return;
  }
  if (!confirm(`Bạn có chắc muốn xóa ${indexes.length} item đã chọn?`)) return;

  const { taxCode, type } = getCurrentTabInfo();
  if (!taxCode || !hkdData[taxCode]) return;

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const key = map[type];
  const items = hkdData[taxCode][key];

  // Xóa từ index lớn đến nhỏ để tránh lệch index
  indexes.sort((a, b) => b - a).forEach(idx => {
    if (idx >= 0 && idx < items.length) items.splice(idx, 1);
  });

  saveDataToLocalStorage();
  renderTonKhoTab(taxCode, type);
  renderHKDTab(taxCode);
  showToast(`✅ Đã xóa ${indexes.length} item`, 2000, 'success');
}
window.batchDeleteItems = batchDeleteItems;

/**
 * Chuyển hàng loạt các item đã chọn sang kho khác
 */
function batchMoveItems() {
  const indexes = getSelectedIndexes();
  if (indexes.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 item', 2000, 'warning');
    return;
  }

  const toType = prompt('Chuyển sang kho nào? (main/km/ck)', 'km')?.toLowerCase();
  if (!['main', 'km', 'ck'].includes(toType)) {
    alert('Loại kho không hợp lệ!');
    return;
  }

  const { taxCode, type } = getCurrentTabInfo();
  if (!taxCode || !hkdData[taxCode]) return;
  if (type === toType) {
    alert('Kho đích trùng kho hiện tại.');
    return;
  }

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const fromKey = map[type];
  const toKey = map[toType];
  const fromItems = hkdData[taxCode][fromKey];

  // Chuyển từ index lớn đến nhỏ
  const moved = [];
  indexes.sort((a, b) => b - a).forEach(idx => {
    if (idx >= 0 && idx < fromItems.length) {
      const item = fromItems.splice(idx, 1)[0];
      item.category = toType === 'main' ? 'hang_hoa' : (toType === 'km' ? 'KM' : 'chiet_khau');
      moved.push(item);
    }
  });

  hkdData[taxCode][toKey].push(...moved);

  saveDataToLocalStorage();
  renderTonKhoTab(taxCode, type);
  renderTonKhoTab(taxCode, toType);
  updateMainTotalDisplay(taxCode);
  renderHKDTab(taxCode);
  showToast(`✅ Đã chuyển ${moved.length} item sang ${toType}`, 2000, 'success');
}
window.batchMoveItems = batchMoveItems;

/**
 * Gộp các item đã chọn thành 1 item duy nhất
 * Hiển thị popup danh sách tên các item được chọn + ô input để tạo tên mới
 */
function batchMergeItems() {
  const indexes = getSelectedIndexes();
  if (indexes.length < 2) {
    showToast('Vui lòng chọn ít nhất 2 item để gộp', 2000, 'warning');
    return;
  }

  const { taxCode, type } = getCurrentTabInfo();
  if (!taxCode || !hkdData[taxCode]) return;

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const key = map[type];
  const items = hkdData[taxCode][key];

  const selectedItems = indexes.map(idx => items[idx]).filter(Boolean);
  if (selectedItems.length < 2) {
    showToast('Không đủ item hợp lệ để gộp', 2000, 'warning');
    return;
  }

  // Tạo popup modal
  const modal = document.createElement('div');
  modal.id = 'mergeModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  `;

  // Tạo danh sách tên các item được chọn
  const nameList = selectedItems.map((item, i) =>
    `<li style="padding:4px 0;border-bottom:1px solid #eee;">${i + 1}. ${item.name} (SL: ${item.quantity}, ĐG: ${item.price})</li>`
  ).join('');

  // Tính tổng số lượng, tiền
  const totalQty = selectedItems.reduce((s, item) => s + (parseFloat(item.quantity) || 0), 0);
  const totalAmount = selectedItems.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  const avgPrice = totalQty > 0 ? (totalAmount / totalQty) : 0;

  modal.innerHTML = `
    <div style="background:#fff; border-radius:10px; padding:24px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
      <h3 style="margin:0 0 12px 0;color:#333;">🔗 Gộp ${selectedItems.length} item</h3>
      <div style="margin-bottom:12px;font-size:0.9em;color:#555;">
        <strong>Danh sách item được chọn:</strong>
        <ul style="margin:8px 0;padding-left:20px;max-height:200px;overflow-y:auto;">${nameList}</ul>
      </div>
      <div style="margin-bottom:12px;padding:8px;background:#f5f5f5;border-radius:4px;font-size:0.9em;">
        <div>Tổng SL: <strong>${totalQty}</strong></div>
        <div>Tổng tiền: <strong>${totalAmount.toLocaleString()} đ</strong></div>
        <div>Đơn giá TB: <strong>${avgPrice.toLocaleString()} đ</strong></div>
      </div>
      <label style="display:block;margin-bottom:6px;font-weight:bold;color:#333;">
        Tên mới sau khi gộp:
      </label>
      <input type="text" id="mergeNewName" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:1em;box-sizing:border-box;"
        placeholder="Nhập tên mới hoặc để trống để lấy tên item đầu tiên..."
        value="${selectedItems[0].name || ''}">
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('mergeModal').remove()" style="padding:8px 20px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;">Hủy</button>
        <button onclick="confirmMerge()" style="padding:8px 20px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer;font-weight:bold;">✅ Gộp</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}
window.batchMergeItems = batchMergeItems;

/**
 * Xác nhận gộp - được gọi từ nút "Gộp" trong modal
 */
function confirmMerge() {
  const indexes = getSelectedIndexes();
  const { taxCode, type } = getCurrentTabInfo();
  if (!taxCode || !hkdData[taxCode]) return;

  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const key = map[type];
  const items = hkdData[taxCode][key];

  const newName = document.getElementById('mergeNewName')?.value?.trim();
  if (!newName) {
    showToast('Vui lòng nhập tên cho item sau khi gộp', 2000, 'warning');
    return;
  }

  const selectedItems = indexes.map(idx => items[idx]).filter(Boolean);
  if (selectedItems.length < 2) return;

  // Tính tổng số lượng, tiền, thuế suất bình quân
  const totalQty = selectedItems.reduce((s, item) => s + (parseFloat(item.quantity) || 0), 0);
  const totalAmount = selectedItems.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  const avgPrice = totalQty > 0 ? (totalAmount / totalQty) : 0;
  const weightedTax = selectedItems.reduce((s, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const tax = parseFloat(item.taxRate) || 0;
    return s + (qty * tax);
  }, 0) / (totalQty || 1);

  // Lấy item đầu tiên làm base, cập nhật lại
  const firstIdx = indexes[0];
  const firstItem = items[firstIdx];
  firstItem.name = newName;
  firstItem.quantity = totalQty.toString();
  firstItem.price = avgPrice.toFixed(2);
  firstItem.amount = parseFloat(totalAmount.toFixed(2));
  firstItem.taxRate = Math.round(weightedTax).toString();

  // Xóa các item còn lại (từ index lớn đến nhỏ, bỏ qua item đầu)
  const restIndexes = indexes.slice(1).sort((a, b) => b - a);
  restIndexes.forEach(idx => {
    if (idx >= 0 && idx < items.length) items.splice(idx, 1);
  });

  // Đóng modal
  document.getElementById('mergeModal')?.remove();

  saveDataToLocalStorage();
  renderTonKhoTab(taxCode, type);
  renderHKDTab(taxCode);
  showToast(`✅ Đã gộp ${selectedItems.length} item thành "${newName}"`, 2000, 'success');
}
window.confirmMerge = confirmMerge;

// ============================================================
// QUICK EDIT MÃ SẢN PHẨM (click trực tiếp trên bảng)
// Hiển thị popup đối chiếu: tên hàng - mã MISA - tên MISA - mã hệ thống
// ============================================================
function quickEditProductCode(taxCode, type, index) {
  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const key = map[type];
  const item = hkdData[taxCode]?.[key]?.[index];
  if (!item) return;

  const currentCode = item.productCode || '';
  const currentName = item.name || '';
  const misaCode = item._misaCode || '';
  const misaName = item._misaName || '';
  const matchPct = item._misaMatchPercent;
  const isCodeMatch = item._misaCodeMatch;

  // Xóa popup cũ nếu có
  document.getElementById('quickEditPopup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'quickEditPopup';
  popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const hasMisa = misaCode || misaName;
  const matchColor = matchPct !== undefined && matchPct !== null ? getMatchColor(matchPct) : '#999';

  // Xác định trạng thái khớp mã
  let codeMatchHtml = '';
  if (hasMisa) {
    if (isCodeMatch) {
      codeMatchHtml = `<span style="display:inline-block;padding:2px 12px;border-radius:10px;background:#f44336;color:#fff;font-weight:bold;font-size:0.85em;">⚠️ Trùng mã - khác tên</span>`;
    } else if (misaCode && misaCode === currentCode) {
      codeMatchHtml = `<span style="display:inline-block;padding:2px 12px;border-radius:10px;background:#4caf50;color:#fff;font-weight:bold;font-size:0.85em;">✅ Mã khớp</span>`;
    } else if (misaCode) {
      codeMatchHtml = `<span style="display:inline-block;padding:2px 12px;border-radius:10px;background:#ff9800;color:#fff;font-weight:bold;font-size:0.85em;">🟠 Mã khác (MISA: ${misaCode})</span>`;
    } else {
      codeMatchHtml = `<span style="display:inline-block;padding:2px 12px;border-radius:10px;background:#9e9e9e;color:#fff;font-weight:bold;font-size:0.85em;">MISA chưa có mã</span>`;
    }
  }

  popup.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:520px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#333;">📝 Đối chiếu mã hàng</h3>
        <button onclick="document.getElementById('quickEditPopup').remove()" style="background:none;border:none;font-size:1.5em;cursor:pointer;color:#999;">&times;</button>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${hasMisa ? `
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#e8f5e9;border:1px solid #ddd;width:130px;">📌 Tên MISA</td>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#e8f5e9;font-weight:bold;font-size:1.05em;">${misaName || '(trống)'}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;width:130px;">📦 Tên hàng (HT)</td>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#e3f2fd;font-weight:bold;font-size:1.05em;">${currentName}</td>
        </tr>
        ${hasMisa ? `
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;">🔖 Mã MISA</td>
          <td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace;font-weight:bold;color:#1565c0;font-size:1.05em;">${misaCode || '(trống)'}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;">🔖 Mã hiện tại (HT)</td>
          <td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace;font-weight:bold;font-size:1.1em;color:#e65100;">${currentCode || 'N/A'}</td>
        </tr>
        ${hasMisa ? `
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;">📊 Tỷ lệ khớp tên</td>
          <td style="padding:8px 12px;border:1px solid #ddd;">
            <span style="display:inline-block;padding:2px 12px;border-radius:10px;background:${matchColor};color:#fff;font-weight:bold;font-size:0.85em;">
              ${matchPct !== undefined && matchPct !== null ? matchPct + '%' : 'Chưa đồng bộ'}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;">⚡ Trạng thái mã</td>
          <td style="padding:8px 12px;border:1px solid #ddd;">${codeMatchHtml}</td>
        </tr>
        ` : `
        <tr>
          <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #ddd;">⚡ Trạng thái</td>
          <td style="padding:8px 12px;border:1px solid #ddd;color:#999;font-style:italic;">Chưa có dữ liệu đồng bộ MISA</td>
        </tr>
        `}
      </table>

      <div style="margin-bottom:12px;">
        <label style="font-weight:bold;display:block;margin-bottom:4px;color:#333;">✏️ Nhập mã hàng mới:</label>
        <input type="text" id="quickEditNewCode" value="${currentCode}"
          style="width:100%;padding:10px 12px;font-size:1em;border:2px solid #1976d2;border-radius:6px;font-family:monospace;font-weight:bold;box-sizing:border-box;">
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('quickEditPopup').remove()"
          style="padding:10px 20px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;font-size:0.9em;">
          Hủy
        </button>
        <button onclick="confirmQuickEditCode('${taxCode}', '${type}', ${index})"
          style="padding:10px 24px;border:none;border-radius:6px;background:#1976d2;color:#fff;cursor:pointer;font-weight:bold;font-size:0.9em;">
          ✅ Cập nhật
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  // Focus vào ô input
  setTimeout(() => document.getElementById('quickEditNewCode')?.focus(), 100);
}
window.quickEditProductCode = quickEditProductCode;

// Xác nhận cập nhật mã từ popup quickEdit
function confirmQuickEditCode(taxCode, type, index) {
  const map = { main: 'tonkhoMain', km: 'tonkhoKM', ck: 'tonkhoCK' };
  const key = map[type];
  const item = hkdData[taxCode]?.[key]?.[index];
  if (!item) return;

  const newCode = document.getElementById('quickEditNewCode')?.value?.trim();
  if (!newCode) {
    showToast('Vui lòng nhập mã hàng', 2000, 'warning');
    return;
  }

  item.productCode = newCode;
  // Xóa _misaMatchPercent nếu người dùng tự sửa mã
  delete item._misaMatchPercent;
  delete item._misaName;
  delete item._misaCode;

  document.getElementById('quickEditPopup')?.remove();

  saveDataToLocalStorage();
  renderTonKhoTab(taxCode, type);
  showToast(`✅ Đã cập nhật mã: ${newCode}`, 2000, 'success');
}
window.confirmQuickEditCode = confirmQuickEditCode;

// ============================================================
// ĐỒNG BỘ MÃ HÀNG MISA VỚI HỆ THỐNG TỒN KHO
// ============================================================

// -------------------------------------------------------
// PROGRESS BAR HELPERS
// -------------------------------------------------------
function showProgress(percent, text) {
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressText');
  if (container) container.style.display = 'block';
  if (bar) bar.style.width = percent + '%';
  if (label) label.textContent = text || percent + '%';
}
function hideProgress() {
  const container = document.getElementById('progressContainer');
  if (container) container.style.display = 'none';
}

// -------------------------------------------------------
// STRING SIMILARITY (Levenshtein-based)
// -------------------------------------------------------
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  
  // BƯỚC 1: So sánh chính xác từng ký tự (kể cả dấu, hoa/thường, ký tự đặc biệt)
  // Ưu tiên khớp 100% cả ký tự
  if (s1 === s2) return 100;
  
  // BƯỚC 2: So sánh không phân biệt hoa/thường và dấu cách
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 100;
  
  // BƯỚC 3: Kiểm tra包含 nhau (một chuỗi nằm trong chuỗi kia)
  if (a.includes(b) || b.includes(a)) {
    // Tính % dựa trên độ dài
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return Math.round((shorter / longer) * 100);
  }

  // BƯỚC 4: Levenshtein distance để tính % tương đồng
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const maxLen = Math.max(m, n);
  return maxLen > 0 ? Math.round((1 - dp[m][n] / maxLen) * 100) : 0;
}

// -------------------------------------------------------
// GET MATCH COLOR
// -------------------------------------------------------
function getMatchColor(percent) {
  if (percent >= 100) return '#4caf50';       // Xanh lá - Khớp 100%
  if (percent >= 75) return '#8bc34a';        // Xanh nhạt - Trên 75%
  if (percent >= 50) return '#ff9800';        // Cam - Trên 50%
  if (percent >= 25) return '#ffc107';        // Vàng - Trên 25%
  return '#f44336';                            // Đỏ - Dưới 25%
}

// -------------------------------------------------------
// HÀM TẠO MÃ HHxxx (dùng chung cho cả generateProductCodeByName)
// -------------------------------------------------------
let _misaProductCounter = 0;
let _misaProductMap = {};

function resetMisaProductMap() {
  _misaProductCounter = 0;
  _misaProductMap = {};
}

function getNextHHCode(name, unit) {
  const key = (name || '').trim().toLowerCase() + '|' + (unit || '').trim().toLowerCase();
  if (!_misaProductMap[key]) {
    _misaProductCounter++;
    _misaProductMap[key] = 'HH' + String(_misaProductCounter).padStart(3, '0');
  }
  return _misaProductMap[key];
}

// -------------------------------------------------------
// IMPORT EXCEL MISA - LUỒNG XỬ LÝ RIÊNG
// -------------------------------------------------------
async function importMisaExcel(file) {
  const taxCode = currentTaxCode;
  if (!taxCode || !hkdData[taxCode]) {
    showToast('Vui lòng chọn một HKD trước khi import', 3000, 'error');
    return;
  }

  showProgress(5, 'Đang đọc file Excel...');

  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    showProgress(20, `Đã đọc ${jsonData.length} dòng từ Excel...`);

    // Chuẩn hóa dữ liệu MISA
    const misaItems = jsonData.map((row, idx) => {
      let stt = row['STT'] || row['Stt'] || row['stt'] || '';
      let maHang = row['Mã hàng'] || row['Mã Hàng'] || row['Ma hang'] || row['ma_hang'] || row['Mã'] || '';
      let tenHang = row['Tên Hàng Hóa'] || row['Tên hàng hóa'] || row['Ten hang hoa'] || row['Tên hàng'] || row['Tên'] || row['ten_hang'] || '';
      return { stt, maHang: String(maHang).trim(), tenHang: String(tenHang).trim() };
    }).filter(item => item.tenHang);

    if (misaItems.length === 0) {
      showToast('Không tìm thấy dữ liệu hàng hóa trong file Excel', 3000, 'warning');
      hideProgress();
      return;
    }

    showProgress(30, `Đang đối chiếu ${misaItems.length} hàng hóa MISA với tồn kho...`);

    // Gom tất cả tồn kho hiện tại
    const allStock = [
      ...hkdData[taxCode].tonkhoMain.map((item, idx) => ({ ...item, _stockType: 'tonkhoMain', _idx: idx })),
      ...hkdData[taxCode].tonkhoKM.map((item, idx) => ({ ...item, _stockType: 'tonkhoKM', _idx: idx })),
      ...hkdData[taxCode].tonkhoCK.map((item, idx) => ({ ...item, _stockType: 'tonkhoCK', _idx: idx }))
    ];

    // Đối chiếu từng item MISA với tồn kho
    const comparisonResults = [];
    const usedStockIndexes = new Set();

    misaItems.forEach((misaItem, mi) => {
      showProgress(30 + Math.round((mi / misaItems.length) * 40), `Đang đối chiếu ${mi + 1}/${misaItems.length}...`);

      let bestMatch = null;
      let bestScore = 0;

      allStock.forEach((stockItem, si) => {
        if (usedStockIndexes.has(si)) return;

        // So sánh tên
        const nameScore = stringSimilarity(misaItem.tenHang, stockItem.name);

        // So sánh mã
        const misaCode = misaItem.maHang.toUpperCase();
        const stockCode = (stockItem.productCode || '').toUpperCase();
        const codeMatch = misaCode && stockCode && misaCode === stockCode;

        if (nameScore > bestScore || (codeMatch && nameScore >= bestScore)) {
          bestScore = nameScore;
          bestMatch = { stockItem, stockIdx: si, nameScore, codeMatch };
        }
      });

      if (bestMatch && bestScore >= 25) {
        usedStockIndexes.add(bestMatch.stockIdx);
        comparisonResults.push({
          misaItem,
          stockItem: bestMatch.stockItem,
          matchPercent: bestMatch.nameScore,
          codeMatch: bestMatch.codeMatch,
          action: bestMatch.nameScore >= 100 ? 'use_misa_code' :
                  bestMatch.codeMatch ? 'warning_code_mismatch' :
                  bestMatch.nameScore >= 90 ? 'use_misa_code' :
                  'keep_system_code'
        });
      } else {
        comparisonResults.push({
          misaItem,
          stockItem: null,
          matchPercent: 0,
          codeMatch: false,
          action: 'add_new'
        });
      }
    });

    showProgress(75, 'Hiển thị kết quả đối chiếu...');

    // Reset map trước khi tạo mã mới
    resetMisaProductMap();

    // Hiển thị modal so sánh
    showMisaComparisonModal(taxCode, comparisonResults, misaItems);

  } catch (err) {
    console.error('Import MISA error:', err);
    showToast('Lỗi khi import file MISA: ' + err.message, 4000, 'error');
    hideProgress();
  }
}
window.importMisaExcel = importMisaExcel;

// -------------------------------------------------------
// ĐỌC FILE AS ARRAY BUFFER
// -------------------------------------------------------
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsArrayBuffer(file);
  });
}

// -------------------------------------------------------
// HIỂN THỊ MODAL ĐỐI CHIẾU MISA
// -------------------------------------------------------
function showMisaComparisonModal(taxCode, results, misaItems) {
  document.getElementById('misaComparisonModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'misaComparisonModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  `;

  // Đếm thống kê
  const match100 = results.filter(r => r.matchPercent >= 100).length;
  const match75 = results.filter(r => r.matchPercent >= 75 && r.matchPercent < 100).length;
  const match50 = results.filter(r => r.matchPercent >= 50 && r.matchPercent < 75).length;
  const match25 = results.filter(r => r.matchPercent >= 25 && r.matchPercent < 50).length;
  const noMatch = results.filter(r => r.matchPercent < 25).length;
  const warnings = results.filter(r => r.action === 'warning_code_mismatch').length;

  let tableRows = '';
  results.forEach((r, i) => {
    const color = getMatchColor(r.matchPercent);
    const misaName = r.misaItem.tenHang;
    const misaCode = r.misaItem.maHang;
    const stockName = r.stockItem ? r.stockItem.name : '(Chưa có trong hệ thống)';
    const stockCode = r.stockItem ? (r.stockItem.productCode || '') : '';

    let actionText = '';
    let finalCode = '';
    if (r.action === 'use_misa_code') {
      finalCode = misaCode || getNextHHCode(misaName, '');
      actionText = misaCode ? `✅ Lấy mã MISA: <strong>${misaCode}</strong>` : `🆕 Tạo mới: <strong>${finalCode}</strong>`;
    } else if (r.action === 'warning_code_mismatch') {
      finalCode = stockCode;
      actionText = `⚠️ <span style="color:#f44336;">Trùng mã - khác tên!</span> Mã: <strong>${stockCode}</strong>`;
    } else if (r.action === 'keep_system_code') {
      finalCode = stockCode || getNextHHCode(misaName, '');
      actionText = `🔒 Giữ mã hệ thống: <strong>${finalCode}</strong>`;
    } else {
      finalCode = getNextHHCode(misaName, '');
      actionText = `🆕 Thêm mới: <strong>${finalCode}</strong>`;
    }

    const rowColor = r.matchPercent >= 100 ? '#e8f5e9' :
                     r.matchPercent >= 75 ? '#f1f8e9' :
                     r.matchPercent >= 50 ? '#fff3e0' :
                     r.matchPercent >= 25 ? '#fff8e1' : '#ffebee';

    tableRows += `
      <tr style="background:${rowColor};">
        <td style="text-align:center;font-size:0.85em;">${i + 1}</td>
        <td style="text-align:center;">
          <span style="display:inline-block;width:40px;height:20px;border-radius:4px;background:${color};color:#fff;font-size:0.75em;font-weight:bold;text-align:center;line-height:20px;">${r.matchPercent}%</span>
        </td>
        <td style="font-size:0.85em;">${misaName}</td>
        <td style="text-align:center;font-size:0.85em;font-family:monospace;">
          <input type="text" id="misaFinalCode-${i}" value="${finalCode}"
            style="width:80px;padding:2px 4px;border:1px solid #ccc;border-radius:3px;font-family:monospace;font-size:0.9em;text-align:center;"
            onchange="markMisaCodeEdited(${i})">
        </td>
        <td style="font-size:0.85em;color:#666;">${stockName}</td>
        <td style="font-size:0.85em;">${actionText}</td>
      </tr>
    `;
  });

  modal.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:20px; max-width:900px; width:95%; max-height:85vh; overflow-y:auto; box-shadow:0 8px 30px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#333;">📊 Đối chiếu mã hàng MISA</h3>
        <button onclick="document.getElementById('misaComparisonModal').remove()" style="background:none;border:none;font-size:1.5em;cursor:pointer;color:#999;">&times;</button>
      </div>

      <!-- Thống kê -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:#f5f5f5;border-radius:8px;font-size:0.85em;">
        <span style="background:#4caf50;color:#fff;padding:3px 10px;border-radius:12px;">✅ Khớp 100%: ${match100}</span>
        <span style="background:#8bc34a;color:#fff;padding:3px 10px;border-radius:12px;">🟢 Trên 75%: ${match75}</span>
        <span style="background:#ff9800;color:#fff;padding:3px 10px;border-radius:12px;">🟠 Trên 50%: ${match50}</span>
        <span style="background:#ffc107;color:#333;padding:3px 10px;border-radius:12px;">🟡 Trên 25%: ${match25}</span>
        <span style="background:#f44336;color:#fff;padding:3px 10px;border-radius:12px;">🔴 Dưới 25%: ${noMatch}</span>
        ${warnings > 0 ? `<span style="background:#9c27b0;color:#fff;padding:3px 10px;border-radius:12px;">⚠️ Cảnh báo: ${warnings}</span>` : ''}
      </div>

      <!-- Bảng đối chiếu -->
      <div style="max-height:50vh;overflow-y:auto;border:1px solid #ddd;border-radius:6px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
          <thead>
            <tr style="background:#37474f;color:#fff;position:sticky;top:0;">
              <th style="padding:8px;text-align:center;width:40px;">#</th>
              <th style="padding:8px;text-align:center;width:60px;">Tỷ lệ</th>
              <th style="padding:8px;text-align:left;">Tên MISA</th>
              <th style="padding:8px;text-align:center;width:110px;">Mã hàng (click để sửa)</th>
              <th style="padding:8px;text-align:left;">Tên hệ thống</th>
              <th style="padding:8px;text-align:left;">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <!-- Nút hành động -->
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button onclick="document.getElementById('misaComparisonModal').remove()"
          style="padding:8px 20px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;font-size:0.9em;">
          ❌ Hủy
        </button>
        <button onclick="applyMisaSync('${taxCode}')"
          style="padding:8px 24px;border:none;border-radius:6px;background:#2196f3;color:#fff;cursor:pointer;font-weight:bold;font-size:0.9em;">
          ✅ Áp dụng đồng bộ
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// -------------------------------------------------------
// ĐÁNH DẤU MÃ ĐÃ ĐƯỢC SỬA TAY
// -------------------------------------------------------
let _misaEditedIndexes = new Set();
function markMisaCodeEdited(index) {
  _misaEditedIndexes.add(index);
}
window.markMisaCodeEdited = markMisaCodeEdited;

// -------------------------------------------------------
// ÁP DỤNG ĐỒNG BỘ MISA
// -------------------------------------------------------
function applyMisaSync(taxCode) {
  if (!taxCode || !hkdData[taxCode]) return;

  const modal = document.getElementById('misaComparisonModal');
  if (!modal) return;

  const inputs = modal.querySelectorAll('input[id^="misaFinalCode-"]');

  showProgress(80, 'Đang áp dụng đồng bộ mã hàng...');

  // Gom tất cả tồn kho
  const allStock = [
    ...hkdData[taxCode].tonkhoMain.map((item, idx) => ({ ...item, _stockType: 'tonkhoMain', _idx: idx })),
    ...hkdData[taxCode].tonkhoKM.map((item, idx) => ({ ...item, _stockType: 'tonkhoKM', _idx: idx })),
    ...hkdData[taxCode].tonkhoCK.map((item, idx) => ({ ...item, _stockType: 'tonkhoCK', _idx: idx }))
  ];

  // Đọc từng dòng trong modal
  const rows = modal.querySelectorAll('tbody tr');
  rows.forEach((row, idx) => {
    const codeInput = row.querySelector(`#misaFinalCode-${idx}`);
    if (!codeInput) return;
    const newCode = codeInput.value.trim();
    if (!newCode) return;

    // Lấy matchPercent từ cột thứ 2 (span chứa %)
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) return;
    const percentSpan = cells[1]?.querySelector('span');
    const matchPercent = percentSpan ? parseInt(percentSpan.textContent) : 0;
    const stockName = cells[4]?.textContent?.trim() || '';

    // Lấy thông tin MISA từ các cột trong modal
    const misaName = cells[2]?.textContent?.trim() || '';
    const misaCodeInput = cells[3]?.querySelector('input');
    const misaCode = misaCodeInput ? misaCodeInput.value.trim() : '';

    // Lấy action text từ cột cuối để biết mã có trùng không
    const actionText = cells[5]?.textContent?.trim() || '';
    const isCodeMatch = actionText.includes('Trùng mã') || actionText.includes('warning');

    // Chuẩn hóa tên để tìm chính xác
    const normStockName = stockName.normalize('NFC').trim().replace(/\s+/g, ' ');

    // Tìm TẤT CẢ item có cùng tên trong allStock (không break sau item đầu)
    for (const s of allStock) {
      const sName = (s.name || '').normalize('NFC').trim().replace(/\s+/g, ' ');
      if (sName === normStockName) {
        const key = s._stockType;
        const idx2 = s._idx;
        // Cập nhật mã
        hkdData[taxCode][key][idx2].productCode = newCode;
        // Lưu matchPercent để hiển thị màu trên bảng tồn kho
        hkdData[taxCode][key][idx2]._misaMatchPercent = matchPercent;
        // Lưu thông tin MISA để hiển thị popup đối chiếu khi click
        hkdData[taxCode][key][idx2]._misaName = misaName;
        hkdData[taxCode][key][idx2]._misaCode = misaCode;
        hkdData[taxCode][key][idx2]._misaCodeMatch = isCodeMatch;
        // Không break - tiếp tục cập nhật các item khác cùng tên
      }
    }
  });

  modal.remove();
  _misaEditedIndexes.clear();

  saveDataToLocalStorage();
  renderTonKhoTab(taxCode, 'main');
  renderTonKhoTab(taxCode, 'km');
  renderTonKhoTab(taxCode, 'ck');
  renderHKDTab(taxCode);

  showProgress(100, '✅ Hoàn tất!');
  setTimeout(hideProgress, 1500);

  showToast('✅ Đã đồng bộ mã hàng MISA thành công!', 3000, 'success');
}
window.applyMisaSync = applyMisaSync;

// ============================
// HÀM DỌN DẸP: GỘP CÁC ITEM TRÙNG TÊN + ĐVT + MÃ SP TRONG CÙNG 1 HKD
// ============================
function deduplicateTonKho(taxCode) {
  if (!hkdData[taxCode]) return;
  
  const types = ['tonkhoMain', 'tonkhoKM', 'tonkhoCK'];
  let totalMerged = 0;
  
  types.forEach(field => {
    const items = hkdData[taxCode][field] || [];
    if (items.length < 2) return;
    
    const merged = [];
    const seen = new Map(); // key: "name|unit|productCode" -> item
    
    items.forEach(item => {
      // Chuẩn hóa tên và ĐVT để làm key
      const nameKey = (item.name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
      const unitKey = (item.unit || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
      const codeKey = (item.productCode || '').trim();
      const key = `${nameKey}|${unitKey}|${codeKey}`;
      
      if (seen.has(key)) {
        // Trùng -> gộp
        const existing = seen.get(key);
        const existingQty = parseFloat(existing.quantity || 0);
        const itemQty = parseFloat(item.quantity || 0);
        const existingPrice = parseFloat(existing.price || 0);
        const itemPrice = parseFloat(item.price || 0);
        
        existing.quantity = (existingQty + itemQty).toString();
        
        // Tính giá bình quân
        if (existingPrice > 0 && itemPrice > 0) {
          const totalValue = (existingQty * existingPrice) + (itemQty * itemPrice);
          const totalQty = existingQty + itemQty;
          existing.price = (totalValue / totalQty).toFixed(2);
        } else if (itemPrice > 0) {
          existing.price = itemPrice.toString();
        }
        
        // Cộng thành tiền
        const existingAmount = parseFloat(existing.amount || 0);
        const itemAmount = parseFloat(item.amount || 0);
        existing.amount = (existingAmount + itemAmount).toString();
        
        // Giữ _misaMatchPercent cao nhất
        const existingPct = existing._misaMatchPercent;
        const itemPct = item._misaMatchPercent;
        if (itemPct !== undefined && itemPct !== null) {
          if (existingPct === undefined || existingPct === null || itemPct > existingPct) {
            existing._misaMatchPercent = itemPct;
          }
        }
        
        totalMerged++;
      } else {
        seen.set(key, item);
        merged.push(item);
      }
    });
    
    hkdData[taxCode][field] = merged;
  });
  
  if (totalMerged > 0) {
    saveDataToLocalStorage();
    console.log(`📦 Đã gộp ${totalMerged} item trùng trong HKD ${taxCode}`);
  }
  return totalMerged;
}
window.deduplicateTonKho = deduplicateTonKho;
