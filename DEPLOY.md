# 灵栈AI IP资产库 — Docker 容器化部署指南

## 快速部署（3步搞定）

### 前提条件
- 一台 **Linux 服务器**（推荐 Ubuntu 22.04 / CentOS 7+ / Debian 12）
- 已安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)
- 服务器开放 **TCP 3000 端口**（或自定义端口）

### 第一步：上传项目文件到服务器

```bash
# 方式1：用 scp 从本地上传
scp -r lingzhan-ip-system/ user@your-server:/home/user/

# 方式2：在服务器上 git clone（如果推到了仓库）
git clone https://github.com/your-repo/lingzhan-ip-system.git

# 方式3：打包上传
zip -r lingzhan.zip lingzhan-ip-system/
# 然后在服务器上解压
```

### 第二步：一键部署

```bash
cd lingzhan-ip-system
chmod +x deploy.sh
./deploy.sh          # 默认端口 3000
./deploy.sh 8080      # 或指定其他端口
```

### 第三步：访问验证

| 入口 | 地址 | 账号 | 密码 |
|------|------|------|------|
| 前台 | `http://服务器IP:3000/front` | admin2 | 1234567 |
| 后台 | `http://服务器IP:3000/admin` | admin | 123456 |

---

## 其他部署方式

### 方式A：Docker Compose 部署

```bash
cd lingzhan-ip-system
mkdir -p data public/uploads
docker compose up -d --build
```

查看日志：
```bash
docker compose logs -f
```

### 方式B：手动 Docker 构建

```bash
cd lingzhan-ip-system
docker build -t lingzhan-ip:latest .
docker run -d \
  --name lingzhan-ip \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public/uploads:/app/public/uploads \
  lingzhan-ip:latest
```

### 方式C：Nginx 反向代理 + HTTPS（生产推荐）

1. 先用 Docker 启动服务（方式B）

2. 安装 Nginx + Certbot（Let's Encrypt）：
```bash
# Ubuntu/Debian
apt install nginx certbot python3-certbot-nginx -y

# CentOS/RHEL
yum install nginx certbot python3-certbot-nginx -y
```

3. 复制 Nginx 配置并修改域名：
```bash
cp nginx.conf /etc/nginx/sites-available/lingzhan
ln -s /etc/nginx/sites-available/lingzhan /etc/nginx/sites-enabled/
# 编辑 /etc/nginx/sites-available/lingzhan，把 your-domain.com 改成你的域名
nginx -t && systemctl reload nginx
```

4. 申请 SSL 证书：
```bash
certbot --nginx -d your-domain.com
```

5. 访问 `https://your-domain.com/front` 即可

---

## 各云平台部署参考

### 阿里云 ECS
1. 购买 ECS 实例（最低配置即可，1核2G够用）
2. 安全组开放 3000 端口
3. 按上述「快速部署」执行
4. 可选：绑定域名 + Nginx + SSL

### 腾讯云 CVM
1. 购买轻量应用服务器或标准 CVM
2. 防火墙放行 3000 端口
3. 上传项目 → `./deploy.sh`
4. （可选）用腾讯云 CDN 加速静态资源

### AWS EC2
```bash
# 1. 创建实例后，安全组入站规则添加 TCP 3000
# 2. SSH 登录后执行：
sudo yum install -y docker   # Amazon Linux 2023
sudo systemctl start docker
sudo usermod -aG docker ec2-user
# 退出重新登录
git clone <your-repo> && cd lingzhan-ip-system
./deploy.sh
```

### 阿里云容器服务 ACK / 腾讯云 TKE
将项目推送到镜像仓库后，直接使用以下编排：
```yaml
# k8s deployment.yaml 参考
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lingzhan-ip
spec:
  replicas: 1
  selector:
    matchLabels:
      app: lingzhan-ip
  template:
    metadata:
      labels:
        app: lingzhan-ip
    spec:
      containers:
        - name: lingzhan-ip
          image: registry.cn-hangzhou.aliyuncs.com/your-namespace/lingzhan-ip:latest
          ports:
            - containerPort: 3000
          volumeMounts:
            - name: data
              mountPath: /app/data
            - name: uploads
              mountPath: /app/public/uploads
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: lingzhan-data
        - name: uploads
          persistentVolumeClaim:
            claimName: lingzhan-uploads
---
apiVersion: v1
kind: Service
metadata:
  name: lingzhan-ip-service
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: lingzhan-ip
```

---

## 本地开发 & 测试

```bash
# 无需 Docker，直接启动
npm install
npm start
# 前台 http://localhost:3000/front
# 后台 http://localhost:3000/admin
```

配合内网穿透快速分享给他人：

### cloudflared（推荐，免费且稳定）
```brew install cloudflared  # macOS
cloudflared tunnel --url http://localhost:3000
# 会生成一个 trycloudflare.com 的临时公网地址
```

### ngrok
```bash
ngrok http 3000
# 会生成一个 ngrok.io 的公网地址
```

---

## 数据备份

数据库和上传文件都通过 Docker Volume 持久化在宿主机：

```bash
# 备份
cp data/lingzhan.db backup/lingzhan_$(date +%Y%m%d).db
tar czf backup/uploads_$(date +%Y%m%d).tar.gz public/uploads/

# 恢复
cp backup/lingzhan_20260530.db data/lingzhan.db
tar xzf backup/uploads_20260530.tar.gz -C public/
docker restart lingzhan-ip
```

---

## 故障排查

| 问题 | 排查方法 |
|------|----------|
| 页面打不开 | `curl http://localhost:3000/api/health` 检查服务状态 |
| 上传失败 | 检查 `public/uploads/` 目录权限 `chmod 777 public/uploads` |
| 数据丢失 | 检查 volume 挂载 `docker inspect lingzhan-ip \| grep Mounts` |
| 端口冲突 | 修改 deploy.sh 的 PORT 参数，或 `./deploy.sh 8080` |
| 日志排查 | `docker logs -f lingzhan-ip` 查看实时日志 |
