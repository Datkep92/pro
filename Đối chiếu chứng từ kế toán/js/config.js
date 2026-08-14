// ============================================================
// Cấu hình mapping cột cho từng loại file
// ============================================================

const FILE_CONFIG = {
    // Bảng kê bán ra - header dòng 1, data từ dòng 2
    // Số hóa đơn chỉ xuất hiện ở dòng đầu của mỗi hóa đơn, các dòng mặt hàng tiếp theo trống
    bangKeBanRa: {
        headerRow: 0, // 0-indexed
        fillSoHD: true, // fill số hóa đơn cho các dòng trống
        columns: {
            soHD: 0,
            ngay: 1,      // serial number
            ten: 2,
            mst: 3,
            matHang: 4,
            tienChuaThue: 5,
            thueSuat: 6,
            thueGTGT: 7
        }
    },
    // Bảng kê mua vào - header dòng 4, data từ dòng 5
    bangKeMuaVao: {
        headerRow: 3, // 0-indexed, dòng 4
        fillSoHD: false, // mỗi dòng đã có số hóa đơn
        columns: {
            soHD: 0,
            ngay: 1,
            ten: 2,
            mst: 3,
            matHang: 4,
            tienChuaThue: 5,
            thueSuat: 6,
            thueGTGT: 7
        }
    },
    // Hóa đơn bán ra - đã cấp mã (19 cột)
    // Cột 17 = "Trạng thái hóa đơn" (Hóa đơn mới / Hóa đơn thay thế / ...)
    hdBanRaDaCapMa: {
        headerRow: 3,
        columns: {
            soHD: 3,
            ngay: 4,       // dd/MM/yyyy
            tenMua: 8,
            tienChuaThue: 10,
            tienThue: 11,
            tongTT: 14,
            trangThai: 17   // Trạng thái hóa đơn
        }
    },
    // Hóa đơn bán ra - máy tính tiền (17 cột)
    // Cột 15 = "Trạng thái hóa đơn"
    hdBanRaMayTinhTien: {
        headerRow: 3,
        columns: {
            soHD: 3,
            ngay: 4,
            tenMua: 8,
            tienChuaThue: 11,
            tienThue: 12,
            tongTT: 14,
            trangThai: 15
        }
    },
    // Hóa đơn mua vào - đã cấp mã (19 cột)
    // Cột 17 = "Trạng thái hóa đơn"
    hdMuaVaoDaCapMa: {
        headerRow: 3,
        columns: {
            soHD: 3,
            ngay: 4,
            tenBan: 6,
            tienChuaThue: 10,
            tienThue: 11,
            tongTT: 14,
            trangThai: 17
        }
    },
    // Hóa đơn mua vào - không cấp mã (19 cột)
    // Cột 17 = "Trạng thái hóa đơn"
    hdMuaVaoKhongCapMa: {
        headerRow: 3,
        columns: {
            soHD: 3,
            ngay: 4,
            tenBan: 6,
            tienChuaThue: 10,
            tienThue: 11,
            tongTT: 14,
            trangThai: 17
        }
    },
    // Hóa đơn mua vào - máy tính tiền (17 cột)
    // Cột 15 = "Trạng thái hóa đơn"
    hdMuaVaoMayTinhTien: {
        headerRow: 3,
        columns: {
            soHD: 3,
            ngay: 4,
            tenBan: 6,
            tienChuaThue: 11,
            tienThue: 12,
            tongTT: 14,
            trangThai: 15
        }
    }
};

// Định nghĩa loại file
const FILE_TYPES = {
    BANG_KE_BAN_RA: 'bangKeBanRa',
    BANG_KE_MUA_VAO: 'bangKeMuaVao',
    HD_BAN_RA_DA_CAP_MA: 'hdBanRaDaCapMa',
    HD_BAN_RA_MAY_TINH_TIEN: 'hdBanRaMayTinhTien',
    HD_MUA_VAO_DA_CAP_MA: 'hdMuaVaoDaCapMa',
    HD_MUA_VAO_KHONG_CAP_MA: 'hdMuaVaoKhongCapMa',
    HD_MUA_VAO_MAY_TINH_TIEN: 'hdMuaVaoMayTinhTien',
    SAO_KE_NGAN_HANG: 'saoKeNganHang',
    DANH_SACH_KHACH_HANG: 'danhSachKhachHang',
    DANH_SACH_NHA_CUNG_CAP: 'danhSachNhaCungCap',
    MAU_PHIEU_THU: 'mauPhieuThu',
    MAU_PHIEU_CHI: 'mauPhieuChi',
    UNKNOWN: 'unknown'
};

// Nhóm loại file
const FILE_GROUP = {
    BAN_RA: 'banRa',
    MUA_VAO: 'muaVao'
};

// Map loại file → nhóm
const FILE_TYPE_TO_GROUP = {
    [FILE_TYPES.BANG_KE_BAN_RA]: FILE_GROUP.BAN_RA,
    [FILE_TYPES.BANG_KE_MUA_VAO]: FILE_GROUP.MUA_VAO,
    [FILE_TYPES.HD_BAN_RA_DA_CAP_MA]: FILE_GROUP.BAN_RA,
    [FILE_TYPES.HD_BAN_RA_MAY_TINH_TIEN]: FILE_GROUP.BAN_RA,
    [FILE_TYPES.HD_MUA_VAO_DA_CAP_MA]: FILE_GROUP.MUA_VAO,
    [FILE_TYPES.HD_MUA_VAO_KHONG_CAP_MA]: FILE_GROUP.MUA_VAO,
    [FILE_TYPES.HD_MUA_VAO_MAY_TINH_TIEN]: FILE_GROUP.MUA_VAO
};

// Tên hiển thị cho từng loại file
const FILE_TYPE_LABELS = {
    [FILE_TYPES.BANG_KE_BAN_RA]: '📊 Bảng kê bán ra',
    [FILE_TYPES.BANG_KE_MUA_VAO]: '📊 Bảng kê mua vào',
    [FILE_TYPES.HD_BAN_RA_DA_CAP_MA]: '📄 HĐ bán ra - Đã cấp mã',
    [FILE_TYPES.HD_BAN_RA_MAY_TINH_TIEN]: '📄 HĐ bán ra - Máy tính tiền',
    [FILE_TYPES.HD_MUA_VAO_DA_CAP_MA]: '📄 HĐ mua vào - Đã cấp mã',
    [FILE_TYPES.HD_MUA_VAO_KHONG_CAP_MA]: '📄 HĐ mua vào - Không cấp mã',
    [FILE_TYPES.HD_MUA_VAO_MAY_TINH_TIEN]: '📄 HĐ mua vào - Máy tính tiền',
    [FILE_TYPES.UNKNOWN]: '❓ Không xác định'
};
