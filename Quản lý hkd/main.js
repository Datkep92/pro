// main.js

// XÓA dòng khai báo hkdData, hkdOrder, currentTaxCode ở đây
// Sử dụng biến từ state.js

// Hàm đảm bảo dữ liệu HKD tồn tại
function ensureHkdData(taxCode) {
  if (!hkdData[taxCode]) {
    hkdData[taxCode] = {
      name: taxCode,
      tonkhoMain: [],
      tonkhoCK: [],
      tonkhoKM: [],
      xuatkhoMain: [],
      xuatkhoKM: [],
      xuatkhoCK: [],
      invoices: [],
      exports: [],
      customers: []
    };
    if (!hkdOrder.includes(taxCode)) {
      hkdOrder.push(taxCode);
    }
  }
  return hkdData[taxCode];
}

// Hàm xử lý khi chọn file ZIP từ nút trong sidebar
function handleZipFileChange(event) {
  const files = Array.from(event.target.files);
  if (files.length > 0) handleFilesFromInput(files);
  event.target.value = '';
}

// Hàm xử lý khi chọn file MISA từ nút trong sidebar
function handleMisaFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof importMisaExcel === 'function') {
    importMisaExcel(file);
  } else {
    alert('Hàm importMisaExcel chưa sẵn sàng. Vui lòng kiểm tra file inventory.js');
  }
  event.target.value = '';
}

// Hàm xử lý files từ input (dùng chung cho cả event listener cũ và mới)
async function handleFilesFromInput(files) {
  // Hiển thị progress bar
  if (typeof showProgress === 'function') {
    showProgress(0, `Bắt đầu xử lý ${files.length} file ZIP...`);
  }

  // Danh sách taxCode đã xử lý (để cập nhật mặc định sau)
  const processedTaxCodes = new Set();
  let processedCount = 0;
  const totalFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip')).length;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      window.showToast(`Bỏ qua file không phải .zip: ${file.name}`, 3000, 'info');
      continue;
    }

    try {
      // Cập nhật progress: đang giải nén
      if (typeof showProgress === 'function') {
        const pct = Math.round((processedCount / totalFiles) * 80);
        showProgress(pct, `📦 Đang giải nén: ${file.name} (${processedCount + 1}/${totalFiles})...`);
      }

      const invoice = await extractInvoiceFromZip(file);

      if (!invoice || !invoice.buyerInfo || !invoice.products) {
        window.showToast(`Không đọc được dữ liệu hóa đơn: ${file.name}`, 3000, 'error');
        processedCount++;
        continue;
      }

      // Cập nhật progress: đang xử lý dữ liệu
      if (typeof showProgress === 'function') {
        const pct = Math.round((processedCount / totalFiles) * 80) + 10;
        showProgress(Math.min(pct, 85), `📄 Đang xử lý hóa đơn: ${invoice.invoiceInfo?.number || file.name}...`);
      }

      const taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';
      const name = invoice?.buyerInfo?.name?.trim() || taxCode;
      const mccqt = (invoice.invoiceInfo?.mccqt || '').toUpperCase();

      ensureHkdData(taxCode);
      
      if (!hkdData[taxCode].name || hkdData[taxCode].name === taxCode) {
        hkdData[taxCode].name = name;
      }

      const exists = (hkdData[taxCode]?.invoices || []).some(
        inv => (inv.invoiceInfo?.mccqt || '') === mccqt
      );
      if (exists) {
        window.showToast(`Bỏ qua MCCQT trùng: ${mccqt}`, 3000, 'info');
        processedCount++;
        continue;
      }

      hkdData[taxCode].invoices.push(invoice);

      invoice.products.forEach(p => {
        const entry = {
          ...p,
          lineDiscount: parseFloat(p.lineDiscount || 0),
          invoiceDate: invoice.invoiceInfo?.date || '',
          mccqt: invoice.invoiceInfo?.mccqt || '',
          number: invoice.invoiceInfo?.number || '',
          taxCode: taxCode
        };
        const arr = entry.category === 'hang_hoa' ? 'tonkhoMain' :
                    entry.category === 'KM' ? 'tonkhoKM' : 'tonkhoCK';
        hkdData[taxCode][arr].push(entry);
      });

      processedTaxCodes.add(taxCode);
      processedCount++;

      window.logAction(`Nhập xong hóa đơn ${invoice.invoiceInfo.number} cho HKD ${taxCode}`, JSON.parse(JSON.stringify(hkdData)));

    } catch (err) {
      console.error(`Lỗi xử lý file ${file.name}:`, err);
      window.showToast(`File lỗi: ${file.name} - ${err.message}`, 3000, 'error');
      processedCount++;
      continue;
    }
  }

  // Cập nhật progress: đang lưu dữ liệu
  if (typeof showProgress === 'function') {
    showProgress(90, '💾 Đang lưu dữ liệu...');
  }

  // === SAU KHI NHẬP XONG TẤT CẢ FILE → LƯU MẶC ĐỊNH CHO TẤT CẢ HKD ===
  for (const taxCode of processedTaxCodes) {
    if (!hkdData[taxCode].tonkhoMainDefault) {
      const totalQty = hkdData[taxCode].tonkhoMain.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
      const totalValue = hkdData[taxCode].tonkhoMain.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.price || 0)), 0);

      hkdData[taxCode].tonkhoMainDefault = {
        totalQty: totalQty.toFixed(6),
        totalValue: totalValue.toFixed(2)
      };

      console.log(`[HOÀN TẤT] Lưu tồn kho mặc định cho HKD ${taxCode}:`, hkdData[taxCode].tonkhoMainDefault);
    }
  }

  // Lưu + render + cập nhật giao diện
  window.saveDataToLocalStorage();
  window.renderHKDList();

  if (hkdOrder.length > 0) {
    const lastTaxCode = hkdOrder[hkdOrder.length - 1];
    window.renderHKDTab(lastTaxCode);
    updateMainTotalDisplay(lastTaxCode);
  }

  // Hoàn tất
  if (typeof showProgress === 'function') {
    showProgress(100, '✅ Hoàn tất!');
    setTimeout(() => { if (typeof hideProgress === 'function') hideProgress(); }, 1500);
  }

  window.showToast('Đã xử lý xong tất cả file hóa đơn', 2000, 'success');
}

