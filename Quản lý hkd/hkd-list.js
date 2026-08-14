// ============================================================
// DANH SÁCH HKD - SIDEBAR + DANH SÁCH HÓA ĐƠN
// ============================================================

/**
 * Render danh sách HKD/Công ty ở sidebar.
 * Mỗi HKD hiển thị:
 * - Mã số thuế, tên
 * - Thống kê: tồn kho, xuất hàng, hóa đơn
 * - Danh sách hóa đơn với so sánh tổng tiền (tính toán vs XML)
 * - Sắp xếp hóa đơn lỗi lên trên
 */
function renderHKDList() {
  // Render vào sidebar tồn kho
  const ul = document.getElementById('businessList');
  // Render vào sidebar xuất kho
  const ulXuat = document.getElementById('businessListXuat');
  // Render vào sidebar tồn kho thực tế
  const ulThucTe = document.getElementById('businessListThucTe');

  if (ul) ul.innerHTML = '';
  if (ulXuat) ulXuat.innerHTML = '';
  if (ulThucTe) ulThucTe.innerHTML = '';

  hkdOrder.forEach(taxCode => {
    const hkd = hkdData[taxCode] || {};
    const name = hkd.name || taxCode;
    const invoices = hkd.invoices || [];
    const exports = hkd.exports || [];

    // Tạo danh sách hóa đơn với thông tin số hóa đơn, tổng tiền, so sánh
    const invoiceList = invoices
      .map(inv => {
        const info = inv.invoiceInfo || {};
        const totals = inv.totals || {};
        const calculatedTotal = totals.total || 0;
        const xmlDeclared = totals.xmlDeclared || 0;
        const hasDiff = calculatedTotal !== xmlDeclared;
        const diffAmount = Math.abs(calculatedTotal - xmlDeclared);
        return {
          date: info.date || '',
          number: info.number || '',
          mccqt: info.mccqt || '',
          calculatedTotal: calculatedTotal,
          xmlDeclared: xmlDeclared,
          hasDiff: hasDiff,
          diffAmount: diffAmount
        };
      })
      .filter(x => x.number || x.mccqt)
      .sort((a, b) => {
        // Sắp xếp: lỗi lên trên, sau đó theo ngày giảm dần
        if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1;
        return a.date > b.date ? -1 : 1;
      });

    // Tạo HTML cho một item HKD - dùng prefix để phân biệt sidebar
    function createHKDItemHTML(sidebarPrefix) {
      const idList = `invoiceList-${taxCode}-${sidebarPrefix}`;

      // Hiển thị thống kê - tổng tất cả các loại tồn kho (main + km + ck)
      const totalExports = exports.length;
      const totalInventory = (hkd.tonkhoMain || []).length + (hkd.tonkhoKM || []).length + (hkd.tonkhoCK || []).length;
      const totalInvoices = invoiceList.length;
      const errorInvoices = invoiceList.filter(x => x.hasDiff).length;

      return `
      <div onclick="window.renderHKDTab('${taxCode}','${sidebarPrefix === 'tonkho' ? 'tonkho' : sidebarPrefix === 'tonkhothucte' ? 'tonkhothucte' : 'xuathang'}')">
        <strong>${taxCode}</strong><br>
        <span>${name}</span><br>
        <small style="color: #666;">
          📦 ${totalInventory} tồn kho | 📤 ${totalExports} xuất hàng | 📄 ${totalInvoices} hóa đơn
          ${errorInvoices > 0 ? `<span style="color:#e53935;font-weight:bold;"> ⚠️ ${errorInvoices} lỗi</span>` : ''}
        </small>
      </div>
      <div style="display:flex; gap:4px; margin-top:6px;">
        <button onclick="toggleInvoiceList('${taxCode}','${sidebarPrefix}')" style="flex:1; font-size:0.8em; padding:4px 6px;">📄 Hóa đơn</button>
        <button onclick="openMergePopup('${taxCode}')" style="flex:1; font-size:0.8em; padding:4px 6px; background:#ff9800; color:white; border:none; border-radius:4px; cursor:pointer;">🔗 Gộp</button>
      </div>
      <ul id="${idList}" style="display:none; list-style:none; padding:4px 0 4px 8px; margin:4px 0 0 0;">
        ${
          invoiceList.length
            ? invoiceList
                .map(
                  (item, idx) => {
                    const diffClass = item.hasDiff ? 'style="background:#ffebee; border-left:4px solid #e53935; margin-bottom:3px; border-radius:3px; padding:6px 8px; cursor:pointer;"' : 'style="margin-bottom:3px; border-radius:3px; padding:6px 8px; cursor:pointer;"';
                    const diffText = item.hasDiff
                      ? `<span style="color:#e53935;font-weight:bold;font-size:0.85em;"> ⚠️ Chênh lệch: ${item.diffAmount.toLocaleString()}đ</span>`
                      : `<span style="color:#43a047;font-size:0.85em;"> ✅ Khớp</span>`;
                    return `<li onclick="renderInvoiceDetail('${taxCode}','${item.mccqt}')" ${diffClass}>
                      <div style="font-weight:bold;font-size:0.9em;">📄 ${item.number || item.mccqt}</div>
                      <div style="font-size:0.8em;color:#555;">📅 ${item.date}</div>
                      <div style="font-size:0.8em;margin-top:2px;">
                        <span>Tính: ${item.calculatedTotal.toLocaleString()}đ</span>
                        <span style="margin-left:6px;">XML: ${item.xmlDeclared.toLocaleString()}đ</span>
                        ${diffText}
                      </div>
                    </li>`;
                  }
                )
                .join('')
            : `<li style="padding:6px 8px;color:#999;font-style:italic;">Chưa có hóa đơn</li>`
        }
      </ul>`;
    }

    // Thêm vào sidebar tồn kho (prefix = tonkho)
    if (ul) {
      const li = document.createElement('li');
      li.classList.add('hkd-item');
      li.innerHTML = createHKDItemHTML('tonkho');
      ul.appendChild(li);
    }

    // Thêm vào sidebar xuất kho (prefix = xuathang)
    if (ulXuat) {
      const li = document.createElement('li');
      li.classList.add('hkd-item');
      li.innerHTML = createHKDItemHTML('xuathang');
      ulXuat.appendChild(li);
    }

    // Thêm vào sidebar tồn kho thực tế (prefix = tonkhothucte)
    if (ulThucTe) {
      const li = document.createElement('li');
      li.classList.add('hkd-item');
      li.innerHTML = createHKDItemHTML('tonkhothucte');
      ulThucTe.appendChild(li);
    }
  });

  // KHÔNG tự động gọi renderHKDTab ở đây nữa vì initApp() đã gọi trước đó
}

/**
 * Bật/tắt hiển thị danh sách hóa đơn của một HKD
 * @param {string} taxCode - Mã số thuế
 * @param {string} sidebarPrefix - 'tonkho' hoặc 'xuathang' để phân biệt sidebar
 */
function toggleInvoiceList(taxCode, sidebarPrefix = 'tonkho') {
  const list = document.getElementById(`invoiceList-${taxCode}-${sidebarPrefix}`);
  if (!list) return;

  const isHidden = list.style.display === 'none' || !list.style.display;
  list.style.display = isHidden ? 'block' : 'none';
}
