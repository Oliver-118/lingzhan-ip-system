#!/bin/bash
# ============================================
#  灵栈AI IP资产库 — 一键部署脚本
#  适用于 Linux / macOS 服务器（含 Docker）
# ============================================

set -e
echo "🚀 灵栈AI IP资产库 — 容器化部署脚本"
echo "========================================"

# ---- 配置项（可按需修改）----
IMAGE_NAME="lingzhan-ip-system"
CONTAINER_NAME="lingzhan-ip"
PORT="${1:-3000}"
# ------------------------------

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# 1. 环境检查
echo ""
echo "--- [1/5] 检查环境 ---"
command -v docker >/dev/null 2>&1 || error "未安装 Docker，请先安装: https://docs.docker.com/get-docker/"
command -v docker compose >/dev/null 2>&1 || error "未安装 Docker Compose"
info "Docker 版本: $(docker --version)"
info "端口 $PORT 将被映射"

# 2. 清理旧容器/镜像（可选）
echo ""
echo "--- [2/5] 清理旧实例 ---"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "发现旧容器 ${CONTAINER_NAME}，正在停止并删除..."
    docker stop ${CONTAINER_NAME} 2>/dev/null || true
    docker rm ${CONTAINER_NAME} 2>/dev/null || true
else
    info "无旧容器，跳过清理"
fi

# 3. 构建镜像
echo ""
echo "--- [3/5] 构建 Docker 镜像 ---"
info "开始构建 ${IMAGE_NAME} 镜像..."
docker build -t ${IMAGE_NAME}:latest .
info "镜像构建完成 ✓"

# 4. 启动容器
echo ""
echo "--- [4/5] 启动容器 ---"
mkdir -p data public/uploads

docker run -d \
  --name ${CONTAINER_NAME} \
  --restart unless-stopped \
  -p "${PORT}:3000" \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/public/uploads:/app/public/uploads" \
  -e NODE_ENV=production \
  ${IMAGE_NAME}:latest

info "容器启动中..."

# 5. 等待就绪 & 输出结果
echo ""
echo "--- [5/5] 验证服务 ---"

for i in $(seq 1 15); do
  if curl -sf http://localhost:${PORT}/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
  printf "."
done
echo ""

if curl -sf http://localhost:${PORT}/api/health >/dev/null 2>&1; then
  echo ""
  echo "========================================"
  echo -e "${GREEN}🎉 部署成功！${NC}"
  echo "========================================"
  echo ""
  echo -e "  前台地址:  ${YELLOW}http://<你的IP>:${PORT}/front${NC}"
  echo -e "            账号: admin2  密码: 1234567"
  echo ""
  echo -e "  后台地址:  ${YELLOW}http://<你的IP>:${PORT}/admin${NC}"
  echo -e "            账号: admin   密码: 123456"
  echo ""
  echo "  常用命令:"
  echo "    查看日志:   docker logs -f ${CONTAINER_NAME}"
  echo "    停止服务:   docker stop ${CONTAINER_NAME}"
  echo "    重启服务:   docker restart ${CONTAINER_NAME}"
  echo "    删除容器:   docker rm -f ${CONTAINER_NAME}"
  echo "    重新构建:   ./deploy.sh (再次运行本脚本)"
  echo ""
  echo "  数据持久化目录:"
  echo "    数据库: $(pwd)/data/lingzhan.db"
  echo "    上传文件: $(pwd)/public/uploads/"
  echo "========================================"
else
  warn "服务可能还在启动中，请稍后手动验证:"
  echo "  docker logs ${CONTAINER_NAME}"
fi
