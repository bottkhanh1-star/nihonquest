#!/usr/bin/env bash
# ==============================================================================
# Nihon Quest - Oracle Cloud Always Free PostgreSQL Setup Script
# Hỗ trợ Ubuntu 22.04 / 24.04 LTS (ARM64 Ampere A1 hoặc AMD64)
# ==============================================================================

set -e

echo "🚀 [1/5] Cập nhật hệ thống Ubuntu..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release iptables-persistent netfilter-persistent

echo "🐳 [2/5] Cài đặt Docker và Docker Compose..."
if ! command -v docker &> /dev/null; then
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-compose
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker $USER
fi

echo "🛡️ [3/5] Mở cổng 5432 trên tường lửa Ubuntu (iptables / UFW)..."
# Oracle Cloud Ubuntu mặc định chặn tất cả các port vào bằng iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5432 -j ACCEPT || true
sudo netfilter-persistent save || true

if command -v ufw &> /dev/null; then
  sudo ufw allow 5432/tcp || true
fi

echo "📦 [4/5] Khởi động PostgreSQL Container..."
cd "$(dirname "$0")"

# Tạo mật khẩu ngẫu nhiên nếu chưa có .env
if [ ! -f .env ]; then
  RANDOM_PASS=$(tr -dc A-Za-z0-9_#@% 2>/dev/null < /dev/urandom | head -c 24 || echo "NihonQuestSecure2026Pass")
  cat <<EOF > .env
POSTGRES_USER=nihonquest_admin
POSTGRES_PASSWORD=${RANDOM_PASS}
POSTGRES_DB=nihonquest
EOF
  echo "🔑 Đã tạo file .env với mật khẩu tự sinh:"
  cat .env
fi

sudo docker compose up -d

PUBLIC_IP=$(curl -s https://ifconfig.me || echo "<IP_PUBLIC_CUA_BAN>")
DB_USER=$(grep POSTGRES_USER .env | cut -d '=' -f2)
DB_PASS=$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2)
DB_NAME=$(grep POSTGRES_DB .env | cut -d '=' -f2)

echo ""
echo "=============================================================================="
echo "✅ CHÚC MỪNG BẠN! POSTGRESQL ĐÃ SẴN SÀNG TRÊN ORACLE CLOUD ALWAYS FREE!"
echo "=============================================================================="
echo "Chuỗi kết nối DATABASE_URL cho Nihon Quest (.env):"
echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASS}@${PUBLIC_IP}:5432/${DB_NAME}?sslmode=prefer\""
echo "DIRECT_URL=\"postgresql://${DB_USER}:${DB_PASS}@${PUBLIC_IP}:5432/${DB_NAME}?sslmode=prefer\""
echo ""
echo "⚠️ LƯU Ý QUAN TRỌNG: Hãy đảm bảo bạn đã mở Ingress Rule cổng 5432 trên"
echo "Oracle Cloud Web Console: VCN -> Security Lists -> Default Security List -> Add Ingress Rule"
echo "Source CIDR: 0.0.0.0/0, Destination Port: 5432"
echo "=============================================================================="

