const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'lingzhan.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const d = getDB();

  // 用户表
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'front',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // IP资产表
  d.exec(`
    CREATE TABLE IF NOT EXISTS ip_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT '女性',
      age INTEGER NOT NULL,
      style TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '上架',
      cover_url TEXT,
      height TEXT,
      weight TEXT,
      hometown TEXT,
      creator TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // 素材表
  d.exec(`
    CREATE TABLE IF NOT EXISTS ip_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_id INTEGER NOT NULL,
      age_version TEXT NOT NULL,
      material_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (ip_id) REFERENCES ip_assets(id) ON DELETE CASCADE
    )
  `);

  // 操作记录表
  d.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_id INTEGER,
      ip_no TEXT,
      ip_name TEXT,
      operation_type TEXT NOT NULL,
      operation_content TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // 初始化用户（幂等）
  const insertUser = d.prepare(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`);
  insertUser.run('admin', '123456', 'admin');
  insertUser.run('admin2', '1234567', 'front');

  // 初始化示例IP数据（仅在表为空时）
  const count = d.prepare('SELECT COUNT(*) as c FROM ip_assets').get();
  if (count.c === 0) {
    const now = '2026-05-30 10:00';
    const insertIP = d.prepare(
      `INSERT INTO ip_assets (ip_no, name, gender, age, style, status, height, weight, hometown, creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ips = [
      ['IP-0001', '李默涵', '女性', 22, '古风', '上架', '168cm', '45kg', '中国 · 江南', 'admin', now, now],
      ['IP-0002', '陆行川', '男性', 31, '现代', '上架', '182cm', '70kg', '中国 · 海城', 'admin', now, now],
      ['IP-0003', '沈青棠', '女性', 16, '年代', '上架', '158cm', '42kg', '中国 · 云州', 'admin', now, now],
      ['IP-0004', '周砚白', '男性', 42, '科幻', '下架', '178cm', '68kg', '中国 · 北境', 'admin', now, now],
    ];
    for (const ip of ips) insertIP.run(...ip);

    // 初始操作记录
    const insertLog = d.prepare(
      `INSERT INTO operation_logs (ip_id, ip_no, ip_name, operation_type, operation_content, operator, created_at)
       VALUES ((SELECT id FROM ip_assets WHERE ip_no=?), ?, ?, '创建', ?, ?, ?)`
    );
    insertLog.run('IP-0001', 'IP-0001', '李默涵', '初始化演示IP数据', 'admin', now);
  }

  console.log('✅ 数据库初始化完成');
  return d;
}

module.exports = { getDB, initDB, DB_PATH };
