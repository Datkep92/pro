// ============================================================
// MUA VÀO - IMPORT & SO SÁNH HÓA ĐƠN MUA VÀO TỪ FILE EXCEL
// ============================================================
// Tính năng: Import file Excel "MUA VÀO" (danh sách hóa đơn mua vào)
// và so sánh với các hóa đơn đã trích xuất từ XML (ZIP) để phát hiện
// hóa đơn bị thiếu hoặc sai số tiền.
//
// Tiêu chí so sánh:
//   1. Trùng số hóa đơn
//   2. Trùng số tiền (tổng tiền thanh toán)
// Nếu thiếu 1 trong 2 → cảnh báo để phát hiện.
// ============================================================

// Xử lý khi chọn file Excel MUA VÀO từ nút trong sidebar
function handleMuaVaoFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (typeof importMuaVaoExcel === 'function') {
    importMuaVaoExcel(file);
  } else {
    alert('Hàm importMuaVaoExcel chưa sẵn sàng. Vui lòng kiểm tra file mua-vao.js');
  }
  event.target.value = '';
}
window.handleMuaVaoFileChange = handleMuaVaoFileChange;

// Đọc file Excel thành ArrayBuffer
function readMuaVaoFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsArrayBuffer(file);
  });
}

// Chuẩn hóa số hóa đơn: bỏ khoảng trắng, bỏ số 0 ở đầu, chuyển thành chuỗi
function normalizeInvoiceNumber(value) {
  if (value === null || value === undefined) return '';
  let s = String(value).trim();
  // Bỏ số 0 ở đầu (ví dụ "08909" -> "8909") để so sánh khớp
  s = s.replace(/^0+/, '');
  return s;
}

// Chuẩn hóa số tiền: chuyển chuỗi "1,986,111,0" hoặc số thành số thực
function normalizeAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  // Loại bỏ dấu phân cách hàng nghìn (dấu phẩy) và khoảng trắng
  const cleaned = String(value).replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Tìm dòng header trong mảng 2 chiều của sheet
// Trả về index của dòng header, hoặc -1 nếu không tìm thấy
function findMuaVaoHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const joined = row.map(c => String(c || '').toLowerCase()).join('|');
    // Header chứa "số hóa đơn" và "tổng tiền thanh toán" hoặc "stt"
    if (joined.includes('số hóa đơn') || joined.includes('so hoa don') || joined.includes('số hoá đơn')) {
      return i;
    }
  }
  return -1;
}

// Tìm chỉ số cột theo tên header (không phân biệt hoa thường, bỏ dấu)
function findColumnIndex(headerRow, keywords) {
  for (let c = 0; c < headerRow.length; c++) {
    const cell = String(headerRow[c] || '').toLowerCase();
    for (const kw of keywords) {
      if (cell.includes(kw)) return c;
    }
  }
  return -1;
}

