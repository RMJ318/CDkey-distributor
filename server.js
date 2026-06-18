const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 5555;

// 初始化数据库（异步）
db.initDatabase().then(() => {
  console.log('数据库初始化完成');
}).catch(err => {
  console.error('数据库初始化失败:', err);
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
app.use(session({
  secret: 'cdkey-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}));

// 主页重定向（必须在static之前）
app.get('/', (req, res) => {
  if (req.session.user) {
    // 根据用户角色重定向到不同的dashboard
    if (req.session.user.role === 'admin') {
      res.redirect('/dashboard.html');  // 管理员 → v1完整版Dashboard
    } else {
      res.redirect('/dashboard-v2.html');  // 普通用户 → v2极简版Dashboard
    }
  } else {
    res.redirect('/login-new.html');  // 新版登录
  }
});

app.use(express.static('public'));

// 认证中间件
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }
  next();
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '需要管理员权限' });
  }
  next();
}

// API路由

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '请输入用户名和密码'
    });
  }

  const result = db.authenticateUser(username, password);

  if (result.success) {
    req.session.user = result.user;
    res.json({
      success: true,
      user: result.user,
      message: '登录成功'
    });
  } else {
    res.status(401).json(result);
  }
});

// 登出
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: '已登出' });
});

// 获取当前用户信息（包含配额）
app.get('/api/current-user', (req, res) => {
  if (req.session.user) {
    const quotaInfo = db.getUserQuotaInfo(req.session.user.id);
    res.json({
      success: true,
      user: req.session.user,
      quota: quotaInfo
    });
  } else {
    res.json({ success: false });
  }
});

// 获取CDKey（需要登录）
app.post('/api/get-cdkey', requireAuth, (req, res) => {
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '请输入请求原因'
    });
  }

  const result = db.getCDKeyWithUser(reason.trim(), req.session.user.id);
  res.json(result);
});

// 添加单个CDKey（需要管理员权限）
app.post('/api/add-cdkey', requireAdmin, (req, res) => {
  const { code } = req.body;

  if (!code || code.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '请输入CDKey'
    });
  }

  const result = db.addCDKey(code.trim());
  res.json(result);
});

// 批量添加CDKey（需要管理员权限）
app.post('/api/add-batch-cdkeys', requireAdmin, (req, res) => {
  const { codes } = req.body;

  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供CDKey数组'
    });
  }

  const cleanCodes = codes.map(c => c.trim()).filter(c => c !== '');
  const result = db.addBatchCDKeys(cleanCodes);
  res.json(result);
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  res.json(stats);
});

// 获取所有CDKey列表（支持搜索过滤）
app.get('/api/cdkeys', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;

  const filters = {
    codeSearch: req.query.codeSearch,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const cdkeys = db.getAllCDKeys(limit, offset, filters);
  res.json(cdkeys);
});

// 获取请求历史（管理员看全部，普通用户只看自己的，支持搜索过滤）
app.get('/api/history', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const filters = {
    cdkeySearch: req.query.cdkeySearch,
    reasonSearch: req.query.reasonSearch,
    usernameSearch: req.query.usernameSearch,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  let history;
  if (req.session.user.role === 'admin') {
    history = db.getRequestHistory(limit, offset, filters);
  } else {
    history = db.getUserRequestHistory(req.session.user.id, limit, offset, filters);
  }

  res.json(history);
});

// 删除CDKey（需要管理员权限）
app.delete('/api/cdkey/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const result = db.deleteCDKey(id);
  res.json(result);
});

// 获取所有用户（需要管理员权限）
app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.getAllUsers();
  res.json(users);
});

// 创建用户（需要管理员权限）
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '请提供用户名和密码'
    });
  }

  const result = db.createUser(username, password, role || 'user');
  res.json(result);
});

// 更新用户配额（需要管理员权限）
app.put('/api/users/:id/quota', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { dailyQuota, monthlyQuota } = req.body;

  if (!dailyQuota || !monthlyQuota) {
    return res.status(400).json({
      success: false,
      message: '请提供每日和每月配额'
    });
  }

  const result = db.updateUserQuota(userId, dailyQuota, monthlyQuota);
  res.json(result);
});

// 导出CDKey数据（CSV格式，需要管理员权限）
app.get('/api/export/cdkeys', requireAdmin, (req, res) => {
  const filters = {
    codeSearch: req.query.codeSearch,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const cdkeys = db.getAllCDKeys(10000, 0, filters); // 最多导出10000条

  // 构建CSV内容
  let csv = 'ID,CDKey,状态,创建时间,使用时间\n';
  cdkeys.forEach(key => {
    csv += `${key.id},"${key.code}",${key.is_used ? '已使用' : '可用'},"${key.created_at}","${key.used_at || ''}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cdkeys_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send('﻿' + csv); // 添加BOM以支持Excel打开中文
});

// 导出请求历史（CSV格式，需要管理员权限）
app.get('/api/export/history', requireAdmin, (req, res) => {
  const filters = {
    cdkeySearch: req.query.cdkeySearch,
    reasonSearch: req.query.reasonSearch,
    usernameSearch: req.query.usernameSearch,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const history = db.getRequestHistory(10000, 0, filters); // 最多导出10000条

  // 构建CSV内容
  let csv = 'ID,用户名,CDKey,请求原因,请求时间\n';
  history.forEach(item => {
    csv += `${item.id},"${item.username || ''}","${item.cdkey_code}","${item.reason}","${item.requested_at}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="history_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send('﻿' + csv); // 添加BOM以支持Excel打开中文
});

// 清空数据（需要管理员权限）
app.post('/api/clear-all', requireAdmin, (req, res) => {
  const result = db.clearAllData();
  res.json(result);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`CDKey分配系统已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`=================================\n`);
});
