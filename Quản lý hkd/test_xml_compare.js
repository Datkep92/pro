// Chẩn đoán: so sánh dữ liệu XML (đã giải nén) với Excel MUA VÀO
// Đọc tất cả XML trong _xml_tmp, lấy SHDon, KHHDon, KHMSHDon, tổng tiền
// Rồi so sánh với danh sách Excel để xem tỷ lệ khớp thực tế
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/cana2/OneDrive/Desktop/x/Quản lý hkd';
const xmlDir = 'C:/Users/cana2/Desktop/_xml_tmp';

// ---------- Đọc Excel ----------
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().includes('mua') && f.toLowerCase().endsWith('.xlsx'));
const filePath = path.join(dir, files[0]);
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

function findMuaVaoHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const joined = row.map(c => String(c || '').toLowerCase()).join('|');
    if (joined.includes('số hóa đơn') || joined.includes('so hoa don') || joined.includes('số hoá đơn')) return i;
  }
  return -1;
}
function findColumnIndex(headerRow, keywords) {
  for (let c = 0; c < headerRow.length; c++) {
    const cell = String(headerRow[c] || '').toLowerCase();
    for (const kw of keywords) if (cell.includes(kw)) return c;
  }
  return -1;
}
function normalizeInvoiceNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^0+/, '');
}
function normalizeAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

const headerRowIdx = findMuaVaoHeaderRow(rows);
const headerRow = rows[headerRowIdx];
const colNumber = findColumnIndex(headerRow, ['số hóa đơn', 'so hoa don', 'số hoá đơn']);
const colSymbol = findColumnIndex(headerRow, ['ký hiệu hóa đơn', 'ky hieu hoa don', 'ký hiệu hoá đơn']);
const colTotal = findColumnIndex(headerRow, ['tổng tiền thanh toán', 'tong tien thanh toan']);
const colStatus = findColumnIndex(headerRow, ['trạng thái hóa đơn', 'trang thai hoa don']);

const excelInvoices = [];
for (let i = headerRowIdx + 1; i < rows.length; i++) {
  const row = rows[i] || [];
  const number = normalizeInvoiceNumber(row[colNumber]);
  if (!number) continue;
  const lowerNumber = number.toLowerCase();
  if (lowerNumber.includes('tổng') || lowerNumber.includes('cộng') || lowerNumber.includes('tong') || lowerNumber.includes('cong')) continue;
  excelInvoices.push({
    number: number,
    symbol: colSymbol !== -1 ? String(row[colSymbol] || '').trim().toUpperCase() : '',
    total: normalizeAmount(row[colTotal]),
    status: colStatus !== -1 ? String(row[colStatus] || '').trim() : ''
  });
}

// Xây map Excel theo số (bỏ ký hiệu) và theo (symbol|number)
const excelByNum = new Map();
const excelBySymNum = new Map();
excelInvoices.forEach(inv => {
  if (!excelByNum.has(inv.number)) excelByNum.set(inv.number, []);
  excelByNum.get(inv.number).push(inv);
  const key = inv.symbol + '|' + inv.number;
  if (!excelBySymNum.has(key)) excelBySymNum.set(key, []);
  excelBySymNum.get(key).push(inv);
});

// ---------- Đọc XML ----------
const xmlFiles = fs.readdirSync(xmlDir).filter(f => f.endsWith('.xml'));
console.log('Số file XML:', xmlFiles.length);

const xmlInvoices = [];
xmlFiles.forEach(f => {
  const content = fs.readFileSync(path.join(xmlDir, f), 'utf8');
  const getTag = (tag) => {
    const m = content.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
    return m ? m[1].trim() : '';
  };
  const shdon = getTag('SHDon');
  const khhdon = getTag('KHHDon');
  const khmshdon = getTag('KHMSHDon');
  const tgttbso = getTag('TgTTTBSo');
  if (!shdon) return;
  xmlInvoices.push({
    file: f,
    number: normalizeInvoiceNumber(shdon),
    rawNumber: shdon,
    symbol: khhdon.toUpperCase(),       // Ký hiệu hóa đơn thực tế
    khmshdon: khmshdon,                  // Ký hiệu mẫu (thường là "1")
    total: normalizeAmount(tgttbso)
  });
});

