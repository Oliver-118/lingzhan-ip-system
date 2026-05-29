const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { initDB, getDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化数据库
initDB();

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ==================== 文件上传配置 ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// ==================== 认证中间件 ====================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    // 简单token验证：token格式为 base64(user_id:timestamp)
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, ts] = decoded.split(':');
    // token有效期24小时
    if (Date.now() - Number(ts) > 24 * 60 * 60 * 1000) {
      return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    }
    req.userId = userId;
    req.userRole = userId === 'admin' ? 'admin' : 'front';
    next();
  } catch {
    return res.status(401).json({ success: false, message: '无效的认证信息' });
  }
}

function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: '无权访问后台接口' });
  }
  next();
}

function generateToken(username) {
  return Buffer.from(`${username}:${Date.now()}`).toString('base64');
}

// ==================== 路由：静态页面 ====================

// 前台入口
app.get('/front', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/front/index.html'));
});

// 后台入口
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// 根路径重定向
app.get('/', (req, res) => {
  res.redirect('/front');
});

// ==================== API：登录 ====================

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入账号和密码' });
  }

  const d = getDB();
  const user = d.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: '账号或密码错误' });
  }

  const token = generateToken(username);
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// ==================== API：前台 IP资产库 ====================

// 前台获取IP列表（只返回上架的）
app.get('/api/front/ips', authMiddleware, (req, res) => {
  const d = getDB();
  let sql = `SELECT * FROM ip_assets WHERE status = '上架'`;
  const params = [];

  const { keyword, gender, ageRange, style } = req.query;

  if (keyword) {
    sql += ` AND name LIKE ?`;
    params.push(`%${keyword}%`);
  }
  if (gender && gender !== '全部') {
    sql += ` AND gender = ?`;
    params.push(gender);
  }
  if (ageRange && ageRange !== '全部') {
    const ranges = {
      '0–12岁': [0, 12],
      '13–17岁': [13, 17],
      '18–35岁': [18, 35],
      '36–59岁': [36, 59],
      '60岁及以上': [60, 999]
    };
    const [min, max] = ranges[ageRange] || [0, 999];
    sql += ` AND age BETWEEN ? AND ?`;
    params.push(min, max);
  }
  if (style && style !== '全部') {
    sql += ` AND style = ?`;
    params.push(style);
  }

  sql += ` ORDER BY created_at DESC`;

  const ips = d.prepare(sql).all(...params);

  // 为每个IP添加accent颜色
  const accentMap = { 现代: '#465a74', 古风: '#5c7f9f', 年代: '#986a5a', 科幻: '#3452a4' };
  ips.forEach(ip => {
    ip.accent = accentMap[ip.style] || '#5c7f9f';
    ip.home = ip.hometown;
    // 构建封面URL
    if (ip.cover_url) {
      ip.cover = `/uploads/${path.basename(ip.cover_url)}`;
    }
  });

  res.json({ success: true, data: ips });
});

// 前台获取IP详情（含素材）
app.get('/api/front/ips/:id', authMiddleware, (req, res) => {
  const d = getDB();
  const ip = d.prepare('SELECT * FROM ip_assets WHERE id = ? AND status = "上架"').get(req.params.id);

  if (!ip) {
    return res.status(404).json({ success: false, message: 'IP不存在或已下架' });
  }

  ip.accent = { 现代: '#465a74', 古风: '#5c7f9f', 年代: '#986a5a', 科幻: '#3452a4' }[ip.style] || '#5c7f9f';
  ip.home = ip.hometown;
  if (ip.cover_url) ip.cover = `/uploads/${path.basename(ip.cover_url)}`;

  // 获取所有素材
  const materials = d.prepare(
    'SELECT * FROM ip_materials WHERE ip_id = ? ORDER BY age_version, material_type, sort_order'
  ).all(ip.id);

  // 按年龄版本和类型分组
  const assets = {};
  const versions = ['儿童版', '少年版', '青年版', '中年版', '老年版'];
  versions.forEach(v => {
    assets[v] = { video: null, role: null, three: null, styles: [] };
  });

  materials.forEach(m => {
    const ver = m.age_version;
    if (!assets[ver]) assets[ver] = { video: null, role: null, three: null, styles: [] };

    const fileUrl = `/uploads/${path.basename(m.file_url)}`;

    switch (m.material_type) {
      case 'video_intro':
        assets[ver].video = { name: m.file_name || '视频介绍.mp4', data: fileUrl };
        break;
      case 'character_setting':
        assets[ver].role = { name: m.file_name || '人设图.png', data: fileUrl };
        break;
      case 'three_view':
        assets[ver].three = { name: m.file_name || '三视图.png', data: fileUrl };
        break;
      case 'style_gallery':
        assets[ver].styles.push({ name: m.file_name || '风格图片.png', data: fileUrl, accent: ip.accent });
        break;
    }
  });

  ip.assets = assets;

  res.json({ success: true, data: ip });
});

