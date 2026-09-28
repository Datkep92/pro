// ============================================================
// test_duplicate_key.js
// Test tối thiểu cho logic CHỐNG TRÙNG hóa đơn.
//
// Chạy:  node "Quản lý hkd/test_duplicate_key.js"
// ============================================================

const path = require('path');
const { getInvoiceDupKey } = require(path.join(__dirname, 'invoiceDupKey.js'));

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`          mong đợi: ${JSON.stringify(expected)}`);
    console.log(`          thực tế : ${JSON.stringify(actual)}`);
  }
}

// Tạo nhanh 1 hóa đơn
function inv(number, template, symbol, mst, mccqt) {
  return {
    invoiceInfo: { number: number, template: template, symbol: symbol, mccqt: mccqt || '' },
    sellerInfo: { taxCode: mst }
  };
}

console.log('\n=== Yêu cầu #6: test tối thiểu ===');

// 1) Mẫu 25 + HĐ 100  vs  Mẫu 26 + HĐ 100  -> KHÔNG trùng
const k25 = getInvoiceDupKey(inv('100', '25', 'AA/20E', '0101234567'));
const k26 = getInvoiceDupKey(inv('100', '26', 'AA/20E', '0101234567'));
check('Mẫu 25 + HĐ 100  khác  Mẫu 26 + HĐ 100  -> KHÔNG trùng', k25 === k26, false);

// 2) Mẫu 25 + HĐ 100  vs  Mẫu 25 + HĐ 100  -> TRÙNG
const k25b = getInvoiceDupKey(inv('100', '25', 'AA/20E', '0101234567'));
check('Mẫu 25 + HĐ 100  vs  Mẫu 25 + HĐ 100  -> TRÙNG', k25 === k25b, true);

console.log('\n=== Yêu cầu #2: phân biệt mẫu số / ký hiệu / MST ===');

// 3) Khác MST (cùng mẫu + ký hiệu + số) -> KHÔNG trùng
check(
  'Khác MST -> KHÔNG trùng',
  k25 === getInvoiceDupKey(inv('100', '25', 'AA/20E', '0109999999')),
  false
);

// 4) Khác ký hiệu (cùng MST + mẫu + số) -> KHÔNG trùng
check(
  'Khác ký hiệu -> KHÔNG trùng',
  k25 === getInvoiceDupKey(inv('100', '25', 'AB/20E', '0101234567')),
  false
);

// 5) Khác số hóa đơn -> KHÔNG trùng
check(
  'Khác số hóa đơn -> KHÔNG trùng',
  k25 === getInvoiceDupKey(inv('101', '25', 'AA/20E', '0101234567')),
  false
);

// 6) Số hóa đơn có số 0 ở đầu vẫn phải coi là cùng số
check(
  'HĐ "0000100" vs HĐ "100" (cùng mẫu/ký hiệu/MST) -> TRÙNG',
  getInvoiceDupKey(inv('100', '25', 'AA/20E', '0101234567')) ===
    getInvoiceDupKey(inv('0000100', '25', 'AA/20E', '0101234567')),
  true
);

// 7) Bỏ dấu/hoa-thường của mẫu số & ký hiệu
check(
  'Mẫu "25" vs " 25 " và ký hiệu "aa/20e" vs "AA/20E" -> TRÙNG',
  getInvoiceDupKey(inv('100', '25', 'AA/20E', '0101234567')) ===
    getInvoiceDupKey(inv('100', ' 25 ', 'aa/20e', '0101234567')),
  true
);

// 8) Thiếu số hóa đơn -> không đủ dữ liệu kết luận (khóa rỗng, giữ lại hóa đơn)
check(
  'Thiếu số hóa đơn -> khóa rỗng (không kết luận trùng)',
  getInvoiceDupKey(inv('', '25', 'AA/20E', '0101234567')),
  ''
);

console.log('\n=== Mô phỏng lọc chống trùng khi import ===');

// Mô phỏng vòng lặp import: bỏ qua hóa đơn có khóa đã tồn tại
function dedupeImport(list, mst) {
  const seen = new Set();
  const kept = [];
  for (const it of list) {
    const key = getInvoiceDupKey(it, mst);
    if (key && seen.has(key)) continue; // trùng -> bỏ
    if (key) seen.add(key);
    kept.push(it);
  }
  return kept;
}

const inputList = [
  inv('100', '25', 'AA/20E', '0101234567'), // giữ
  inv('100', '26', 'AA/20E', '0101234567'), // giữ (khác mẫu số)
  inv('100', '25', 'AA/20E', '0101234567'), // TRÙNG -> bỏ
  inv('100', '25', 'AA/20E', '0109999999')  // giữ (khác MST)
];
const kept = dedupeImport(inputList, '0101234567');
check('4 dòng vào, chỉ giữ 3 dòng (1 dòng trùng bị bỏ)', kept.length, 3);
check('Dòng bị bỏ đúng là hóa đơn trùng mẫu 25/HĐ 100/MST 0101234567',
  kept.filter(x => x.invoiceInfo.template === '25' && x.sellerInfo.taxCode === '0101234567').length,
  1);

console.log(`\n=== KẾT QUẢ: ${passed} PASS, ${failed} FAIL ===\n`);
process.exit(failed === 0 ? 0 : 1);
