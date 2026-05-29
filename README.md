# 灵栈AI IP资产库系统

前台 + 后台 + 后端接口 + SQLite数据库，完整全栈项目。

## 快速启动

```bash
# 1. 进入项目目录
cd lingzhan-ip-system

# 2. 安装依赖
npm install

# 3. 启动服务
npm start
```

启动后访问：
- **前台入口**：http://localhost:3000/front
- **后台入口**：http://localhost:3000/admin

## 登录账号

| 入口 | 账号 | 密码 | 角色 |
|------|------|------|------|
| 前台 | admin2 | 1234567 | 前台用户 |
| 后台 | admin | 123456 | 管理员 |

## 功能说明

### 前台（/front）
- 登录后进入 IP 资产库
- 只展示**状态为上架**的 IP
- 支持按姓名搜索、性别筛选、年龄区间筛选、风格筛选
- 点击卡片查看 IP 详情（含年龄版本、视频/人设图/三视图、擅长风格）
- **不展示**上架/下架文案和状态字段

### 后台（/admin）
- 左侧导航：IP列表管控 / 操作记录
- **IP列表**：查看全部IP（含上架/下架），支持搜索和筛选
- **创建IP**：填写基础信息（必填：姓名、年龄、风格、状态、封面图），默认状态为上架
- **编辑IP**：修改基础信息，切换上架/下架状态
- **图片上传矩阵**：每个IP有5个年龄版本，每个版本可上传视频介绍、人设图、三视图、多张擅长风格图片
- **操作记录**：自动记录所有创建、修改操作

### 核心联动机制
1. 后台创建 IP（状态=上架）→ 数据库写入 → 前台刷新可见
2. 后台将 IP 下架 → 数据库更新 status=下架 → 前台刷新不再显示
3. 后台重新上架 → 前台刷新恢复显示
4. 所有操作自动生成记录

## 技术栈

- **后端**：Express.js + better-sqlite3 (SQLite)
- **前端**：原生 HTML/CSS/JS（SPA 单页应用）
- **文件上传**：multer
- **认证**：Token-based（Base64编码）

## 项目结构

```
lingzhan-ip-system/
├── server.js              # Express 主服务器 + API路由
├── package.json           # 依赖配置
├── db/
│   └── init.js            # 数据库初始化 & 种子数据
├── public/
│   ├── front/
│   │   └── index.html     # 前台 SPA（登录+资产库+详情）
│   ├── admin/
│   │   └── index.html     # 后台 SPA（登录+列表管控+编辑+记录）
│   └── uploads/           # 上传文件存储目录
├── data/
│   └── lingzhan.db        # SQLite 数据库文件
└── README.md
```

## 部署到服务器

1. 将整个 `lingzhan-ip-system` 目录上传到服务器
2. 运行 `npm install && npm start`
3. 使用 PM2 保持后台运行：
   ```bash
   npm install -g pm2
   pm2 start server.js --name lingzhan-ip
   pm2 save
   ```
4. 用 Nginx 反向代理（推荐）或直接开放端口访问

## 初始化数据

系统首次启动会自动创建：
- 2 个用户账号（admin / admin2）
- 4 条示例 IP 数据（李默涵/陆行川/沈青棠/周砚白）
- 1 条初始操作记录
