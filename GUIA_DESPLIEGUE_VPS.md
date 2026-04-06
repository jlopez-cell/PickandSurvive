# Guía de despliegue en VPS — Pick and Survive (pickandsurvive.com)

Este proyecto es un **monorepo** (`pickandsurvive`): API NestJS en `apps/api` (puerto **3001**) y frontend Next.js en `apps/web` (puerto **3000**). El dominio de producción es **pickandsurvive.com** (y opcionalmente `www`).

Una plantilla antigua mencionaba otra aplicación; **ignora cualquier referencia a “facturacion-app”** si la encuentras en copias viejas: aquí solo aplica **pickandsurvive**.

---

## Requisitos

- VPS Ubuntu/Debian (recomendado Ubuntu 22.04 LTS)
- Node.js **20+**, **pnpm**, **PM2**, **Nginx** (opcional pero recomendable frente al dominio)
- PostgreSQL accesible desde la API (misma máquina o gestionado)

---

## Estructura en el servidor

En el bootstrap interno se usa el directorio **`/opt/pickandsurvive`**. Ahí debe vivir el monorepo completo (raíz con `pnpm-workspace.yaml`, carpetas `apps/api`, `apps/web`, etc.).

Script de referencia para una instalación inicial en el propio servidor: **`scripts/vps-bootstrap.sh`** (revisa y adapta `DATABASE_URL`, `APP_URL`, credenciales).

Para **actualizar código** desde tu máquina con SSH ya configurado:

```bash
./scripts/deploy-vps.sh usuario@tu_servidor
```

Por defecto sincroniza hacia **`DEPLOY_REMOTE_PATH=/opt/pickandsurvive`**. No versiones `apps/api/.env` ni `apps/web/.env.production`: deben existir solo en el VPS.

---

## Variables de entorno (resumen)

**`apps/api/.env`** (ejemplos; nombres reales según tu `.env`):

- `DATABASE_URL` — PostgreSQL
- `PORT` — suele ser `3001`
- `APP_URL` — origen del frontend para CORS, p. ej. `https://pickandsurvive.com`
- JWT, correo, `FOOTBALL_DATA_ORG_TOKEN`, etc., según tu configuración

**`apps/web/.env.production`** (en el servidor):

- `NEXT_PUBLIC_API_URL` — URL que el navegador usará para hablar con la API (p. ej. `https://pickandsurvive.com` si enrutas la API detrás del mismo dominio, o la URL pública explícita de la API)
- **Opcional (recomendado si aún entras por IP):** Si alguien abre la web con `http://TU_IP`, Chrome mostrará “No es seguro” y el host será la IP. Añade:
  - `NEXT_PUBLIC_LEGACY_HOST=76.13.48.187` (solo el host, sin `http`)
  - `NEXT_PUBLIC_CANONICAL_ORIGIN=https://pickandsurvive.com`  
  El middleware redirige esas peticiones al dominio con HTTPS (debes tener certificado SSL en ese dominio).

Ajusta según cómo montes Nginx (un solo `server` al front o rutas `/api` al backend).

---

## PM2 (procesos esperados)

Tras `pnpm --filter @pickandsurvive/api run build` y `pnpm --filter @pickandsurvive/web run build`, lo habitual es:

- **`pick-api`**: `node apps/api/dist/main.js` (desde `cwd` adecuado; ver `scripts/vps-bootstrap.sh`)
- **`pick-web`**: `pnpm --filter @pickandsurvive/web start` (Next en puerto **3000**)

Comandos útiles:

```bash
pm2 status
pm2 logs pick-api
pm2 logs pick-web
pm2 restart pick-api pick-web
```

---

## Nginx + dominio pickandsurvive.com

Ejemplo mínimo: proxy al frontend Next (puerto 3000). Si tu Next reenvía las rutas `/api/*` al backend, con esto suele bastar.

```nginx
server {
    listen 80;
    server_name pickandsurvive.com www.pickandsurvive.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 10M;
}
```

SSL con Let’s Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pickandsurvive.com -d www.pickandsurvive.com
```

Después del certificado, mantén **`APP_URL=https://pickandsurvive.com`** en la API y revisa `NEXT_PUBLIC_API_URL` en la web.

---

## Actualizaciones

1. Sincronizar código (`./scripts/deploy-vps.sh` o `git pull` en el servidor).
2. En el servidor: `pnpm install`, `pnpm --filter @pickandsurvive/api exec prisma migrate deploy` si hay migraciones, builds de API y web, luego `pm2 restart pick-api pick-web`.

---

## Verificación rápida

```bash
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/leagues
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/
```

Desde fuera: `https://pickandsurvive.com` y rutas de la app.

---

## Nota sobre documentos antiguos

Cualquier guía que hable de **facturacion-app**, Google Sheets o un solo `npm start` en una carpeta distinta **no corresponde** a Pick and Survive. Usa esta guía, **`scripts/deploy-vps.sh`** y **`scripts/vps-bootstrap.sh`**.