console.log('Số hóa đơn XML hợp lệ:', xmlInvoices.length);

// ---------- Phân tích ----------
// 1. Kiểm tra KHMSHDon có phải luôn là "1" không
const khmshdonSet = new Set(xmlInvoices.map(x => x.khmshdon));
console.log('\n--- Giá trị KHMSHDon (ký hiệu mẫu) ---');
console.log([...khmshdonSet].join(', '));

// 2. Kiểm tra symbol XML (KHHDon) có khớp với symbol Excel không
let symMatch = 0, symMismatch = 0;
xmlInvoices.forEach(x => {
  const ex = excelByNum.get(x.number);
  if (ex && ex.some(e => e.symbol === x.symbol)) symMatch++;
  else symMismatch++;
});
console.log('\n--- Khớp ký hiệu (KHHDon vs Excel) ---');
console.log('Khớp ký hiệu:', symMatch, '| Không khớp:', symMismatch);

// 3. So sánh theo số hóa đơn (bỏ ký hiệu)
let matchByNum = 0, notInExcel = 0;
const notInExcelList = [];
xmlInvoices.forEach(x => {
  if (excelByNum.has(x.number)) matchByNum++;
  else { notInExcel++; notInExcelList.push(x); }
});
console.log('\n--- So sánh theo SỐ HÓA ĐƠN (bỏ ký hiệu) ---');
console.log('XML có số trong Excel:', matchByNum, '| XML không có trong Excel:', notInExcel);

// 4. So sánh theo (symbol|number)
let matchBySymNum = 0;
xmlInvoices.forEach(x => {
  if (excelBySymNum.has(x.symbol + '|' + x.number)) matchBySymNum++;
});
console.log('\n--- So sánh theo (KÝ HIỆU|SỐ) ---');
console.log('XML khớp (symbol|number):', matchBySymNum);

// 5. Kiểm tra số tiền khớp
let amountMatch = 0, amountMismatch = 0;
xmlInvoices.forEach(x => {
  const ex = excelByNum.get(x.number);
  if (!ex) return;
  const matched = ex.some(e => Math.abs(e.total - x.total) <= 1);
  if (matched) amountMatch++; else amountMismatch++;
});
console.log('\n--- So sánh số tiền (trong số XML có trong Excel) ---');
console.log('Khớp tiền:', amountMatch, '| Sai tiền:', amountMismatch);

// 6. Hiển thị vài mẫu XML không có trong Excel
console.log('\n--- Mẫu XML không có trong Excel (10 đầu) ---');
notInExcelList.slice(0, 10).forEach(x => {
  console.log(`  number="${x.number}" (raw="${x.rawNumber}") symbol="${x.symbol}" khmshdon="${x.khmshdon}" total=${x.total}`);
});

// 7. Hiển thị vài mẫu XML có trong Excel nhưng sai tiền
console.log('\n--- Mẫu XML sai tiền (10 đầu) ---');
let shown = 0;
xmlInvoices.forEach(x => {
  if (shown >= 10) return;
  const ex = excelByNum.get(x.number);
  if (!ex) return;
  const matched = ex.some(e => Math.abs(e.total - x.total) <= 1);
  if (!matched) {
    console.log(`  XML: number="${x.number}" symbol="${x.symbol}" total=${x.total} | Excel: ${ex.map(e => e.symbol + '=' + e.total).join(', ')}`);
    shown++;
  }
});

// 8. Đếm trùng lặp trong XML (cùng số hóa đơn)
const xmlNumCount = {};
xmlInvoices.forEach(x => { xmlNumCount[x.number] = (xmlNumCount[x.number] || 0) + 1; });
const dupXml = Object.entries(xmlNumCount).filter(([k, c]) => c > 1);
console.log('\n--- Số hóa đơn XML trùng lặp (cùng số) ---');
console.log('Số số trùng:', dupXml.length);
dupXml.slice(0, 10).forEach(([k, c]) => console.log(`  ${k}: ${c} lần`));
