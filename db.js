/**
 * 業務時間ダッシュボード用 IndexedDB ユーティリティ
 */
class DashboardDB {
  constructor() {
    this.dbName = 'SalesDashboardDB';
    this.dbVersion = 1;
    this.storeName = 'monthlyRecords';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'ym' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject('IndexedDB error: ' + event.target.errorCode);
      };
    });
  }

  async saveMonthlyData(ym, records, metadata = {}) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        ym,
        records,
        count: records.length,
        userCount: new Set(records.map(r => r.name)).size,
        updatedAt: new Date().toISOString(),
        ...metadata
      };

      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Save error');
    });
  }

  async getMonthlyData(ym) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(ym);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Get error');
    });
  }

  async getAllData() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const result = {};
        request.result.forEach(item => {
          result[item.ym] = item.records;
        });
        resolve(result);
      };
      request.onerror = () => reject('GetAll error');
    });
  }

  async getAllMetadata() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.map(item => ({
          ym: item.ym,
          count: item.count,
          userCount: item.userCount,
          updatedAt: item.updatedAt
        })));
      };
      request.onerror = () => reject('GetMetadata error');
    });
  }

  async deleteMonthlyData(ym) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(ym);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Delete error');
    });
  }

  async clearAll() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Clear error');
    });
  }
}

const db = new DashboardDB();
export default db;
