// ==========================
// db.js - Quản lý IndexedDB
// ==========================

const DB_NAME = 'ThucNganDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

let _dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_dbInstance) return resolve(_dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      _dbInstance = event.target.result;
      resolve(_dbInstance);
    };

    request.onerror = (event) => {
      console.error('❌ Lỗi mở IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Lưu một giá trị vào IndexedDB
async function dbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ key, value: JSON.stringify(value) });
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('❌ dbSet request lỗi:', request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('❌ dbSet lỗi:', e);
    // Không throw để tránh crash, trả về false
    return false;
  }
}

// Đọc một giá trị từ IndexedDB
async function dbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          const result = request.result;
          resolve(result ? JSON.parse(result.value) : null);
        } catch (e) {
          console.error('❌ dbGet parse lỗi:', e);
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('❌ dbGet request lỗi:', request.error);
        resolve(null);
      };
    });
  } catch (e) {
    console.error('❌ dbGet lỗi:', e);
    return null;
  }
}

// Xóa một key
async function dbDelete(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('❌ dbDelete lỗi:', e);
  }
}

// Lấy tất cả keys
async function dbKeys() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('❌ dbKeys lỗi:', e);
    return [];
  }
}

// Xóa toàn bộ dữ liệu
async function dbClear() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error('❌ dbClear lỗi:', e);
  }
}

// Export
window.dbSet = dbSet;
window.dbGet = dbGet;
window.dbDelete = dbDelete;
window.dbKeys = dbKeys;
window.dbClear = dbClear;

console.log('✅ db.js loaded - IndexedDB ready');
