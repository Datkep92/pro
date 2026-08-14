// ============================================================
// xuatkho.js - Quản lý xuất kho (giống hệt tồn kho)
// ============================================================

// State cho xuất kho
let xuatkhoPageState = {};
let xuatkhoShowAllState = {};
let xuatkhoEditing = { taxCode: '', type: '', index: -1 };

function getXuatKhoPage(taxCode, type) {
  return xuatkhoPageState[`${taxCode}-${type}`] || 0;
}
function setXuatKhoPage(taxCode, type, page) {
  xuatkhoPageState[`${taxCode}-${type}`] = page;
}
function isXuatKhoShowAll(taxCode, type) {
  return xuatkhoShowAllState[`${taxCode}-${type}`] || false;
}
function setXuatKhoShowAll(taxCode, type, showAll) {
  xuatkhoShowAllState[`${taxCode}-${type}`] = showAll;
}

// ============================================================
// RENDER XUẤT KHO TAB
// ============================================================
function renderXuatKhoTab(taxCode, type) {
  if (typeof addMissingProductCodes === 'function') addMissingProductCodes(taxCode);

  if (!hkdData[taxCode]) {
    hkdData[taxCode] = {
      tonkhoMain: [], tonkhoKM: [], tonkhoCK: [],
      xuatkhoMain: [], xuatkhoKM: [], xuatkhoCK: [],
      invoices: [], exports: [], customers: []
    };
  }

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const divMap = { main: 'xuatKho-main', km: 'xuatKho-km', ck: 'xuatKho-ck' };
  const spanMap = { main: 'total-xuatkho-main', km: 'total-xuatkho-km', ck: 'total-xuatkho-ck' };

  const arr = (hkdData[taxCode][map[type]] || []).filter(item => {
    if (type === 'main') return item.category === 'hang_hoa';
    if (type === 'km') return item.category === 'KM';
    if (type === 'ck') return item.category === 'chiet_khau';
    return true;
  });

  const zeroStockCount = arr.filter(item => parseFloat(item.quantity) <= 0).length;

  // ============================================================
  // THANH FILTER
  // ============================================================
  const filterId = `xuatkho-filters-${type}`;
  if (!document.getElementById(filterId)) {
    const filterDiv = document.createElement('div');
    filterDiv.id = filterId;
    filterDiv.style = 'margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';
    filterDiv.innerHTML = `
      <label>📅 Từ: <input type="text" id="xuatFilterFrom-${type}" class="flatpickr-input" placeholder="Chọn ngày" readonly="readonly"></label>
      <label>📅 Đến: <input type="text" id="xuatFilterTo-${type}" class="flatpickr-input" placeholder="Chọn ngày" readonly="readonly"></label>
      <label>🔍 Số HĐ: <input type="text" id="xuatFilterNumber-${type}" list="xuatNumberList-${type}" placeholder="Gõ số hóa đơn..." style="width:160px;"></label>
      <datalist id="xuatNumberList-${type}"></datalist>
      <label>🔎 Tìm: <input type="text" id="xuatFilterSearch-${type}" placeholder="Tên hoặc mã hàng..." style="width:180px;"></label>
      <label>Tên: <select id="xuatFilterTen-${type}" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>Thuế suất: <select id="xuatFilterThueSuat-${type}" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>ĐVT: <select id="xuatFilterDVT-${type}" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
      </select></label>
      <label>% Khớp: <select id="xuatFilterMatchPct-${type}" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Tất cả</option>
        <option value="100">100%</option>
        <option value="75-99">75% - 99%</option>
        <option value="50-74">50% - 74%</option>
        <option value="25-49">25% - 49%</option>
        <option value="1-24">< 25%</option>
        <option value="none">Chưa đồng bộ</option>
      </select></label>
      <label>Sắp xếp: <select id="xuatFilterSort-${type}" style="font-size:0.85em;padding:2px 4px;">
        <option value="">Mặc định</option>
        <option value="ten-asc">Tên A-Z</option>
        <option value="ten-desc">Tên Z-A</option>
      </select></label>
      ${zeroStockCount > 0 ? `
        <button id="xuatDeleteZeroStockBtn-${type}" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
          Xóa ${zeroStockCount} tồn kho = 0
        </button>
      ` : ''}
      <button id="xuatResetFiltersBtn-${type}" style="background: #ff9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight:bold;">
        🔄 Đặt lại
      </button>
    `;
    const container = document.getElementById(divMap[type]);
    if (container) container.insertAdjacentElement('beforebegin', filterDiv);

    // Khởi tạo flatpickr
    if (typeof flatpickr === 'function') {
      flatpickr(`#xuatFilterFrom-${type}`, {
        dateFormat: "Y-m-d",
        onChange: () => applyXuatAutoFilter()
      });
      flatpickr(`#xuatFilterTo-${type}`, {
        dateFormat: "Y-m-d",
        onChange: () => applyXuatAutoFilter()
      });
    }

    let _debounceTimer;
    document.getElementById(`xuatFilterNumber-${type}`).addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => applyXuatAutoFilter(), 300);
    });
    document.getElementById(`xuatFilterSearch-${type}`).addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => applyXuatAutoFilter(), 300);
    });
    document.getElementById(`xuatFilterTen-${type}`).addEventListener('change', () => applyXuatAutoFilter());
    document.getElementById(`xuatFilterThueSuat-${type}`).addEventListener('change', () => applyXuatAutoFilter());
    document.getElementById(`xuatFilterDVT-${type}`).addEventListener('change', () => applyXuatAutoFilter());
    document.getElementById(`xuatFilterMatchPct-${type}`).addEventListener('change', () => applyXuatAutoFilter());
    document.getElementById(`xuatFilterSort-${type}`).addEventListener('change', () => applyXuatAutoFilter());
    document.getElementById(`xuatResetFiltersBtn-${type}`).addEventListener('click', () => resetXuatKhoFilters());

    // Batch actions
    const batchId = `xuatkho-batch-actions-${type}`;
    if (!document.getElementById(batchId)) {
      const batchDiv = document.createElement('div');
      batchDiv.id = batchId;
      batchDiv.style = 'margin: 5px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 6px 10px; background: #f0f4ff; border-radius: 6px; border: 1px solid #cce;';
      batchDiv.innerHTML = `
        <label style="font-size:0.9em;font-weight:bold;margin-right:4px;">
          <input type="checkbox" id="xuatSelectAllCheckbox-${type}" onchange="toggleXuatSelectAll(this)"> Chọn tất cả
        </label>
        <span id="xuatSelectedCount-${type}" style="font-size:0.85em;color:#555;">(0 đã chọn)</span>
        <button id="xuatBatchDeleteBtn-${type}" onclick="batchXuatDeleteItems()" style="background:#f44336;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🗑 Xóa</button>
        <button id="xuatBatchMoveBtn-${type}" onclick="batchXuatMoveItems()" style="background:#ff9800;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🔁 Chuyển</button>
        <button id="xuatBatchMergeBtn-${type}" onclick="batchXuatMergeItems()" style="background:#4caf50;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🔗 Gộp</button>
        <button id="xuatAutoMergeBtn-${type}" onclick="autoMergeXuatKhoDuplicates()" style="background:#2196f3;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">🔗 Gộp tự động</button>
      `;
      const container = document.getElementById(divMap[type]);
      if (container) container.insertAdjacentElement('beforebegin', batchDiv);
    }
  }

  updateXuatSelectedCount();

  // Lưu giá trị filter hiện tại
  const prevSearch = document.getElementById(`xuatFilterSearch-${type}`)?.value || '';
  const prevTen = document.getElementById(`xuatFilterTen-${type}`)?.value || '';
  const prevThueSuat = document.getElementById(`xuatFilterThueSuat-${type}`)?.value || '';
  const prevDVT = document.getElementById(`xuatFilterDVT-${type}`)?.value || '';
  const prevMatchPct = document.getElementById(`xuatFilterMatchPct-${type}`)?.value || '';

  // Cập nhật datalist số HĐ
  const allNumbers = [
    ...new Set((hkdData[taxCode].invoices || []).map(inv => inv.invoiceInfo?.number).filter(Boolean))
  ];
  const numberList = document.getElementById(`xuatNumberList-${type}`);
  if (numberList) numberList.innerHTML = allNumbers.map(n => `<option value="${n}">`).join('');

  // Cập nhật dropdown Tên
  const filterTen = document.getElementById(`xuatFilterTen-${type}`);
  if (filterTen) {
    const tenValues = [...new Set(arr.map(item => (item.name || '').trim()).filter(Boolean))].sort();
    filterTen.innerHTML = '<option value="">Tất cả</option>' + tenValues.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    filterTen.value = prevTen;
  }

  // Cập nhật dropdown Thuế suất
  const filterThueSuat = document.getElementById(`xuatFilterThueSuat-${type}`);
  if (filterThueSuat) {
    const thueValues = [...new Set(arr.map(item => item.taxRate).filter(v => v !== undefined && v !== ''))].sort((a,b) => a-b);
    filterThueSuat.innerHTML = '<option value="">Tất cả</option>' + thueValues.map(v => `<option value="${v}">${v}%</option>`).join('');
    filterThueSuat.value = prevThueSuat;
  }

  // Cập nhật dropdown ĐVT
  const filterDVT = document.getElementById(`xuatFilterDVT-${type}`);
  if (filterDVT) {
    const unitMap = {};
    arr.forEach(item => {
      const raw = (item.unit || '').trim();
      if (!raw) return;
      const key = (typeof normalizeUnit === 'function') ? normalizeUnit(raw) : raw.toLowerCase();
      if (!unitMap[key] || (typeof isBetterUnit === 'function' && isBetterUnit(raw, unitMap[key]))) {
        unitMap[key] = raw;
      }
    });
    const dvtValues = Object.keys(unitMap).sort().map(k => unitMap[k]);
    filterDVT.innerHTML = '<option value="">Tất cả</option>' + dvtValues.map(v => `<option value="${v.replace(/'/g, "\\'")}">${v}</option>`).join('');
    filterDVT.value = prevDVT;
  }

  const filterSearchEl = document.getElementById(`xuatFilterSearch-${type}`);
  if (filterSearchEl) filterSearchEl.value = prevSearch;
  const filterMatchPctEl = document.getElementById(`xuatFilterMatchPct-${type}`);
  if (filterMatchPctEl) filterMatchPctEl.value = prevMatchPct;

  if (zeroStockCount > 0) {
    document.getElementById(`xuatDeleteZeroStockBtn-${type}`)?.addEventListener('click', () => {
      deleteXuatZeroStock(taxCode, type);
    });
  }

  // Kiểm tra filter active
  const hasActiveFilter =
    (document.getElementById(`xuatFilterFrom-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterTo-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterNumber-${type}`)?.value?.trim() || '') ||
    (document.getElementById(`xuatFilterSearch-${type}`)?.value?.trim() || '') ||
    (document.getElementById(`xuatFilterTen-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterThueSuat-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterDVT-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterMatchPct-${type}`)?.value || '') ||
    (document.getElementById(`xuatFilterSort-${type}`)?.value || '');

  if (hasActiveFilter) {
    const total = arr.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const totalSpan = document.getElementById(spanMap[type]);
    if (totalSpan) totalSpan.innerText = total.toLocaleString() + ' đ';
    applyXuatAutoFilter();
    return;
  }

  const total = arr.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  let html = `
  <table border="1" cellpadding="6" cellspacing="0" style="margin-top:10px; width:100%; background:#fff;">
    <thead>
      <tr>
        <th style="width:40px;"><input type="checkbox" id="xuatSelectAllCheckboxHeader-${type}" onchange="toggleXuatSelectAll(this)"></th>
        <th>STT</th><th>Số HĐ</th><th>Mã SP</th><th>Tên</th><th>ĐVT</th><th>SL</th>
        <th>Đơn giá</th><th>CK</th><th>Thành tiền</th><th>Thuế</th><th>TTST</th>
        <th>Thao tác</th>
      </tr>
    </thead>
    <tbody>`;

  const TONKHO_PAGE_SIZE = 50;
  const showAll = isXuatKhoShowAll(taxCode, type);
  const currentPage = getXuatKhoPage(taxCode, type);
  const startIdx = showAll ? 0 : currentPage * TONKHO_PAGE_SIZE;
  const pageItems = showAll ? arr : arr.slice(startIdx, startIdx + TONKHO_PAGE_SIZE);

  pageItems.forEach((item, idx) => {
    const i = startIdx + idx;
    const isEditing = (xuatkhoEditing.index === i && xuatkhoEditing.type === type && xuatkhoEditing.taxCode === taxCode);
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const discount = parseFloat(item.discount || item.lineDiscount || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = quantity * price - discount;
    const afterTax = amount + (amount * taxRate / 100);

    const rowStyle = quantity <= 0 ? 'background:#ffebee;' : '';

    let invNumber = (item.number || '').trim();
    if (!invNumber && item.mccqt) {
      const inv = (hkdData[taxCode].invoices || []).find(i => i.invoiceInfo?.mccqt === item.mccqt);
      invNumber = (inv?.invoiceInfo?.number || '').trim();
    }
    const invNumberDisplay = invNumber || item.mccqt || '';

    html += `<tr style="${rowStyle}"><td style="text-align:center;"><input type="checkbox" class="xuatkho-checkbox" data-index="${i}" data-type="${type}" onchange="updateXuatSelectedCount()"></td><td>${i + 1}</td>`;
    if (invNumberDisplay) {
      html += `<td style="text-align:center;"><a href="#" onclick="event.preventDefault(); renderInvoiceDetail('${taxCode}', '${item.mccqt}'); return false;" style="color:#1976d2;text-decoration:underline;cursor:pointer;font-size:0.85em;">${invNumberDisplay}</a></td>`;
    } else {
      html += `<td style="text-align:center;color:#999;">-</td>`;
    }

    if (isEditing) {
      html += `
        <td><input value="${item.productCode || ''}" id="xuat-edit-code-${i}" style="width:100%"></td>
        <td><input value="${item.name}" id="xuat-edit-name-${i}" style="width:100%"></td>
        <td><input value="${item.unit}" id="xuat-edit-unit-${i}" style="width:100%"></td>
        <td><input type="number" value="${item.quantity}" id="xuat-edit-qty-${i}" style="width:60px"></td>
        <td><input type="number" value="${item.price}" id="xuat-edit-price-${i}" style="width:80px"></td>
        <td>${amount.toLocaleString()}</td>
        <td><input value="${item.taxRate}" id="xuat-edit-tax-${i}" style="width:60px"></td>
        <td>${Math.round(afterTax).toLocaleString()}</td>
        <td>
          <button onclick="confirmXuatEditProduct('${taxCode}', '${type}', ${i})">Lưu</button>
          <button onclick="cancelXuatEditProduct()">Hủy</button>
        </td>`;
    } else {
      const qtyColor = quantity <= 0 ? 'color:#f44336; font-weight:bold;' : '';
      const matchPct = item._misaMatchPercent;
      let codeBg = '';
      let codeTitle = '';
      if (matchPct !== undefined && matchPct !== null) {
        codeBg = 'background:' + (typeof getMatchColor === 'function' ? getMatchColor(matchPct) : '#ccc') + ';';
        codeTitle = ` title="Tỷ lệ match MISA: ${matchPct}%"`;
      }
      html += `
        <td style="${codeBg}text-align:center;${codeTitle}">
          <a href="#" onclick="event.preventDefault(); quickEditXuatProductCode('${taxCode}', '${type}', ${i}); return false;"
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
          <button onclick="createXuatKhoItem('${taxCode}', '${type}')">Thêm</button>
          <button onclick="startXuatEditProduct('${taxCode}', '${type}', ${i})">Sửa</button>
          ${quantity <= 0 ? `
            <button onclick="deleteXuatStockItem('${taxCode}', '${type}', ${i})"
                    style="background: #f44336; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
              Xóa
            </button>
          ` : `
            <button onclick="deleteXuatKhoItem('${taxCode}', '${type}', ${i})">Xóa</button>
          `}
          <button onclick="moveXuatKhoItemPrompt('${taxCode}', '${type}', ${i})">Chuyển</button>
        </td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // Phân trang
  html += renderXuatPagination(arr.length, currentPage, taxCode, type, divMap[type]);

  if (type === 'ck') {
    html += `<div style="margin-top:10px; font-weight:bold; color:#b00;">
      Tổng chiết khấu: ${total.toLocaleString()} đ
    </div>`;
  }

  const container = document.getElementById(divMap[type]);
  if (container) container.innerHTML = html;

  const totalSpan = document.getElementById(spanMap[type]);
  if (totalSpan) totalSpan.innerText = total.toLocaleString() + ' đ';
}

// ============================================================
// PAGINATION
// ============================================================
function renderXuatPagination(totalItems, currentPage, taxCode, type, containerId) {
  const TONKHO_PAGE_SIZE = 50;
  const totalPages = Math.ceil(totalItems / TONKHO_PAGE_SIZE);
  const showAll = isXuatKhoShowAll(taxCode, type);

  let html = `<div style="margin: 10px 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">`;
  html += `<span style="font-size:0.9em;color:#555;">Tổng: <b>${totalItems}</b> sản phẩm</span>`;

  if (totalPages > 1) {
    html += `<div style="display:flex;gap:4px;">`;
    for (let p = 0; p < totalPages; p++) {
      const active = p === currentPage ? 'background:#4361ee;color:#fff;' : 'background:#f1f5f9;color:#333;';
      html += `<button onclick="changeXuatKhoPage('${taxCode}','${type}',${p})" style="${active}border:1px solid #ddd;padding:4px 10px;border-radius:4px;cursor:pointer;">${p + 1}</button>`;
    }
    html += `</div>`;
  }

  html += `
    <label style="font-size:0.85em;">
      <input type="checkbox" onchange="toggleXuatKhoShowAll('${taxCode}','${type}')" ${showAll ? 'checked' : ''}> Hiển thị tất cả
    </label>
  `;
  html += `</div>`;
  return html;
}

function changeXuatKhoPage(taxCode, type, page) {
  setXuatKhoPage(taxCode, type, page);
  renderXuatKhoTab(taxCode, type);
}

function toggleXuatKhoShowAll(taxCode, type) {
  const showAll = !isXuatKhoShowAll(taxCode, type);
  setXuatKhoShowAll(taxCode, type, showAll);
  renderXuatKhoTab(taxCode, type);
}

function switchXuatKhoTab(tab) {
  if (!currentTaxCode) return;
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.xuatkho-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.xuatkho-tab-btn[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  renderXuatKhoTab(currentTaxCode, tab);
}

// ============================================================
// FILTER
// ============================================================
function applyXuatAutoFilter() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = (hkdData[taxCode][map[type]] || []).filter(item => {
    if (type === 'main') return item.category === 'hang_hoa';
    if (type === 'km') return item.category === 'KM';
    if (type === 'ck') return item.category === 'chiet_khau';
    return true;
  });

  const fromDate = document.getElementById(`xuatFilterFrom-${type}`)?.value || '';
  const toDate = document.getElementById(`xuatFilterTo-${type}`)?.value || '';
  const numberFilter = document.getElementById(`xuatFilterNumber-${type}`)?.value?.trim().toLowerCase() || '';
  const searchFilter = document.getElementById(`xuatFilterSearch-${type}`)?.value?.trim().toLowerCase() || '';
  const tenFilter = document.getElementById(`xuatFilterTen-${type}`)?.value || '';
  const thueSuatFilter = document.getElementById(`xuatFilterThueSuat-${type}`)?.value || '';
  const dvtFilter = document.getElementById(`xuatFilterDVT-${type}`)?.value || '';
  const matchPctFilter = document.getElementById(`xuatFilterMatchPct-${type}`)?.value || '';
  const sortFilter = document.getElementById(`xuatFilterSort-${type}`)?.value || '';

  let filtered = arr.filter(item => {
    if (fromDate && item.invoiceDate && item.invoiceDate < fromDate) return false;
    if (toDate && item.invoiceDate && item.invoiceDate > toDate) return false;
    if (numberFilter) {
      const invNum = (item.number || '').toLowerCase();
      if (!invNum.includes(numberFilter)) return false;
    }
    if (searchFilter) {
      const name = (item.name || '').toLowerCase();
      const code = (item.productCode || '').toLowerCase();
      if (!name.includes(searchFilter) && !code.includes(searchFilter)) return false;
    }
    if (tenFilter && (item.name || '').trim() !== tenFilter) return false;
    if (thueSuatFilter && parseFloat(item.taxRate) !== parseFloat(thueSuatFilter)) return false;
    if (dvtFilter && (item.unit || '').trim() !== dvtFilter) return false;
    if (matchPctFilter) {
      const pct = item._misaMatchPercent;
      if (matchPctFilter === 'none') {
        if (pct !== undefined && pct !== null) return false;
      } else if (matchPctFilter === '100') {
        if (pct !== 100) return false;
      } else {
        const [min, max] = matchPctFilter.split('-').map(Number);
        if (pct === undefined || pct === null || pct < min || (max && pct > max)) return false;
      }
    }
    return true;
  });

  if (sortFilter === 'ten-asc') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (sortFilter === 'ten-desc') filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));

  renderFilteredXuatKhoTable(taxCode, type, filtered);
}

function renderFilteredXuatKhoTable(taxCode, type, filtered) {
  const divMap = { main: 'xuatKho-main', km: 'xuatKho-km', ck: 'xuatKho-ck' };
  const spanMap = { main: 'total-xuatkho-main', km: 'total-xuatkho-km', ck: 'total-xuatkho-ck' };

  const total = filtered.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  let html = `
  <table border="1" cellpadding="6" cellspacing="0" style="margin-top:10px; width:100%; background:#fff;">
    <thead>
      <tr>
        <th style="width:40px;"><input type="checkbox" id="xuatSelectAllCheckboxHeader-${type}" onchange="toggleXuatSelectAll(this)"></th>
        <th>STT</th><th>Số HĐ</th><th>Mã SP</th><th>Tên</th><th>ĐVT</th><th>SL</th>
        <th>Đơn giá</th><th>CK</th><th>Thành tiền</th><th>Thuế</th><th>TTST</th>
        <th>Thao tác</th>
      </tr>
    </thead>
    <tbody>`;

  filtered.forEach((item, idx) => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const discount = parseFloat(item.discount || item.lineDiscount || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = quantity * price - discount;
    const afterTax = amount + (amount * taxRate / 100);
    const rowStyle = quantity <= 0 ? 'background:#ffebee;' : '';

    let invNumber = (item.number || '').trim();
    if (!invNumber && item.mccqt) {
      const inv = (hkdData[taxCode].invoices || []).find(i => i.invoiceInfo?.mccqt === item.mccqt);
      invNumber = (inv?.invoiceInfo?.number || '').trim();
    }
    const invNumberDisplay = invNumber || item.mccqt || '';

    html += `<tr style="${rowStyle}"><td style="text-align:center;"><input type="checkbox" class="xuatkho-checkbox" data-index="${idx}" data-type="${type}" onchange="updateXuatSelectedCount()"></td><td>${idx + 1}</td>`;
    if (invNumberDisplay) {
      html += `<td style="text-align:center;"><a href="#" onclick="event.preventDefault(); renderInvoiceDetail('${taxCode}', '${item.mccqt}'); return false;" style="color:#1976d2;text-decoration:underline;cursor:pointer;font-size:0.85em;">${invNumberDisplay}</a></td>`;
    } else {
      html += `<td style="text-align:center;color:#999;">-</td>`;
    }

    const matchPct = item._misaMatchPercent;
    let codeBg = '';
    let codeTitle = '';
    if (matchPct !== undefined && matchPct !== null) {
      codeBg = 'background:' + (typeof getMatchColor === 'function' ? getMatchColor(matchPct) : '#ccc') + ';';
      codeTitle = ` title="Tỷ lệ match MISA: ${matchPct}%"`;
    }
    html += `
      <td style="${codeBg}text-align:center;${codeTitle}">
        <a href="#" onclick="event.preventDefault(); quickEditXuatProductCode('${taxCode}', '${type}', ${idx}); return false;"
           style="color:${matchPct !== undefined && matchPct !== null ? '#fff' : '#1976d2'};text-decoration:underline;cursor:pointer;font-size:0.85em;font-family:monospace;font-weight:bold;">
          ${item.productCode || 'N/A'}
        </a>
      </td>
      <td>${item.name}</td>
      <td>${item.unit}</td>
      <td style="${quantity <= 0 ? 'color:#f44336; font-weight:bold;' : ''}">${item.quantity}</td>
      <td>${item.price}</td>
      <td>${discount.toLocaleString()}</td>
      <td>${amount.toLocaleString()}</td>
      <td>${item.taxRate}</td>
      <td>${Math.round(afterTax).toLocaleString()}</td>
      <td>
        <button onclick="createXuatKhoItem('${taxCode}', '${type}')">Thêm</button>
        <button onclick="startXuatEditProduct('${taxCode}', '${type}', ${idx})">Sửa</button>
        ${quantity <= 0 ? `
          <button onclick="deleteXuatStockItem('${taxCode}', '${type}', ${idx})"
                  style="background: #f44336; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
            Xóa
          </button>
        ` : `
          <button onclick="deleteXuatKhoItem('${taxCode}', '${type}', ${idx})">Xóa</button>
        `}
        <button onclick="moveXuatKhoItemPrompt('${taxCode}', '${type}', ${idx})">Chuyển</button>
      </td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  html += `<div style="margin-top:8px;font-weight:bold;">Tổng: ${total.toLocaleString()} đ</div>`;

  const container = document.getElementById(divMap[type]);
  if (container) container.innerHTML = html;

  const totalSpan = document.getElementById(spanMap[type]);
  if (totalSpan) totalSpan.innerText = total.toLocaleString() + ' đ';
}

// ============================================================
// RESET FILTERS
// ============================================================
function resetXuatKhoFilters() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  document.getElementById(`xuatFilterFrom-${type}`).value = '';
  document.getElementById(`xuatFilterTo-${type}`).value = '';
  document.getElementById(`xuatFilterNumber-${type}`).value = '';
  document.getElementById(`xuatFilterSearch-${type}`).value = '';
  document.getElementById(`xuatFilterTen-${type}`).value = '';
  document.getElementById(`xuatFilterThueSuat-${type}`).value = '';
  document.getElementById(`xuatFilterDVT-${type}`).value = '';
  document.getElementById(`xuatFilterMatchPct-${type}`).value = '';
  document.getElementById(`xuatFilterSort-${type}`).value = '';

  setXuatKhoPage(taxCode, type, 0);
  setXuatKhoShowAll(taxCode, type, false);
  renderXuatKhoTab(taxCode, type);
}

// ============================================================
// EDITING FUNCTIONS
// ============================================================
function startXuatEditProduct(taxCode, type, index) {
  xuatkhoEditing = { taxCode, type, index };
  renderXuatKhoTab(taxCode, type);
}

function confirmXuatEditProduct(taxCode, type, index) {
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  if (!arr || !arr[index]) return;

  const item = arr[index];
  item.productCode = document.getElementById(`xuat-edit-code-${index}`)?.value || item.productCode;
  item.name = document.getElementById(`xuat-edit-name-${index}`)?.value || item.name;
  item.unit = document.getElementById(`xuat-edit-unit-${index}`)?.value || item.unit;
  item.quantity = parseFloat(document.getElementById(`xuat-edit-qty-${index}`)?.value) || 0;
  item.price = parseFloat(document.getElementById(`xuat-edit-price-${index}`)?.value) || 0;
  item.taxRate = parseFloat(document.getElementById(`xuat-edit-tax-${index}`)?.value) || 0;
  item.amount = item.quantity * item.price;

  xuatkhoEditing = { taxCode: '', type: '', index: -1 };
  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function cancelXuatEditProduct() {
  xuatkhoEditing = { taxCode: '', type: '', index: -1 };
  const taxCode = currentTaxCode;
  if (taxCode) {
    let type = 'main';
    ['main', 'km', 'ck'].forEach(t => {
      const el = document.getElementById(`xuatKho-${t}`);
      if (el && el.style.display !== 'none') type = t;
    });
    renderXuatKhoTab(taxCode, type);
  }
}

// ============================================================
// CRUD FUNCTIONS
// ============================================================
function createXuatKhoItem(taxCode, type) {
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  if (!hkdData[taxCode]) ensureHkdData(taxCode);
  if (!hkdData[taxCode][map[type]]) hkdData[taxCode][map[type]] = [];

  const newItem = {
    productCode: '',
    name: 'Sản phẩm mới',
    unit: '',
    quantity: 0,
    price: 0,
    amount: 0,
    taxRate: 0,
    category: type === 'km' ? 'KM' : type === 'ck' ? 'chiet_khau' : 'hang_hoa',
    invoiceDate: '',
    mccqt: '',
    number: ''
  };

  hkdData[taxCode][map[type]].push(newItem);
  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function deleteXuatKhoItem(taxCode, type, index) {
  if (!confirm('Xóa sản phẩm này?')) return;
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  if (!arr || !arr[index]) return;
  arr.splice(index, 1);
  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function deleteXuatStockItem(taxCode, type, index) {
  if (!confirm('Xóa sản phẩm tồn kho = 0 này?')) return;
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  if (!arr || !arr[index]) return;
  arr.splice(index, 1);
  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function moveXuatKhoItemPrompt(taxCode, type, index) {
  const target = prompt('Chuyển đến (main/km/ck):', '');
  if (!target || !['main', 'km', 'ck'].includes(target)) return;
  moveXuatKhoItem(taxCode, type, index, target);
}

function moveXuatKhoItem(taxCode, fromType, index, toType) {
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const fromArr = hkdData[taxCode][map[fromType]];
  if (!fromArr || !fromArr[index]) return;

  const item = fromArr.splice(index, 1)[0];
  item.category = toType === 'km' ? 'KM' : toType === 'ck' ? 'chiet_khau' : 'hang_hoa';
  if (!hkdData[taxCode][map[toType]]) hkdData[taxCode][map[toType]] = [];
  hkdData[taxCode][map[toType]].push(item);

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, fromType);
}

// ============================================================
// BATCH OPERATIONS
// ============================================================
function toggleXuatSelectAll(checkbox) {
  document.querySelectorAll('.xuatkho-checkbox').forEach(cb => cb.checked = checkbox.checked);
  updateXuatSelectedCount();
}

function updateXuatSelectedCount() {
  const checked = document.querySelectorAll('.xuatkho-checkbox:checked');
  const count = checked.length;
  document.querySelectorAll('[id^="xuatSelectedCount-"]').forEach(el => {
    el.textContent = `(${count} đã chọn)`;
  });
}

function getXuatSelectedIndices(type) {
  const indices = [];
  document.querySelectorAll(`.xuatkho-checkbox:checked[data-type="${type}"]`).forEach(cb => {
    indices.push(parseInt(cb.dataset.index));
  });
  return indices.sort((a, b) => b - a);
}

function batchXuatDeleteItems() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  const indices = getXuatSelectedIndices(type);
  if (indices.length === 0) return window.showToast('Chưa chọn sản phẩm nào!', 2000, 'error');
  if (!confirm(`Xóa ${indices.length} sản phẩm đã chọn?`)) return;

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  indices.forEach(i => arr.splice(i, 1));

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function batchXuatMoveItems() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  const indices = getXuatSelectedIndices(type);
  if (indices.length === 0) return window.showToast('Chưa chọn sản phẩm nào!', 2000, 'error');

  const target = prompt('Chuyển đến (main/km/ck):', '');
  if (!target || !['main', 'km', 'ck'].includes(target)) return;

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const fromArr = hkdData[taxCode][map[type]];
  const items = [];
  indices.sort((a, b) => b - a).forEach(i => {
    items.push(fromArr.splice(i, 1)[0]);
  });

  items.reverse().forEach(item => {
    item.category = target === 'km' ? 'KM' : target === 'ck' ? 'chiet_khau' : 'hang_hoa';
    if (!hkdData[taxCode][map[target]]) hkdData[taxCode][map[target]] = [];
    hkdData[taxCode][map[target]].push(item);
  });

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

function batchXuatMergeItems() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  const indices = getXuatSelectedIndices(type);
  if (indices.length < 2) return window.showToast('Chọn ít nhất 2 sản phẩm để gộp!', 2000, 'error');

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];

  const base = arr[indices[indices.length - 1]];
  const others = indices.slice(0, -1).sort((a, b) => b - a);

  others.forEach(i => {
    const other = arr[i];
    base.quantity = (parseFloat(base.quantity) || 0) + (parseFloat(other.quantity) || 0);
    base.amount = (parseFloat(base.quantity) || 0) * (parseFloat(base.price) || 0);
    arr.splice(i, 1);
  });

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

// ============================================================
// DELETE ZERO STOCK
// ============================================================
function deleteXuatZeroStock(taxCode, type) {
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  if (!arr) return;

  const before = arr.length;
  hkdData[taxCode][map[type]] = arr.filter(item => parseFloat(item.quantity) > 0);
  const after = hkdData[taxCode][map[type]].length;

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
  window.showToast(`Đã xóa ${before - after} sản phẩm tồn kho = 0`, 2000, 'success');
}

// ============================================================
// QUICK EDIT PRODUCT CODE
// ============================================================
function quickEditXuatProductCode(taxCode, type, index) {
  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const item = hkdData[taxCode]?.[map[type]]?.[index];
  if (!item) return;

  const newCode = prompt('Nhập mã sản phẩm mới:', item.productCode || '');
  if (newCode === null) return;

  item.productCode = newCode.trim();
  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
}

// ============================================================
// AUTO MERGE DUPLICATES - Gộp tự động sản phẩm trùng tên, trùng ký tự, trùng DVT
// ============================================================
function autoMergeXuatKhoDuplicates() {
  const taxCode = currentTaxCode;
  if (!taxCode) return;

  let type = 'main';
  ['main', 'km', 'ck'].forEach(t => {
    const el = document.getElementById(`xuatKho-${t}`);
    if (el && el.style.display !== 'none') type = t;
  });

  const map = { main: 'xuatkhoMain', km: 'xuatkhoKM', ck: 'xuatkhoCK' };
  const arr = hkdData[taxCode][map[type]];
  if (!arr || arr.length < 2) {
    return window.showToast('Không có đủ sản phẩm để gộp!', 2000, 'info');
  }

  // Nhóm các item theo key: tên (đã trim, normalize) + đơn vị tính (đã trim, normalize)
  const groups = {};
  arr.forEach((item, idx) => {
    const name = (item.name || '').trim().toLowerCase();
    const unit = (item.unit || '').trim().toLowerCase();
    // Key = tên + '|' + đvt (cả 2 đã normalize)
    const key = name + '|' + unit;
    if (!groups[key]) groups[key] = [];
    groups[key].push(idx);
  });

  let mergedCount = 0;
  const toRemove = [];

  Object.keys(groups).forEach(key => {
    const indices = groups[key];
    if (indices.length < 2) return; // Không trùng thì bỏ qua

    // Giữ item cuối cùng làm base, gộp các item còn lại vào
    const baseIdx = indices[indices.length - 1];
    const base = arr[baseIdx];
    const others = indices.slice(0, -1).sort((a, b) => b - a); // Sắp xếp giảm dần để splice không ảnh hưởng index

    others.forEach(i => {
      const other = arr[i];
      // Cộng dồn số lượng
      base.quantity = (parseFloat(base.quantity) || 0) + (parseFloat(other.quantity) || 0);
      // Cộng dồn thành tiền (amount)
      base.amount = (parseFloat(base.amount) || 0) + (parseFloat(other.amount) || 0);
      // Đánh dấu xóa
      toRemove.push(i);
      mergedCount++;
    });
  });

  if (mergedCount === 0) {
    return window.showToast('✅ Không tìm thấy sản phẩm trùng để gộp!', 2000, 'info');
  }

  // Xóa các item đã gộp (sắp xếp giảm dần để không ảnh hưởng index)
  toRemove.sort((a, b) => b - a);
  toRemove.forEach(i => {
    arr.splice(i, 1);
  });

  window.saveDataToLocalStorage();
  renderXuatKhoTab(taxCode, type);
  window.showToast(`✅ Đã gộp ${mergedCount} sản phẩm trùng thành công!`, 3000, 'success');
}