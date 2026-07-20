process.env.TZ = "Asia/Shanghai";
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080;

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let db;

// 初始化数据库
initSqlJs().then(function(SQL) {
  // 尝试读取现有数据库文件
  let dbBuffer = null;
  const dbPath = path.join(__dirname, 'checkin.db');
  if (fs.existsSync(dbPath)) {
    dbBuffer = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(dbBuffer);
  
  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      imagePath TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 启动服务器
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ 服务器运行在 http://0.0.0.0:${port}`);
    console.log(`📁 上传目录: ${uploadsDir}`);
  });
});

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});
// 打卡上传接口
app.post('/api/checkin', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传图片' });
  }
  
  const { userId, type } = req.body;
  
  try {
    db.run('INSERT INTO checkins (userId, type, imagePath, timestamp) VALUES (?, ?, ?, datetime("now", "localtime"))', 
      [userId || 'unknown', type || 'drink', req.file.filename]);
    
    // 获取最后插入的ID
    const result = db.exec('SELECT last_insert_rowid() as id');
    const lastId = result[0].values[0][0];
    
    res.json({ 
      success: true, 
      id: lastId,
      message: '打卡成功'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有打卡记录
app.get('/api/checkins', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM checkins ORDER BY timestamp DESC');
    const rows = result[0] ? result[0].values.map((row, index) => {
      const columns = result[0].columns;
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    }) : [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除打卡记录
app.delete('/api/checkins/:id', (req, res) => {
  try {
    // 获取图片路径
    const result = db.exec('SELECT imagePath FROM checkins WHERE id = ?', [req.params.id]);
    if (result[0] && result[0].values.length > 0) {
      const imagePath = result[0].values[0][0];
      const filePath = path.join(uploadsDir, imagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // 删除记录
    db.run('DELETE FROM checkins WHERE id = ?', [req.params.id]);
    res.json({ success: true, changes: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});