// exportExcel.js - Xuất dữ liệu từ UI ra 3 file Excel mẫu AMIS Accounting
// ============================================================

/**
 * Ánh xạ dữ liệu UI -> 3 file Excel mẫu:
 * 
 * 1. Mau_danh_muc_nha_cung_cap.xls  (Danh mục nhà cung cấp)
 *    -> Dữ liệu từ: hkdData[taxCode].invoices[].sellerInfo
 *    -> Cột bắt buộc (*): Mã nhà cung cấp, Tên nhà cung cấp
 * 
 * 2. Mau_danh_muc_vat_tu_hang_hoa.xls (Danh mục vật tư hàng hóa)
 *    -> Dữ liệu từ: hkdData[taxCode].tonkhoMain (hàng hóa tồn kho)
 *    -> Cột bắt buộc (*): Mã, Tên, Mã nhóm ngành nghề
 *    -> Mã hàng format: HH001, HH002, ...
 * 
 * 3. Mua_hang_trong_nuoc.xls (Chứng từ mua hàng)
 *    -> Dữ liệu từ: hkdData[taxCode].invoices (hóa đơn mua vào)
 *    -> Cột bắt buộc (*): Ngày hạch toán, Ngày chứng từ, Số phiếu nhập, Mã hàng
 *    -> Mã hàng ĐỒNG BỘ với file VTHH (cùng HHxxx)
 */

// ============================================================
// BIẾN TOÀN CỤC: Lưu mapping mã hàng để đồng bộ giữa các file
// ============================================================
let _productCodeCounter = 0;
let _productCodeMap = {}; // { "tên hàng|đvt": "HH001" }

function resetProductCodeMap() {
  _productCodeCounter = 0;
  _productCodeMap = {};
}

function getProductCode(name, unit) {
  const key = (name || '').trim().toLowerCase() + '|' + (unit || '').trim().toLowerCase();
  if (!_productCodeMap[key]) {
    _productCodeCounter++;
    _productCodeMap[key] = 'HH' + String(_productCodeCounter).padStart(3, '0');
  }
  return _productCodeMap[key];
}

/**
 * Đăng ký mã sản phẩm có sẵn (từ productCode thực tế) vào map để đồng bộ
 * Nếu key name|unit đã tồn tại trong map, giữ nguyên mã cũ
 * Nếu chưa, gán mã từ productCode thực tế
 */
function registerExistingProductCode(name, unit, productCode) {
  if (!productCode) return;
  const key = (name || '').trim().toLowerCase() + '|' + (unit || '').trim().toLowerCase();
  if (!_productCodeMap[key]) {
    _productCodeMap[key] = productCode;
    // Cập nhật counter nếu mã mới có số > counter hiện tại
    const match = productCode.match(/^HH(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > _productCodeCounter) _productCodeCounter = num;
    }
  }
}

