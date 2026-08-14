// ============================================================
// Tự động nhận diện loại file Excel
// ============================================================

/**
 * Nhận diện loại file dựa vào cấu trúc rows và tên file
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @param {string} [fileName] - Tên file (để fallback khi nội dung không đủ)
 * @returns {string} - Loại file (FILE_TYPES.*)
 */
function detectFileType(rows, fileName) {
    // --- Bước 0: Kiểm tra nội dung file ---
    if (rows && rows.length >= 3) {
        // --- Bước 1: Kiểm tra Sao kê ngân hàng ---
        // Header có "SAO KÊ TÀI KHOẢN" hoặc "Ngày GD", "Số tham chiếu", "Nợ", "Có", "Mô tả"
        if (isSaoKeNganHang(rows)) {
            return FILE_TYPES.SAO_KE_NGAN_HANG;
        }

        // --- Bước 2: Kiểm tra Danh sách khách hàng ---
        // Header R1: Mã KH, Tên KH, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi
        if (isDanhSachKhachHang(rows)) {
            return FILE_TYPES.DANH_SACH_KHACH_HANG;
        }

        // --- Bước 3: Kiểm tra Danh sách nhà cung cấp ---
        // Header R1: Mã NCC, Tên NCC, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi
        if (isDanhSachNhaCungCap(rows)) {
            return FILE_TYPES.DANH_SACH_NHA_CUNG_CAP;
        }

        // --- Bước 4: Kiểm tra Mẫu phiếu thu ---
        // Header: Ngày hạch toán, Mã đối tượng, Tên đối tượng, ...
        if (isMauPhieuThu(rows)) {
            return FILE_TYPES.MAU_PHIEU_THU;
        }

        // --- Bước 5: Kiểm tra Mẫu phiếu chi ---
        // Header: Phương thức thanh toán, Tài khoản chi, Mã NCC, ...
        if (isMauPhieuChi(rows)) {
            return FILE_TYPES.MAU_PHIEU_CHI;
        }

        // --- Bước 6: Kiểm tra Bảng kê bán ra ---
        // Header dòng 1 (index 0), có fill-down pattern
        // Cột 0 = Số HĐ, cột 1 = Ngày (serial), cột 2 = Tên, cột 5 = Tiền
        if (isBangKeBanRa(rows)) {
            return FILE_TYPES.BANG_KE_BAN_RA;
        }

        // --- Bước 7: Kiểm tra Bảng kê mua vào ---
        // Header dòng 4 (index 3), mỗi dòng có số HĐ
        if (isBangKeMuaVao(rows)) {
            return FILE_TYPES.BANG_KE_MUA_VAO;
        }

        // --- Bước 8: Kiểm tra Hóa đơn (header dòng 4, index 3) ---
        const headerRow4 = rows[3];
        if (headerRow4 && Array.isArray(headerRow4)) {
            const colCount = headerRow4.length;

            // Hóa đơn 19 cột (đã cấp mã hoặc không cấp mã)
            if (colCount >= 18 && colCount <= 20) {
                return detectHoaDon19Cot(rows);
            }

            // Hóa đơn 17 cột (máy tính tiền)
            if (colCount >= 16 && colCount <= 18) {
                return detectHoaDon17Cot(rows);
            }
        }
    }

    // --- Bước 9: Fallback dựa trên tên file (khi nội dung không đủ để phân tích) ---
    // Xử lý các file template rỗng (mẫu quản trị) chỉ có 1 dòng [""]
    if (fileName) {
        const nameUpper = fileName.toUpperCase().replace(/\.(XLSX|XLS)$/i, '');

        // Kiểm tra Bảng kê bán ra (mẫu quản trị)
        // Pattern: BANG_KE...BAN_RA...(MAU_QUAN_TRI)
        if (isBangKeBanRaByName(nameUpper)) {
            return FILE_TYPES.BANG_KE_BAN_RA;
        }

        // Kiểm tra Bảng kê mua vào (mẫu quản trị)
        // Pattern: BANG_KE...MUA_VAO...(MAU_QUAN_TRI)
        if (isBangKeMuaVaoByName(nameUpper)) {
            return FILE_TYPES.BANG_KE_MUA_VAO;
        }
    }

    return FILE_TYPES.UNKNOWN;
}

