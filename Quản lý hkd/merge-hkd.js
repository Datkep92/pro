// ============================================================
// CHỨC NĂNG GỘP HKD/CÔNG TY
// ============================================================

// ====== KÉO THẢ GỘP TRONG CÙNG BẢNG XUẤT HÀNG (DEMO POPUP HOẠT ĐỘNG) ======

let draggedItemId = null;

function handleDragStart(e) {
  const el = e.target.closest(".match-item");
  if (!el) return;
  draggedItemId = el.dataset.id;
  e.dataTransfer.setData("text/plain", draggedItemId);
  el.classList.add("dragging");
  console.log("🎯 Drag start:", draggedItemId);
}

function handleDragOver(e) {
  e.preventDefault(); // PHẢI CÓ DÒNG NÀY ĐỂ DROP HOẠT ĐỘNG
  const target = e.target.closest(".match-item");
  if (!target || target.dataset.id === draggedItemId) return;
  target.classList.add("drag-over");
}

function handleDragLeave(e) {
  const target = e.target.closest(".match-item");
  if (target) target.classList.remove("drag-over");
}

function handleMergeDropPreview(e) {
  e.preventDefault();
  const target = e.target.closest(".match-item");
  if (!target || target.dataset.id === draggedItemId) return;

  const dragged = document.querySelector(`.match-item[data-id="${draggedItemId}"]`);
  if (!dragged) return;

  const nameA = dragged.querySelector("b")?.textContent.trim() || "(không rõ)";
  const nameB = target.querySelector("b")?.textContent.trim() || "(không rõ)";

  target.classList.remove("drag-over");
  dragged.classList.remove("dragging");

  console.log(`📎 [DROP] from: ${nameA} → to: ${nameB}`);

  // Popup demo xác nhận gộp
  showMergeConfirmPopup(nameA, nameB);
}

function showMergeConfirmPopup(nameA, nameB) {
  const html = `
    <div style="padding:20px; text-align:center;">
      <h3 style="margin-bottom:10px; color:#1976d2;">Gộp sản phẩm</h3>
      <p>Bạn có muốn <strong>gộp</strong> "<span style="color:#333">${nameA}</span>" vào "<span style="color:#333">${nameB}</span>" không?</p>
      <p style="margin-top:12px; font-size:0.9em; color:#666;">(Chức năng demo – chưa gộp dữ liệu thật)</p>
      <div style="margin-top:20px;">
        <button onclick="closeMiniPopup()" style="padding:8px 16px; background:#1976d2; color:#fff; border:none; border-radius:6px; cursor:pointer;">Xác nhận</button>
        <button onclick="closeMiniPopup()" style="padding:8px 16px; background:#ccc; border:none; border-radius:6px; cursor:pointer; margin-left:8px;">Hủy</button>
      </div>
    </div>
  `;
  if (window.showPopup) {
    window.showPopup(html, "Xác nhận gộp", 400);
  } else {
    // Fallback nếu chưa có showPopup
    const div = document.createElement("div");
    div.innerHTML = html;
    div.style.position = "fixed";
    div.style.top = "50%";
    div.style.left = "50%";
    div.style.transform = "translate(-50%, -50%)";
    div.style.background = "#fff";
    div.style.border = "1px solid #ccc";
    div.style.borderRadius = "8px";
    div.style.zIndex = "9999";
    div.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    document.body.appendChild(div);
  }
}

function closeMiniPopup() {
  if (window.closePopup) {
    window.closePopup();
  } else {
    // Fallback xóa popup thủ công
    const lastDiv = document.body.lastElementChild;
    if (lastDiv) lastDiv.remove();
  }
}

// ====== CSS BỔ TRỢ ======
const style = document.createElement("style");
style.innerHTML = `
  .match-item.dragging {
    opacity: 0.6;
    border: 2px dashed #42a5f5;
  }
  .match-item.drag-over {
    background-color: #e3f2fd !important;
    border: 2px solid #1976d2 !important;
  }
`;
document.head.appendChild(style);

// ============================================================
// CHỨC NĂNG GỘP HKD
// ============================================================

