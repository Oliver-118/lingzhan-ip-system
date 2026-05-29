# 🚀 灵栈AI — 一键部署到 Render（免费公网访问）

> 预计耗时：**5-10 分钟** | 费用：**永久免费**

---

## 第一步：注册/登录 Render

1. 打开 https://render.com
2. 点 **"Get Started Free"**
3. 用 **GitHub 登录**（推荐，这样可以直接导入代码仓库）

---

## 第二步：在 GitHub 上创建仓库

1. 打开 https://github.com/new
2. Repository name 填：`lingzhan-ip-system`
3. 选 **Private**（私有，只有你能看到）或 Public 都可以
4. **不要勾选** "Add a README file"
5. 点 **Create repository**

---

## 第三步：推送代码到 GitHub

打开终端（Mac 的「终端」或 Windows 的「命令提示符」），依次执行以下命令：

```bash
# 进入项目目录
cd /Users/xiaolu/WorkBuddy/2026-05-30-00-00-04/lingzhan-ip-system

# 添加你的 GitHub 远程仓库地址（把下面的 YOUR_GITHUB_USERNAME 换成你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/lingzhan-ip-system.git

# 推送代码到 GitHub
git branch -M main
git push -u origin main
```

如果提示输入用户名密码，输入你的 GitHub 账号和密码（或 Personal Access Token）。

---

## 第四步：在 Render 上部署

1. 在 Render 控制台点 **"+ New"** → **"Web Service"**
2. 选择 **"Connect"** 你的 `lingzhan-ip-system` 仓库
3. 配置如下：

| 配置项 | 值 |
|--------|-----|
| **Name** | `lingzhan-ip-system` |
| **Region** | Singapore / Frankfurt（选离你近的） |
| **Runtime** | Node.js（自动识别，不用改） |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | **Free** |

4. 点击 **Advanced** 展开高级配置：
   - 不需要额外环境变量（项目已内置默认值）

5. 点底部 **"Create Web Service"**

6. 等待构建完成（约 1-3 分钟，能看到实时日志）

---

## 第五步：获取公网访问地址

构建完成后，Render 会显示你的网站地址，格式类似：

```
https://lingzhan-ip-system.onrender.com
```

### 访问地址

| 入口 | 地址 |
|------|------|
| **前台** | `https://xxx.onrender.com/front` |
| **后台** | `https://xxx.onrender.com/admin` |

### 登录账号

| 入口 | 账号 | 密码 |
|------|------|------|
| 前台 | admin2 | 1234567 |
| 后台 | admin | 123456 |

---

## ⚠️ 免费版注意事项

1. **休眠策略**：15 分钟无自动访问会休眠，下次访问需等 ~10 秒唤醒
   - 解决方案：升级到付费版（$7/月），或使用 UptimeRobot 免费定时 ping 保持唤醒

2. **数据持久化**：免费版每次重新部署后数据库会被重置
   - 解决方案：升级付费版使用磁盘持久化，或用外部数据库（如 Turso/PlanetScale）

3. **文件上传**：免费版重启后上传的文件会丢失
   - 解决方案：同上，或改用云存储（阿里OSS/腾讯COS/S3）

---

## 🎉 完成！

部署成功后，你可以：
- 把前台链接分享给任何人查看 IP 资产库
- 用后台管理 IP 的增删改查和上架下架
- 数据前后台实时同步

遇到问题？检查 Render Dashboard 里的 Logs 标签页查看错误信息。
