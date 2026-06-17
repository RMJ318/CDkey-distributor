# CDKey分配系统

基于FIFO（先进先出）逻辑的CDKey分配系统，使用SQLite数据库存储。

## 功能特性

- ✅ **FIFO分配逻辑**：最早添加的CDKey最先被分配
- ✅ **请求原因记录**：每次分配都会记录请求原因
- ✅ **批量管理**：支持单个和批量添加CDKey
- ✅ **历史查询**：查看所有请求历史记录
- ✅ **实时统计**：显示总数、可用数、已使用数等统计信息
- ✅ **美观界面**：现代化的响应式UI设计

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **前端**: HTML + CSS + JavaScript

## 安装运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 访问系统：
打开浏览器访问 `http://localhost:3000`

## 数据库设计

### cdkeys表
```sql
CREATE TABLE cdkeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  is_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME
)
```

### requests表
```sql
CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason TEXT NOT NULL,
  cdkey_id INTEGER,
  cdkey_code TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cdkey_id) REFERENCES cdkeys(id)
)
```

## 使用说明

### 1. 请求CDKey

- 在"请求CDKey"页面输入请求原因
- 点击"获取CDKey"按钮
- 系统会按FIFO顺序分配最早添加且未使用的CDKey

### 2. 管理CDKey

- **添加单个**：在输入框中输入CDKey，点击"添加"
- **批量添加**：在文本框中每行输入一个CDKey，点击"批量添加"

### 3. 查看历史

- 点击"请求历史"标签页查看所有分配记录
- 包含CDKey、请求原因和请求时间

### 4. 清空数据

- 在"管理CDKey"页面的危险区域
- 点击"清空所有数据"可以重置系统

## API接口

### 获取CDKey
```
POST /api/get-cdkey
Body: { "reason": "请求原因" }
Response: { "success": true, "cdkey": "KEY-XXX", "message": "分配成功" }
```

### 添加CDKey
```
POST /api/add-cdkey
Body: { "code": "KEY-001" }
Response: { "success": true, "id": 1 }
```

### 批量添加CDKey
```
POST /api/add-batch-cdkeys
Body: { "codes": ["KEY-001", "KEY-002"] }
Response: { "success": true, "count": 2 }
```

### 获取统计信息
```
GET /api/stats
Response: {
  "total": 100,
  "used": 50,
  "available": 50,
  "totalRequests": 50
}
```

### 获取请求历史
```
GET /api/history?limit=50&offset=0
Response: [
  {
    "id": 1,
    "reason": "测试使用",
    "cdkey_code": "KEY-001",
    "requested_at": "2026-06-17T09:00:00.000Z"
  }
]
```

### 清空所有数据
```
POST /api/clear-all
Response: { "success": true, "message": "所有数据已清空" }
```

## 项目结构

```
code-generator/
├── server.js              # Express服务器
├── database.js            # 数据库操作
├── package.json           # 项目配置
├── cdkeys.db             # SQLite数据库（运行后自动生成）
├── README.md             # 说明文档
└── public/               # 前端文件
    ├── index.html        # 主页面
    ├── style.css         # 样式表
    └── script.js         # 前端脚本
```

## 注意事项

1. **CDKey唯一性**：系统会自动检查CDKey是否重复
2. **FIFO保证**：使用 `created_at ASC, id ASC` 排序确保FIFO
3. **事务安全**：分配CDKey使用数据库事务，避免并发问题
4. **数据持久化**：所有数据存储在 `cdkeys.db` 文件中

## 快速测试

启动服务器后，可以使用以下测试数据：

```
KEY-2026-001-ABCD
KEY-2026-002-EFGH
KEY-2026-003-IJKL
KEY-2026-004-MNOP
KEY-2026-005-QRST
```

将以上内容粘贴到"批量添加CDKey"文本框中，即可快速添加测试数据。

## License

MIT
