// Test đọc file Excel MUA VÀO và kiểm tra logic trích xuất
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/cana2/OneDrive/Desktop/x/Quản lý hkd';
// Tìm file xlsx chứa "MUA" trong tên
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().includes('mua') && f.toLowerCase().endsWith('.xlsx'));
console.log('Files found:', files);
if (files.length === 0) {
  console.log('KHÔNG TÌM THẤY FILE');
  process.exit(1);
}
const filePath = path.join(dir, files[0]);
console.log('Reading:', filePath);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Sheet:', sheetName, '| Total rows:', rows.length);

// Tìm header row
function findMuaVaoHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const joined = row.map(c => String(c || '').toLowerCase()).join('|');
    if (joined.includes('số hóa đơn') || joined.includes('so hoa don') || joined.includes('số hoá đơn')) {
      return i;
    }
  }
  return -1;
}

const headerRowIdx = findMuaVaoHeaderRow(rows);
console.log('Header row index:', headerRowIdx);

if (headerRowIdx !== -1) {
  const headerRow = rows[headerRowIdx];
  console.log('Header row:', JSON.stringify(headerRow));

  // Tìm cột
  function findColumnIndex(headerRow, keywords) {
    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').toLowerCase();
      for (const kw of keywords) {
        if (cell.includes(kw)) return c;
      }
    }
    return -1;
  }

  const colNumber = findColumnIndex(headerRow, ['số hóa đơn', 'so hoa don', 'số hoá đơn']);
  const colSymbol = findColumnIndex(headerRow, ['ký hiệu hóa đơn', 'ky hieu hoa don', 'ký hiệu hoá đơn']);
  const colDate = findColumnIndex(headerRow, ['ngày lập', 'ngay lap']);
  const colSellerName = findColumnIndex(headerRow, ['tên người bán', 'ten nguoi ban', 'tên người xuất hàng']);
  const colTotal = findColumnIndex(headerRow, ['tổng tiền thanh toán', 'tong tien thanh toan']);
  const colBeforeTax = findColumnIndex(headerRow, ['tổng tiền chưa thuế', 'tong tien chua thue']);
  const colTax = findColumnIndex(headerRow, ['tổng tiền thuế', 'tong tien thue']);

  console.log('colNumber:', colNumber, '| colSymbol:', colSymbol, '| colDate:', colDate, '| colSellerName:', colSellerName, '| colTotal:', colTotal, '| colBeforeTax:', colBeforeTax, '| colTax:', colTax);

  // Đọc vài dòng dữ liệu
  console.log('\n--- 5 dòng dữ liệu đầu ---');
  let count = 0;
  for (let i = headerRowIdx + 1; i < rows.length && count < 5; i++) {
    const row = rows[i] || [];
    const number = String(row[colNumber] || '').trim();
    if (!number) continue;
    const lowerNumber = number.toLowerCase();
    if (lowerNumber.includes('tổng') || lowerNumber.includes('cộng') || lowerNumber.includes('tong') || lowerNumber.includes('cong')) continue;
    console.log(`Row ${i}: number=${number} | symbol=${row[colSymbol]} | date=${row[colDate]} | seller=${row[colSellerName]} | total=${row[colTotal]}`);
    count++;
  }

  // Đếm tổng số hóa đơn hợp lệ
  let validCount = 0;
  let totalSum = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const number = String(row[colNumber] || '').trim();
    if (!number) continue;
    const lowerNumber = number.toLowerCase();
    if (lowerNumber.includes('tổng') || lowerNumber.includes('cộng') || lowerNumber.includes('tong') || lowerNumber.includes('cong')) continue;
    validCount++;
    const total = parseFloat(String(row[colTotal] || '').replace(/[,\s]/g, ''));
    if (!isNaN(total)) totalSum += total;
  }
  console.log('\nTổng số hóa đơn hợp lệ:', validCount);
  console.log('Tổng tiền thanh toán:', totalSum.toLocaleString('vi-VN'));
}
