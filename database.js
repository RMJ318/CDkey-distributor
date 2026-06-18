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
      daily_quota INTEGER DEFAULT 5,
      monthly_quota INTEGER DEFAULT 30,
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

// 获取所有CDKey列表（支持搜索和过滤）
function buildCDKeyWhereClause(filters = {}) {
  let whereClause = ' WHERE 1=1';

  if (filters.codeSearch) {
    whereClause += ` AND code LIKE '%${filters.codeSearch}%'`;
  }

  if (filters.status === 'used') {
    whereClause += ' AND is_used = 1';
  } else if (filters.status === 'available') {
    whereClause += ' AND is_used = 0';
  }

  if (filters.startDate) {
    whereClause += ` AND date(created_at) >= '${filters.startDate}'`;
  }
  if (filters.endDate) {
    whereClause += ` AND date(created_at) <= '${filters.endDate}'`;
  }

  return whereClause;
}

function mapExecResult(result) {
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

function getAllCDKeys(limit = 100, offset = 0, filters = {}) {
  const whereClause = buildCDKeyWhereClause(filters);
  const query = `
    SELECT id, code, is_used, created_at, used_at
    FROM cdkeys
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return mapExecResult(db.exec(query));
}

function getCDKeyCount(filters = {}) {
  const whereClause = buildCDKeyWhereClause(filters);
  const query = `
    SELECT COUNT(*) AS total
    FROM cdkeys
    ${whereClause}
  `;
  const result = db.exec(query);

  if (!result.length || !result[0].values.length) {
    return 0;
  }

  return result[0].values[0][0];
}

// 获取请求历史（支持搜索和过滤）
function getRequestHistory(limit = 50, offset = 0, filters = {}) {
  let query = `
    SELECT r.id, r.reason, r.cdkey_code, r.requested_at, u.username
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE 1=1
  `;

  // 搜索CDKey
  if (filters.cdkeySearch) {
    query += ` AND r.cdkey_code LIKE '%${filters.cdkeySearch}%'`;
  }

  // 搜索原因
  if (filters.reasonSearch) {
    query += ` AND r.reason LIKE '%${filters.reasonSearch}%'`;
  }

  // 搜索用户名
  if (filters.usernameSearch) {
    query += ` AND u.username LIKE '%${filters.usernameSearch}%'`;
  }

  // 日期范围过滤
  if (filters.startDate) {
    query += ` AND date(r.requested_at) >= '${filters.startDate}'`;
  }
  if (filters.endDate) {
    query += ` AND date(r.requested_at) <= '${filters.endDate}'`;
  }

  query += ` ORDER BY r.requested_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = db.exec(query);

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
function createUser(username, password, role = 'user', dailyQuota = 5, monthlyQuota = 30) {
  try {
    db.run('INSERT INTO users (username, password, role, daily_quota, monthly_quota) VALUES (?, ?, ?, ?, ?)',
      [username, password, role, dailyQuota, monthlyQuota]);
    saveDatabase();
    return { success: true, message: '用户创建成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 更新用户配额
function updateUserQuota(userId, dailyQuota, monthlyQuota) {
  try {
    db.run('UPDATE users SET daily_quota = ?, monthly_quota = ? WHERE id = ?',
      [dailyQuota, monthlyQuota, userId]);
    saveDatabase();
    return { success: true, message: '配额更新成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 获取所有用户
function getAllUsers() {
  const result = db.exec(`
    SELECT id, username, role, daily_quota, monthly_quota, created_at
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

// 检查用户配额
function checkUserQuota(userId) {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  // 获取用户配额设置
  const userResult = db.exec(`SELECT daily_quota, monthly_quota FROM users WHERE id = ${userId}`);
  if (!userResult.length || !userResult[0].values.length) {
    return { allowed: false, message: '用户不存在' };
  }

  const dailyQuota = userResult[0].values[0][0];
  const monthlyQuota = userResult[0].values[0][1];

  // 检查今日使用量
  const dailyResult = db.exec(`
    SELECT COUNT(*) as count FROM requests
    WHERE user_id = ${userId}
    AND date(requested_at) = '${today}'
  `);
  const dailyUsed = dailyResult.length ? dailyResult[0].values[0][0] : 0;

  if (dailyUsed >= dailyQuota) {
    return {
      allowed: false,
      message: `已达今日配额上限（${dailyQuota}次），请明天再试`,
      dailyUsed,
      dailyQuota
    };
  }

  // 检查本月使用量
  const monthlyResult = db.exec(`
    SELECT COUNT(*) as count FROM requests
    WHERE user_id = ${userId}
    AND strftime('%Y-%m', requested_at) = '${thisMonth}'
  `);
  const monthlyUsed = monthlyResult.length ? monthlyResult[0].values[0][0] : 0;

  if (monthlyUsed >= monthlyQuota) {
    return {
      allowed: false,
      message: `已达本月配额上限（${monthlyQuota}次），请下月再试`,
      monthlyUsed,
      monthlyQuota
    };
  }

  return {
    allowed: true,
    dailyUsed,
    dailyQuota,
    monthlyUsed,
    monthlyQuota
  };
}

// 获取用户配额信息
function getUserQuotaInfo(userId) {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const userResult = db.exec(`SELECT daily_quota, monthly_quota FROM users WHERE id = ${userId}`);
  if (!userResult.length || !userResult[0].values.length) {
    return null;
  }

  const dailyQuota = userResult[0].values[0][0];
  const monthlyQuota = userResult[0].values[0][1];

  const dailyResult = db.exec(`
    SELECT COUNT(*) as count FROM requests
    WHERE user_id = ${userId}
    AND date(requested_at) = '${today}'
  `);
  const dailyUsed = dailyResult.length ? dailyResult[0].values[0][0] : 0;

  const monthlyResult = db.exec(`
    SELECT COUNT(*) as count FROM requests
    WHERE user_id = ${userId}
    AND strftime('%Y-%m', requested_at) = '${thisMonth}'
  `);
  const monthlyUsed = monthlyResult.length ? monthlyResult[0].values[0][0] : 0;

  return {
    dailyUsed,
    dailyQuota,
    dailyRemaining: dailyQuota - dailyUsed,
    monthlyUsed,
    monthlyQuota,
    monthlyRemaining: monthlyQuota - monthlyUsed
  };
}

// 修改getCDKey，添加用户ID和配额检查
function getCDKeyWithUser(reason, userId) {
  try {
    // 检查配额
    const quotaCheck = checkUserQuota(userId);
    if (!quotaCheck.allowed) {
      return { success: false, message: quotaCheck.message };
    }

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

// 获取用户的请求历史（支持搜索和过滤）
function getUserRequestHistory(userId, limit = 50, offset = 0, filters = {}) {
  let query = `
    SELECT r.id, r.reason, r.cdkey_code, r.requested_at
    FROM requests r
    WHERE r.user_id = ${userId}
  `;

  // 搜索CDKey
  if (filters.cdkeySearch) {
    query += ` AND r.cdkey_code LIKE '%${filters.cdkeySearch}%'`;
  }

  // 搜索原因
  if (filters.reasonSearch) {
    query += ` AND r.reason LIKE '%${filters.reasonSearch}%'`;
  }

  // 日期范围过滤
  if (filters.startDate) {
    query += ` AND date(r.requested_at) >= '${filters.startDate}'`;
  }
  if (filters.endDate) {
    query += ` AND date(r.requested_at) <= '${filters.endDate}'`;
  }

  query += ` ORDER BY r.requested_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = db.exec(query);

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
  getCDKeyCount,
  getRequestHistory,
  getUserRequestHistory,
  clearAllData,
  authenticateUser,
  createUser,
  getAllUsers,
  deleteCDKey,
  checkUserQuota,
  getUserQuotaInfo,
  updateUserQuota
};
