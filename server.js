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

// 获取当前用户信息
app.get('/api/current-user', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
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

// 获取所有CDKey列表
app.get('/api/cdkeys', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const cdkeys = db.getAllCDKeys(limit, offset);
  res.json(cdkeys);
});

// 获取请求历史（管理员看全部，普通用户只看自己的）
app.get('/api/history', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  let history;
  if (req.session.user.role === 'admin') {
    history = db.getRequestHistory(limit, offset);
  } else {
    history = db.getUserRequestHistory(req.session.user.id, limit, offset);
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