/**
 * Kiểm tra có phải Bảng kê bán ra không
 * Đặc điểm: header có "Số hóa đơn", "Ngày hóa đơn", "Tên người mua"
 * Cột 0 = Số HĐ (có thể rỗng), cột 1 = Ngày (serial date), cột 2 = Tên, cột 5 = Tiền
 * File thực tế: KHÔNG có số HĐ ở cột 0 (tất cả đều rỗng), chỉ có ngày, tên, tiền
 *
 * LƯU Ý: Header có thể ở dòng 0 (file thường) hoặc dòng 3 (file mẫu quản trị có title)
 */
function isBangKeBanRa(rows) {
    // Tìm dòng header - tìm dòng có chứa "Số hóa đơn" và "Ngày hóa đơn"
    let headerRow = -1;
    let header = null;
    
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 6) continue;
        
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('số hóa đơn') && rowStr.includes('ngày hóa đơn') && rowStr.includes('tên người mua')) {
            headerRow = i;
            header = row;
            break;
        }
    }
    
    if (headerRow < 0) return false;

    // Tìm dòng data đầu tiên (sau header, bỏ qua các dòng nhóm)
    let dataRow = -1;
    for (let i = headerRow + 1; i < Math.min(headerRow + 10, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        
        // Bỏ qua dòng nhóm (bắt đầu bằng "Nhóm")
        const col0 = String(row[0] || '').trim();
        if (col0.startsWith('Nhóm')) continue;
        
        // Kiểm tra cột 1 có serial date không
        const ngayRaw = row[1];
        const hasSerialDate = typeof ngayRaw === 'number' && ngayRaw > 40000 && ngayRaw < 70000;
        if (!hasSerialDate) continue;
        
        // Kiểm tra cột 2 có tên không
        const ten = String(row[2] || '').trim();
        if (!ten) continue;
        
        // Kiểm tra cột 5 có số tiền không
        const tien = parseFloat(row[5]);
        if (!isNaN(tien) && tien > 0) {
            dataRow = i;
            break;
        }
        
        // Thử cột 7 (thuế GTGT)
        const thue = parseFloat(row[7]);
        if (!isNaN(thue) && thue > 0) {
            dataRow = i;
            break;
        }
    }
    
    return dataRow >= 0;
}

/**
 * Kiểm tra có phải Bảng kê mua vào không
 * Đặc điểm: header dòng 4 (index 3), data bắt đầu từ dòng 5+ (có thể có dòng nhóm ở dòng 5)
 * Cột 0 = Số HĐ (dạng số, có leading zeros), cột 1 = Ngày (serial date), cột 2 = Tên người bán
 *
 * QUAN TRỌNG: Phân biệt với hóa đơn (cũng có header dòng 3 với "Số hóa đơn" và "Tên người bán"):
 * - Bảng kê mua vào: cột 0 = Số HĐ, cột 1 = serial date, header có "Mặt hàng" ở cột 4
 * - Hóa đơn: cột 3 = Số HĐ, cột 4 = ngày (dd/MM/yyyy), header có "STT" ở cột 0
 */
