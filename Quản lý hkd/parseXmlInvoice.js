function parseXmlInvoice(xmlContent) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const getText = (path, parent = xmlDoc) => {
    const node = parent.querySelector(path);
    return node ? node.textContent.trim() : '';
  };

  const getAdditionalInfo = (fieldName) => {
    const ttKhacNode = xmlDoc.querySelector('HDon > DLHDon > NDHDon > TToan > TTKhac');
    if (ttKhacNode) {
      const nodes = ttKhacNode.querySelectorAll('TTin');
      for (const node of nodes) {
        const field = node.querySelector('TTruong');
        if (field && field.textContent.trim() === fieldName) {
          return node.querySelector('DLieu')?.textContent.trim() || '';
        }
      }
    }
    return '';
  };

  const invoiceInfo = {
    title: getText('HDon > DLHDon > TTChung > THDon'),
    template: getText('HDon > DLHDon > TTChung > KHHDon'),
    symbol: getText('HDon > DLHDon > TTChung > KHMSHDon'),
    number: getText('HDon > DLHDon > TTChung > SHDon'),
    date: getText('HDon > DLHDon > TTChung > NLap'),
    paymentMethod: getText('HDon > DLHDon > TTChung > HTTToan'),
    paymentStatus: getAdditionalInfo('Trạng thái thanh toán'),
    amountInWords: getAdditionalInfo('TotalAmountInWordsByENG') || '',
    mccqt: getText('HDon > MCCQT')?.toUpperCase() || ''
  };

  const sellerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NBan > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NBan > MST'),
    address: getText('HDon > DLHDon > NDHDon > NBan > DChi'),
    phone: getText('HDon > DLHDon > NDHDon > NBan > SDThoai'),
    email: getText('HDon > DLHDon > NDHDon > NBan > DCTDTu')
  };

  const buyerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NMua > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NMua > MST'),
    address: getText('HDon > DLHDon > NDHDon > NMua > DChi'),
    customerCode: getText('HDon > DLHDon > NDHDon > NMua > MKHang'),
    idNumber: getText('HDon > DLHDon > NDHDon > NMua > CCCDan')
  };

  const products = [];
  const productNodes = xmlDoc.querySelectorAll('HHDVu');
  let totalManual = 0;
  let totalTaxManual = 0;

  productNodes.forEach((node, index) => {
    const stt = index + 1;

    const tchat = parseInt(getText('TChat', node) || '1');
    const name = getText('THHDVu', node) || '';
    const code = getText('MaSP', node) || '';
    const unit = getText('DVTinh', node) || '';
    const quantity = parseFloat(getText('SLuong', node) || '0');
    const price = parseFloat(getText('DGia', node) || '0');
    const discount = parseFloat(getText('CKhau', node) || getText('STCKhau', node) || '0');
    const xmlThTien = parseFloat(getText('ThTien', node) || '0');

    // ✅ Chuẩn hóa thuế suất
    const taxRateText = getText('TSuat', node).trim();
    const rawTax = taxRateText.toLowerCase().replace('%', '');
    let taxRate = 0;
    if (rawTax === 'kct' || rawTax === 'không chịu thuế' || rawTax === '') {
      taxRate = 0;
    } else if (!isNaN(parseFloat(rawTax))) {
      taxRate = parseFloat(rawTax);
    }

    let amount = quantity * price;
    // Ưu tiên dùng ThTien từ XML (đã được làm tròn và tính chiết khấu sẵn)
    if (xmlThTien !== 0) {
      amount = xmlThTien;
    }

    // ✅ Phân loại sản phẩm
    let category = 'hang_hoa';
    const lowerName = name.toLowerCase();
    const isCKText = lowerName.includes('chiết khấu') || lowerName.includes('ck');
    const isCKTMKeyword = lowerName.includes('cktm');
    const isCKTMByAmount = (quantity === 0 && tchat === 3 && amount !== 0);
    const isChietKhau = isCKTMByAmount || isCKText || isCKTMKeyword;

    if (quantity === 0 && amount === 0) {
      category = 'KM';
    } else if (tchat === 3 && isChietKhau) {
      category = 'chiet_khau';
    } else if (quantity > 0 && amount > 0) {
      category = 'hang_hoa';
    }

    if (category === 'chiet_khau' && amount > 0) {
      amount = -Math.abs(amount); // chuẩn hóa về số âm
    }

    totalManual += amount;
    totalTaxManual += Math.round((amount * taxRate) / 100);

    products.push({
      stt,
      code,
      name,
      unit,
      quantity: quantity.toString(),
      price: price.toString(),
      discount: discount.toString(),
      amount,
      taxRate,
      taxRateText,
      category,
      tchat,
      __diff: Math.abs(amount - xmlThTien) >= 1,
      xmlAmount: Math.round(xmlThTien),
      isFree: price === 0
    });
  });

  const ttCKTMai = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TTCKTMai') || '0');
  const tgTThue = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTThue') || '0');
  const tgTTTBSo = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTTTBSo') || '0');
  const tgTCThue = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTCThue') || '0');

  const xmlBeforeTax = Math.round(tgTThue);
  const xmlTax = Math.round(tgTCThue);
  const xmlTotal = Math.round(tgTTTBSo);

  // ✅ Ưu tiên giá trị XML cho thuế (TgTCThue) và tổng tiền (TgTTTBSo)
  // Vì XML tính thuế trên tổng trước thuế (làm tròn 1 lần) khác với tính từng dòng
  const finalBeforeTax = Math.round(totalManual);
  const finalTax = (xmlTax > 0 && Math.abs(Math.round(totalTaxManual) - xmlTax) <= 10) ? xmlTax : Math.round(totalTaxManual);
  const finalTotal = (xmlTotal > 0 && Math.abs(Math.round(totalManual + totalTaxManual) - xmlTotal) <= 10) ? xmlTotal : Math.round(totalManual + totalTaxManual);

  const totals = {
    beforeTax: finalBeforeTax,
    tax: finalTax,
    fee: 0,
    discount: Math.round(ttCKTMai),
    total: finalTotal,
    xmlDeclared: xmlTotal,
    TgTCThue: xmlTax
  };

  return { invoiceInfo, sellerInfo, buyerInfo, products, totals, rawXml: xmlContent };
}
// parseXmlInvoice.js – GIỮ NGUYÊN LOGIC TÌM XML TRONG ZIP

