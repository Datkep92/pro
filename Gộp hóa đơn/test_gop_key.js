// Kiểm tra logic khóa trong module "Gộp hóa đơn" (trích hàm thật từ index.html)
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/function makeInvoiceKey\(row\) \{[\s\S]*?\n    \}/);
if (!m) { console.log('KHONG TIM THAY makeInvoiceKey'); process.exit(2); }
eval(m[0]);

const r = (mst, mauSo, kyHieu, so) => ({
  'MST người bán/MST người xuất hàng': mst,
  'Ký hiệu mẫu số': mauSo,
  'Ký hiệu hóa đơn': kyHieu,
  'Số hóa đơn': so
});

const a = makeInvoiceKey(r('0101234567', '25', 'AA/20E', '100'));
const b = makeInvoiceKey(r('0101234567', '26', 'AA/20E', '100'));
const c = makeInvoiceKey(r('0101234567', '25', 'AA/20E', '0000100'));
const d = makeInvoiceKey(r('0109999999', '25', 'AA/20E', '100'));

console.log('key mau25/HD100 =', a);
console.log('mau25 vs mau26 -> khong trung?', a !== b);
console.log('HD 0000100 vs 100 (cung mau/ky hieu/MST) -> trung?', a === c);
console.log('khac MST -> khong trung?', a !== d);

// Đếm unique theo khóa tổng hợp (mô phỏng renderUI)
const rows = [
  r('0101234567', '25', 'AA/20E', '100'),
  r('0101234567', '26', 'AA/20E', '100'),
  r('0101234567', '25', 'AA/20E', '100'),
  r('0101234567', '25', 'AB/20E', '100')
];
const uniqueOld = new Set(rows.map(x => x['Số hóa đơn']).filter(Boolean)).size;
const uniqueNew = new Set(rows.map(makeInvoiceKey).filter(Boolean)).size;
console.log('unique cu (chi so HD):', uniqueOld, '| unique moi (MST+mau+kyhieu+so):', uniqueNew);