// ==================== API：后台管理 ====================

// 后台获取全部IP列表（含上架和下架）
app.get('/api/admin/ips', authMiddleware, adminOnly, (req, res) => {
  const d = getDB();
  let sql = `SELECT * FROM ip_assets ORDER BY created_at DESC`;
  const params = [];
  const { keyword, status, style } = req.query;

  if (keyword) {
    sql = sql.replace('ORDER BY', 'WHERE (ip_no LIKE ? OR name LIKE ?) ORDER BY');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (status && status !== '全部状态') {
    sql += (params.length ? ' AND' : 'WHERE') + ` status = ?`;
    params.push(status);
  }
  if (style && style !== '全部风格') {
    sql += (params.length ? ' AND' : 'WHERE') + ` style = ?`;
    params.push(style);
  }

  const ips = d.prepare(sql).all(...params);

  const accentMap = { 现代: '#465a74', 古风: '#5c7f9f', 年代: '#986a5a', 科幻: '#3452a4' };
  ips.forEach(ip => {
    ip.accent = accentMap[ip.style] || '#5c7f9f';
    ip.home = ip.hometown;
    if (ip.cover_url) ip.cover = `/uploads/${path.basename(ip.cover_url)}`;
  });

  res.json({ success: true, data: ips });
});

// 创建IP
app.post('/api/admin/ips', authMiddleware, adminOnly, (req, res) => {
  const d = getDB();
  const { name, gender, age, style, status, height, weight, hometown, cover_url } = req.body;

  if (!name || !age || !style || !status) {
    return res.status(400).json({ success: false, message: '必填字段不完整' });
  }

  // 生成新编号
  const row = d.prepare('SELECT ip_no FROM ip_assets ORDER BY CAST(SUBSTR(ip_no, 4) AS INTEGER) DESC LIMIT 1').get();
  const nextNo = row ? 'IP-' + String(Number(row.ip_no.replace(/\D/g, '')) + 1).padStart(4, '0') : 'IP-0001';

  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

  const result = d.prepare(
    `INSERT INTO ip_assets (ip_no, name, gender, age, style, status, height, weight, hometown, creator, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nextNo, name, gender || '女性', Number(age), style, status, height || null, weight || null, hometown || null, 'admin', now, now);

  // 操作记录
  d.prepare(
    `INSERT INTO operation_logs (ip_id, ip_no, ip_name, operation_type, operation_content, operator, created_at)
     VALUES (?, ?, ?, '创建', '创建IP，填写基础信息并上传封面图', 'admin', ?)`
  ).run(result.lastInsertRowid, nextNo, name, now);

  const accentMap = { 现代: '#465a74', 古风: '#5c7f9f', 年代: '#986a5a', 科幻: '#3452a4' };

  res.json({
    success: true,
    data: {
      id: result.lastInsertRowid,
      no: nextNo,
      name, gender: gender || '女性', age: Number(age), style, status,
      height, weight, hometown: hometown || null,
      creator: 'admin', created: now, accent: accentMap[style] || '#5c7f9f',
      cover: cover_url ? `/uploads/${path.basename(cover_url)}` : null,
      assets: {}
    }
  });
});

// 编辑IP
app.put('/api/admin/ips/:id', authMiddleware, adminOnly, (req, res) => {
  const d = getDB();
  const id = req.params.id;
  const old = d.prepare('SELECT * FROM ip_assets WHERE id = ?').get(id);

  if (!old) {
    return res.status(404).json({ success: false, message: 'IP不存在' });
  }

  const { name, gender, age, style, status, height, weight, hometown, cover_url } = req.body;
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

  d.prepare(
    `UPDATE ip_assets SET name=?, gender=?, age=?, style=?, status=?, height=?, weight=?, hometown=?, updated_at=?
     ${cover_url !== undefined ? ', cover_url=?' : ''} WHERE id=?`
  ).run(name ?? old.name, gender ?? old.gender, age ?? old.age, style ?? old.style,
       status ?? old.status, height ?? old.height, weight ?? old.weight, hometown ?? old.hometown, now,
       ...(cover_url !== undefined ? [cover_url] : []), id);

  // 操作记录
  d.prepare(
    `INSERT INTO operation_logs (ip_id, ip_no, ip_name, operation_type, operation_content, operator, created_at)
     VALUES (?, ?, ?, '修改', '修改IP基础信息或状态', 'admin', ?)`
  ).get(id, old.ip_no, name ?? old.name, now);

  res.json({ success: true, message: '更新成功' });
});

// 上传素材
app.post('/api/admin/ips/:id/assets', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  const d = getDB();
  const ipId = req.params.id;
  const { age_version, material_type } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择文件' });
  }

  const ip = d.prepare('SELECT * FROM ip_assets WHERE id = ?').get(ipId);
  if (!ip) {
    return res.status(404).json({ success: false, message: 'IP不存在' });
  }

  // 如果是视频介绍/人设图/三视图，先删除同版本同类型的旧记录
  if (['video_intro', 'character_setting', 'three_view'].includes(material_type)) {
    d.prepare("DELETE FROM ip_materials WHERE ip_id = ? AND age_version = ? AND material_type = ?")
      .run(ipId, age_version, material_type);
  }

  // 擅长风格的sort_order
  let sortOrder = 0;
  if (material_type === 'style_gallery') {
    const maxRow = d.prepare(
      "SELECT MAX(sort_order) as mx FROM ip_materials WHERE ip_id = ? AND age_version = ? AND material_type = ?"
    ).get(ipId, age_version, material_type);
    sortOrder = (maxRow?.mx ?? 0) + 1;
  }

  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

  d.prepare(
    `INSERT INTO ip_materials (ip_id, age_version, material_type, file_url, file_name, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(ipId, age_version, material_type, req.file.path, req.file.originalname, sortOrder, now);

  // 操作记录
  const opContentMap = {
    video_intro: '上传/替换视频介绍',
    character_setting: '上传/替换人设图',
    three_view: '上传/替换三视图',
    style_gallery: '新增擅长风格图片'
  };
  d.prepare(
    `INSERT INTO operation_logs (ip_id, ip_no, ip_name, operation_type, operation_content, operator, created_at)
     VALUES (?, ?, ?, '修改', ?, 'admin', ?)`
  ).get(ipId, ip.ip_no, ip.name, opContentMap[material_type] || '上传素材', now);

  res.json({
    success: true,
    data: {
      url: `/uploads/${path.basename(req.file.path)}`,
      name: req.file.originalname
    }
  });
});

// 删除素材
app.delete('/api/admin/assets/:assetId', authMiddleware, adminOnly, (req, res) => {
  const d = getDB();
  const assetId = req.params.assetId;
  const asset = d.prepare('SELECT * FROM ip_materials WHERE id = ?').get(assetId);

  if (!asset) {
    return res.status(404).json({ success: false, message: '素材不存在' });
  }

  const ip = d.prepare('SELECT * FROM ip_assets WHERE id = ?').get(asset.ip_id);

  // 操作记录
  const opMap = {
    video_intro: '删除视频介绍',
    character_setting: '删除人设图',
    three_view: '删除三视图',
    style_gallery: '删除擅长风格图片'
  };
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

  d.prepare(
    `INSERT INTO operation_logs (ip_id, ip_no, ip_name, operation_type, operation_content, operator, created_at)
     VALUES (?, ?, ?, '修改', ?, 'admin', ?)`
  ).get(asset.ip_id, ip?.ip_no || '', ip?.name || '', opMap[asset.material_type] || '删除素材', now);

  d.prepare('DELETE FROM ip_materials WHERE id = ?').run(assetId);

  res.json({ success: true, message: '删除成功' });
});

// 操作记录查询
app.get('/api/admin/operation-records', authMiddleware, adminOnly, (req, res) => {
  const d = getDB();
  let sql = `SELECT * FROM operation_logs ORDER BY created_at DESC`;
  const params = [];

  const { keyword, type } = req.query;

  if (keyword) {
    sql = sql.replace('ORDER BY', 'WHERE (ip_no LIKE ? OR ip_name LIKE ? OR operation_content LIKE ? OR operator LIKE ?) ORDER BY');
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  if (type && type !== '全部操作') {
    sql += (params.length ? ' AND' : 'WHERE') + ` operation_type = ?`;
    params.push(type);
  }

  const records = d.prepare(sql).all(...params);
  res.json({ success: true, data: records });
});

// 健康检查（Docker/Nginx用）
app.get('/api/health', (req, res) => {
  try {
    const d = getDB();
    d.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   灵栈AI IP资产库系统 已启动          ║
║                                      ║
║   前台入口：http://localhost:${PORT}/front   ║
║   后台入口：http://localhost:${PORT}/admin   ║
║                                      ║
║   前台账号：admin2 / 1234567          ║
║   后台账号：admin  / 123456           ║
╚══════════════════════════════════════╝
  `);
});
