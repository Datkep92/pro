// ============================================================
// CHI TIẾT HÓA ĐƠN - SO SÁNH BẢNG TRÍCH XUẤT VS XML GỐC
// ============================================================

/**
 * Hiển thị popup chi tiết hóa đơn với 2 bảng song song:
 * - Bảng trái: dữ liệu trích xuất
 * - Bảng phải: XML Tree View chuyên nghiệp (có expand/collapse)
 * So sánh từng dòng để phát hiện chênh lệch
 */
function renderInvoiceDetail(taxCode, mccqt) {
  const hkd = hkdData[taxCode];
  if (!hkd || !Array.isArray(hkd.invoices)) return;

  const invoice = hkd.invoices.find(inv => inv.invoiceInfo?.mccqt === mccqt);
  if (!invoice) {
    showToast(`❌ Không tìm thấy hóa đơn ${mccqt}`, 2000, 'error');
    return;
  }
  // Lưu invoice hiện tại để các hàm global có thể truy cập
  window._currentInvoice = invoice;

  const products = invoice.products || [];
  const totals = invoice.totals || {};
  const calculatedTotal = totals.total || 0;
  const xmlDeclared = totals.xmlDeclared || 0;
  const hasDiff = calculatedTotal !== xmlDeclared;
  const diffAmount = Math.abs(calculatedTotal - xmlDeclared);
  // Nếu chênh 1đ do làm tròn thuế, đã được tự động sửa trong parseXmlInvoice, nên coi như khớp
  const isRoundingDiff = hasDiff && diffAmount === 1;

  // Header thông tin hóa đơn
  const invNumber = invoice.invoiceInfo?.number || mccqt;
  const invDate = invoice.invoiceInfo?.date || 'Không rõ';
  const invSymbol = invoice.invoiceInfo?.symbol || '';
  const invTemplate = invoice.invoiceInfo?.template || '';

  // Tổng quan so sánh
  const diffLabel = hasDiff && !isRoundingDiff
    ? `<span style="color:#e53935;font-weight:bold;">⚠️ CHÊNH LỆCH: ${diffAmount.toLocaleString()}đ</span>`
    : `<span style="color:#43a047;font-weight:bold;">✅ KHỚP</span>`;

  // Parse XML gốc để lấy dữ liệu song song
  let xmlProducts = [];
  let xmlTotals = { beforeTax: 0, tax: 0, total: 0 };
  const rawXml = invoice.rawXml || '';
  if (rawXml) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawXml, 'text/xml');
      const getText = (path, parent = xmlDoc) => {
        const node = parent.querySelector(path);
        return node ? node.textContent.trim() : '';
      };
      // Lấy sản phẩm từ XML gốc - dùng THHDVu thay vì Ten
      const productNodes = xmlDoc.querySelectorAll('HDon > DLHDon > NDHDon > DSHHDVu > HHDVu');
      productNodes.forEach((node, idx) => {
        const name = getText('THHDVu', node) || getText('Ten', node) || '';
        const unit = getText('DVTinh', node) || getText('DVT', node) || '';
        const qty = parseFloat(getText('SLuong', node)) || 0;
        const price = parseFloat(getText('DGia', node)) || 0;
        const amount = parseFloat(getText('ThTien', node)) || 0;
        const taxRate = parseFloat(getText('TSuat', node)) || 0;
        const discount = parseFloat(getText('CKhau', node) || getText('TLCKhau', node)) || 0;
        xmlProducts.push({ idx: idx + 1, name, unit, qty, price, amount, taxRate, discount });
      });
      // Lấy tổng tiền từ XML gốc
      const ttoanNode = xmlDoc.querySelector('HDon > DLHDon > NDHDon > TToan');
      if (ttoanNode) {
        xmlTotals.beforeTax = parseFloat(getText('TgTThue', ttoanNode)) || 0;
        xmlTotals.tax = parseFloat(getText('TgTCThue', ttoanNode)) || 0;
        xmlTotals.total = parseFloat(getText('TgTTTBSo', ttoanNode)) || 0;
      }
    } catch (e) {
      console.warn('⚠️ Không parse được XML gốc:', e);
    }
  }

  // Style chung
  const cellStyle = 'padding:3px 5px;font-size:0.78em;';
  const thStyle = cellStyle + 'background:#1565c0;color:white;font-weight:bold;text-align:center;';

  // --- TẠO HTML VỚI 2 BẢNG SONG SONG ---
  let html = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="flex-shrink:0;padding:8px 12px 0 12px;">
        <h3 style="margin:4px 0 2px 0;font-size:1em;">📄 Hóa đơn: ${invNumber}</h3>
        <div style="margin-bottom:4px; color:#555;font-size:0.8em;">
          📅 ${invDate}
          ${invSymbol ? ` | Ký hiệu: ${invSymbol}` : ''}
          ${invTemplate ? ` | Mẫu: ${invTemplate}` : ''}
        </div>
        <!-- Thanh tổng quan -->
        <div style="margin-bottom:6px; padding:6px 8px; background:#f5f5f5; border-radius:4px; display:flex; gap:8px; flex-wrap:wrap; font-size:0.78em;">
          <div><div style="color:#888;">Tổng tính toán</div><b>${calculatedTotal.toLocaleString()}đ</b></div>
          <div><div style="color:#888;">Tổng XML (TgTTTBSo)</div><b>${xmlDeclared.toLocaleString()}đ</b></div>
          <div><div style="color:#888;">Trước thuế</div>${(totals.beforeTax || 0).toLocaleString()}đ</div>
          <div><div style="color:#888;">Thuế</div>${(totals.tax || 0).toLocaleString()}đ</div>
          <div><div style="color:#888;">Chiết khấu</div>${(totals.discount || 0).toLocaleString()}đ</div>
          <div style="display:flex;align-items:center;padding-left:6px;border-left:2px solid #ddd;">${diffLabel}</div>
        </div>
      </div>
      <!-- Container 2 bảng song song, scroll khi dài -->
      <div style="display:flex; gap:6px; flex:1; min-height:0; padding:0 12px 12px 12px;">
        <!-- BẢNG TRÁI: DỮ LIỆU TRÍCH XUẤT -->
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden;">
          <div style="font-weight:bold;font-size:0.8em;margin-bottom:2px;color:#1565c0;flex-shrink:0;">📊 Bảng trích xuất</div>
          <div style="flex:1; overflow:auto; border:1px solid #ddd; border-radius:4px;">
          <table border="1" cellpadding="0" cellspacing="0" style="width:100%; background:#fff; border-collapse:collapse; font-size:0.78em;">
            <thead>
              <tr>
                <th ${thStyle} style="width:30px;">STT</th>
                <th ${thStyle} style="width:50px;">Tính chất</th>
                <th ${thStyle} style="width:80px;">Loại HH</th>
                <th ${thStyle}>Tên hàng hóa, dịch vụ</th>
                <th ${thStyle} style="width:50px;">ĐVT</th>
                <th ${thStyle} style="width:50px;">SL</th>
                <th ${thStyle} style="width:70px;">Đơn giá</th>
                <th ${thStyle} style="width:60px;">Chiết khấu</th>
                <th ${thStyle} style="width:50px;">Thuế suất</th>
                <th ${thStyle} style="width:90px;">Thành tiền</th>
                <th ${thStyle} style="width:70px;">XML T.Tiền</th>
              </tr>
            </thead>
            <tbody>`;

  products.forEach((p, i) => {
    const isDiff = p.__diff === true;
    const rowBg = isDiff ? 'background:#ffebee;' : (i % 2 === 0 ? 'background:#fafafa;' : '');
    const xmlAmount = p.xmlAmount !== undefined ? p.xmlAmount.toLocaleString() : '';
    // Tính chất: 1=Hàng hóa, 3=Dịch vụ,...
    const tchatLabel = p.tchat === 3 ? 'DV' : (p.tchat === 2 ? 'HH' : 'HH');
    const codeLabel = p.code || '';
    html += `
      <tr style="${rowBg}">
        <td ${cellStyle}style="text-align:center;">${i + 1}</td>
        <td ${cellStyle}style="text-align:center;">${tchatLabel}</td>
        <td ${cellStyle}style="text-align:center;">${codeLabel}</td>
        <td ${cellStyle}>${p.name || ''}${isDiff ? ' ⚠️' : ''}</td>
        <td ${cellStyle}style="text-align:center;">${p.unit || ''}</td>
        <td ${cellStyle}style="text-align:right;">${p.quantity}</td>
        <td ${cellStyle}style="text-align:right;">${parseFloat(p.price).toLocaleString()}</td>
        <td ${cellStyle}style="text-align:right;">${parseFloat(p.discount).toLocaleString()}</td>
        <td ${cellStyle}style="text-align:center;">${p.taxRate}%</td>
        <td ${cellStyle}style="text-align:right;${isDiff ? 'color:#e53935;font-weight:bold;' : ''}">${p.amount.toLocaleString()}</td>
        <td ${cellStyle}style="text-align:right;${isDiff ? 'color:#e53935;' : ''}">${xmlAmount}</td>
      </tr>`;
  });

  // Thêm dòng tổng cho bảng trích xuất
  const sumQty = products.reduce((s, p) => s + parseFloat(p.quantity || 0), 0);
  const sumAmount = products.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  html += `
    <tr style="background:#e3f2fd;font-weight:bold;">
      <td ${cellStyle}style="text-align:center;"></td>
      <td ${cellStyle}></td>
      <td ${cellStyle}></td>
      <td ${cellStyle}>Tổng (${products.length} SP)</td>
      <td ${cellStyle}></td>
      <td ${cellStyle}style="text-align:right;">${sumQty}</td>
      <td ${cellStyle}></td>
      <td ${cellStyle}></td>
      <td ${cellStyle}></td>
      <td ${cellStyle}style="text-align:right;color:#1565c0;">${sumAmount.toLocaleString()}</td>
      <td ${cellStyle}></td>
    </tr>`;

  html += `</tbody></table>`;

  // Thông tin người bán
  const seller = invoice.sellerInfo || {};
  if (seller.name) {
    html += `<div style="margin-top:6px;padding:4px 8px;background:#f9f9f9;border-radius:3px;font-size:0.75em;color:#555;"><b>Người bán:</b> ${seller.name}${seller.taxCode ? ` | MST: ${seller.taxCode}` : ''}</div>`;
  }

  html += `</div></div>`; // đóng scroll div + đóng bảng trái

  // ============================================================
  // BẢNG PHẢI: HÓA ĐƠN GỐC (INVOICE.HTML TỪ ZIP)
  // ============================================================
  const htmlUrl = invoice.htmlUrl || '';
  html += `
        <!-- BẢNG PHẢI: HÓA ĐƠN GỐC -->
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden;">
          <div style="font-weight:bold;font-size:0.8em;margin-bottom:2px;color:#e65100;flex-shrink:0;">📄 Hóa đơn gốc (invoice.html)</div>`;

  if (htmlUrl) {
    html += `
          <div style="flex:1; border:1px solid #ddd; border-radius:4px; overflow:hidden; background:#fff;">
            <iframe src="${htmlUrl}" style="width:100%; height:100%; border:none;" sandbox="allow-same-origin"></iframe>
          </div>`;
  } else if (rawXml) {
    // Fallback: hiển thị XML tree view nếu không có htmlUrl
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawXml, 'text/xml');
      const treeHtml = buildXmlTree(xmlDoc.documentElement, 0);
      html += `
          <div style="flex:1; overflow:auto; background:#1e1e1e;color:#d4d4d4;border-radius:4px;padding:8px;font-family:'Consolas','Courier New',monospace;font-size:0.78em;border:1px solid #333;">
            <div style="color:#888;font-size:0.85em;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #333;">
              📄 ${xmlDoc.documentElement.tagName}
              <span style="color:#666;"> (${xmlDoc.documentElement.children.length} nodes)</span>
            </div>
            ${treeHtml}
          </div>`;
    } catch (e) {
      html += `<div style="color:#e53935;padding:8px;background:#ffebee;border-radius:4px;font-size:0.78em;">❌ Lỗi parse XML: ${e.message}</div>`;
    }
  } else {
    html += `<div style="padding:12px;background:#f5f5f5;border-radius:4px;text-align:center;color:#999;font-size:0.85em;">Không có dữ liệu hóa đơn gốc<br><span style="font-size:0.85em;color:#bbb;">(chỉ có từ hóa đơn mới nhập)</span></div>`;
  }

  // XML Tree View dạng expandable bên dưới
  if (rawXml) {
    html += `
          <details style="margin-top:4px;flex-shrink:0;">
            <summary style="cursor:pointer;font-size:0.75em;color:#888;padding:3px 6px;background:#f5f5f5;border-radius:3px;user-select:none;">
              📋 Xem XML gốc (Tree View)
            </summary>
            <div style="margin-top:4px;">
              <button onclick="copyRawXml()" style="padding:2px 6px;background:#e65100;color:white;border:none;border-radius:3px;cursor:pointer;font-size:0.72em;float:right;">📋 Copy XML</button>
              <div style="clear:both;"></div>`;
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawXml, 'text/xml');
      const treeHtml = buildXmlTree(xmlDoc.documentElement, 0);
      html += `
              <div style="background:#1e1e1e;color:#d4d4d4;border-radius:4px;padding:6px;font-family:'Consolas','Courier New',monospace;font-size:0.72em;overflow:auto;max-height:200px;border:1px solid #333;margin-top:4px;">
                ${treeHtml}
              </div>`;
    } catch (e) {
      html += `<div style="color:#e53935;padding:6px;font-size:0.78em;">❌ ${e.message}</div>`;
    }
    html += `</div></details>`;
  }

  html += `</div>`; // đóng bảng phải
  html += `</div>`; // đóng container song song
  html += `</div>`; // đóng outer flex container

  window.showPopup(html, `Chi tiết hóa đơn ${invNumber}`);
}
window.renderInvoiceDetail = renderInvoiceDetail;

/**
 * Xây dựng XML Tree View từ DOM node
 * @param {Node} node - DOM node
 * @param {number} depth - độ sâu hiện tại
 * @returns {string} HTML tree
 */
function buildXmlTree(node, depth) {
  if (!node) return '';
  
  const tagName = node.tagName || '';
  if (!tagName) return '';
  
  const indent = depth * 20;
  const hasChildren = node.children.length > 0;
  const nodeId = 'xml-node-' + Math.random().toString(36).substr(2, 6);
  const isExpanded = depth < 2; // auto-expand 2 cấp đầu
  
  // Lấy attributes
  let attrs = '';
  if (node.attributes && node.attributes.length > 0) {
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      attrs += ` <span style="color:#9cdcfe;">${attr.name}</span>=<span style="color:#ce9178;">"${escapeHtml(attr.value)}"</span>`;
    }
  }
  
  // Lấy text content nếu là leaf node
  let textContent = '';
  if (!hasChildren) {
    const text = (node.textContent || '').trim();
    if (text) {
      textContent = `<span style="color:#ce9178;">${escapeHtml(text)}</span>`;
    }
  }
  
  let html = '';
  const toggleIcon = hasChildren 
    ? `<span class="xml-toggle" onclick="toggleXmlNode('${nodeId}')" style="cursor:pointer;user-select:none;color:#888;margin-right:2px;">${isExpanded ? '▼' : '▶'}</span>`
    : '<span style="color:#888;margin-right:2px;margin-left:12px;"> </span>';
  
  const displayStyle = depth > 2 && !isExpanded ? 'display:none;' : '';
  
  html += `<div id="${nodeId}" style="margin-left:${indent}px;white-space:nowrap;${displayStyle}line-height:1.6;">
    ${toggleIcon}<span style="color:#569cd6;"><</span><span style="color:#569cd6;">${tagName}</span>${attrs}${hasChildren ? '<span style="color:#569cd6;">></span>' : ''}${textContent ? ' ' + textContent : ''}`;
  
  if (hasChildren) {
    // Đệ quy children
    for (let i = 0; i < node.children.length; i++) {
      html += buildXmlTree(node.children[i], depth + 1);
    }
    // Close tag
    html += `<div style="margin-left:${indent}px;white-space:nowrap;${displayStyle}line-height:1.6;">
      <span style="color:#888;margin-left:12px;"> </span><span style="color:#569cd6;"></</span><span style="color:#569cd6;">${tagName}</span><span style="color:#569cd6;">></span>
    </div>`;
  } else {
    html += `<span style="color:#569cd6;"></</span><span style="color:#569cd6;">${tagName}</span><span style="color:#569cd6;">></span>`;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Toggle expand/collapse XML node (global function)
 */
function toggleXmlNode(nodeId) {
  const container = document.getElementById(nodeId);
  if (!container) return;
  
  // Tìm tất cả children div trực tiếp
  const children = container.querySelectorAll(':scope > div');
  const toggle = container.querySelector('.xml-toggle');
  
  if (children.length > 0) {
    const isHidden = children[0].style.display === 'none';
    children.forEach(child => {
      child.style.display = isHidden ? '' : 'none';
    });
    if (toggle) {
      toggle.textContent = isHidden ? '▼' : '▶';
    }
  }
}
window.toggleXmlNode = toggleXmlNode;

// Hàm copy XML gốc (global)
function copyRawXml() {
  const invoice = window._currentInvoice;
  if (!invoice || !invoice.rawXml) {
    showToast('❌ Không có dữ liệu XML gốc', 1500, 'error');
    return;
  }
  const textArea = document.createElement('textarea');
  textArea.value = invoice.rawXml;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  showToast('✅ Đã copy XML gốc vào clipboard', 1500, 'success');
}
window.copyRawXml = copyRawXml;