function isBangKeMuaVao(rows) {
    // Header dòng 4 (index 3) - phải có đủ cột và có từ khóa
    const header = rows[3];
    if (!header || header.length < 6) return false;

    // Kiểm tra header có chứa từ khóa "số hóa đơn" và "tên người bán"
    const headerStr = header.map(c => String(c || '').toLowerCase()).join(' ');
    if (!headerStr.includes('số hóa đơn') || !headerStr.includes('tên người bán')) {
        return false;
    }

    // Phân biệt với hóa đơn: bảng kê mua vào có "Mặt hàng" ở header, hóa đơn có "STT"
    // Bảng kê mua vào: cột 0 = Số HĐ, header có "Mặt hàng"
    // Hóa đơn: header có "STT" ở cột 0, "Ký hiệu mẫu số" ở cột 1
    if (headerStr.includes('stt') || headerStr.includes('ký hiệu mẫu số') || headerStr.includes('ký hiệu hóa đơn')) {
        return false; // Đây là hóa đơn, không phải bảng kê
    }

    // Tìm dòng data đầu tiên có số HĐ (dạng số) và serial date
    for (let i = 4; i < Math.min(20, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;

        const soHD = String(row[0] || '').trim();
        const ngayRaw = row[1];

        // Kiểm tra cột 0 có số HĐ không (dạng số hoặc chuỗi số)
        if (!soHD) continue;
        
        // Số HĐ có thể là số (286) hoặc chuỗi "0000286"
        const soHDNum = parseInt(soHD.replace(/^0+/, ''), 10);
        if (isNaN(soHDNum) || soHDNum <= 0) continue;

        // Kiểm tra cột 1 có serial date không
        if (typeof ngayRaw === 'number' && ngayRaw > 40000 && ngayRaw < 70000) {
            return true;
        }

        // Kiểm tra cột 2 có tên không
        const ten = String(row[2] || '').trim();
        if (ten && ten.length > 5) return true;
    }

    return false;
}

/**
 * Nhận diện hóa đơn 19 cột (đã cấp mã / không cấp mã)
 * Phân biệt bán ra vs mua vào dựa vào data (vì header giống nhau)
 *
 * Đặc điểm phân biệt:
 * - Hóa đơn BÁN RA: cột 8 = tên khách hàng (cá nhân, không chứa "CÔNG TY"/"TNHH")
 * - Hóa đơn MUA VÀO: cột 8 = tên công ty mình (chứa "CÔNG TY", "TNHH", "CHI NHÁNH")
 */
function detectHoaDon19Cot(rows) {
    const header = rows[3];
    if (!header) return FILE_TYPES.UNKNOWN;

    const row4 = rows[4];
    if (!row4) return FILE_TYPES.UNKNOWN;

    // Kiểm tra cột 3 có số HĐ không
    const soHD = String(row4[3] || '').trim();
    if (!soHD) return FILE_TYPES.UNKNOWN;

    // Kiểm tra cột 4 có ngày không (dd/MM/yyyy)
    const ngayRaw = String(row4[4] || '').trim();
    const hasDate = ngayRaw.includes('/');
    if (!hasDate) return FILE_TYPES.UNKNOWN;

    // Phân biệt bán ra / mua vào dựa vào TÊN ở cột 8 (tên người mua)
    // Bán ra: cột 8 = tên khách hàng cá nhân (ko có "CÔNG TY", "TNHH")
    // Mua vào: cột 8 = tên công ty mình (có "CÔNG TY", "TNHH", "CHI NHÁNH")
    const tenMua = String(row4[8] || '').trim().toUpperCase();
    const tenBan = String(row4[6] || '').trim().toUpperCase();
    
    // Nếu cột 8 là tên công ty (chứa CÔNG TY, TNHH, CHI NHÁNH) → mua vào
    const isCompanyName = tenMua.includes('CÔNG TY') || tenMua.includes('TNHH') || tenMua.includes('CHI NHÁNH');
    
    if (isCompanyName) {
        return FILE_TYPES.HD_MUA_VAO_DA_CAP_MA;
    }
    
    // Nếu cột 8 là tên cá nhân (ngắn, ko có từ khóa công ty) → bán ra
    if (tenMua && !tenBan) {
        return FILE_TYPES.HD_BAN_RA_DA_CAP_MA;
    }
    
    // Cả 2 đều có tên, cột 8 là cá nhân → bán ra
    if (tenMua && tenBan && !isCompanyName) {
        return FILE_TYPES.HD_BAN_RA_DA_CAP_MA;
    }

    return FILE_TYPES.UNKNOWN;
}

// ============================================================
// Fallback: Phát hiện dựa trên tên file (cho file template rỗng)
// ============================================================

/**
 * Kiểm tra tên file có phải Bảng kê bán ra không (dựa trên tên file)
 * Pattern: chứa "BANG_KE" hoặc "BẢNG KÊ" + "BAN_RA" hoặc "BÁN RA"
 * @param {string} nameUpper - Tên file IN HOA, đã bỏ đuôi .XLSX/.XLS
 * @returns {boolean}
 */
function isBangKeBanRaByName(nameUpper) {
    // Chuẩn hóa: thay dấu gạch dưới bằng khoảng trắng để dễ kiểm tra
    const normalized = nameUpper.replace(/_/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ');
    
    // Kiểm tra có chứa từ khóa "BẢNG KÊ" hoặc "BANG KE"
    const isBangKe = normalized.includes('BẢNG KÊ') || normalized.includes('BANG KE') || normalized.includes('BANG_KE');
    if (!isBangKe) return false;
    
    // Kiểm tra có chứa "BÁN RA" hoặc "BAN RA" hoặc "BAN_RA"
    const isBanRa = normalized.includes('BÁN RA') || normalized.includes('BAN RA') || normalized.includes('BAN_RA');
    if (!isBanRa) return false;
    
    // Loại trừ nếu có "MUA VÀO" hoặc "MUA VAO" (đề phòng tên file lẫn lộn)
    const isMuaVao = normalized.includes('MUA VÀO') || normalized.includes('MUA VAO') || normalized.includes('MUA_VAO');
    if (isMuaVao) return false;
    
    return true;
}

/**
 * Kiểm tra tên file có phải Bảng kê mua vào không (dựa trên tên file)
 * Pattern: chứa "BANG_KE" hoặc "BẢNG KÊ" + "MUA_VAO" hoặc "MUA VÀO"
 * @param {string} nameUpper - Tên file IN HOA, đã bỏ đuôi .XLSX/.XLS
 * @returns {boolean}
 */
function isBangKeMuaVaoByName(nameUpper) {
    // Chuẩn hóa: thay dấu gạch dưới bằng khoảng trắng để dễ kiểm tra
    const normalized = nameUpper.replace(/_/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ');
    
    // Kiểm tra có chứa từ khóa "BẢNG KÊ" hoặc "BANG KE"
    const isBangKe = normalized.includes('BẢNG KÊ') || normalized.includes('BANG KE') || normalized.includes('BANG_KE');
    if (!isBangKe) return false;
    
    // Kiểm tra có chứa "MUA VÀO" hoặc "MUA VAO" hoặc "MUA_VAO"
    const isMuaVao = normalized.includes('MUA VÀO') || normalized.includes('MUA VAO') || normalized.includes('MUA_VAO');
    if (!isMuaVao) return false;
    
    // Loại trừ nếu có "BÁN RA" hoặc "BAN RA" (đề phòng tên file lẫn lộn)
    const isBanRa = normalized.includes('BÁN RA') || normalized.includes('BAN RA') || normalized.includes('BAN_RA');
    if (isBanRa) return false;
    
    return true;
}

/**
 * Nhận diện hóa đơn 17 cột (máy tính tiền)
 *
 * Đặc điểm phân biệt:
 * - Hóa đơn BÁN RA máy tính tiền: cột 7 = "MST người mua", cột 8 = "Tên người mua" (tên cá nhân)
 * - Hóa đơn MUA VÀO máy tính tiền: cột 7 = "Địa chỉ người bán", cột 8 = "MST người mua", cột 9 = "Tên người mua" (tên công ty)
 */
function detectHoaDon17Cot(rows) {
    const header = rows[3];
    if (!header) return FILE_TYPES.UNKNOWN;

    const row4 = rows[4];
    if (!row4) return FILE_TYPES.UNKNOWN;

    // Kiểm tra cột 3 có số HĐ không
    const soHD = String(row4[3] || '').trim();
    if (!soHD) return FILE_TYPES.UNKNOWN;

    // Kiểm tra cột 4 có ngày không
    const ngayRaw = String(row4[4] || '').trim();
    const hasDate = ngayRaw.includes('/');
    if (!hasDate) return FILE_TYPES.UNKNOWN;

    // Phân biệt dựa vào header cột 7:
    // - Bán ra: cột 7 = "MST người mua/MST người nhận hàng"
    // - Mua vào: cột 7 = "Địa chỉ người bán"
    const col7Header = String(header[7] || '').toLowerCase();
    
    if (col7Header.includes('địa chỉ')) {
        return FILE_TYPES.HD_MUA_VAO_MAY_TINH_TIEN;
    }
    
    // Nếu cột 7 là MST → bán ra (kiểm tra thêm data để chắc chắn)
    const tenMua = String(row4[8] || '').trim().toUpperCase();
    const isCompanyName = tenMua.includes('CÔNG TY') || tenMua.includes('TNHH') || tenMua.includes('CHI NHÁNH');
    
    if (!isCompanyName) {
        return FILE_TYPES.HD_BAN_RA_MAY_TINH_TIEN;
    }

    return FILE_TYPES.UNKNOWN;
}

// ============================================================
// Phát hiện Sao kê ngân hàng
// ============================================================

/**
 * Kiểm tra có phải Sao kê ngân hàng không
 * Đặc điểm: header có "SAO KÊ TÀI KHOẢN" hoặc dòng chứa "Ngày GD", "Số tham chiếu", "Nợ", "Có", "Mô tả"
 * File Vietcombank: header ở dòng 10 (index 9), data từ dòng 11+
 * @param {Array} rows
 * @returns {boolean}
 */
function isSaoKeNganHang(rows) {
    // Kiểm tra dòng đầu tiên có "SAO KÊ TÀI KHOẢN" không
    const row0 = rows[0];
    if (row0 && Array.isArray(row0)) {
        const row0Str = row0.map(c => String(c || '').toUpperCase()).join(' ');
        if (row0Str.includes('SAO KÊ TÀI KHOẢN') || row0Str.includes('SAO KE TAI KHOAN')) {
            return true;
        }
    }

    // Tìm dòng header chứa "Ngày GD" + "Số tham chiếu" + ("Nợ" hoặc "Có") + "Mô tả"
    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 4) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');
        
        // Kiểm tra các từ khóa đặc trưng của sao kê ngân hàng
        const hasNgayGD = rowStr.includes('NGÀY GIAO DỊCH') || rowStr.includes('NGAY GIAO DICH') ||
                          rowStr.includes('NGÀY GD') || rowStr.includes('NGAY GD');
        const hasSoThamChieu = rowStr.includes('SỐ THAM CHIẾU') || rowStr.includes('SO THAM CHIEU') ||
                               rowStr.includes('SỐ REF') || rowStr.includes('SỐ CT') || rowStr.includes('SO CT');
        // Mở rộng: "Số tiền ghi nợ" / "Số tiền ghi có"
        const hasNoCo = rowStr.includes('NỢ') || rowStr.includes('NO') ||
                        rowStr.includes('CÓ') || rowStr.includes('CO') ||
                        rowStr.includes('SỐ TIỀN GHI NỢ') || rowStr.includes('SO TIEN GHI NO') ||
                        rowStr.includes('SỐ TIỀN GHI CÓ') || rowStr.includes('SO TIEN GHI CO') ||
                        rowStr.includes('GHI NỢ') || rowStr.includes('GHI NO') ||
                        rowStr.includes('GHI CÓ') || rowStr.includes('GHI CO');
        const hasMoTa = rowStr.includes('MÔ TẢ') || rowStr.includes('MO TA') ||
                        rowStr.includes('DIỄN GIẢI') || rowStr.includes('DIEN GIAI') ||
                        rowStr.includes('NỘI DUNG') || rowStr.includes('NOI DUNG');

        if (hasNgayGD && hasSoThamChieu && hasNoCo && hasMoTa) {
            return true;
        }
    }

    return false;
}

// ============================================================
// Phát hiện Danh sách khách hàng
// ============================================================

/**
 * Kiểm tra có phải Danh sách khách hàng không
 * Đặc điểm: header R1 có "Mã KH" hoặc "Mã khách hàng", "Tên KH" hoặc "Tên khách hàng", "MST"
 * File mẫu: Khach_hang (1).xlsx - header R1: [Mã KH, Tên KH, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi]
 * @param {Array} rows
 * @returns {boolean}
 */
function isDanhSachKhachHang(rows) {
    // Kiểm tra dòng 1 (index 0) hoặc dòng 2 (index 1)
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 3) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

        // Kiểm tra có "MÃ KH" hoặc "MÃ KHÁCH HÀNG"
        const hasMaKH = rowStr.includes('MÃ KH') || rowStr.includes('MA KH') ||
                        rowStr.includes('MÃ KHÁCH HÀNG') || rowStr.includes('MA KHACH HANG') ||
                        rowStr.includes('MÃ KHÁCH') || rowStr.includes('MA KHACH');
        
        // Kiểm tra có "TÊN KH" hoặc "TÊN KHÁCH HÀNG"
        const hasTenKH = rowStr.includes('TÊN KH') || rowStr.includes('TEN KH') ||
                         rowStr.includes('TÊN KHÁCH HÀNG') || rowStr.includes('TEN KHACH HANG') ||
                         rowStr.includes('TÊN KHÁCH') || rowStr.includes('TEN KHACH');
        
        // Kiểm tra có "MST" hoặc "MÃ SỐ THUẾ"
        const hasMST = rowStr.includes('MST') || rowStr.includes('MÃ SỐ THUẾ') || rowStr.includes('MA SO THUE') ||
                       rowStr.includes('MÃ SỐ THUẾ') || rowStr.includes('MA SO THUE');

        if (hasMaKH && hasTenKH && hasMST) {
            return true;
        }
        
        // Fallback: chỉ cần Mã KH + Tên KH (nếu không có MST)
        if (hasMaKH && hasTenKH) {
            // Kiểm tra thêm có "Địa chỉ" hoặc "Điện thoại" để chắc chắn
            const hasDiaChi = rowStr.includes('ĐỊA CHỈ') || rowStr.includes('DIA CHI');
            const hasDienThoai = rowStr.includes('ĐIỆN THOẠI') || rowStr.includes('DIEN THOAI');
            if (hasDiaChi || hasDienThoai) {
                return true;
            }
        }
        
        // Fallback 2: Kiểm tra "DANH SÁCH KHÁCH HÀNG" ở dòng trước
        if (hasMaKH && hasTenKH) {
            return true;
        }
    }

    return false;
}