// ============================================================
// XỬ LÝ FILE ZIP XUẤT KHO (dùng sellerInfo.taxCode thay vì buyerInfo.taxCode)
// ============================================================
async function handleXuatKhoFileChange(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  event.target.value = '';

  if (typeof showProgress === 'function') {
    showProgress(0, `Bắt đầu xử lý ${files.length} file ZIP xuất kho...`);
  }

  const processedTaxCodes = new Set();
  let processedCount = 0;
  const totalFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip')).length;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      window.showToast(`Bỏ qua file không phải .zip: ${file.name}`, 3000, 'info');
      continue;
    }

    try {
      if (typeof showProgress === 'function') {
        const pct = Math.round((processedCount / totalFiles) * 80);
        showProgress(pct, `📦 Đang giải nén: ${file.name} (${processedCount + 1}/${totalFiles})...`);
      }

      const invoice = await extractInvoiceFromZip(file);

      if (!invoice || !invoice.sellerInfo || !invoice.products) {
        window.showToast(`Không đọc được dữ liệu hóa đơn xuất: ${file.name}`, 3000, 'error');
        processedCount++;
        continue;
      }

      if (typeof showProgress === 'function') {
        const pct = Math.round((processedCount / totalFiles) * 80) + 10;
        showProgress(Math.min(pct, 85), `📄 Đang xử lý hóa đơn xuất: ${invoice.invoiceInfo?.number || file.name}...`);
      }

      // Dùng sellerInfo.taxCode thay vì buyerInfo.taxCode
      const taxCode = invoice?.sellerInfo?.taxCode?.trim() || 'UNKNOWN';
      const name = invoice?.sellerInfo?.name?.trim() || taxCode;
      const mccqt = (invoice.invoiceInfo?.mccqt || '').toUpperCase();

      ensureHkdData(taxCode);

      if (!hkdData[taxCode].name || hkdData[taxCode].name === taxCode) {
        hkdData[taxCode].name = name;
      }

      const exists = (hkdData[taxCode]?.invoices || []).some(
        inv => (inv.invoiceInfo?.mccqt || '') === mccqt
      );
      if (exists) {
        window.showToast(`Bỏ qua MCCQT trùng: ${mccqt}`, 3000, 'info');
        processedCount++;
        continue;
      }

      hkdData[taxCode].invoices.push(invoice);

      invoice.products.forEach(p => {
        const entry = {
          ...p,
          lineDiscount: parseFloat(p.lineDiscount || 0),
          invoiceDate: invoice.invoiceInfo?.date || '',
          mccqt: invoice.invoiceInfo?.mccqt || '',
          number: invoice.invoiceInfo?.number || '',
          taxCode: taxCode
        };
        // Lưu vào xuatkhoMain/KM/CK thay vì tonkhoMain/KM/CK
        const arr = entry.category === 'hang_hoa' ? 'xuatkhoMain' :
                    entry.category === 'KM' ? 'xuatkhoKM' : 'xuatkhoCK';
        hkdData[taxCode][arr].push(entry);
      });

      processedTaxCodes.add(taxCode);
      processedCount++;

      window.logAction(`Nhập xong hóa đơn xuất ${invoice.invoiceInfo.number} cho HKD ${taxCode}`, JSON.parse(JSON.stringify(hkdData)));

    } catch (err) {
      console.error(`Lỗi xử lý file xuất ${file.name}:`, err);
      window.showToast(`File lỗi: ${file.name} - ${err.message}`, 3000, 'error');
      processedCount++;
      continue;
    }
  }

  if (typeof showProgress === 'function') {
    showProgress(90, '💾 Đang lưu dữ liệu...');
  }

  window.saveDataToLocalStorage();
  window.renderHKDList();

  if (hkdOrder.length > 0) {
    const lastTaxCode = hkdOrder[hkdOrder.length - 1];
    // Dùng keepTab='xuathang' để renderHKDTab giữ tab xuất hàng active
    window.renderHKDTab(lastTaxCode, 'xuathang');
  }

  // Tự động gộp sản phẩm trùng sau khi import xuất kho
  if (typeof autoMergeXuatKhoDuplicates === 'function') {
    autoMergeXuatKhoDuplicates();
  }

  if (typeof showProgress === 'function') {
    showProgress(100, '✅ Hoàn tất!');
    setTimeout(() => { if (typeof hideProgress === 'function') hideProgress(); }, 1500);
  }

  window.showToast('Đã xử lý xong tất cả file xuất kho', 2000, 'success');
}

