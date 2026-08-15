// Chẩn đoán dữ liệu Excel MUA VÀO - phân tích cấu trúc số hóa đơn và ký hiệu
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/cana2/OneDrive/Desktop/x/Quản lý hkd';
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().includes('mua') && f.toLowerCase().endsWith('.xlsx'));
if (files.length === 0) { console.log('KHÔNG TÌM THẤY FILE'); process.exit(1); }
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

const headerRowIdx = findMuaVaoHeaderRow(rows);
const headerRow = rows[headerRowIdx];
const colNumber = findColumnIndex(headerRow, ['số hóa đơn', 'so hoa don', 'số hoá đơn']);
const colSymbol = findColumnIndex(headerRow, ['ký hiệu hóa đơn', 'ky hieu hoa don', 'ký hiệu hoá đơn']);
const colTotal = findColumnIndex(headerRow, ['tổng tiền thanh toán', 'tong tien thanh toan']);
const colStatus = findColumnIndex(headerRow, ['trạng thái hóa đơn', 'trang thai hoa don']);

console.log('colNumber:', colNumber, '| colSymbol:', colSymbol, '| colTotal:', colTotal, '| colStatus:', colStatus);

// Thu thập dữ liệu
const invoices = [];
for (let i = headerRowIdx + 1; i < rows.length; i++) {
  const row = rows[i] || [];
  const number = String(row[colNumber] || '').trim();
  if (!number) continue;
  const lowerNumber = number.toLowerCase();
  if (lowerNumber.includes('tổng') || lowerNumber.includes('cộng') || lowerNumber.includes('tong') || lowerNumber.includes('cong')) continue;
  invoices.push({
    number: number,
    symbol: colSymbol !== -1 ? String(row[colSymbol] || '').trim() : '',
    total: parseFloat(String(row[colTotal] || '').replace(/[,\s]/g, '')) || 0,
    status: colStatus !== -1 ? String(row[colStatus] || '').trim() : ''
  });
}

console.log('\nTổng số hóa đơn:', invoices.length);

// Phân tích ký hiệu
const symbolCount = {};
invoices.forEach(inv => {
  const s = inv.symbol || '(trống)';
  symbolCount[s] = (symbolCount[s] || 0) + 1;
});
console.log('\n--- Phân bố ký hiệu ---');
Object.entries(symbolCount).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

// Phân tích định dạng số hóa đơn
console.log('\n--- Mẫu số hóa đơn (10 dòng đầu) ---');
invoices.slice(0, 10).forEach(inv => console.log(`  number="${inv.number}" symbol="${inv.symbol}" total=${inv.total} status="${inv.status}"`));

// Kiểm tra số hóa đơn có số 0 ở đầu không
const withLeadingZero = invoices.filter(inv => /^0/.test(inv.number));
console.log('\nSố hóa đơn có số 0 ở đầu:', withLeadingZero.length);
withLeadingZero.slice(0, 10).forEach(inv => console.log(`  "${inv.number}" -> sau khi bỏ 0: "${inv.number.replace(/^0+/, '')}"`));

// Kiểm tra trạng thái
const statusCount = {};
invoices.forEach(inv => {
  const s = inv.status || '(trống)';
  statusCount[s] = (statusCount[s] || 0) + 1;
});
console.log('\n--- Phân bố trạng thái ---');
Object.entries(statusCount).forEach(([s, c]) => console.log(`  "${s}": ${c}`));

// Kiểm tra số hóa đơn trùng lặp
const numCount = {};
invoices.forEach(inv => {
  const key = inv.symbol + '|' + inv.number;
  numCount[key] = (numCount[key] || 0) + 1;
});
const duplicates = Object.entries(numCount).filter(([k, c]) => c > 1);
console.log('\nSố cặp (symbol|number) trùng lặp:', duplicates.length);
duplicates.slice(0, 10).forEach(([k, c]) => console.log(`  ${k}: ${c} lần`));

// Kiểm tra logic phát hiện "đã bị thay thế" (chỉ khớp "đã bị thay thế", không khớp "thay thế")
console.log('\n--- Kiểm tra logic phát hiện "đã bị thay thế" ---');
const replacedOnly = invoices.filter(inv => {
  const s = String(inv.status || '').toLowerCase();
  return s.includes('đã bị thay thế') || s.includes('da bi thay the') || s.includes('đã bị thay thê');
});
console.log('Số hóa đơn "đã bị thay thế" (chính xác):', replacedOnly.length);
replacedOnly.forEach(inv => console.log(`  number="${inv.number}" symbol="${inv.symbol}" status="${inv.status}"`));

// Kiểm tra các trạng thái khác cần xử lý
console.log('\n--- Các trạng thái "đã bị điều chỉnh" (tương tự) ---');
const adjustedOnly = invoices.filter(inv => {
  const s = String(inv.status || '').toLowerCase();
  return s.includes('đã bị điều chỉnh') || s.includes('da bi dieu chinh');
});
console.log('Số hóa đơn "đã bị điều chỉnh":', adjustedOnly.length);
adjustedOnly.forEach(inv => console.log(`  number="${inv.number}" symbol="${inv.symbol}" status="${inv.status}"`));