// ============================================================
// Phát hiện Danh sách nhà cung cấp
// ============================================================

/**
 * Kiểm tra có phải Danh sách nhà cung cấp không
 * Đặc điểm: header R1 có "Mã NCC" hoặc "Mã nhà cung cấp", "Tên NCC" hoặc "Tên nhà cung cấp", "MST"
 * File mẫu: nha cung cap.xlsx - header R1: [Mã NCC, Tên NCC, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi]
 * @param {Array} rows
 * @returns {boolean}
 */
function isDanhSachNhaCungCap(rows) {
    // Kiểm tra dòng 1 (index 0) hoặc dòng 2 (index 1)
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 3) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

        // Kiểm tra có "MÃ NCC" hoặc "MÃ NHÀ CUNG CẤP"
        const hasMaNCC = rowStr.includes('MÃ NCC') || rowStr.includes('MA NCC') ||
                         rowStr.includes('MÃ NHÀ CUNG CẤP') || rowStr.includes('MA NHA CUNG CAP') ||
                         rowStr.includes('MÃ NHÀ CUNG') || rowStr.includes('MA NHA CUNG');
        
        // Kiểm tra có "TÊN NCC" hoặc "TÊN NHÀ CUNG CẤP"
        const hasTenNCC = rowStr.includes('TÊN NCC') || rowStr.includes('TEN NCC') ||
                          rowStr.includes('TÊN NHÀ CUNG CẤP') || rowStr.includes('TEN NHA CUNG CAP') ||
                          rowStr.includes('TÊN NHÀ CUNG') || rowStr.includes('TEN NHA CUNG');
        
        // Kiểm tra có "MST" hoặc "MÃ SỐ THUẾ"
        const hasMST = rowStr.includes('MST') || rowStr.includes('MÃ SỐ THUẾ') || rowStr.includes('MA SO THUE');

        if (hasMaNCC && hasTenNCC && hasMST) {
            return true;
        }
        
        // Fallback: chỉ cần Mã NCC + Tên NCC
        if (hasMaNCC && hasTenNCC) {
            const hasDiaChi = rowStr.includes('ĐỊA CHỈ') || rowStr.includes('DIA CHI');
            const hasDienThoai = rowStr.includes('ĐIỆN THOẠI') || rowStr.includes('DIEN THOAI');
            if (hasDiaChi || hasDienThoai) {
                return true;
            }
        }
        
        // Fallback 2: chỉ cần Mã NCC + Tên NCC
        if (hasMaNCC && hasTenNCC) {
            return true;
        }
    }

    return false;
}

