const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'cdkeys.db');
let db = null;

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, data);
  }
}

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // CDKey表
  db.run(`
    CREATE TABLE IF NOT EXISTS cdkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      is_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      used_at TEXT
    )
  `);

  // 请求记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT NOT NULL,
      cdkey_id INTEGER,
      cdkey_code TEXT,
      user_id INTEGER,
      requested_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (cdkey_id) REFERENCES cdkeys(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建默认管理员账户（用户名: admin, 密码: admin123）
  try {
    db.run(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')`);
  } catch (e) {
    // 管理员已存在
  }

  // 创建默认普通用户（用户名: user, 密码: user123）
  try {
    db.run(`INSERT INTO users (username, password, role) VALUES ('user', 'user123', 'user')`);
  } catch (e) {
    // 用户已存在
  }

  saveDatabase();
  console.log('数据库表初始化完成');
  console.log('默认管理员账户: admin / admin123');
  console.log('默认普通用户: user / user123');
}

// 添加CDKey到数据库
function addCDKey(code) {
  try {
    db.run('INSERT INTO cdkeys (code) VALUES (?)', [code]);
    saveDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 批量添加CDKey
function addBatchCDKeys(codes) {
  let successCount = 0;
  for (const code of codes) {
    try {
      db.run('INSERT INTO cdkeys (code) VALUES (?)', [code]);
      successCount++;
    } catch (error) {
      console.error(`添加CDKey失败: ${code}`, error.message);
    }
  }
  saveDatabase();
  return { success: true, count: successCount };
}

// 获取CDKey (FIFO逻辑)
function getCDKey(reason) {
  try {
    // 查找最早的未使用CDKey（FIFO）
    const result = db.exec(`
      SELECT id, code
      FROM cdkeys
      WHERE is_used = 0
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `);

    if (!result.length || !result[0].values.length) {
      return { success: false, message: 'CDKey库存不足' };
    }

    const cdkeyId = result[0].values[0][0];
    const cdkeyCode = result[0].values[0][1];

    // 标记为已使用
    db.run(`
      UPDATE cdkeys
      SET is_used = 1, used_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [cdkeyId]);

    // 记录请求
    db.run(`
      INSERT INTO requests (reason, cdkey_id, cdkey_code)
      VALUES (?, ?, ?)
    `, [reason, cdkeyId, cdkeyCode]);

    saveDatabase();

    return {
      success: true,
      cdkey: cdkeyCode,
      message: '分配成功'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// 获取统计信息
function getStats() {
  const totalResult = db.exec('SELECT COUNT(*) as count FROM cdkeys');
  const total = totalResult.length ? totalResult[0].values[0][0] : 0;

  const usedResult = db.exec('SELECT COUNT(*) as count FROM cdkeys WHERE is_used = 1');
  const used = usedResult.length ? usedResult[0].values[0][0] : 0;

  const available = total - used;

  const requestsResult = db.exec('SELECT COUNT(*) as count FROM requests');
  const totalRequests = requestsResult.length ? requestsResult[0].values[0][0] : 0;

  return {
    total,
    used,
    available,
    totalRequests
  };
}

// 获取所有CDKey列表
function getAllCDKeys(limit = 100, offset = 0) {
  const result = db.exec(`
    SELECT id, code, is_used, created_at, used_at
    FROM cdkeys
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  if (!result.length) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// 获取请求历史
function getRequestHistory(limit = 50, offset = 0) {
  const result = db.exec(`
    SELECT id, reason, cdkey_code, requested_at
    FROM requests
    ORDER BY requested_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  if (!result.length) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// 清空所有数据
function clearAllData() {
  db.run('DELETE FROM requests');
  db.run('DELETE FROM cdkeys');
  saveDatabase();
  return { success: true, message: '所有数据已清空' };
}

// 用户认证
function authenticateUser(username, password) {
  const result = db.exec(`
    SELECT id, username, role
    FROM users
    WHERE username = '${username}' AND password = '${password}'
    LIMIT 1
  `);

  if (!result.length || !result[0].values.length) {
    return { success: false, message: '用户名或密码错误' };
  }

  const row = result[0].values[0];
  return {
    success: true,
    user: {
      id: row[0],
      username: row[1],
      role: row[2]
    }
  };
}

// 创建新用户
function createUser(username, password, role = 'user') {
  try {
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, password, role]);
    saveDatabase();
    return { success: true, message: '用户创建成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 获取所有用户
function getAllUsers() {
  const result = db.exec(`
    SELECT id, username, role, created_at
    FROM users
    ORDER BY created_at DESC
  `);

  if (!result.length) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// 删除CDKey
function deleteCDKey(id) {
  try {
    db.run('DELETE FROM cdkeys WHERE id = ?', [id]);
    saveDatabase();
    return { success: true, message: 'CDKey已删除' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 修改getCDKey，添加用户ID
function getCDKeyWithUser(reason, userId) {
  try {
    // 查找最早的未使用CDKey（FIFO）
    const result = db.exec(`
      SELECT id, code
      FROM cdkeys
      WHERE is_used = 0
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `);

    if (!result.length || !result[0].values.length) {
      return { success: false, message: 'CDKey库存不足' };
    }

    const cdkeyId = result[0].values[0][0];
    const cdkeyCode = result[0].values[0][1];

    // 标记为已使用
    db.run(`
      UPDATE cdkeys
      SET is_used = 1, used_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [cdkeyId]);

    // 记录请求（包含用户ID）
    db.run(`
      INSERT INTO requests (reason, cdkey_id, cdkey_code, user_id)
      VALUES (?, ?, ?, ?)
    `, [reason, cdkeyId, cdkeyCode, userId]);

    saveDatabase();

    return {
      success: true,
      cdkey: cdkeyCode,
      message: '分配成功'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// 获取用户的请求历史
function getUserRequestHistory(userId, limit = 50, offset = 0) {
  const result = db.exec(`
    SELECT r.id, r.reason, r.cdkey_code, r.requested_at
    FROM requests r
    WHERE r.user_id = ${userId}
    ORDER BY r.requested_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  if (!result.length) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

module.exports = {
  initDatabase,
  addCDKey,
  addBatchCDKeys,
  getCDKey,
  getCDKeyWithUser,
  getStats,
  getAllCDKeys,
  getRequestHistory,
  getUserRequestHistory,
  clearAllData,
  authenticateUser,
  createUser,
  getAllUsers,
  deleteCDKey
};