async function handleFiles() {
  const input = document.getElementById("zipFile");
  const files = Array.from(input.files);
  if (files.length > 0) await handleFilesFromInput(files);
}

// Hàm đọc file Excel
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Lấy sheet đầu tiên
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Chuyển đổi sang JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Lỗi đọc file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

function mergeDuplicateItems(items) {
  const mergedMap = new Map();

  items.forEach((item, index) => {
    // BỎ QUA ITEM "PHẦN CÒN LẠI" TỪ TỰ ĐỘNG KHỚP
    if (item.isRemaining) {
      mergedMap.set(`__remaining_${index}`, {
        ...item,
        originalIndex: index,
        originalIndexes: [index]
      });
      return;
    }

    const key = `${item.name.trim().toLowerCase()}|${parseFloat(item.price || 0).toFixed(6)}`;
    const qty = parseFloat(item.qty || 0);

    // TÍNH originalQty CHO MỖI ITEM GỐC
    const originalQty = qty + (item.matchedHistory || []).reduce((s, m) => s + parseFloat(m.qty || 0), 0);

    // === XỬ LÝ ITEM ĐÃ XUẤT HẾT (qty <= 0) ===
    if (qty <= 0) {
      const doneKey = `${key}_done_${index}`;
      mergedMap.set(doneKey, {
        ...item,
        originalIndex: index,
        originalIndexes: [index],
        originalQty
      });
      return;
    }

    // === GỘP VỚI ITEM ĐÃ TỒN TẠI ===
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);

      // GỘP SỐ LƯỢNG + THÀNH TIỀN
      existing.qty = (parseFloat(existing.qty) + qty).toFixed(6);
      existing.amount = (parseFloat(existing.amount) + parseFloat(item.amount || 0)).toFixed(2);

      // GỘP originalQty
      existing.originalQty = (parseFloat(existing.originalQty || 0) + originalQty).toFixed(6);

      // GỘP matchedHistory
      if (item.matchedHistory?.length) {
        if (!existing.matchedHistory) existing.matchedHistory = [];
        existing.matchedHistory.push(...item.matchedHistory);
      }

      // Ghi nhận chỉ mục gốc
      existing.originalIndexes.push(index);

    } else {
      // TẠO MỚI
      mergedMap.set(key, {
        ...JSON.parse(JSON.stringify(item)),
        originalIndex: index,
        originalIndexes: [index],
        originalQty
      });
    }
  });

  // === CHUYỂN VỀ MẢNG, GIỮ THỨ TỰ GỐC ===
  const result = [];
  const seenKeys = new Set();

  items.forEach((item, index) => {
    // XỬ LÝ ITEM "PHẦN CÒN LẠI"
    if (item.isRemaining) {
      const key = `__remaining_${index}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const merged = mergedMap.get(key);
        if (merged) result.push(merged);
      }
      return;
    }

    const qty = parseFloat(item.qty || 0);
    const baseKey = `${item.name.trim().toLowerCase()}|${parseFloat(item.price || 0).toFixed(6)}`;

    if (qty <= 0) {
      const doneKey = `${baseKey}_done_${index}`;
      if (!seenKeys.has(doneKey)) {
        seenKeys.add(doneKey);
        const merged = mergedMap.get(doneKey);
        if (merged) result.push(merged);
      }
      return;
    }

    if (!seenKeys.has(baseKey)) {
      seenKeys.add(baseKey);
      const merged = mergedMap.get(baseKey);
      if (merged) result.push(merged);
    }
  });

  return result;
}
// === HÀM HỖ TRỢ: ĐỊNH DẠNG SỐ LƯỢNG ===
/**
 * Định dạng số lượng: loại bỏ .0000, giữ số nguyên nếu không có thập phân
 */
function formatQuantity(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  
  // Nếu là số nguyên → trả về dạng chuỗi không thập phân
  if (Number.isInteger(num)) return num.toString();
  
  // Nếu có thập phân → làm tròn 4 chữ số, loại bỏ số 0 thừa
  return num.toFixed(4).replace(/\.?0+$/, '');
}

async function extractInvoiceFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);

  const xmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.xml'));
  const htmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.html'));

  if (!xmlFile) throw new Error("Không tìm thấy file XML trong ZIP");

  const xmlContent = await xmlFile.async('text');
  const invoice = parseXmlInvoice(xmlContent);
  invoice._taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';

  if (htmlFile) {
    const htmlContent = await htmlFile.async('text');
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(blob);
    invoice.htmlUrl = htmlUrl;
  }

  return invoice;
}

// renderHKDList đã được chuyển sang hkd-list.js
// Biến toàn cục lưu tab chính đang active ('tonkho', 'xuathang', 'tonkhothucte')
let _activeMainTab = 'tonkho';

function renderHKDTab(taxCode, keepTab = null) {
  currentTaxCode = taxCode;
  ensureHkdData(taxCode);
  const hkd = hkdData[taxCode];

  // Xác định tab cần giữ
  if (keepTab === 'tonkho' || keepTab === 'xuathang' || keepTab === 'tonkhothucte') {
    _activeMainTab = keepTab;
  }
  // Nếu keepTab = null, giữ nguyên _activeMainTab hiện tại

  const activeTabId = `${taxCode}-${_activeMainTab}`;

  // LẤY TÊN CÔNG TY
  const companyName = hkd.name || taxCode;
const companyInfo = `
  <div class="company-header">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
    <span class="company-name">${companyName}</span>
    <span class="tax-code">${taxCode}</span>
  </div>
`;

  /* ---------- 1. TỒN KHO ---------- */
  const totalInvQty = (hkd.tonkhoMain || []).reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
  const totalInvValue = (hkd.tonkhoMain || []).reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.price || 0)), 0);
  const totalUniqueProducts = (hkd.tonkhoMain || []).filter(i => parseFloat(i.quantity) > 0).length;

  // Tính tổng CK và Thuế từ tonkhoMain + tonkhoCK
  const tongHang = (hkd.tonkhoMain || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongCK = (hkd.tonkhoCK || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongSauCK = tongHang - Math.abs(tongCK);
  const tongThue = (hkd.tonkhoMain || []).reduce((s, i) => {
    const a = parseFloat(i.amount) || 0;
    const t = parseFloat(i.taxRate) || 0;
    return s + a * (t / 100);
  }, 0);
  const tyLe = tongHang > 0 ? tongSauCK / tongHang : 0;
  const thueSauCK = tongThue * tyLe;

  /* ---------- 2. XUẤT HÀNG ---------- */
  // Tính tổng xuất kho từ xuatkhoMain
  const totalXuatQty = (hkd.xuatkhoMain || []).reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
  const totalXuatValue = (hkd.xuatkhoMain || []).reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.price || 0)), 0);
  const totalXuatUniqueProducts = (hkd.xuatkhoMain || []).filter(i => parseFloat(i.quantity) > 0).length;

  // Tính tổng CK và Thuế từ xuatkhoMain + xuatkhoCK
  const tongXuatHang = (hkd.xuatkhoMain || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongXuatCK = (hkd.xuatkhoCK || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongXuatSauCK = tongXuatHang - Math.abs(tongXuatCK);
  const tongXuatThue = (hkd.xuatkhoMain || []).reduce((s, i) => {
    const a = parseFloat(i.amount) || 0;
    const t = parseFloat(i.taxRate) || 0;
    return s + a * (t / 100);
  }, 0);
  const tyLeXuat = tongXuatHang > 0 ? tongXuatSauCK / tongXuatHang : 0;
  const thueXuatSauCK = tongXuatThue * tyLeXuat;

  // Xác định tab nào active dựa trên activeTabId
  const isTonkhoActive = !activeTabId || activeTabId === `${taxCode}-tonkho`;
  const isXuathangActive = activeTabId === `${taxCode}-xuathang`;
  const isTonkhoThucTeActive = activeTabId === `${taxCode}-tonkhothucte`;

  /* ---------- 3. HTML KHUNG ---------- */
  const html = `
    <!-- DÒNG TÊN CÔNG TY -->
    ${companyInfo}

    <!-- TAB TỒN KHO (có sidebar bên trong) -->
    <div id="${taxCode}-tonkho" class="tab-content ${isTonkhoActive ? 'active' : ''} hkd-section" style="${isTonkhoActive ? '' : 'display:none;'}">
      <div class="tonkho-layout">
        <!-- SIDEBAR HKD nằm trong tab Tồn kho -->
        <div class="tonkho-sidebar" id="tonkhoSidebar">
          <div class="tonkho-sidebar-header">
            <h3>📋 Danh sách HKD</h3>
            <div class="tonkho-sidebar-actions">
              <button class="btn-file" onclick="document.getElementById('zipFile').click()" title="Chọn file ZIP hóa đơn">📁 Chọn file</button>
              <input type="file" id="zipFile" accept=".zip" multiple style="display:none;" onchange="handleZipFileChange(event)">
              <button class="btn-misa" onclick="document.getElementById('misaExcelFile').click()" title="Import Excel MISA để đồng bộ mã hàng">📥 Import MISA</button>
              <input type="file" id="misaExcelFile" accept=".xlsx,.xls" style="display:none;" onchange="handleMisaFileChange(event)">
            </div>
          </div>
          <ul id="businessList"></ul>
        </div>

        <!-- NỘI DUNG TỒN KHO -->
        <div class="tonkho-content">
          <div class="summary-grid">
            <div class="summary-box">
              <div class="label">📦 Tổng SL tồn kho</div>
              <div class="value" id="inv-qty" style="font-weight:bold; color:#1976d2;">${formatQuantity(totalInvQty)}</div>
            </div>
            <div class="summary-box">
              <div class="label">📊 Số SP tồn kho</div>
              <div class="value" id="inv-product-count" style="font-weight:bold; color:#6a1b9a;">${totalUniqueProducts}</div>
            </div>
            <div class="summary-box">
              <div class="label">💰 Tiền tồn kho (thực tế)</div>
              <div class="value" id="inv-value" style="color:#2e7d32; font-weight:bold;">${window.formatCurrencyVN(totalInvValue)}</div>
            </div>
            <div class="summary-box">
              <div class="label">🔻 Tổng CK</div>
              <div class="value" id="inv-total-ck" style="color:#d32f2f; font-weight:bold;">${Math.abs(tongCK).toLocaleString()} đ</div>
            </div>
            <div class="summary-box">
              <div class="label">💸 Tổng Thuế</div>
              <div class="value" id="inv-total-tax" style="color:#e65100; font-weight:bold;">${Math.round(thueSauCK).toLocaleString()} đ</div>
            </div>
          </div>

          <div class="tonkho-tab-buttons">
            <div style="display:flex;gap:10px;">
              <button onclick="switchTonKhoTab('main')">Hàng hóa</button>
              <button onclick="switchTonKhoTab('km')">Khuyến mại</button>
              <button onclick="switchTonKhoTab('ck')">Chiết khấu</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="exportAllInventoryToExcel('${taxCode}')">Xuất Excel</button>
              <button onclick="exportSuppliersExcel('${taxCode}')"
                      style="background:#17a2b8;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:0.85em;">
                🏭 Danh mục NCC
              </button>
              <button onclick="exportMaterialsExcel('${taxCode}')"
                      style="background:#6f42c1;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:0.85em;">
                📦 Danh mục VTHH
              </button>
              <button onclick="exportPurchaseExcel('${taxCode}')"
                      style="background:#fd7e14;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:0.85em;">
                📄 Mua hàng trong nước
              </button>
              <button onclick="exportAllExcel('${taxCode}')"
                      style="background:#dc3545;color:white;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:0.85em;font-weight:bold;">
                📤 Xuất tất cả (3 file)
              </button>
            </div>
          </div>

          <div style="margin-top:20px">
            <div id="tonKho-main"></div>
            <div id="tonKho-km" style="display:none;"></div>
            <div id="tonKho-ck" style="display:none;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB XUẤT HÀNG (giống hệt cấu trúc tồn kho - có sidebar + nút import) -->
    <div id="${taxCode}-xuathang" class="tab-content ${isXuathangActive ? 'active' : ''}" style="${isXuathangActive ? '' : 'display:none;'}">
      <div class="tonkho-layout">
        <!-- SIDEBAR HKD (dùng chung id để mobile toggle hoạt động) -->
        <div class="tonkho-sidebar" id="tonkhoSidebarXuat">
          <div class="tonkho-sidebar-header">
            <h3>📋 Danh sách HKD</h3>
            <div class="tonkho-sidebar-actions">
              <button class="btn-file" onclick="document.getElementById('xuatkhoZipFile').click()" title="Chọn file ZIP hóa đơn xuất kho">📁 Chọn file xuất</button>
              <input type="file" id="xuatkhoZipFile" accept=".zip" multiple style="display:none;" onchange="handleXuatKhoFileChange(event)">
            </div>
          </div>
          <ul id="businessListXuat"></ul>
        </div>

        <!-- NỘI DUNG XUẤT KHO -->
        <div class="tonkho-content">
          <!-- Summary grid cho xuất kho -->
          <div class="summary-grid">
            <div class="summary-box">
              <div class="label">📦 Tổng SL xuất kho</div>
              <div class="value" id="xuat-qty" style="font-weight:bold; color:#1976d2;">${formatQuantity(totalXuatQty)}</div>
            </div>
            <div class="summary-box">
              <div class="label">📊 Số SP xuất kho</div>
              <div class="value" id="xuat-product-count" style="font-weight:bold; color:#6a1b9a;">${totalXuatUniqueProducts}</div>
            </div>
            <div class="summary-box">
              <div class="label">💰 Tiền xuất kho (thực tế)</div>
              <div class="value" id="xuat-value" style="color:#2e7d32; font-weight:bold;">${window.formatCurrencyVN(totalXuatValue)}</div>
            </div>
            <div class="summary-box">
              <div class="label">🔻 Tổng CK</div>
              <div class="value" id="xuat-total-ck" style="color:#d32f2f; font-weight:bold;">${Math.abs(tongXuatCK).toLocaleString()} đ</div>
            </div>
            <div class="summary-box">
              <div class="label">💸 Tổng Thuế</div>
              <div class="value" id="xuat-total-tax" style="color:#e65100; font-weight:bold;">${Math.round(thueXuatSauCK).toLocaleString()} đ</div>
            </div>
          </div>

          <!-- Nút chuyển tab xuất kho -->
          <div style="margin:15px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <div style="display:flex;gap:10px;">
              <button class="xuatkho-tab-btn active" data-tab="main" onclick="switchXuatKhoTab('main')">Hàng hóa</button>
              <button class="xuatkho-tab-btn" data-tab="km" onclick="switchXuatKhoTab('km')">Khuyến mại</button>
              <button class="xuatkho-tab-btn" data-tab="ck" onclick="switchXuatKhoTab('ck')">Chiết khấu</button>
            </div>
          </div>

          <!-- Container cho xuất kho -->
          <div style="margin-top:20px">
            <div id="xuatKho-main"></div>
            <div id="xuatKho-km" style="display:none;"></div>
            <div id="xuatKho-ck" style="display:none;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB TỒN KHO THỰC TẾ -->
    <div id="${taxCode}-tonkhothucte" class="tab-content ${isTonkhoThucTeActive ? 'active' : ''}" style="${isTonkhoThucTeActive ? '' : 'display:none;'}">
      <div class="tonkho-layout">
        <!-- SIDEBAR HKD (dùng chung) -->
        <div class="tonkho-sidebar" id="tonkhoSidebarThucTe">
          <div class="tonkho-sidebar-header">
            <h3>📋 Danh sách HKD</h3>
          </div>
          <ul id="businessListThucTe"></ul>
        </div>

        <!-- NỘI DUNG TỒN KHO THỰC TẾ -->
        <div class="tonkho-content">
          <div id="tonkhoThucTeContent">
            <p style="text-align:center;padding:20px;color:#999;">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('hkdInfo').innerHTML = html;

  /* ---------- 4. RENDER + CẬP NHẬT ---------- */
  if (isXuathangActive) {
    // Nếu đang ở tab xuất hàng, render xuất kho
    window.renderXuatKhoTab(taxCode, 'main');
  } else if (isTonkhoThucTeActive) {
    // Nếu đang ở tab tồn kho thực tế
    if (typeof window.renderTonKhoThucTeTab === 'function') {
      window.renderTonKhoThucTeTab(taxCode);
    }
  } else {
    // Mặc định render tồn kho
    window.renderTonKhoTab(taxCode, 'main');
    updateMainTotalDisplay(taxCode);
  }

  /* ---------- 5. RENDER LẠI DANH SÁCH HKD VÀO SIDEBAR ---------- */
  window.renderHKDList();
}

function openTab(evt, tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (!target) return window.showToast(`Không tìm thấy tab ${tabId}`,3000,'error');
  target.style.display = 'block';
  evt?.currentTarget?.classList.add('active');

  const taxCode = tabId.split('-')[0];

  // Cập nhật biến toàn cục _activeMainTab
  if (tabId.includes('tonkhothucte')) {
    _activeMainTab = 'tonkhothucte';
    if (typeof window.renderTonKhoThucTeTab === 'function') {
      window.renderTonKhoThucTeTab(taxCode);
    }
  } else if (tabId.includes('tonkho')) {
    _activeMainTab = 'tonkho';
    window.renderTonKhoTab(taxCode, 'main');
  }
  if (tabId.includes('xuathang')) {
    _activeMainTab = 'xuathang';
    window.renderXuatKhoTab(taxCode, 'main');
  }
}

// Hàm chuyển tab chính từ header (được gọi từ index.html)
function switchMainTabGlobal(tabName) {
  if (!currentTaxCode) {
    if (hkdOrder.length > 0) {
      currentTaxCode = hkdOrder[0];
    } else {
      return;
    }
  }
  // Cập nhật _activeMainTab
  _activeMainTab = tabName;
  // Cập nhật active class cho header buttons
  document.querySelectorAll('.header-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  // Render lại tab với keepTab tương ứng
  window.renderHKDTab(currentTaxCode, tabName);
}

async function initApp() {
  if (window.innerWidth < 768) {
    document.body.classList.add('compact-mode');
  }

  // Đăng ký tất cả các hàm toàn cục TRƯỚC khi gọi render
  window.handleFiles = handleFiles;
  window.renderHKDTab = renderHKDTab;
  window.renderTonKhoTab = renderTonKhoTab;
  window.startEditProduct = startEditProduct;
  window.confirmEditProduct = confirmEditProduct;
  window.cancelEditProduct = cancelEditProduct;
  window.createTonKhoItem = createTonKhoItem;
  window.deleteTonKhoItem = deleteTonKhoItem;
  window.moveTonKhoItem = moveTonKhoItem;
  window.clearAll = clearAll;
  window.showLogHistory = showLogHistory;
  window.undoAction = undoAction;
  window.openTab = openTab;
  window.switchTonKhoTab = switchTonKhoTab;
  window.deleteZeroStock = deleteZeroStock;
  window.deleteStockItem = deleteStockItem;
  window.ensureHkdData = ensureHkdData;
  window.mergeDuplicateItems = mergeDuplicateItems;
  window.handleZipFileChange = handleZipFileChange;
  window.handleMisaFileChange = handleMisaFileChange;
  window.handleFilesFromInput = handleFilesFromInput;
  window.handleXuatKhoFileChange = handleXuatKhoFileChange;
  window.renderXuatKhoTab = renderXuatKhoTab;
  window.switchXuatKhoTab = switchXuatKhoTab;
  window.startXuatEditProduct = startXuatEditProduct;
  window.confirmXuatEditProduct = confirmXuatEditProduct;
  window.cancelXuatEditProduct = cancelXuatEditProduct;
  window.createXuatKhoItem = createXuatKhoItem;
  window.deleteXuatKhoItem = deleteXuatKhoItem;
  window.deleteXuatStockItem = deleteXuatStockItem;
  window.moveXuatKhoItemPrompt = moveXuatKhoItemPrompt;
  window.toggleXuatSelectAll = toggleXuatSelectAll;
  window.updateXuatSelectedCount = updateXuatSelectedCount;
  window.batchXuatDeleteItems = batchXuatDeleteItems;
  window.batchXuatMoveItems = batchXuatMoveItems;
  window.batchXuatMergeItems = batchXuatMergeItems;
  window.autoMergeXuatKhoDuplicates = autoMergeXuatKhoDuplicates;
  window.renderTonKhoThucTeTab = renderTonKhoThucTeTab;
  window.calculateTonKhoThucTe = calculateTonKhoThucTe;
  window.showTTComparePopup = showTTComparePopup;
  window.showTTManualPopup = showTTManualPopup;
  window.confirmTTMatch = confirmTTMatch;
  window.rejectTTMatch = rejectTTMatch;
  window.confirmTTManual = confirmTTManual;
  window.selectTTManualItem = selectTTManualItem;
  window.applyTTFilter = applyTTFilter;
  window.resetTTFilter = resetTTFilter;
  window.toggleTTSortDir = toggleTTSortDir;
  window.debounceTTFilter = debounceTTFilter;
  window.onTTDragStart = onTTDragStart;
  window.onTTDragEnd = onTTDragEnd;
  window.onTTDragOver = onTTDragOver;
  window.onTTDrop = onTTDrop;
  window.showQuickMatchPopup = showQuickMatchPopup;
  window.quickMatchConfirm = quickMatchConfirm;
  window.batchMatchSelected = batchMatchSelected;
  window.toggleTTSelectAll = toggleTTSelectAll;
  window.toggleTTSelectItem = toggleTTSelectItem;
  window.escapeHtml = escapeHtml;
  window.showTTMatchHistoryPopup = showTTMatchHistoryPopup;
  window.showTTMatchDetailPopup = showTTMatchDetailPopup;
  window.filterTTDetailItems = filterTTDetailItems;
  window.selectTTDetailItem = selectTTDetailItem;
  window.confirmTTDetail = confirmTTDetail;
  window.showTTMatchDetailPopupReverse = showTTMatchDetailPopupReverse;
  window.filterTTDetailItemsReverse = filterTTDetailItemsReverse;
  window.selectTTDetailItemReverse = selectTTDetailItemReverse;
  window.confirmTTDetailReverse = confirmTTDetailReverse;
  window.loadManualMatchCacheReverse = loadManualMatchCacheReverse;
  window.saveManualMatchCacheReverse = saveManualMatchCacheReverse;
  window.getTonkhoItemKey = getTonkhoItemKey;
  window.findTopSuggestionsReverse = findTopSuggestionsReverse;
  window.quickEditXuatProductCode = quickEditXuatProductCode;
  window.changeXuatKhoPage = changeXuatKhoPage;
  window.toggleXuatKhoShowAll = toggleXuatKhoShowAll;
  window.switchMainTabGlobal = switchMainTabGlobal;
  window.showEmptyState = showEmptyState;

  if (typeof closeInvoicePopup !== 'undefined') {
    window.closeInvoicePopup = closeInvoicePopup;
  }

  await window.loadDataFromLocalStorage();

  // Nếu có dữ liệu HKD, render tab đầu tiên để tạo sidebar trước
  if (hkdOrder.length > 0) {
    window.renderHKDTab(hkdOrder[0]);
    window.renderHKDList();
  } else {
    // Hiển thị giao diện mặc định với nút import
    showEmptyState();
  }
}

function showEmptyState() {
  const hkdInfo = document.getElementById('hkdInfo');
  if (!hkdInfo) return;
  hkdInfo.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:40px;">
      <div style="font-size:4em;margin-bottom:20px;">📂</div>
      <h2 style="color:var(--text-primary,#1e293b);margin-bottom:12px;">Chưa có dữ liệu</h2>
      <p style="color:var(--text-secondary,#64748b);margin-bottom:30px;max-width:400px;">
        Vui lòng import file ZIP hóa đơn để bắt đầu. Hỗ trợ file ZIP chứa XML hóa đơn điện tử.
      </p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
        <button onclick="document.getElementById('zipFileOutput').click()"
          style="padding:14px 28px;background:linear-gradient(135deg,#1976d2,#2196f3);color:#fff;border:none;border-radius:12px;font-size:1.1em;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(33,150,243,0.3);transition:all 0.25s ease;">
          📁 Import tồn kho
        </button>
        <button onclick="document.getElementById('xuatkhoZipFileOutput').click()"
          style="padding:14px 28px;background:linear-gradient(135deg,#e65100,#ff9800);color:#fff;border:none;border-radius:12px;font-size:1.1em;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(255,152,0,0.3);transition:all 0.25s ease;">
          📤 Import xuất kho
        </button>
      </div>
      <input type="file" id="zipFileOutput" accept=".zip" multiple style="display:none;" onchange="handleZipFileChange(event)">
      <input type="file" id="xuatkhoZipFileOutput" accept=".zip" multiple style="display:none;" onchange="handleXuatKhoFileChange(event)">
      <p style="color:var(--text-muted,#94a3b8);margin-top:24px;font-size:0.85em;">
        Sau khi import, dữ liệu sẽ hiển thị tự động
      </p>
    </div>
  `;
}

window.showPopup = function(html, title = '', onClose = null) {
  // XÓA POPUP CŨ NẾU CÓ
  const oldWrapper = document.getElementById('invoicePopupWrapper');
  if (oldWrapper) oldWrapper.remove();

  // TẠO WRAPPER MỚI - FIXED + Z-INDEX CAO
  const wrapper = document.createElement('div');
  wrapper.id = 'invoicePopupWrapper';
  wrapper.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    overflow: auto;
  `;

  wrapper.innerHTML = `
    <div class="popup" style="
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      width: 90%;
      max-width: 1100px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    ">
      <div class="popup-header" style="
        padding: 16px 20px;
        background: #1976d2;
        color: white;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>${title}</div>
        <button onclick="window.closePopup()" style="
          background:none; border:none; color:white; font-size:1.5em; cursor:pointer; padding:0; width:30px; height:30px;
        ">×</button>
      </div>
      <div class="popup-body" style="flex:1; overflow:auto; padding:0;">
        ${html}
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  // HÀM ĐÓNG
  window.closePopup = function() {
    wrapper.remove();
    if (onClose) onClose();
  };

  // ĐÓNG KHI CLICK NỀN
  wrapper.addEventListener('click', function(e) {
    if (e.target === wrapper) window.closePopup();
  });
};

window.closePopup = function() {
  const wrapper = document.getElementById('invoicePopupWrapper');
  if (wrapper) wrapper.remove();
};

function updateMainTotalDisplay(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) return;

  // === 1. TỒN KHO HIỆN TẠI (THỰC TẾ) ===
  let currentQty = 0;
  let currentValue = 0;
  (hkd.tonkhoMain || []).forEach(item => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    currentQty += qty;
    currentValue += qty * price;
  });

  // === 2. SỐ SP TỒN KHO (SL > 0) ===
  const totalUniqueProducts = (hkd.tonkhoMain || []).filter(i => parseFloat(i.quantity) > 0).length;

  // === 3. TỔNG CK VÀ THUẾ ===
  const tongHang = (hkd.tonkhoMain || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongCK = (hkd.tonkhoCK || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tongSauCK = tongHang - Math.abs(tongCK);
  const tongThue = (hkd.tonkhoMain || []).reduce((s, i) => {
    const a = parseFloat(i.amount) || 0;
    const t = parseFloat(i.taxRate) || 0;
    return s + a * (t / 100);
  }, 0);
  const tyLe = tongHang > 0 ? tongSauCK / tongHang : 0;
  const thueSauCK = tongThue * tyLe;

  // === 4. CẬP NHẬT GIAO DIỆN ===
  if (currentTaxCode === taxCode) {
    const el = (id) => document.getElementById(id);
    if (el('inv-qty')) el('inv-qty').textContent = formatQuantity(currentQty);
    if (el('inv-product-count')) el('inv-product-count').textContent = totalUniqueProducts;
    if (el('inv-value')) el('inv-value').textContent = window.formatCurrencyVN(currentValue);
    if (el('inv-total-ck')) el('inv-total-ck').textContent = Math.abs(tongCK).toLocaleString() + ' đ';
    if (el('inv-total-tax')) el('inv-total-tax').textContent = Math.round(thueSauCK).toLocaleString() + ' đ';
  }
}

// Các hàm gộp HKD (openMergePopup, executeMerge, mergeInventoryArray, drag-drop helpers) đã được chuyển sang merge-hkd.js

document.addEventListener('DOMContentLoaded', initApp);