// ============================================================
// Phát hiện Mẫu phiếu thu
// ============================================================

/**
 * Kiểm tra có phải Mẫu phiếu thu tiền gửi không
 * Đặc điểm: header có "Ngày hạch toán", "Mã đối tượng", "Tên đối tượng"
 * File mẫu: phieu thu tien gui.xlsx - 2 rows, 25 columns
 * @param {Array} rows
 * @returns {boolean}
 */
function isMauPhieuThu(rows) {
    // Kiểm tra dòng 1 (index 0) hoặc dòng 2 (index 1)
    for (let i = 0; i < Math.min(3, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 5) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

        // Kiểm tra có "Ngày hạch toán" hoặc "Ngày chứng từ"
        const hasNgay = rowStr.includes('NGÀY HẠCH TOÁN') || rowStr.includes('NGAY HACH TOAN') ||
                        rowStr.includes('NGÀY CHỨNG TỪ') || rowStr.includes('NGAY CHUNG TU');
        
        // Kiểm tra có "Mã đối tượng"
        const hasMaDT = rowStr.includes('MÃ ĐỐI TƯỢNG') || rowStr.includes('MA DOI TUONG') ||
                        rowStr.includes('MÃ ĐT') || rowStr.includes('MA DT');
        
        // Kiểm tra có "Tên đối tượng"
        const hasTenDT = rowStr.includes('TÊN ĐỐI TƯỢNG') || rowStr.includes('TEN DOI TUONG') ||
                         rowStr.includes('TÊN ĐT') || rowStr.includes('TEN DT');

        // Kiểm tra có "Số tiền" hoặc "Số chứng từ"
        const hasSoTien = rowStr.includes('SỐ TIỀN') || rowStr.includes('SO TIEN') ||
                          rowStr.includes('SỐ CHỨNG TỪ') || rowStr.includes('SO CHUNG TU');

        if (hasNgay && hasMaDT && hasTenDT && hasSoTien) {
            return true;
        }
    }

    return false;
}

