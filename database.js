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

// 批量删除CDKey
function batchDeleteCDKeys(ids) {
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { success: false, message: '请提供要删除的ID列表' };
    }

    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM cdkeys WHERE id IN (${placeholders})`, ids);
    saveDatabase();

    return {
      success: true,
      message: `成功删除 ${ids.length} 个CDKey`,
      count: ids.length
    };
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
    SELECT r.id, r.reason, r.cdkey_code, r.requested_at, u.username
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
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

// ==================== 数据分析函数 ====================

// 获取时间序列数据（库存和请求趋势）
function getTimeSeriesData(days = 30) {
  const result = {
    dates: [],
    totalKeys: [],
    availableKeys: [],
    usedKeys: [],
    requests: []
  };

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    result.dates.push(dateStr);

    // 获取该日期的CDKey统计
    const totalResult = db.exec(`
      SELECT COUNT(*) FROM cdkeys
      WHERE date(created_at) <= '${dateStr}'
    `);
    const total = totalResult.length ? totalResult[0].values[0][0] : 0;

    const usedResult = db.exec(`
      SELECT COUNT(*) FROM cdkeys
      WHERE is_used = 1 AND date(used_at) <= '${dateStr}'
    `);
    const used = usedResult.length ? usedResult[0].values[0][0] : 0;

    result.totalKeys.push(total);
    result.usedKeys.push(used);
    result.availableKeys.push(total - used);

    // 获取该日期的请求数
    const requestResult = db.exec(`
      SELECT COUNT(*) FROM requests
      WHERE date(requested_at) = '${dateStr}'
    `);
    const requests = requestResult.length ? requestResult[0].values[0][0] : 0;
    result.requests.push(requests);
  }

  return result;
}

// 获取异常用户列表
function getAnomalousUsers() {
  // 计算近7天平均申请量
  const avgResult = db.exec(`
    SELECT COUNT(*) * 1.0 / COUNT(DISTINCT user_id) as avg_requests
    FROM requests
    WHERE date(requested_at) >= date('now', '-7 days')
    AND user_id IS NOT NULL
  `);

  const avgRequests = avgResult.length && avgResult[0].values.length ?
    avgResult[0].values[0][0] : 1;

  // 获取所有用户近7天的申请数
  const result = db.exec(`
    SELECT u.username, COUNT(r.id) as request_count
    FROM users u
    LEFT JOIN requests r ON u.id = r.user_id
      AND date(r.requested_at) >= date('now', '-7 days')
    GROUP BY u.id, u.username
    HAVING request_count > 0
    ORDER BY request_count DESC
  `);

  if (!result.length) return { users: [], avgRequests: 0 };

  const users = result[0].values.map(row => {
    const username = row[0];
    const count = row[1];
    const ratio = count / avgRequests;

    let riskLevel = 'normal';
    if (ratio >= 5) riskLevel = 'high';
    else if (ratio >= 3) riskLevel = 'warning';

    return {
      username,
      count,
      ratio: parseFloat(ratio.toFixed(2)),
      riskLevel
    };
  });

  return {
    users: users.filter(u => u.riskLevel !== 'normal'),
    avgRequests: parseFloat(avgRequests.toFixed(2)),
    allUsers: users
  };
}

// 获取用户活跃度数据
function getUserActivityStats() {
  // 本周活跃用户
  const thisWeekResult = db.exec(`
    SELECT COUNT(DISTINCT user_id) FROM requests
    WHERE date(requested_at) >= date('now', '-7 days')
    AND user_id IS NOT NULL
  `);
  const thisWeek = thisWeekResult.length ? thisWeekResult[0].values[0][0] : 0;

  // 上周活跃用户
  const lastWeekResult = db.exec(`
    SELECT COUNT(DISTINCT user_id) FROM requests
    WHERE date(requested_at) >= date('now', '-14 days')
    AND date(requested_at) < date('now', '-7 days')
    AND user_id IS NOT NULL
  `);
  const lastWeek = lastWeekResult.length ? lastWeekResult[0].values[0][0] : 0;

  // 本月活跃用户
  const thisMonthResult = db.exec(`
    SELECT COUNT(DISTINCT user_id) FROM requests
    WHERE date(requested_at) >= date('now', 'start of month')
    AND user_id IS NOT NULL
  `);
  const thisMonth = thisMonthResult.length ? thisMonthResult[0].values[0][0] : 0;

  // 总用户数
  const totalUsersResult = db.exec(`SELECT COUNT(*) FROM users`);
  const totalUsers = totalUsersResult.length ? totalUsersResult[0].values[0][0] : 0;

  // 计算增长率
  const growthRate = lastWeek > 0 ?
    ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : 0;

  // 活跃率
  const activeRate = totalUsers > 0 ?
    (thisMonth / totalUsers * 100).toFixed(1) : 0;

  // 近7天活跃趋势
  const trendResult = db.exec(`
    SELECT date(requested_at) as date, COUNT(DISTINCT user_id) as active_users
    FROM requests
    WHERE date(requested_at) >= date('now', '-7 days')
    AND user_id IS NOT NULL
    GROUP BY date
    ORDER BY date
  `);

  const trend = {
    dates: [],
    activeUsers: []
  };

  if (trendResult.length && trendResult[0].values.length) {
    trendResult[0].values.forEach(row => {
      trend.dates.push(row[0]);
      trend.activeUsers.push(row[1]);
    });
  }

  return {
    thisWeek,
    lastWeek,
    thisMonth,
    totalUsers,
    growthRate: parseFloat(growthRate),
    activeRate: parseFloat(activeRate),
    trend
  };
}

// 智能洞察生成
function generateInsights() {
  const insights = [];

  // 1. 检查库存健康度
  const health = getInventoryHealth();
  if (health.status === 'critical') {
    insights.push({
      type: 'danger',
      icon: '⚠️',
      message: `当前库存仅可支撑 ${health.daysRemaining} 天，建议立即补充 ${Math.ceil(health.avgDailyRequests * 60 - health.available)} 个CDKey`
    });
  } else if (health.status === 'warning') {
    insights.push({
      type: 'warning',
      icon: '📦',
      message: `当前库存可支撑 ${health.daysRemaining} 天，预计库存充足`
    });
  }

  // 2. 检查请求量变化
  const recentRequests = db.exec(`
    SELECT COUNT(*) FROM requests
    WHERE date(requested_at) >= date('now', '-7 days')
  `);
  const thisWeekRequests = recentRequests.length ? recentRequests[0].values[0][0] : 0;

  const lastWeekRequests = db.exec(`
    SELECT COUNT(*) FROM requests
    WHERE date(requested_at) >= date('now', '-14 days')
    AND date(requested_at) < date('now', '-7 days')
  `);
  const lastWeekCount = lastWeekRequests.length ? lastWeekRequests[0].values[0][0] : 0;

  if (lastWeekCount > 0) {
    const change = ((thisWeekRequests - lastWeekCount) / lastWeekCount * 100).toFixed(0);
    if (Math.abs(change) >= 30) {
      const direction = change > 0 ? '增长' : '下降';
      const arrow = change > 0 ? '↗' : '↘';
      insights.push({
        type: change > 0 ? 'info' : 'warning',
        icon: '📈',
        message: `本周请求量 ${thisWeekRequests} 次，较上周${direction} ${Math.abs(change)}% ${arrow}`
      });
    }
  }

  // 3. 检查异常用户
  const anomalous = getAnomalousUsers();
  const highRiskUsers = anomalous.users.filter(u => u.riskLevel === 'high');
  if (highRiskUsers.length > 0) {
    const user = highRiskUsers[0];
    insights.push({
      type: 'danger',
      icon: '🚨',
      message: `${user.username} 本周申请 ${user.count} 次，超过平均值 ${user.ratio} 倍`
    });
  }

  // 4. 正常状态提示
  if (insights.length === 0 || (insights.length === 1 && insights[0].type === 'warning')) {
    insights.push({
      type: 'success',
      icon: '✅',
      message: '无异常申请行为，系统运行正常'
    });
  }

  // 只返回前4条最重要的洞察
  return insights.slice(0, 4);
}

// 获取用户请求排行
function getUserRequestRanking(limit = 10) {
  const result = db.exec(`
    SELECT u.username, COUNT(r.id) as request_count
    FROM users u
    LEFT JOIN requests r ON u.id = r.user_id
    GROUP BY u.id, u.username
    ORDER BY request_count DESC
    LIMIT ${limit}
  `);

  if (!result.length) return [];

  return result[0].values.map(row => ({
    username: row[0],
    count: row[1]
  }));
}

// 获取请求时段分布（24小时）
function getHourlyDistribution() {
  const hours = Array(24).fill(0);

  const result = db.exec(`
    SELECT strftime('%H', requested_at) as hour, COUNT(*) as count
    FROM requests
    GROUP BY hour
  `);

  if (result.length && result[0].values.length) {
    result[0].values.forEach(row => {
      const hour = parseInt(row[0], 10);
      const count = row[1];
      hours[hour] = count;
    });
  }

  return hours;
}

// 获取CDKey生命周期数据
function getCDKeyLifecycle() {
  const result = db.exec(`
    SELECT
      CAST(julianday(used_at) - julianday(created_at) AS INTEGER) as days_to_use,
      COUNT(*) as count
    FROM cdkeys
    WHERE is_used = 1 AND used_at IS NOT NULL
    GROUP BY days_to_use
    ORDER BY days_to_use
  `);

  if (!result.length) return [];

  return result[0].values.map(row => ({
    days: row[0],
    count: row[1]
  }));
}

// 获取星期分布
function getWeekdayDistribution() {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const counts = Array(7).fill(0);

  const result = db.exec(`
    SELECT strftime('%w', requested_at) as weekday, COUNT(*) as count
    FROM requests
    GROUP BY weekday
  `);

  if (result.length && result[0].values.length) {
    result[0].values.forEach(row => {
      const day = parseInt(row[0], 10);
      const count = row[1];
      counts[day] = count;
    });
  }

  return {
    labels: weekdays,
    data: counts
  };
}

// 获取库存健康度指标
function getInventoryHealth() {
  const stats = getStats();
  const usageRate = stats.total > 0 ? (stats.used / stats.total * 100).toFixed(1) : 0;

  // 获取最近7天的平均请求量
  const recentResult = db.exec(`
    SELECT COUNT(*) as total FROM requests
    WHERE date(requested_at) >= date('now', '-7 days')
  `);
  const recentRequests = recentResult.length ? recentResult[0].values[0][0] : 0;
  const avgDailyRequests = Math.round(recentRequests / 7);

  // 预计剩余天数
  const daysRemaining = avgDailyRequests > 0 ? Math.floor(stats.available / avgDailyRequests) : 999;

  return {
    total: stats.total,
    available: stats.available,
    used: stats.used,
    usageRate: parseFloat(usageRate),
    avgDailyRequests,
    daysRemaining,
    status: daysRemaining < 7 ? 'critical' : daysRemaining < 30 ? 'warning' : 'healthy'
  };
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
  batchDeleteCDKeys,
  checkUserQuota,
  getUserQuotaInfo,
  updateUserQuota,
  // 新增分析函数
  getTimeSeriesData,
  getUserRequestRanking,
  getHourlyDistribution,
  getCDKeyLifecycle,
  getWeekdayDistribution,
  getInventoryHealth,
  // 新增优化分析函数
  getAnomalousUsers,
  getUserActivityStats,
  generateInsights
};
