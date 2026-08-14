// ==========================
// state.js - Quản lý trạng thái ứng dụng
// ==========================

// Biến toàn cục lưu trạng thái ứng dụng
let hkdData = {};
let hkdOrder = [];
let currentTaxCode = null;
let tonkhoEditing = { taxCode: '', type: '', index: -1 };
let exportInventoryData = [];
let logHistory = [];
let undoStack = [];
// ensureHkdData được định nghĩa trong main.js (có thêm hkdOrder.push)
// Hàm này chỉ giữ lại để tương thích ngược, nhưng không ghi đè
// Đảm bảo các trường mới tồn tại (cho dữ liệu cũ) - gọi sau khi ensureHkdData
function migrateHkdData(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd) return;
  if (!hkd.tonkhoKM) hkd.tonkhoKM = [];
  if (!hkd.xuatkhoMain) hkd.xuatkhoMain = [];
  if (!hkd.xuatkhoKM) hkd.xuatkhoKM = [];
  if (!hkd.xuatkhoCK) hkd.xuatkhoCK = [];
}

function safeParseInt(value, defaultValue = 0) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function safeParseFloat(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
// Lưu vào IndexedDB (cho dữ liệu lớn) + localStorage (cho cấu hình nhẹ)
function saveDataToLocalStorage() {
  try {
    // Lưu cấu hình nhẹ vào localStorage
    localStorage.setItem('hkdOrder', JSON.stringify(hkdOrder));
    
    // Lưu dữ liệu lớn vào IndexedDB
    dbSet('hkdData', hkdData).catch(e => {
      console.error('❌ Lỗi lưu hkdData vào IndexedDB:', e);
      // Fallback: thử lưu vào localStorage nếu IndexedDB lỗi
      try {
        localStorage.setItem('hkdData', JSON.stringify(hkdData));
      } catch (e2) {
        console.error('❌ Không thể lưu hkdData vào localStorage (fallback):', e2);
        showToast('❌ Dung lượng lưu trữ đã đầy, vui lòng xóa bớt dữ liệu cũ', 4000, 'error');
      }
    });
    
    // Lưu logHistory vào IndexedDB (không lưu snapshot data để tránh đầy)
    const logHistoryLight = logHistory.map(entry => ({
      time: entry.time,
      action: entry.action,
      // Không lưu data snapshot để tiết kiệm dung lượng
      hasData: !!entry.data
    }));
    dbSet('logHistory', logHistoryLight).catch(e => {
      console.error('❌ Lỗi lưu logHistory vào IndexedDB:', e);
    });
    
    // Lưu undoStack vào IndexedDB (giới hạn 5 bản gần nhất)
    const undoStackLight = undoStack.slice(-5);
    dbSet('undoStack', undoStackLight).catch(e => {
      console.error('❌ Lỗi lưu undoStack vào IndexedDB:', e);
    });
  } catch (e) {
    console.error('❌ Lỗi saveDataToLocalStorage:', e);
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n);
}



// Load từ IndexedDB (ưu tiên) + localStorage (fallback)
async function loadDataFromLocalStorage() {
  try {
    // Đọc hkdOrder từ localStorage (cấu hình nhẹ)
    const savedOrder = localStorage.getItem('hkdOrder');
    
    // Đọc dữ liệu lớn từ IndexedDB
    let savedData = await dbGet('hkdData');
    let savedLogs = await dbGet('logHistory');
    let savedUndo = await dbGet('undoStack');
    
    // Fallback: nếu IndexedDB không có, đọc từ localStorage
    if (!savedData) {
      const lsData = localStorage.getItem('hkdData');
      if (lsData) savedData = JSON.parse(lsData);
    }
    if (!savedLogs) {
      const lsLogs = localStorage.getItem('logHistory');
      if (lsLogs) savedLogs = JSON.parse(lsLogs);
    }

    if (savedData && savedOrder) {
      hkdData = savedData;
      hkdOrder = JSON.parse(savedOrder);
      logHistory = savedLogs || [];
      if (savedUndo) undoStack = savedUndo;
    } else {
      // Thử load legacy từ localStorage
      const lsData = localStorage.getItem('hkdData');
      const lsOrder = localStorage.getItem('hkdOrder');
      if (lsData && lsOrder) {
        hkdData = JSON.parse(lsData);
        hkdOrder = JSON.parse(lsOrder);
        const lsLogs = localStorage.getItem('logHistory');
        if (lsLogs) logHistory = JSON.parse(lsLogs);
      }
    }

    // Migration dữ liệu cũ: đảm bảo các trường mới tồn tại
    hkdOrder.forEach(taxCode => {
      if (typeof migrateHkdData === 'function') {
        migrateHkdData(taxCode);
      }
    });
  } catch (e) {
    console.error("❌ Lỗi đọc dữ liệu:", e);
    showToast("❌ Không thể đọc dữ liệu trước đó", 3000, 'error');
  }
}
// Ghi log hành động
function logAction(action, dataSnapshot = null) {
  const entry = {
    time: new Date().toLocaleString(),
    action,
    data: dataSnapshot ? JSON.parse(JSON.stringify(dataSnapshot)) : null
  };
  
  logHistory.push(entry);
  if (logHistory.length > 100) logHistory.shift();
  
  if (dataSnapshot) {
    undoStack.push(JSON.stringify(dataSnapshot));
    if (undoStack.length > 20) undoStack.shift();
  }
}

// Hoàn tác hành động
function undoAction() {
  if (undoStack.length === 0) {
    toast("Không còn thao tác để hoàn tác", 'error');
    return false;
  }
  
  try {
    const previousState = JSON.parse(undoStack.pop());
    setState({
      hkdData: previousState.hkdData || {},
      hkdOrder: previousState.hkdOrder || [],
      currentTaxCode: previousState.currentTaxCode || null
    });
    renderHKDList();
    if (currentTaxCode) renderHKDTab(currentTaxCode);
    toast("✅ Đã hoàn tác", 'success');
    saveDataToLocalStorage();
    return true;
  } catch (error) {
    toast("❌ Lỗi khi hoàn tác: " + error.message, 'error');
    return false;
  }
}

// Lấy trạng thái hiện tại (dùng để log hoặc undo)
function getState() {
  return {
    hkdData: JSON.parse(JSON.stringify(hkdData)),
    hkdOrder: [...hkdOrder],
    currentTaxCode,
    tonkhoEditing: { ...tonkhoEditing },
    exportInventoryData: [...exportInventoryData],
    logHistory: [...logHistory],
    undoStack: [...undoStack]
  };
}

// Đặt lại trạng thái
function setState(newState) {
  if (newState.hkdData) hkdData = JSON.parse(JSON.stringify(newState.hkdData));
  if (newState.hkdOrder) hkdOrder = [...newState.hkdOrder];
  if (newState.currentTaxCode !== undefined) currentTaxCode = newState.currentTaxCode;
  if (newState.tonkhoEditing) tonkhoEditing = { ...newState.tonkhoEditing };
  if (newState.exportInventoryData) exportInventoryData = [...newState.exportInventoryData];
  if (newState.logHistory) logHistory = [...newState.logHistory];
  if (newState.undoStack) undoStack = [...newState.undoStack];
}

function showToast(message, duration = 3000, type = 'info') {
  Toastify({
    text: message,
    duration,
    gravity: 'top',
    position: 'right',
    style: {
      background: type === 'error' ? 'red' : type === 'success' ? 'green' : '#333',
    },
  }).showToast();
}

window.toast = showToast;


function showLogHistory() {
  if (!logHistory || logHistory.length === 0) {
    toast("📭 Không có lịch sử thao tác", 'info');
    return;
  }

  const lastLogs = logHistory.slice(-10).map(
    (log, i) => `${i + 1}. [${log.time}] ${log.action}`
  ).join("\n");

  alert("📝 Lịch sử gần đây:\n\n" + lastLogs);
}



async function clearAll() {
  if (!confirm("Bạn có chắc chắn muốn xoá toàn bộ dữ liệu?")) return;

  hkdData = {};
  hkdOrder = [];
  currentTaxCode = null;
  undoStack = [];
  logHistory = [];

  localStorage.removeItem('hkdData');
  localStorage.removeItem('hkdOrder');
  localStorage.removeItem('logHistory');

  // Xóa toàn bộ cache ghép thủ công (tt_cache_* và tt_cache_rev_*)
  for (var key in localStorage) {
    if (key.indexOf('tt_cache_') === 0 || key.indexOf('tt_cache_rev_') === 0) {
      localStorage.removeItem(key);
    }
  }

  // Xóa IndexedDB
  try {
    await dbClear();
  } catch (e) {
    console.error('❌ Lỗi xóa IndexedDB:', e);
  }

  // Xóa cả 3 sidebar
  const bl = document.getElementById("businessList");
  if (bl) bl.innerHTML = "";
  const blx = document.getElementById("businessListXuat");
  if (blx) blx.innerHTML = "";
  const bltt = document.getElementById("businessListThucTe");
  if (bltt) bltt.innerHTML = "";
  // Hiển thị giao diện mặc định với nút import
  if (typeof window.showEmptyState === 'function') {
    window.showEmptyState();
  } else {
    document.getElementById("mainContent").innerHTML = '<div id="hkdInfo">Chưa chọn HKD</div>';
  }
  toast("🗑️ Đã xoá toàn bộ dữ liệu", 'success');
}

// Gắn vào window để dùng toàn cục nếu cần
window.saveDataToLocalStorage = saveDataToLocalStorage;
window.loadDataFromLocalStorage = loadDataFromLocalStorage;
window.getState = getState;
window.setState = setState;
window.logAction = logAction;
window.undoAction = undoAction;