// ============================================================
// Phát hiện Mẫu phiếu chi
// ============================================================

/**
 * Kiểm tra có phải Mẫu phiếu chi tiền gửi không
 * Đặc điểm: header có "Phương thức thanh toán", "Tài khoản chi", "Mã NCC"
 * File mẫu: phieu chi tien gui.xlsx - 1 row, 44 columns
 * @param {Array} rows
 * @returns {boolean}
 */
function isMauPhieuChi(rows) {
    // Kiểm tra dòng 1 (index 0) hoặc dòng 2 (index 1)
    for (let i = 0; i < Math.min(3, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 5) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

        // Kiểm tra có "Phương thức thanh toán"
        const hasPTTT = rowStr.includes('PHƯƠNG THỨC THANH TOÁN') || rowStr.includes('PHUONG THUC THANH TOAN') ||
                        rowStr.includes('PTTT');
        
        // Kiểm tra có "Tài khoản chi" hoặc "TK chi"
        const hasTKChi = rowStr.includes('TÀI KHOẢN CHI') || rowStr.includes('TAI KHOAN CHI') ||
                         rowStr.includes('TK CHI');
        
        // Kiểm tra có "Mã NCC" hoặc "Mã nhà cung cấp"
        const hasMaNCC = rowStr.includes('MÃ NCC') || rowStr.includes('MA NCC') ||
                         rowStr.includes('MÃ NHÀ CUNG CẤP') || rowStr.includes('MA NHA CUNG CAP');

        // Kiểm tra có "Số tiền" hoặc "Số chứng từ"
        const hasSoTien = rowStr.includes('SỐ TIỀN') || rowStr.includes('SO TIEN') ||
                          rowStr.includes('SỐ CHỨNG TỪ') || rowStr.includes('SO CHUNG TU');

        if (hasPTTT && hasTKChi && hasMaNCC && hasSoTien) {
            return true;
        }
        
        // Fallback: PTTT + TK Chi + Số tiền
        if (hasPTTT && hasTKChi && hasSoTien) {
            return true;
        }
    }

    return false;
}