// Mở popup chọn HKD để gộp
function openMergePopup(sourceTaxCode) {
  const hkd = hkdData[sourceTaxCode];
  if (!hkd) { window.showToast('❌ Không tìm thấy HKD nguồn', 3000, 'error'); return; }

  // Tạo danh sách HKD khác để chọn gộp vào
  const targets = hkdOrder.filter(tc => tc !== sourceTaxCode);
  if (targets.length === 0) {
    window.showToast('❌ Không có HKD nào khác để gộp', 3000, 'error');
    return;
  }

  const sourceName = hkd.name || sourceTaxCode;
  let optionsHtml = targets.map(tc => {
    const targetHkd = hkdData[tc];
    const targetName = targetHkd ? (targetHkd.name || tc) : tc;
    return `<option value="${tc}">${targetName} (${tc})</option>`;
  }).join('');

  const popupId = 'mergePopup';
  // Xóa popup cũ nếu có
  const oldPopup = document.getElementById(popupId);
  if (oldPopup) oldPopup.remove();

  const div = document.createElement('div');
  div.id = popupId;
  div.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center;';
  div.innerHTML = `
    <div style="background:white; padding:24px; border-radius:10px; max-width:500px; width:90%; box-shadow:0 8px 30px rgba(0,0,0,0.3);">
      <h3 style="margin-top:0; color:#e65100;">🔗 Gộp HKD</h3>
      <p><strong>Nguồn:</strong> ${sourceName} (${sourceTaxCode})</p>
      <p style="color:#666; font-size:0.9em;">Chọn HKD đích để gộp <strong>${sourceName}</strong> vào:</p>
      <select id="mergeTargetSelect" style="width:100%; padding:10px; font-size:1em; border:1px solid #ccc; border-radius:6px; margin-bottom:16px;">
        ${optionsHtml}
      </select>
      <div style="background:#fff3e0; padding:12px; border-radius:6px; margin-bottom:16px; font-size:0.9em; color:#e65100;">
        <strong>⚠️ Lưu ý:</strong><br>
        - Hàng hóa trùng tên sẽ được <strong>gộp chung</strong> (cộng số lượng)<br>
        - Hóa đơn, xuất hàng từ nguồn sẽ chuyển sang đích<br>
        - HKD nguồn sẽ bị <strong>xóa</strong> sau khi gộp
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button onclick="this.closest('#${popupId}').remove()" style="padding:10px 20px; background:#9e9e9e; color:white; border:none; border-radius:6px; cursor:pointer;">Hủy</button>
        <button onclick="executeMerge('${sourceTaxCode}')" style="padding:10px 20px; background:#ff9800; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Xác nhận gộp</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

// Thực hiện gộp
function executeMerge(sourceTaxCode) {
  const select = document.getElementById('mergeTargetSelect');
  if (!select) return;
  const targetTaxCode = select.value;
  if (!targetTaxCode || targetTaxCode === sourceTaxCode) {
    window.showToast('❌ Vui lòng chọn HKD đích hợp lệ', 3000, 'error');
    return;
  }

  const source = hkdData[sourceTaxCode];
  const target = hkdData[targetTaxCode];
  if (!source || !target) {
    window.showToast('❌ Lỗi dữ liệu HKD', 3000, 'error');
    return;
  }

  // Lưu snapshot để undo
  const snapshot = JSON.parse(JSON.stringify({ hkdData, hkdOrder, currentTaxCode }));

  // 1. Gộp tonkhoMain - gộp hàng trùng tên
  mergeInventoryArray(target, source, 'tonkhoMain');
  mergeInventoryArray(target, source, 'tonkhoKM');
  mergeInventoryArray(target, source, 'tonkhoCK');

  // 2. Gộp invoices (chuyển toàn bộ, tránh trùng MCCQT)
  (source.invoices || []).forEach(inv => {
    const mccqt = inv.invoiceInfo?.mccqt || '';
    const exists = (target.invoices || []).some(i => (i.invoiceInfo?.mccqt || '') === mccqt);
    if (!exists) {
      target.invoices.push(inv);
    }
  });

  // 3. Gộp exports (chuyển toàn bộ, cập nhật taxCode)
  (source.exports || []).forEach(exp => {
    exp.taxCode = targetTaxCode;
    exp.items.forEach(item => { item.taxCode = targetTaxCode; });
    target.exports.push(exp);
  });

  // 4. Gộp customers
  (source.customers || []).forEach(c => {
    const exists = (target.customers || []).some(tc => tc.taxCode === c.taxCode || tc.name === c.name);
    if (!exists) target.customers.push(c);
  });

  // 5. Cập nhật tên nếu target chưa có tên
  if (!target.name || target.name === targetTaxCode) {
    target.name = source.name || targetTaxCode;
  }

  // 6. Xóa HKD nguồn
  delete hkdData[sourceTaxCode];
  hkdOrder = hkdOrder.filter(tc => tc !== sourceTaxCode);

  // 7. Cập nhật currentTaxCode nếu đang chọn HKD nguồn
  if (currentTaxCode === sourceTaxCode) {
    currentTaxCode = targetTaxCode;
  }

  // Lưu và render lại
  window.saveDataToLocalStorage();
  window.logAction(`Gộp HKD ${sourceTaxCode} vào ${targetTaxCode}`, snapshot);
  window.renderHKDList();
  if (currentTaxCode) window.renderHKDTab(currentTaxCode);

  // Đóng popup
  const popup = document.getElementById('mergePopup');
  if (popup) popup.remove();

  window.showToast(`✅ Đã gộp ${sourceTaxCode} vào ${targetTaxCode}`, 3000, 'success');
}

// Hàm chuẩn hóa tên để so sánh: chuẩn hóa Unicode NFC, trim, lowercase, xóa khoảng trắng thừa
function normalizeName(str) {
  return (str || '')
    .normalize('NFC')        // Chuẩn hóa Unicode về dạng tổ hợp (tránh NFD vs NFC)
    .trim()
    .replace(/\s+/g, ' ')    // Xóa khoảng trắng thừa (nhiều spaces -> 1 space)
    .toLowerCase();
}

// Hàm so sánh tên không dấu (fallback khi so sánh có dấu không khớp)
function normalizeNameNoAccent(str) {
  return normalizeName(str)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');
}

// Gộp mảng tồn kho - nếu trùng tên + ĐVT thì cộng dồn số lượng
function mergeInventoryArray(target, source, field) {
  const targetItems = target[field] || [];
  const sourceItems = source[field] || [];

  sourceItems.forEach(sourceItem => {
    const sourceNameNorm = normalizeName(sourceItem.name);
    const sourceUnitNorm = normalizeName(sourceItem.unit);
    // Fallback không dấu
    const sourceNameNoAccent = normalizeNameNoAccent(sourceItem.name);
    const sourceUnitNoAccent = normalizeNameNoAccent(sourceItem.unit);
    
    // Tìm item trùng trong target (cùng tên và cùng đơn vị)
    const existing = targetItems.find(ti => {
      const tiNameNorm = normalizeName(ti.name);
      const tiUnitNorm = normalizeName(ti.unit);
      
      // So sánh có dấu trước
      if (tiNameNorm === sourceNameNorm && tiUnitNorm === sourceUnitNorm) return true;
      
      // Fallback: so sánh không dấu (phòng trường hợp dữ liệu nhập từ nhiều nguồn khác encoding)
      const tiNameNoAccent = normalizeNameNoAccent(ti.name);
      const tiUnitNoAccent = normalizeNameNoAccent(ti.unit);
      return tiNameNoAccent === sourceNameNoAccent && tiUnitNoAccent === sourceUnitNoAccent;
    });

    if (existing) {
      // Gộp: cộng số lượng, giữ nguyên đơn giá (lấy giá TB nếu khác)
      const existingQty = parseFloat(existing.quantity || 0);
      const sourceQty = parseFloat(sourceItem.quantity || 0);
      const existingPrice = parseFloat(existing.price || 0);
      const sourcePrice = parseFloat(sourceItem.price || 0);
      
      existing.quantity = (existingQty + sourceQty).toString();
      
      // Tính giá bình quân
      if (existingPrice > 0 && sourcePrice > 0) {
        const totalValue = (existingQty * existingPrice) + (sourceQty * sourcePrice);
        const totalQty = existingQty + sourceQty;
        existing.price = (totalValue / totalQty).toFixed(2);
      } else if (sourcePrice > 0) {
        existing.price = sourcePrice.toString();
      }
      
      // Cộng thành tiền
      const existingAmount = parseFloat(existing.amount || 0);
      const sourceAmount = parseFloat(sourceItem.amount || 0);
      existing.amount = (existingAmount + sourceAmount).toString();

      // Ưu tiên giữ mã SP đã có (không ghi đè nếu đã có mã)
      if (!existing.productCode || existing.productCode === 'N/A') {
        existing.productCode = sourceItem.productCode || existing.productCode;
      }
      // Giữ _misaMatchPercent cao nhất
      const existingPct = existing._misaMatchPercent;
      const sourcePct = sourceItem._misaMatchPercent;
      if (sourcePct !== undefined && sourcePct !== null) {
        if (existingPct === undefined || existingPct === null || sourcePct > existingPct) {
          existing._misaMatchPercent = sourcePct;
        }
      }
    } else {
      // Không trùng -> thêm mới
      targetItems.push({ ...sourceItem });
    }
  });

  target[field] = targetItems;
}

// Gắn vào window
window.openMergePopup = openMergePopup;
window.executeMerge = executeMerge;
