// ============================================================
// invoiceDupKey.js
// KHÓA NHẬN DIỆN HÓA ĐƠN - dùng cho logic CHỐNG TRÙNG.
//
// Nguyên tắc: KHÔNG xác định trùng chỉ bằng "số hóa đơn".
// Một hóa đơn được nhận diện bằng:
//     MST (người bán/xuất hàng) | Mẫu số | Ký hiệu | Số hóa đơn
//
//   - Cùng số hóa đơn nhưng KHÁC mẫu số            -> KHÔNG trùng
//   - Cùng mẫu số + ký hiệu + số hóa đơn cùng MST  -> trùng
//   - KHÁC MST                                      -> KHÔNG trùng
//
// Dùng được ở cả browser (gắn vào window) lẫn Node (module.exports) để test.
// ============================================================

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.getInvoiceDupKey = api.getInvoiceDupKey;
    root.getInvoiceKeyParts = api.getInvoiceKeyParts;
    root.normalizeInvoiceNumberForKey = api.normalizeInvoiceNumber;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {

  // Chuẩn hóa văn bản: trim, gộp khoảng trắng, viết hoa (so sánh không phân biệt hoa thường)
  function normText(value) {
    return String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, ' ');
  }

  // Chuẩn hóa số hóa đơn: trim + bỏ số 0 ở đầu ("0000100" -> "100")
  function normalizeInvoiceNumber(value) {
    return String(value == null ? '' : value).trim().replace(/^0+/, '');
  }

  /**
   * Lấy các thành phần nhận diện từ một object hóa đơn.
   * @param {Object} inv - { invoiceInfo, sellerInfo } hoặc trực tiếp object invoiceInfo
   * @param {String} [fallbackMst] - MST dùng khi hóa đơn không có MST người bán
   * @returns {{mst:string, mauSo:string, kyHieu:string, soHD:string, mccqt:string}}
   */
  function getInvoiceKeyParts(inv, fallbackMst) {
    const info = (inv && inv.invoiceInfo) ? inv.invoiceInfo : (inv || {});
    const sellerMst = (inv && inv.sellerInfo) ? inv.sellerInfo.taxCode : '';
    const mst = normText(sellerMst || fallbackMst || info.taxCode || '');
    // "Mẫu số" ưu tiên trường template (KHMSHDon); hỗ trợ thêm mauSo cho dữ liệu khác
    const mauSo = normText((info.template != null && info.template !== '') ? info.template : (info.mauSo || ''));
    const kyHieu = normText(info.symbol || info.kyHieu || '');
    const soHD = normalizeInvoiceNumber((info.number != null && info.number !== '') ? info.number : (info.soHoaDon || ''));
    const mccqt = normText(info.mccqt || '');
    return { mst: mst, mauSo: mauSo, kyHieu: kyHieu, soHD: soHD, mccqt: mccqt };
  }

  /**
   * Trả về khóa chống trùng cho một hóa đơn.
   * Trả về '' nghĩa là không đủ dữ liệu để kết luận trùng (nên GIỮ LẠI hóa đơn).
   */
  function getInvoiceDupKey(inv, fallbackMst) {
    const p = getInvoiceKeyParts(inv, fallbackMst);
    if (p.soHD) {
      return ['HD', p.mst, p.mauSo, p.kyHieu, p.soHD].join('|');
    }
    if (p.mccqt) {
      // Không có số hóa đơn -> dùng MCCQT làm phương án dự phòng
      return ['MCCQT', p.mst, p.mccqt].join('|');
    }
    return '';
  }

  return {
    getInvoiceDupKey: getInvoiceDupKey,
    getInvoiceKeyParts: getInvoiceKeyParts,
    normalizeInvoiceNumber: normalizeInvoiceNumber
  };
});
