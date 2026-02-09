#!/bin/bash

# --- CONFIGURACIÓN ---
APP_NAME="lizard-loop"
USER_NAME="lizard"
APP_DIR="/home/$USER_NAME/$APP_NAME"
DERMA_DIR="/home/$USER_NAME/website-derma-aracely"

# 1. ACTUALIZACIÓN Y DEPENDENCIAS
echo "🚀 Actualizando sistema e instalando dependencias..."
apt update && apt upgrade -y
apt install -y nginx sqlite3 curl git build-essential ufw

# 2. INSTALAR NODE.JS 20 LTS
echo "📦 Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 3. CREAR USUARIO Y DIRECTORIOS
if ! id "$USER_NAME" &>/dev/null; then
    adduser --disabled-password --gecos "" $USER_NAME
fi
chmod +x /home/$USER_NAME

# 4. CONFIGURACIÓN GLOBAL DE NGINX (Optimizado para 512MB/1GB RAM)
echo "⚙️ Configurando nginx.conf..."
cat > /etc/nginx/nginx.conf <<EOF
user www-data;
worker_processes auto;
events {
    worker_connections 512;
    use epoll;
    multi_accept on;
}
http {
    client_max_body_size 10M;
    keepalive_timeout 15;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    error_log /var/log/nginx/error.log warn;
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# 5. CONFIGURACIÓN DEL SITIO 1: LIZARD LOOP (Proxy Reverso)
echo "🌐 Configurando Nginx para Lizard Loop..."
cat > /etc/nginx/sites-available/$APP_NAME <<EOF
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto http;
    }
}
EOF

# 6. CONFIGURACIÓN DEL SITIO 2: DERMA ARACELY (Archivos Estáticos)
echo "🌐 Configurando Nginx para Derma Aracely (Puerto 8080)..."
cat > /etc/nginx/sites-available/website-derma-aracely <<EOF
server {
    listen 8080;
    server_name _;
    root $DERMA_DIR/dist;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 7. ACTIVAR SITIOS Y LIMPIAR DEFAULT
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/website-derma-aracely /etc/nginx/sites-enabled/

# 8. FIREWALL
echo "🛡️ Configurando Firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 8080/tcp
ufw allow 443/tcp
ufw --force enable

# 9. REINICIAR SERVICIOS
nginx -t && systemctl restart nginx
systemctl enable nginx

echo "✅ Instalación base completada."
echo "⚠️ RECUERDA: Ahora debes clonar tus repositorios en /home/lizard/ y arrancar PM2."