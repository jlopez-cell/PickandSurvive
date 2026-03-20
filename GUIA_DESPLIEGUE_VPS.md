# Guía de Despliegue en VPS - Aplicación Next.js

Esta guía te ayudará a desplegar tu aplicación Next.js en un servidor VPS y mantenerla activa 24/7.

## 📋 Requisitos Previos

- VPS con Ubuntu/Debian (recomendado Ubuntu 22.04 LTS)
- Acceso SSH al servidor
- Dominio configurado apuntando a la IP del VPS (opcional pero recomendado)

## 🚀 Paso 1: Preparación del Servidor

### 1.1 Conectarse al servidor VPS

```bash
ssh usuario@tu_ip_vps
```

### 1.2 Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Instalar Node.js (versión 20 LTS)

```bash
# Instalar Node.js usando NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 1.4 Instalar PM2 (gestor de procesos)

PM2 mantendrá tu aplicación corriendo 24/7 y la reiniciará automáticamente si se cae.

```bash
sudo npm install -g pm2
```

### 1.5 Instalar Nginx (servidor web y reverse proxy)

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.6 Configurar Firewall

```bash
# Permitir SSH, HTTP y HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 📦 Paso 2: Transferir el Proyecto al Servidor

### Opción A: Usando Git (Recomendado)

```bash
# En tu servidor VPS
cd ~
git clone https://github.com/tu-usuario/tu-repositorio.git facturacion-app
cd facturacion-app
```

### Opción B: Usando SCP desde tu máquina local

```bash
# Desde tu máquina local (en la carpeta del proyecto)
scp -r . usuario@tu_ip_vps:~/facturacion-app
```

### Opción C: Usando rsync (más eficiente)

```bash
# Desde tu máquina local
rsync -avz --exclude 'node_modules' --exclude '.next' \
  . usuario@tu_ip_vps:~/facturacion-app
```

## ⚙️ Paso 3: Configuración del Proyecto

### 3.1 Instalar dependencias

```bash
cd ~/facturacion-app
npm install
```

### 3.2 Configurar variables de entorno

```bash
# Crear archivo .env.local
nano .env.local
```