// ============================================================
// ĐỊNH DẠNG EXCEL CHUYÊN NGHIỆP
// ============================================================
const STYLE = {
  // --- Màu sắc chủ đạo ---
  colors: {
    headerBg: '4472C4',       // Xanh đậm
    headerFg: 'FFFFFF',       // Trắng
    titleFg: '1F4E79',        // Xanh navy
    guideFg: '808080',        // Xám
    border: 'B4C6E7',         // Xanh nhạt
    dataBorder: 'D9D9D9',    // Xám nhạt
    altRow: 'D6E4F0',        // Xanh nhạt cho dòng xen kẽ
    white: 'FFFFFF'
  },

  // Header chính: nền xanh đậm, chữ trắng đậm, canh giữa
  header: {
    fill: { fgColor: { rgb: '4472C4' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'B4C6E7' } },
      bottom: { style: 'thin', color: { rgb: 'B4C6E7' } },
      left: { style: 'thin', color: { rgb: 'B4C6E7' } },
      right: { style: 'thin', color: { rgb: 'B4C6E7' } }
    }
  },

  // Header phụ (merged): nền xanh nhạt hơn
  headerSub: {
    fill: { fgColor: { rgb: '5B9BD5' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'B4C6E7' } },
      bottom: { style: 'thin', color: { rgb: 'B4C6E7' } },
      left: { style: 'thin', color: { rgb: 'B4C6E7' } },
      right: { style: 'thin', color: { rgb: 'B4C6E7' } }
    }
  },

  // Tiêu đề file
  title: {
    font: { bold: true, sz: 13, name: 'Calibri', color: { rgb: '1F4E79' } }
  },

  // Hướng dẫn
  guide: {
    font: { italic: true, color: { rgb: '808080' }, sz: 9, name: 'Calibri' }
  },

  // Dữ liệu text
  data: {
    font: { sz: 10, name: 'Calibri' },
    alignment: { vertical: 'center', wrapText: false },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  },

  // Dữ liệu text xen kẽ (nền xanh nhạt)
  dataAlt: {
    font: { sz: 10, name: 'Calibri' },
    fill: { fgColor: { rgb: 'D6E4F0' } },
    alignment: { vertical: 'center', wrapText: false },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  },

  // Số nguyên: căn phải, định dạng #,##0
  number: {
    font: { sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  },

  // Số nguyên xen kẽ
  numberAlt: {
    font: { sz: 10, name: 'Calibri' },
    fill: { fgColor: { rgb: 'D6E4F0' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  },

  // Số thập phân: 2 chữ số
  decimal: {
    font: { sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0.00',
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  },

  // Số thập phân xen kẽ
  decimalAlt: {
    font: { sz: 10, name: 'Calibri' },
    fill: { fgColor: { rgb: 'D6E4F0' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0.00',
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  }
};

// ============================================================
// HÀM TIỆN ÍCH: Áp dụng style
// ============================================================
function setCell(ws, addr, value, style) {
  const cell = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  if (style) cell.s = style;
  ws[addr] = cell;
}

function applyStyle(ws, startRow, endRow, startCol, endCol, style, isAlt) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      // Nếu là số, dùng style number tương ứng
      if (ws[addr].t === 'n') {
        ws[addr].s = (isAlt && (r % 2 === 0)) ? 
          (style === STYLE.data ? STYLE.numberAlt : STYLE.numberAlt) : 
          (style === STYLE.data ? STYLE.number : STYLE.number);
      } else {
        ws[addr].s = (isAlt && (r % 2 === 0)) ? STYLE.dataAlt : STYLE.data;
      }
    }
  }
}

// ============================================================
// 1. XUẤT DANH MỤC NHÀ CUNG CẤP
// ============================================================
function exportSuppliersExcel(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) { window.showToast('❌ Không tìm thấy dữ liệu HKD', 3000, 'error'); return; }

  const supplierMap = new Map();
  (hkd.invoices || []).forEach(inv => {
    const seller = inv.sellerInfo;
    if (seller && seller.name) {
      const key = seller.taxCode || seller.name;
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          code: seller.taxCode || `NCC_${supplierMap.size + 1}`,
          name: seller.name,
          address: seller.address || '',
          taxCode: seller.taxCode || '',
          group: ''
        });
      }
    }
  });

  if (supplierMap.size === 0) {
    window.showToast('❌ Không có dữ liệu nhà cung cấp để xuất', 3000, 'error');
    return;
  }

  const suppliers = Array.from(supplierMap.values());
  const ws = XLSX.utils.aoa_to_sheet(buildSupplierData(suppliers));

  // Cột widths
  ws['!cols'] = [
    { wch: 24 },  // A: Mã NCC
    { wch: 42 },  // B: Tên NCC
    { wch: 48 },  // C: Địa chỉ
    { wch: 18 },  // D: MST
    { wch: 24 }   // E: Mã nhóm NCC
  ];

  // Style
  setCell(ws, 'A1', ws.A1.v, STYLE.title);
  for (let r = 2; r <= 6; r++) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
    setCell(ws, addr, ws[addr].v, STYLE.guide);
  }
  // Header row (index 7)
  for (let c = 0; c <= 4; c++) {
    const addr = XLSX.utils.encode_cell({ r: 7, c });
    setCell(ws, addr, ws[addr].v, STYLE.header);
  }
  // Data rows với xen kẽ màu
  for (let r = 8; r < wsDataLength(ws); r++) {
    const isAlt = r % 2 === 0;
    for (let c = 0; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = isAlt ? STYLE.dataAlt : STYLE.data;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục NCC');
  XLSX.writeFile(wb, `danh_muc_nha_cung_cap_${taxCode}.xlsx`);
  window.showToast(`✅ Đã xuất ${suppliers.length} nhà cung cấp`, 3000, 'success');
}

function buildSupplierData(suppliers) {
  const data = [
    ['FILE MẪU DANH SÁCH NHÀ CUNG CẤP ĐỂ NHẬP VÀO PHẦN MỀM AMIS ACCOUNTING'],
    ['Hướng dẫn:'],
    ['- Điền dữ liệu vào các cột tương ứng trên file này'],
    ['- Các cột có dấu (*) là những cột bắt buộc'],
    ['- Nếu muốn nhập nhiều thông tin hơn người dùng có thể tải mẫu đầy đủ/hoặc tự thêm cột trên mẫu cơ bản'],
    ['- Các dòng dữ liệu phía dưới chỉ là ví dụ minh họa'],
    [],
    ['Mã nhà cung cấp (*)', 'Tên nhà cung cấp (*)', 'Địa chỉ', 'Mã số thuế', 'Mã nhóm nhà cung cấp']
  ];
  suppliers.forEach(s => data.push([s.code, s.name, s.address, s.taxCode, s.group]));
  return data;
}

// ============================================================
// 2. XUẤT DANH MỤC VẬT TƯ HÀNG HÓA (Mã: HH001, HH002...)
// ============================================================
function exportMaterialsExcel(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) { window.showToast('❌ Không tìm thấy dữ liệu HKD', 3000, 'error'); return; }

  // Reset mã hàng để bắt đầu từ HH001
  resetProductCodeMap();

  const allItems = [
    ...(hkd.tonkhoMain || []).map(p => ({ ...p, kho: 'Hàng hóa' })),
    ...(hkd.tonkhoKM || []).map(p => ({ ...p, kho: 'Khuyến mại' })),
    ...(hkd.tonkhoCK || []).map(p => ({ ...p, kho: 'Chiết khấu' })),
  ];

  if (allItems.length === 0) {
    window.showToast('❌ Không có dữ liệu hàng hóa để xuất', 3000, 'error');
    return;
  }

  // Đăng ký mã sản phẩm thực tế (đã đồng bộ MISA hoặc đã sửa) vào map trước
  allItems.forEach(item => {
    if (item.productCode) {
      registerExistingProductCode(item.name, item.unit, item.productCode);
    }
  });

  // Gán mã cho từng item: ưu tiên productCode thực tế, fallback sinh HHxxx mới
  allItems.forEach(item => {
    if (item.productCode) {
      // Dùng mã thực tế (đã đồng bộ MISA hoặc đã sửa tay)
      item._code = item.productCode;
      // Đảm bảo map đã có mã này
      registerExistingProductCode(item.name, item.unit, item.productCode);
    } else {
      // Sinh mã mới nếu chưa có
      item._code = getProductCode(item.name, item.unit);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(buildMaterialData(allItems));

  ws['!cols'] = [
    { wch: 12 },  // A: Mã
    { wch: 38 },  // B: Tên
    { wch: 18 },  // C: Tính chất
    { wch: 14 },  // D: ĐVT
    { wch: 16 },  // E: Mã nhóm VTHH
    { wch: 18 },  // F: Thuế suất GTGT
    { wch: 18 },  // G: % thuế suất KHAC
    { wch: 18 },  // H: Đơn giá bán
    { wch: 55 }   // I: Mã nhóm ngành nghề
  ];

  // Style
  setCell(ws, 'A1', ws.A1.v, STYLE.title);
  for (let r = 2; r <= 6; r++) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
    setCell(ws, addr, ws[addr].v, STYLE.guide);
  }
  // Header
  for (let c = 0; c <= 8; c++) {
    const addr = XLSX.utils.encode_cell({ r: 7, c });
    setCell(ws, addr, ws[addr].v, STYLE.header);
  }
  // Data rows
  for (let r = 8; r < wsDataLength(ws); r++) {
    const isAlt = r % 2 === 0;
    for (let c = 0; c <= 8; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      // Cột H (Đơn giá bán) - số
      if (c === 7 && typeof ws[addr].v === 'number') {
        ws[addr].s = isAlt ? STYLE.numberAlt : STYLE.number;
      }
      // Cột F (Thuế suất) - số
      else if (c === 5 && typeof ws[addr].v === 'number') {
        ws[addr].s = isAlt ? STYLE.numberAlt : STYLE.number;
      }
      // Cột text
      else {
        ws[addr].s = isAlt ? STYLE.dataAlt : STYLE.data;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh mục VTHH');
  XLSX.writeFile(wb, `danh_muc_vat_tu_hang_hoa_${taxCode}.xlsx`);
  window.showToast(`✅ Đã xuất ${allItems.length} mặt hàng`, 3000, 'success');
}

function buildMaterialData(items) {
  const data = [
    ['FILE MẪU DANH SÁCH VẬT TƯ HÀNG HÓA ĐỂ NHẬP VÀO PHẦN MỀM AMIS ACCOUNTING'],
    ['Hướng dẫn:'],
    ['- Điền dữ liệu vào các cột tương ứng trên file này'],
    ['- Các cột có dấu (*) là những cột bắt buộc'],
    ['- Nếu muốn nhập nhiều thông tin hơn người dùng có thể tải mẫu đầy đủ hoặc thêm cột trên mẫu cơ bản'],
    ['- Các dòng dữ liệu phía dưới chỉ là ví dụ minh họa'],
    [],
    ['Mã (*)', 'Tên (*)', 'Tính chất', 'Đơn vị tính chính', 'Mã nhóm VTHH', 'Thuế suất GTGT (%)', '% thuế suất KHAC', 'Đơn giá bán', 'Mã nhóm ngành nghề (*)']
  ];
  items.forEach(item => {
    const taxRate = item.taxRate !== undefined && item.taxRate !== '' ? item.taxRate : '';
    const sellPrice = parseFloat(item.sellPrice || item.price || 0);
    const tinhChat = item.kho === 'Khuyến mại' ? 'Khuyến mại' :
                     item.kho === 'Chiết khấu' ? 'Chiết khấu' : 'Hàng hóa';
    
    data.push([
      item._code,                       // A: Mã HHxxx
      item.name || '',                  // B: Tên
      tinhChat,                         // C: Tính chất
      item.unit || '',                  // D: ĐVT
      item.groupCode || '',             // E: Mã nhóm VTHH
      taxRate,                          // F: Thuế suất
      '',                               // G: % thuế suất KHAC
      sellPrice > 0 ? sellPrice : '',   // H: Đơn giá bán (số)
      '101 - Hoạt động bán buôn, bán lẻ các loại hàng hóa (trừ giá trị hàng hóa đại lý bán đúng giá hưởng hoa hồng);'
    ]);
  });
  return data;
}

// ============================================================
// 3. XUẤT CHỨNG TỪ MUA HÀNG TRONG NƯỚC
// ============================================================
function exportPurchaseExcel(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) { window.showToast('❌ Không tìm thấy dữ liệu HKD', 3000, 'error'); return; }

  const invoices = hkd.invoices || [];
  if (invoices.length === 0) {
    window.showToast('❌ Không có hóa đơn mua vào để xuất', 3000, 'error');
    return;
  }

  // Reset mã hàng để đồng bộ với file VTHH
  resetProductCodeMap();
  // Pre-populate map từ tonkho để đồng bộ mã - ưu tiên productCode thực tế
  [hkd.tonkhoMain, hkd.tonkhoKM, hkd.tonkhoCK].forEach(arr => {
    (arr || []).forEach(item => {
      if (item.productCode) {
        // Dùng mã thực tế (đã đồng bộ MISA hoặc đã sửa)
        registerExistingProductCode(item.name, item.unit, item.productCode);
      } else {
        // Sinh mã mới nếu chưa có
        getProductCode(item.name, item.unit);
      }
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(buildPurchaseData(invoices));

  ws['!cols'] = [
    { wch: 30 },  // A
    { wch: 22 },  // B
    { wch: 24 },  // C
    { wch: 16 },  // D
    { wch: 16 },  // E
    { wch: 16 },  // F
    { wch: 24 },  // G
    { wch: 16 },  // H
    { wch: 16 },  // I
    { wch: 18 },  // J
    { wch: 38 },  // K
    { wch: 42 },  // L
    { wch: 18 },  // M
    { wch: 22 },  // N
    { wch: 20 },  // O
    { wch: 32 },  // P
    { wch: 12 },  // Q: Mã hàng HHxxx
    { wch: 32 },  // R
    { wch: 10 },  // S
    { wch: 12 },  // T
    { wch: 14 },  // U: Số lượng
    { wch: 18 },  // V: Đơn giá
    { wch: 20 },  // W: Thành tiền
    { wch: 14 },  // X
    { wch: 18 },  // Y
    { wch: 14 },  // Z
    { wch: 18 },  // AA
    { wch: 18 },  // AB: Tiền thuế
    { wch: 24 },  // AC: MCCQT
    { wch: 32 }   // AD
  ];

  // Merged cells: Q7:AB7, AC7:AD7
  ws['!merges'] = [
    { s: { r: 6, c: 16 }, e: { r: 6, c: 27 } },
    { s: { r: 6, c: 28 }, e: { r: 6, c: 29 } }
  ];

  // Style
  setCell(ws, 'A1', ws.A1.v, STYLE.title);
  for (let r = 2; r <= 6; r++) {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
    setCell(ws, addr, ws[addr].v, STYLE.guide);
  }
  // Row 7 merged headers
  setCell(ws, 'Q7', 'Chi tiết hàng tiền', STYLE.headerSub);
  setCell(ws, 'AC7', 'Thông tin bổ sung', STYLE.headerSub);
  // Row 8 main headers
  for (let c = 0; c <= 29; c++) {
    const addr = XLSX.utils.encode_cell({ r: 7, c });
    setCell(ws, addr, ws[addr].v, STYLE.header);
  }

  // Data rows
  for (let r = 8; r < wsDataLength(ws); r++) {
    const isAlt = r % 2 === 0;
    for (let c = 0; c <= 29; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      
      // Cột số: U(20)=SL, V(21)=ĐG, W(22)=TT, X(23)=CK%, Y(24)=CK, Z(25)=Thuế%, AB(27)=Tiền thuế
      const numCols = [20, 21, 22, 23, 24, 25, 27];
      if (numCols.includes(c) && typeof ws[addr].v === 'number') {
        ws[addr].s = isAlt ? STYLE.numberAlt : STYLE.number;
      } else {
        ws[addr].s = isAlt ? STYLE.dataAlt : STYLE.data;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mua hàng trong nước');
  XLSX.writeFile(wb, `mua_hang_trong_nuoc_${taxCode}.xlsx`);
  window.showToast(`✅ Đã xuất dữ liệu mua hàng`, 3000, 'success');
}

function buildPurchaseData(invoices) {
  const data = [
    ['FILE MẪU CHỨNG TỪ MUA HÀNG TRONG NƯỚC ĐỂ NHẬP VÀO PHẦN MỀM AMIS ACCOUNTING HKD'],
    ['Hướng dẫn:'],
    ['- Điền dữ liệu vào các cột tương ứng trên file này'],
    ['- Các cột có dấu (*) là những cột bắt buộc'],
    ['- Nếu muốn nhập nhiều thông tin hơn người dùng có thể tải mẫu đầy đủ/hoặc tự thêm cột trên mẫu cơ bản'],
    ['- Các dòng dữ liệu phía dưới chỉ là ví dụ minh họa'],
    ['Chi tiết hàng tiền',,,,,,,,,,,,,,,, 'Chi tiết hàng tiền',,,,,,,,,,,, 'Thông tin bổ sung', 'Thông tin bổ sung'],
    ['Hình thức mua hàng', 'Phương thức thanh toán', 'Nhận kèm hóa đơn', 'Ngày hạch toán (*)', 'Ngày chứng từ (*)', 'Số phiếu nhập (*)', 'Số chứng từ ghi nợ/Số chứng từ thanh toán', 'Số hóa đơn', 'Ngày hóa đơn', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Địa chỉ', 'Mã số thuế', 'Người giao hàng', 'Số tài khoản chi', 'Diễn giải', 'Mã hàng (*)', 'Tên hàng', 'Mã kho', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Tỷ lệ CK (%)', 'Tiền chiết khấu', '% thuế GTGT', '% thuế suất KHAC', 'Tiền thuế GTGT', 'Mã tra cứu HĐĐT', 'Đường dẫn tra cứu HĐĐT']
  ];

  invoices.forEach((inv, invIdx) => {
    const products = inv.products || [];
    const seller = inv.sellerInfo || {};
    const invInfo = inv.invoiceInfo || {};
    const invDate = invInfo.date || '';
    const invNumber = invInfo.number || '';
    const mccqt = invInfo.mccqt || '';

    products.forEach((p, pIdx) => {
      const qty = parseFloat(p.quantity) || 0;
      const price = parseFloat(p.price) || 0;
      const amount = parseFloat(p.amount) || (qty * price);
      const taxRate = p.taxRate || 0;
      const taxAmount = Math.round(amount * taxRate / 100);
      const discount = parseFloat(p.discount) || parseFloat(p.lineDiscount) || 0;
      const discountRate = discount > 0 && amount > 0 ? Math.round((discount / amount) * 100) : 0;

      // Mã hàng HHxxx - ĐỒNG BỘ với file VTHH
      const productCode = getProductCode(p.name, p.unit);

      data.push([
        'Mua hàng trong nước nhập kho',  // A
        'Chưa thanh toán',                // B
        'Nhận kèm hóa đơn GTGT',          // C
        invDate,                          // D
        invDate,                          // E
        `NK${String(invIdx + 1).padStart(4, '0')}`, // F
        '',                               // G
        invNumber,                        // H
        invDate,                          // I
        seller.taxCode || '',             // J
        seller.name || '',                // K
        seller.address || '',             // L
        seller.taxCode || '',             // M
        '',                               // N
        '',                               // O
        `Mua hàng - HĐ ${invNumber}`,     // P
        productCode,                      // Q: Mã hàng HHxxx
        p.name || '',                     // R
        'HH',                             // S
        p.unit || '',                     // T
        qty,                              // U: số
        price,                            // V: số
        amount,                           // W: số
        discountRate,                     // X: số
        discount,                         // Y: số
        taxRate,                          // Z: số
        '',                               // AA
        taxAmount,                        // AB: số
        mccqt,                            // AC
        ''                                // AD
      ]);
    });
  });

  return data;
}

// ============================================================
// HỖ TRỢ: Đếm số dòng trong worksheet
// ============================================================
function wsDataLength(ws) {
  if (!ws['!ref']) return 0;
  const range = XLSX.utils.decode_range(ws['!ref']);
  return range.e.r + 1;
}

// ============================================================
// XUẤT TẤT CẢ 3 FILE
// ============================================================
function exportAllExcel(taxCode) {
  if (!taxCode) taxCode = currentTaxCode;
  if (!taxCode || !hkdData[taxCode]) {
    window.showToast('❌ Vui lòng chọn HKD trước', 3000, 'error');
    return;
  }
  exportSuppliersExcel(taxCode);
  setTimeout(() => exportMaterialsExcel(taxCode), 600);
  setTimeout(() => exportPurchaseExcel(taxCode), 1200);
  window.showToast(`📤 Đang xuất 3 file Excel cho ${taxCode}...`, 2000, 'info');
}

// ============================================================
// GẮN VÀO WINDOW
// ============================================================
window.exportSuppliersExcel = exportSuppliersExcel;
window.exportMaterialsExcel = exportMaterialsExcel;
window.exportPurchaseExcel = exportPurchaseExcel;
window.exportAllExcel = exportAllExcel;
