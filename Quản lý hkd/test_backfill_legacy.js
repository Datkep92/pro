// ============================================================
// test_backfill_legacy.js
// Test cho backfillInvoiceTemplate() - khôi phục "mẫu số" cho hóa đơn CŨ
// (nhập bằng parser cũ đã lưu nhầm template = ký hiệu).
//
// Chạy:  node "Quản lý hkd/test_backfill_legacy.js"
// ============================================================

const fs = require('fs');
const path = require('path');

// Stub DOMParser tối thiểu: tìm thẻ trong chuỗi XML
global.DOMParser = class {
  parseFromString(xml) {
    return {
      querySelector: (selector) => {
        const tag = String(selector).split('>').pop().trim();
        const m = String(xml).match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
        return m ? { textContent: m[1] } : null;
      }
    };
  }
};

// Trích hàm thật backfillInvoiceTemplate từ parseXmlInvoice.js
const src = fs.readFileSync(path.join(__dirname, 'parseXmlInvoice.js'), 'utf8');
const m = src.match(/function backfillInvoiceTemplate\(invoice\) \{[\s\S]*?\n\}/);
if (!m) { console.log('KHONG TIM THAY backfillInvoiceTemplate'); process.exit(2); }
eval(m[0]);

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}\n          mong đợi: ${JSON.stringify(expected)}\n          thực tế : ${JSON.stringify(actual)}`); }
}

const rawXmlWithMauSo = '<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C25TDB</KHHDon><SHDon>100</SHDon></TTChung></DLHDon></HDon>';
const rawXmlNoMauSo = '<HDon><DLHDon><TTChung><KHHDon>C25TDB</KHHDon><SHDon>100</SHDon></TTChung></DLHDon></HDon>';

// 1) Bản ghi cũ (template === symbol) + có rawXml -> khôi phục mẫu số
const oldInv = { invoiceInfo: { template: 'C25TDB', symbol: 'C25TDB', number: '100' }, rawXml: rawXmlWithMauSo };
backfillInvoiceTemplate(oldInv);
check('Bản ghi cũ: template "C25TDB" được khôi phục thành mẫu số "1"', oldInv.invoiceInfo.template, '1');

// 2) Idempotent: chạy lại không đổi
backfillInvoiceTemplate(oldInv);
check('Chạy lại (idempotent): template vẫn là "1"', oldInv.invoiceInfo.template, '1');

// 3) XML không có KHMSHDon -> template thành '' (khác symbol, không lặp lại)
const oldInv2 = { invoiceInfo: { template: 'C25TDB', symbol: 'C25TDB', number: '100' }, rawXml: rawXmlNoMauSo };
backfillInvoiceTemplate(oldInv2);
check('XML cũ không có KHMSHDon -> template "" (không lặp lại vô hạn)', oldInv2.invoiceInfo.template, '');

// 4) Bản ghi MỚI (template đã là mẫu số khác ký hiệu) -> giữ nguyên, không parse
const newInv = { invoiceInfo: { template: '1', symbol: 'C25TDB', number: '100' }, rawXml: rawXmlWithMauSo };
backfillInvoiceTemplate(newInv);
check('Bản ghi mới (template "1" != symbol) -> giữ nguyên', newInv.invoiceInfo.template, '1');

// 5) Không có rawXml -> bỏ qua an toàn
const noXml = { invoiceInfo: { template: 'C25TDB', symbol: 'C25TDB', number: '100' } };
backfillInvoiceTemplate(noXml);
check('Không có rawXml -> giữ nguyên (không lỗi)', noXml.invoiceInfo.template, 'C25TDB');

console.log(`\n=== KẾT QUẢ: ${passed} PASS, ${failed} FAIL ===\n`);
process.exit(failed === 0 ? 0 : 1);
