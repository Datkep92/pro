// ============================================================
// test_kyhieu.js
// Test cho logic suy "Ký hiệu HĐ bị thay thế" theo năm của ngày HĐ.
//   1C26MKT = Ngày hóa đơn bị thay thế 2026
//   1C25MKT = Ngày hóa đơn bị thay thế 2025
//
// Chạy:  node "thay thế hóa đơn/test_kyhieu.js"
// ============================================================

const fs = require('fs');
const path = require('path');

// Trích 2 hàm thật từ js/app.js (app.js không require được vì dùng document ở top-level)
const src = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
function extract(name) {
  const re = new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}');
  const m = src.match(re);
  if (!m) throw new Error('Không tìm thấy hàm ' + name);
  return m[0];
}
eval(extract('buildKyHieuHDBiThayThe'));
eval(extract('extractYearFromDate'));

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}\n          mong đợi: ${JSON.stringify(expected)}\n          thực tế : ${JSON.stringify(actual)}`); }
}

// Chuyển ngày -> Excel serial (giống giá trị sheet_to_json trả về cho ô ngày)
function toSerial(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569; }

console.log('\n=== Đúng yêu cầu (ví dụ người dùng) ===');
check('Ngày 2026 -> 1C26MKT', buildKyHieuHDBiThayThe('15/06/2026'), '1C26MKT');
check('Ngày 2025 -> 1C25MKT', buildKyHieuHDBiThayThe('15/06/2025'), '1C25MKT');

console.log('\n=== Nhiều định dạng ngày ===');
check('dd/mm/yyyy  (01/02/2025) -> 1C25MKT', buildKyHieuHDBiThayThe('01/02/2025'), '1C25MKT');
check('yyyy-mm-dd  (2026-03-09) -> 1C26MKT', buildKyHieuHDBiThayThe('2026-03-09'), '1C26MKT');
check('dd-mm-yy    (01-02-26)   -> 1C26MKT', buildKyHieuHDBiThayThe('01-02-26'), '1C26MKT');
check('Date object (2025-12-31) -> 1C25MKT', buildKyHieuHDBiThayThe(new Date(2025, 11, 31)), '1C25MKT');
check('Excel serial 2025-06-15   -> 1C25MKT', buildKyHieuHDBiThayThe(toSerial(2025, 6, 15)), '1C25MKT');
check('Excel serial 2026-01-01   -> 1C26MKT', buildKyHieuHDBiThayThe(toSerial(2026, 1, 1)), '1C26MKT');
// Code cũ đã String(row[0]) nên ngày serial thành CHUỖI số -> phải parse được
check('Chuỗi serial "46004" (2025) -> 1C25MKT', buildKyHieuHDBiThayThe('46004'), '1C25MKT');
check('Chuỗi năm "2026" -> 1C26MKT', buildKyHieuHDBiThayThe('2026'), '1C26MKT');

console.log('\n=== Ngày thiếu/không hợp lệ -> không gán ký hiệu (tránh map sai) ===');
check('Chuỗi rỗng -> ""', buildKyHieuHDBiThayThe(''), '');
check('null -> ""', buildKyHieuHDBiThayThe(null), '');
check('undefined -> ""', buildKyHieuHDBiThayThe(undefined), '');
check('Chuỗi rác "abc" -> ""', buildKyHieuHDBiThayThe('abc'), '');

console.log(`\n=== KẾT QUẢ: ${passed} PASS, ${failed} FAIL ===\n`);
process.exit(failed === 0 ? 0 : 1);