// Import file Excel MUA VÀO và so sánh với hóa đơn XML đã nhập
async function importMuaVaoExcel(file) {
  const taxCode = currentTaxCode;
  if (!taxCode || !hkdData[taxCode]) {
    showToast('Vui lòng chọn một HKD trước khi import', 3000, 'error');
    return;
  }

  showProgress(5, 'Đang đọc file Excel MUA VÀO...');

  try {
    const data = await readMuaVaoFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Đọc dưới dạng mảng 2 chiều để xử lý header linh hoạt
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    showProgress(20, `Đã đọc ${rows.length} dòng từ Excel...`);

    // Tìm dòng header
    const headerRowIdx = findMuaVaoHeaderRow(rows);
    if (headerRowIdx === -1) {
      showToast('Không tìm thấy dòng tiêu đề (Số hóa đơn) trong file Excel', 3000, 'warning');
      hideProgress();
      return;
    }

    const headerRow = rows[headerRowIdx] || [];

    // Xác định chỉ số cột
    const colNumber = findColumnIndex(headerRow, ['số hóa đơn', 'so hoa don', 'số hoá đơn']);
    const colSymbol = findColumnIndex(headerRow, ['ký hiệu hóa đơn', 'ky hieu hoa don', 'ký hiệu hoá đơn']);
    const colDate = findColumnIndex(headerRow, ['ngày lập', 'ngay lap']);
    const colSellerName = findColumnIndex(headerRow, ['tên người bán', 'ten nguoi ban', 'tên người xuất hàng']);
    const colSellerTax = findColumnIndex(headerRow, ['mst người bán', 'mst nguoi ban', 'mst người xuất hàng']);
    const colTotal = findColumnIndex(headerRow, ['tổng tiền thanh toán', 'tong tien thanh toan', 'tổng tiền thanh toán']);
    const colBeforeTax = findColumnIndex(headerRow, ['tổng tiền chưa thuế', 'tong tien chua thue']);
    const colTax = findColumnIndex(headerRow, ['tổng tiền thuế', 'tong tien thue']);
    const colStatus = findColumnIndex(headerRow, ['trạng thái hóa đơn', 'trang thai hoa don']);

    if (colNumber === -1 || colTotal === -1) {
      showToast('File Excel thiếu cột "Số hóa đơn" hoặc "Tổng tiền thanh toán"', 3000, 'warning');
      hideProgress();
      return;
    }

    // Trích xuất danh sách hóa đơn mua vào từ Excel
    const excelInvoices = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const number = normalizeInvoiceNumber(row[colNumber]);
      // Bỏ qua dòng trống hoặc dòng tổng cộng
      if (!number) continue;
      // Bỏ qua dòng tổng kết (chứa "tổng" hoặc "cộng")
      const lowerNumber = number.toLowerCase();
      if (lowerNumber.includes('tổng') || lowerNumber.includes('cộng') || lowerNumber.includes('tong') || lowerNumber.includes('cong')) continue;

      excelInvoices.push({
        stt: row[0] !== undefined ? String(row[0]).trim() : '',
        symbol: colSymbol !== -1 ? String(row[colSymbol] || '').trim() : '',
        number: number,
        date: colDate !== -1 ? String(row[colDate] || '').trim() : '',
        sellerName: colSellerName !== -1 ? String(row[colSellerName] || '').trim() : '',
        sellerTax: colSellerTax !== -1 ? String(row[colSellerTax] || '').trim() : '',
        beforeTax: colBeforeTax !== -1 ? normalizeAmount(row[colBeforeTax]) : 0,
        tax: colTax !== -1 ? normalizeAmount(row[colTax]) : 0,
        total: normalizeAmount(row[colTotal]),
        status: colStatus !== -1 ? String(row[colStatus] || '').trim() : ''
      });
    }

    if (excelInvoices.length === 0) {
      showToast('Không tìm thấy dữ liệu hóa đơn trong file Excel', 3000, 'warning');
      hideProgress();
      return;
    }

    showProgress(40, `Đã trích xuất ${excelInvoices.length} hóa đơn từ Excel. Đang so sánh...`);

    // Lấy danh sách hóa đơn XML đã nhập
    const xmlInvoices = (hkdData[taxCode].invoices || []).filter(inv => inv && inv.invoiceInfo);

    // Xây dựng map tra cứu theo cặp (ký hiệu + số hóa đơn) để so sánh chính xác
    // Vì cùng số hóa đơn có thể xuất hiện ở nhiều ký hiệu khác nhau
    const xmlByKey = new Map();
    xmlInvoices.forEach(inv => {
      const num = normalizeInvoiceNumber(inv.invoiceInfo.number);
      const sym = String(inv.invoiceInfo.symbol || '').trim().toUpperCase();
      if (num) {
        const key = sym + '|' + num;
        if (!xmlByKey.has(key)) xmlByKey.set(key, []);
        xmlByKey.get(key).push(inv);
        // Cũng lưu theo số hóa đơn (fallback nếu ký hiệu khác nhau)
        if (!xmlByKey.has('|' + num)) xmlByKey.set('|' + num, []);
        xmlByKey.get('|' + num).push(inv);
      }
    });

    // Xây dựng map tra cứu Excel theo cặp (ký hiệu + số) và theo số
    const excelByKey = new Map();
    excelInvoices.forEach(inv => {
      const sym = String(inv.symbol || '').trim().toUpperCase();
      const num = inv.number;
      if (num) {
        const key = sym + '|' + num;
        if (!excelByKey.has(key)) excelByKey.set(key, []);
        excelByKey.get(key).push(inv);
        if (!excelByKey.has('|' + num)) excelByKey.set('|' + num, []);
        excelByKey.get('|' + num).push(inv);
      }
    });

    // Hàm kiểm tra hóa đơn Excel có phải "đã bị thay thế" không
    function isReplacedInvoice(inv) {
      const statusText = String(inv.status || '').toLowerCase();
      return statusText.includes('đã bị thay thế') || statusText.includes('da bi thay the') || statusText.includes('đã bị thay thê');
    }

    // So sánh từng hóa đơn Excel với hóa đơn XML (chiều Excel -> XML)
    const results = excelInvoices.map((excelInv, idx) => {
      showProgress(40 + Math.round((idx / excelInvoices.length) * 40), `Đang so sánh ${idx + 1}/${excelInvoices.length}...`);

      // Nếu hóa đơn đã bị thay thế thì không cần so sánh
      if (isReplacedInvoice(excelInv)) {
        return {
          excelInv,
          xmlMatches: [],
          xmlTotal: 0,
          excelTotal: excelInv.total,
          amountDiff: 0,
          amountMatch: false,
          status: 'replaced' // Hóa đơn đã bị thay thế - không cần so sánh
        };
      }

      const sym = String(excelInv.symbol || '').trim().toUpperCase();
      const num = excelInv.number;
      // Ưu tiên tìm theo cặp (ký hiệu + số), fallback theo số
      let matches = xmlByKey.get(sym + '|' + num) || xmlByKey.get('|' + num) || [];
      const xmlTotal = matches.length > 0 ? (matches[0].totals?.total || 0) : 0;
      const excelTotal = excelInv.total;

      // So sánh số tiền (cho phép chênh lệch nhỏ do làm tròn, ví dụ 1đ)
      const amountDiff = Math.abs(xmlTotal - excelTotal);
      const amountMatch = amountDiff <= 1;

      let status;
      if (matches.length === 0) {
        status = 'missing'; // Thiếu hóa đơn trong XML
      } else if (amountMatch) {
        status = 'match'; // Khớp cả số HĐ và tiền
      } else {
        status = 'amount_mismatch'; // Có số HĐ nhưng tiền khác
      }

      return {
        excelInv,
        xmlMatches: matches,
        xmlTotal,
        excelTotal,
        amountDiff,
        amountMatch,
        status
      };
    });

    // So sánh chiều ngược lại: XML -> Excel (tìm hóa đơn XML không có trong Excel)
    // Đánh dấu các hóa đơn XML đã khớp với Excel (theo số + ký hiệu)
    const matchedXmlKeys = new Set();
    results.forEach(r => {
      if (r.status === 'match' || r.status === 'amount_mismatch') {
        const sym = String(r.excelInv.symbol || '').trim().toUpperCase();
        const num = r.excelInv.number;
        matchedXmlKeys.add(sym + '|' + num);
        matchedXmlKeys.add('|' + num);
      }
    });

    // Tìm hóa đơn XML không có trong Excel
    // Chỉ khớp theo SỐ HÓA ĐƠN - KHÔNG cần khớp ký hiệu hay số tiền.
    // Vì hóa đơn có số trong Excel (dù ký hiệu khác hoặc sai tiền) không phải là "dư".
    const xmlOnlyInvoices = [];
    xmlInvoices.forEach(inv => {
      const num = normalizeInvoiceNumber(inv.invoiceInfo.number);
      if (!num) return;
      // Kiểm tra xem hóa đơn XML này có số hóa đơn trong Excel không (chỉ theo số)
      const excelMatches = excelByKey.get('|' + num) || [];
      const isMatched = excelMatches.some(e => e.number === num);
      if (!isMatched) {
        xmlOnlyInvoices.push(inv);
      }
    });

    showProgress(85, 'Đang hiển thị kết quả so sánh...');

    // Hiển thị modal kết quả
    showMuaVaoComparisonModal(taxCode, results, excelInvoices.length, xmlInvoices.length, xmlOnlyInvoices);

  } catch (err) {
    console.error('Import MUA VÀO error:', err);
    showToast('Lỗi khi import file MUA VÀO: ' + err.message, 4000, 'error');
    hideProgress();
  }
}
window.importMuaVaoExcel = importMuaVaoExcel;