Agregar todas las variables necesarias:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=tu_spreadsheet_id_aqui
GOOGLE_SERVICE_ACCOUNT_EMAIL=facturacion-app@facturacion-483818.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Si tienes más variables de entorno, agréguelas aquí
# NODE_ENV=production
# PORT=3001
```

**Importante:** También necesitarás transferir el archivo JSON de credenciales de Google:

```bash
# Desde tu máquina local
scp facturacion-483818-61030a623c91.json usuario@tu_ip_vps:~/facturacion-app/
```

### 3.3 Compilar la aplicación para producción

```bash
npm run build
```

## 🔄 Paso 4: Configurar PM2

### 4.1 Crear archivo de configuración de PM2

```bash
nano ecosystem.config.js
```

Agregar el siguiente contenido:

```javascript
module.exports = {
  apps: [{
    name: 'facturacion-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/tu_usuario/facturacion-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

**Nota:** Reemplaza `tu_usuario` con tu usuario real del servidor.

### 4.2 Crear directorio de logs

```bash
mkdir -p logs
```

### 4.3 Iniciar la aplicación con PM2

```bash
pm2 start ecosystem.config.js
```

### 4.4 Configurar PM2 para iniciar al arrancar el servidor

```bash
pm2 startup
# Ejecutar el comando que PM2 te muestre (algo como: sudo env PATH=...)
pm2 save
```

### 4.5 Comandos útiles de PM2

```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs facturacion-app

# Reiniciar la aplicación
pm2 restart facturacion-app

# Detener la aplicación
pm2 stop facturacion-app

# Ver información detallada
pm2 info facturacion-app

# Monitor en tiempo real
pm2 monit
```

## 🌐 Paso 5: Configurar Nginx como Reverse Proxy

### 5.1 Crear configuración de Nginx

```bash
sudo nano /etc/nginx/sites-available/facturacion-app
```

Agregar la siguiente configuración:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Si no tienes dominio, usa la IP del servidor
    # server_name tu_ip_vps;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para evitar cortes de conexión
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Tamaño máximo de archivos subidos
    client_max_body_size 10M;
}
```

### 5.2 Habilitar el sitio

```bash
sudo ln -s /etc/nginx/sites-available/facturacion-app /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar configuración
sudo systemctl reload nginx
```

## 🔒 Paso 6: Configurar SSL con Let's Encrypt (Opcional pero Recomendado)

Si tienes un dominio configurado, puedes obtener un certificado SSL gratuito:

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# El certificado se renovará automáticamente
```

## ✅ Paso 7: Verificación

### 7.1 Verificar que la aplicación está corriendo

```bash
pm2 status
curl http://localhost:3001
```

### 7.2 Verificar Nginx

```bash
sudo systemctl status nginx
curl http://tu-dominio.com
# o
curl http://tu_ip_vps
```

### 7.3 Verificar logs si hay problemas

```bash
# Logs de PM2
pm2 logs facturacion-app

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 🔄 Paso 8: Actualizaciones Futuras

Cuando necesites actualizar la aplicación:

```bash
cd ~/facturacion-app

# Si usas Git
git pull origin main

# Reinstalar dependencias si hay cambios
npm install

# Recompilar
npm run build

# Reiniciar con PM2
pm2 restart facturacion-app
```

## 🛠️ Solución de Problemas Comunes

### La aplicación no inicia

```bash
# Ver logs detallados
pm2 logs facturacion-app --lines 100

# Verificar que el puerto 3001 está libre
sudo netstat -tulpn | grep 3001

# Verificar variables de entorno
pm2 env 0
```

### Error 502 Bad Gateway

- Verificar que la aplicación está corriendo: `pm2 status`
- Verificar que Nginx puede alcanzar el puerto 3001: `curl http://localhost:3001`
- Revisar logs de Nginx: `sudo tail -f /var/log/nginx/error.log`

### La aplicación se cae frecuentemente

- Verificar memoria disponible: `free -h`
- Ajustar `max_memory_restart` en `ecosystem.config.js`
- Verificar logs para errores: `pm2 logs facturacion-app`

### Problemas con Google Sheets API

- Verificar que el archivo JSON de credenciales está en el servidor
- Verificar que las variables de entorno están correctamente configuradas
- Verificar permisos del archivo JSON: `chmod 600 facturacion-483818-61030a623c91.json`

## 📊 Monitoreo y Mantenimiento

### Ver uso de recursos

```bash
pm2 monit
```

### Ver estadísticas

```bash
pm2 status
pm2 info facturacion-app
```

### Backup de la aplicación

```bash
# Crear backup del proyecto
tar -czf backup-facturacion-$(date +%Y%m%d).tar.gz ~/facturacion-app

# Backup de variables de entorno (importante)
cp ~/facturacion-app/.env.local ~/backup-env-$(date +%Y%m%d).env
```

## 🔐 Seguridad Adicional

### 1. Configurar fail2ban (protección contra ataques)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Deshabilitar login root (si no lo has hecho)

```bash
sudo passwd -l root
```

### 3. Configurar actualizaciones automáticas de seguridad

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📝 Notas Finales

- Tu aplicación estará disponible en `http://tu-dominio.com` o `http://tu_ip_vps`
- PM2 reiniciará automáticamente la aplicación si se cae
- Los logs están disponibles con `pm2 logs facturacion-app`
- Para cambios en el código, sigue el proceso de actualización del Paso 8

## 🆘 Soporte

Si encuentras problemas:
1. Revisa los logs: `pm2 logs facturacion-app`
2. Verifica el estado: `pm2 status`
3. Verifica Nginx: `sudo systemctl status nginx`
4. Verifica conectividad: `curl http://localhost:3001`