async function extractInvoiceFromZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const xmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.xml'));
    
    if (xmlFiles.length === 0) {
      window.showToast(`Không tìm thấy file XML trong: ${file.name}`, 'error');
      return null;
    }

    const xmlText = await zip.file(xmlFiles[0]).async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    if (xmlDoc.querySelector('parsererror')) {
      throw new Error('XML không hợp lệ');
    }

    const getText = (selector) => {
      const node = xmlDoc.querySelector(selector);
      return node ? node.textContent.trim() : '';
    };

    const products = Array.from(xmlDoc.querySelectorAll('DSHDon > HHDVu')).map(row => {
      const name = getText('THang') || getText('Ten');
      const qty = parseFloat(getText('SLuong')) || 0;
      const price = parseFloat(getText('DGia')) || 0;
      const amount = parseFloat(getText('ThTien')) || 0;
      const unit = getText('DVTinh') || 'Cái';
      const category = getText('LHHoa')?.toLowerCase().includes('km') ? 'KM' : 'hang_hoa';

      return { name, quantity: qty, price, amount, unit, category, lineDiscount: 0 };
    }).filter(p => p.quantity > 0);

    if (products.length === 0) {
      window.showToast(`Không có sản phẩm trong: ${file.name}`, 'info');
      return null;
    }

    const invoice = {
      invoiceInfo: {
        mccqt: getText('MCCQT') || getText('MaCQT'),
        number: getText('SHDon'),
        date: getText('NLap')
      },
      buyerInfo: {
        name: getText('TenNMa'),
        taxCode: getText('MSTNMa')
      },
      sellerInfo: {
        name: getText('TenNBan'),
        taxCode: getText('MSTNban')
      },
      products
    };

    return invoice;

  } catch (err) {
    console.error('Lỗi đọc ZIP:', err);
    window.showToast(`Lỗi đọc ZIP: ${file.name}`, 'error');
    return null;
  }
}

// GÁN TOÀN CỤC
window.extractInvoiceFromZip = extractInvoiceFromZip;