// Hiển thị modal kết quả so sánh hóa đơn mua vào (2 chiều: Excel <-> XML)
function showMuaVaoComparisonModal(taxCode, results, totalExcel, totalXml, xmlOnlyInvoices) {
  // Xóa modal cũ nếu có
  document.getElementById('muaVaoModal')?.remove();

  const missingCount = results.filter(r => r.status === 'missing').length;
  const mismatchCount = results.filter(r => r.status === 'amount_mismatch').length;
  const matchCount = results.filter(r => r.status === 'match').length;
  const replacedCount = results.filter(r => r.status === 'replaced').length;
  const xmlOnlyCount = (xmlOnlyInvoices || []).length;

  const modal = document.createElement('div');
  modal.id = 'muaVaoModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center;
    z-index: 10000; overflow: auto;
  `;

  // Tạo bảng HTML
  const cellStyle = 'padding:6px 8px;font-size:0.8em;border:1px solid #ddd;';
  const thStyle = cellStyle + 'background:#1565c0;color:white;font-weight:bold;text-align:center;';

  // --- Bảng 1: Hóa đơn Excel thiếu trong XML (missing) ---
  const missingResults = results.filter(r => r.status === 'missing');
  let missingRowsHtml = '';
  missingResults.forEach((r, i) => {
    const inv = r.excelInv;
    missingRowsHtml += `
      <tr style="background:#ffebee;">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${inv.symbol || ''}</td>
        <td ${cellStyle}style="text-align:center;font-weight:bold;">${inv.number}</td>
        <td ${cellStyle}style="text-align:center;">${inv.date || ''}</td>
        <td ${cellStyle}>${inv.sellerName || ''}</td>
        <td ${cellStyle}style="text-align:right;">${inv.total.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:center;color:#e53935;font-weight:bold;">❌ THIẾU</td>
      </tr>`;
  });

  // --- Bảng 2: Hóa đơn XML không có trong Excel (xmlOnly) ---
  let xmlOnlyRowsHtml = '';
  (xmlOnlyInvoices || []).forEach((inv, i) => {
    const num = normalizeInvoiceNumber(inv.invoiceInfo.number);
    const sym = String(inv.invoiceInfo.symbol || '').trim();
    const total = inv.totals?.total || 0;
    const sellerName = inv.sellerInfo?.name || '';
    const date = inv.invoiceInfo?.date || '';
    xmlOnlyRowsHtml += `
      <tr style="background:#fff3e0;">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${sym}</td>
        <td ${cellStyle}style="text-align:center;font-weight:bold;">${num}</td>
        <td ${cellStyle}style="text-align:center;">${date}</td>
        <td ${cellStyle}>${sellerName}</td>
        <td ${cellStyle}style="text-align:right;">${total.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:center;color:#ef6c00;font-weight:bold;">⚠️ KHÔNG CÓ TRONG EXCEL</td>
      </tr>`;
  });

  // --- Bảng 3: Hóa đơn sai tiền (amount_mismatch) ---
  const mismatchResults = results.filter(r => r.status === 'amount_mismatch');
  let mismatchRowsHtml = '';
  mismatchResults.forEach((r, i) => {
    const inv = r.excelInv;
    mismatchRowsHtml += `
      <tr style="background:#fff8e1;">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${inv.symbol || ''}</td>
        <td ${cellStyle}style="text-align:center;font-weight:bold;">${inv.number}</td>
        <td ${cellStyle}style="text-align:center;">${inv.date || ''}</td>
        <td ${cellStyle}>${inv.sellerName || ''}</td>
        <td ${cellStyle}style="text-align:right;">${inv.total.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:right;">${r.xmlTotal.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:center;color:#ff9800;font-weight:bold;">⚠️ SAI TIỀN</td>
      </tr>`;
  });

  // --- Bảng 4: Hóa đơn đã bị thay thế (replaced) ---
  const replacedResults = results.filter(r => r.status === 'replaced');
  let replacedRowsHtml = '';
  replacedResults.forEach((r, i) => {
    const inv = r.excelInv;
    replacedRowsHtml += `
      <tr style="background:#f3e5f5;">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${inv.symbol || ''}</td>
        <td ${cellStyle}style="text-align:center;font-weight:bold;">${inv.number}</td>
        <td ${cellStyle}style="text-align:center;">${inv.date || ''}</td>
        <td ${cellStyle}>${inv.sellerName || ''}</td>
        <td ${cellStyle}style="text-align:right;">${inv.total.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:center;color:#6a1b9a;font-weight:bold;">🔁 ĐÃ BỊ THAY THẾ</td>
      </tr>`;
  });

  // --- Bảng 5: Hóa đơn khớp (match) ---
  const matchResults = results.filter(r => r.status === 'match');
  let matchRowsHtml = '';
  matchResults.forEach((r, i) => {
    const inv = r.excelInv;
    matchRowsHtml += `
      <tr style="background:#e8f5e9;">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${inv.symbol || ''}</td>
        <td ${cellStyle}style="text-align:center;font-weight:bold;">${inv.number}</td>
        <td ${cellStyle}style="text-align:center;">${inv.date || ''}</td>
        <td ${cellStyle}>${inv.sellerName || ''}</td>
        <td ${cellStyle}style="text-align:right;">${inv.total.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:right;">${r.xmlTotal.toLocaleString('vi-VN')}</td>
        <td ${cellStyle}style="text-align:center;color:#43a047;font-weight:bold;">✅ KHỚP</td>
      </tr>`;
  });

  // Hàm tạo bảng HTML
  function buildTable(headers, rowsHtml) {
    return `
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr>${headers.map(h => `<th ${thStyle} ${h.width ? `style="width:${h.width};"` : ''}>${h.label}</th>`).join('')}</tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }

  const commonHeaders = [
    { label: 'STT', width: '40px' },
    { label: 'Ký hiệu', width: '80px' },
    { label: 'Số HĐ', width: '90px' },
    { label: 'Ngày', width: '90px' },
    { label: 'Người bán' },
    { label: 'Tiền', width: '120px' },
    { label: 'Kết quả', width: '150px' }
  ];
  const mismatchHeaders = [
    { label: 'STT', width: '40px' },
    { label: 'Ký hiệu', width: '80px' },
    { label: 'Số HĐ', width: '90px' },
    { label: 'Ngày', width: '90px' },
    { label: 'Người bán' },
    { label: 'Tiền Excel', width: '120px' },
    { label: 'Tiền XML', width: '120px' },
    { label: 'Kết quả', width: '120px' }
  ];

  // Nội dung các tab
  const tabContent = {
    missing: `
      <div style="padding:10px 0;color:#e53935;font-weight:bold;font-size:0.9em;">
        ❌ ${missingCount} hóa đơn có trong Excel nhưng KHÔNG có trong XML (thiếu khi import XML)
      </div>
      ${buildTable(commonHeaders, missingRowsHtml || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999;">Không có hóa đơn thiếu</td></tr>')}
    `,
    xmlonly: `
      <div style="padding:10px 0;color:#ef6c00;font-weight:bold;font-size:0.9em;">
        ⚠️ ${xmlOnlyCount} hóa đơn có trong XML nhưng KHÔNG có trong Excel (có thể import nhầm hoặc Excel thiếu)
      </div>
      ${buildTable(commonHeaders, xmlOnlyRowsHtml || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999;">Không có hóa đơn dư</td></tr>')}
    `,
    mismatch: `
      <div style="padding:10px 0;color:#ff9800;font-weight:bold;font-size:0.9em;">
        ⚠️ ${mismatchCount} hóa đơn có ở cả 2 nguồn nhưng SAI SỐ TIỀN
      </div>
      ${buildTable(mismatchHeaders, mismatchRowsHtml || '<tr><td colspan="8" style="padding:20px;text-align:center;color:#999;">Không có hóa đơn sai tiền</td></tr>')}
    `,
    replaced: `
      <div style="padding:10px 0;color:#6a1b9a;font-weight:bold;font-size:0.9em;">
        🔁 ${replacedCount} hóa đơn đã bị thay thế (không so sánh)
      </div>
      ${buildTable(commonHeaders, replacedRowsHtml || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999;">Không có hóa đơn bị thay thế</td></tr>')}
    `,
    match: `
      <div style="padding:10px 0;color:#43a047;font-weight:bold;font-size:0.9em;">
        ✅ ${matchCount} hóa đơn khớp cả số và tiền
      </div>
      ${buildTable(mismatchHeaders, matchRowsHtml || '<tr><td colspan="8" style="padding:20px;text-align:center;color:#999;">Không có hóa đơn khớp</td></tr>')}
    `
  };

  // Tab buttons
  const tabs = [
    { id: 'missing', label: `❌ Excel thiếu (${missingCount})`, color: '#e53935' },
    { id: 'xmlonly', label: `⚠️ XML dư (${xmlOnlyCount})`, color: '#ef6c00' },
    { id: 'mismatch', label: `⚠️ Sai tiền (${mismatchCount})`, color: '#ff9800' },
    { id: 'replaced', label: `🔁 Đã thay thế (${replacedCount})`, color: '#6a1b9a' },
    { id: 'match', label: `✅ Khớp (${matchCount})`, color: '#43a047' }
  ];

  const tabButtonsHtml = tabs.map((t, i) => `
    <button id="muaVaoTabBtn-${t.id}" onclick="switchMuaVaoTab('${t.id}')"
      style="padding:8px 14px;border:1px solid #ddd;border-radius:6px 6px 0 0;cursor:pointer;font-size:0.85em;font-weight:bold;background:${i === 0 ? '#1565c0' : '#f5f5f5'};color:${i === 0 ? 'white' : '#333'};">
      ${t.label}
    </button>`).join('');

  const tabContentsHtml = tabs.map((t, i) => `
    <div id="muaVaoTab-${t.id}" style="${i === 0 ? '' : 'display:none;'}">${tabContent[t.id]}</div>
  `).join('');

  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);width:95%;max-width:1200px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:16px 20px;background:#1565c0;color:white;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
        <div>📊 SO SÁNH HÓA ĐƠN MUA VÀO (2 CHIỀU)</div>
        <button onclick="document.getElementById('muaVaoModal').remove()" style="background:none;border:none;color:white;font-size:1.5em;cursor:pointer;padding:0;width:30px;height:30px;">×</button>
      </div>
      <div style="padding:12px 20px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;gap:16px;flex-wrap:wrap;font-size:0.85em;">
        <div>📄 Excel: <b>${totalExcel}</b> hóa đơn</div>
        <div>📁 XML: <b>${totalXml}</b> hóa đơn</div>
        <div style="color:#43a047;">✅ Khớp: <b>${matchCount}</b></div>
        <div style="color:#e53935;">❌ Excel thiếu: <b>${missingCount}</b></div>
        <div style="color:#ef6c00;">⚠️ XML dư: <b>${xmlOnlyCount}</b></div>
        <div style="color:#ff9800;">⚠️ Sai tiền: <b>${mismatchCount}</b></div>
        <div style="color:#6a1b9a;">🔁 Đã thay thế: <b>${replacedCount}</b></div>
      </div>
      <div style="padding:0 20px;display:flex;gap:4px;border-bottom:2px solid #1565c0;flex-wrap:wrap;">
        ${tabButtonsHtml}
      </div>
      <div style="flex:1;overflow:auto;padding:12px 20px;">
        ${tabContentsHtml}
      </div>
      <div style="padding:12px 20px;background:#f5f5f5;border-top:1px solid #ddd;display:flex;justify-content:flex-end;gap:8px;">
        <button onclick="document.getElementById('muaVaoModal').remove()" style="padding:8px 20px;background:#1976d2;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Đóng</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Hàm chuyển tab
  window.switchMuaVaoTab = function(tabId) {
    tabs.forEach(t => {
      const btn = document.getElementById('muaVaoTabBtn-' + t.id);
      const content = document.getElementById('muaVaoTab-' + t.id);
      if (btn) {
        btn.style.background = t.id === tabId ? '#1565c0' : '#f5f5f5';
        btn.style.color = t.id === tabId ? 'white' : '#333';
      }
      if (content) content.style.display = t.id === tabId ? '' : 'none';
    });
  };

  // Đóng khi click nền
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });

  // Cảnh báo nếu có hóa đơn thiếu hoặc sai tiền (không tính hóa đơn đã bị thay thế)
  if (missingCount > 0 || mismatchCount > 0 || xmlOnlyCount > 0) {
    const msg = [];
    if (missingCount > 0) msg.push(`❌ Excel thiếu ${missingCount} HĐ trong XML`);
    if (xmlOnlyCount > 0) msg.push(`⚠️ XML dư ${xmlOnlyCount} HĐ không có trong Excel`);
    if (mismatchCount > 0) msg.push(`⚠️ ${mismatchCount} HĐ sai số tiền`);
    showToast(msg.join(' | '), 7000, 'error');
  } else if (replacedCount > 0) {
    showToast(`✅ Các hóa đơn còn lại đều khớp (${replacedCount} hóa đơn đã bị thay thế, không so sánh)`, 4000, 'success');
  } else {
    showToast('✅ Tất cả hóa đơn mua vào đều khớp!', 3000, 'success');
  }

  hideProgress();
}
window.showMuaVaoComparisonModal = showMuaVaoComparisonModal;
