#!/bin/bash
# deployment/ec2-setup.sh
# Automated EC2 setup script for Ubuntu 22.04 LTS

set -e

echo "========================================"
echo " Video Conference App - EC2 Setup"
echo "========================================"

# Update system
echo "[1/8] Updating system..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
echo "[2/8] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version

# Install PM2
echo "[3/8] Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "[4/8] Installing Nginx..."
sudo apt-get install -y nginx

# Install Certbot for SSL
echo "[5/8] Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# Clone repository (update with your repo URL)
echo "[6/8] Cloning repository..."
cd /home/ubuntu
# git clone <your-private-repo-url> video-conference-app
# For now, assume code is already uploaded via SCP

cd video-conference-app

# Install dependencies
echo "[7/8] Installing dependencies..."
npm install --production

# Setup environment
cp .env.example .env
sudo nano .env  # Edit as needed

# Start application with PM2
echo "[8/8] Starting application..."
pm2 start server.js --name videoconf
pm2 save
pm2 startup

# Configure Nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/videoconf
sudo ln -s /etc/nginx/sites-available/videoconf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo "Application: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo ""
echo "Next steps:"
echo "1. Configure your domain DNS to point to this server"
echo "2. Run: sudo certbot --nginx -d your-domain.com"
echo "3. Update ALLOWED_ORIGINS in .env"
echo "========================================"