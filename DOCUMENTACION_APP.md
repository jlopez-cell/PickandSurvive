# Documentación funcional — Pick & Survive

## 1. Qué es la app
**Pick & Survive** es un juego de predicciones con “supervivencia” (modo torneo) o **puntuación** (modo liga). Los usuarios crean **campeonatos**, que contienen **ediciones** (temporadas/jornadas) y, dentro de una edición, cada usuario participa como **participante**.

En cada **jornada (matchday)** el usuario debe elegir un equipo para su **pick**. Según el resultado y el modo del campeonato, los participantes pueden:
- **Sobrevivir** (seguir participando).
- **Eliminarse** (modo torneo).
- **Acumular puntos** (modo liga).

Además, el sistema envía **notificaciones** (email y web-push si está configurado) y muestra **clasificación** e **historial**.

## 2. Roles y permisos
- **Usuario autenticado**: puede ver su dashboard, unirse a campeonatos y hacer picks.
- **Admin de campeonato**: crea ediciones, publica/activa ediciones, gestiona invitaciones y aprueba/rechaza solicitudes de unión.
- **SUPERADMIN**: gestiona sincronizaciones del sistema (ligas/teams/fixtures) mediante endpoints de `admin`.

## 3. Modelo conceptual (datos principales)
- **FootballLeague**: liga externa (provider) con `apiFootballId`, `currentSeason` y metadatos.
- **FootballTeam**: equipos de una liga (relacionados con `leagueId` y `apiFootballId`).
- **Championship**:
  - `mode`: `TOURNAMENT` o `LEAGUE`
  - `pickResetAtMidseason`: permite reutilizar equipos en la “segunda vuelta”
  - pertenece a una `footballLeague`
  - tiene un `adminId`
- **Edition**:
  - `status`: `DRAFT`, `OPEN`, `ACTIVE`, `FINISHED`, `CANCELLED`
  - `startMatchday` / `endMatchday`
  - `potAmountCents` y contabilidad del bote (pot ledger)
- **Participant**: unión de un usuario a una edición.
  - `status`: `ACTIVE` o `ELIMINATED`
  - en torneo se guarda `eliminatedAtMatchday`
  - en liga se acumulan `totalPoints`
- **JoinRequest**: solicitud de unión al campeonato (estado `PENDING/APPROVED/REJECTED`).
- **Matchday** y **Match**:
  - provienen de la sincronización de fixtures/resultados desde APIs externas.
- **Pick**:
  - el equipo elegido para una `matchdayId`
  - `status`: `PENDING`, `SURVIVED`, `DRAW_ELIMINATED`, `LOSS_ELIMINATED`, `NO_PICK_ELIMINATED`, `POSTPONED_PENDING`
  - en modo liga guarda `pointsAwarded`
- **TeamUsage**:
  - controla el uso de equipos por “mitad” (`PickHalf.FIRST/SECOND`) para evitar repeticiones.

## 4. Backend: endpoints principales (API)
> Nota: todas las rutas protegidas usan `JwtAuthGuard` salvo endpoints públicos de `auth`.

### Auth
- `POST /auth/register`: registro.
- `GET /auth/verify?token=...`: verificación email.
- `POST /auth/login`: login.
- `POST /auth/resend-verification`: reenvío de email de verificación.
- `GET /auth/me`: info del usuario autenticado.

### Ligas externas (para crear campeonatos)
- `GET /leagues`: lista de ligas (`footballLeague`) disponibles.

### Campeonatos / ediciones / invitaciones
- `POST /championships`: crear campeonato.
- `GET /championships`: obtener campeonatos del usuario.
- `GET /championships/:id`: detalle del campeonato (incluye ediciones ordenadas por `createdAt desc`).
- `POST /championships/:id/editions`: crear edición (admin de campeonato).
- `PATCH /championships/:id/editions/:editionId/publish`: publicar edición (admin).
- `PATCH /championships/:id/editions/:editionId/activate`: activar edición cuando corresponda (admin).

Invitaciones y unión:
- `POST /championships/:id/invite-link`: genera link de invitación (admin).
- `POST /championships/:id/invite-email`: envía invitaciones por email (admin).
- `POST /championships/join/:token`: unirse mediante token (crea solicitud).
- `GET /championships/:id/join-requests?status=...`: ver solicitudes (admin).
- `POST /championships/:id/join-requests/:requestId/approve`: aprobar solicitud (admin).
- `POST /championships/:id/join-requests/:requestId/reject`: rechazar solicitud (admin).
- `DELETE /championships/:id/leave`: abandonar campeonato (usuario).
- `DELETE /championships/:id`: eliminar campeonato (admin; superadmin no aplica aquí).

### Picks y datos de edición
Las rutas van bajo: `editions/:editionId/...`.
- `POST /editions/:editionId/picks`: crear o modificar pick.
  - body: `{ teamId, matchdayNumber }`
- `GET /editions/:editionId/picks?matchday=...`: picks del usuario para esa jornada (devuelve `myPick` si existe).
- `GET /editions/:editionId/picks/history`: historial de picks del usuario (agrupable por jornada).
- `GET /editions/:editionId/teams?matchday=...`: equipos disponibles para pick en esa jornada.
- `GET /editions/:editionId/matches?matchday=...`: partidos para esa jornada (incluye flags `homeUsed/awayUsed` para el usuario).
- `GET /editions/:editionId/meta`: metadatos de la edición (startMatchday, endMatchday, status, season…).
- `GET /editions/:editionId/deadline`: deadline de pick (fecha del primer kickoff).

### Clasificación
- `GET /editions/:editionId/standings`: clasificación para un usuario participante (o admin del campeonato).

### Notificaciones
- `GET /notifications?page&limit`: lista.
- `PATCH /notifications/:id/read`: marca como leída.
- `DELETE /notifications/:id`: elimina notificación.
- `GET /notifications/prefs`: preferencias.
- `PUT /notifications/prefs`: actualizar preferencias.

### Admin (SUPERADMIN)
- `GET /admin/leagues`
- `POST /admin/leagues`
- `PUT /admin/leagues/:id`
- `GET /admin/leagues/:id/teams`
- `POST /admin/leagues/:id/sync`: sincroniza equipos.
- `POST /admin/sync-fixtures`: sincroniza fixtures.
- `GET /admin/system/status`: estado del sistema.

## 5. Funcionamiento del juego (reglas)
### 5.1 Estados de una edición
1. **DRAFT**: borrador. Aún no se juega.
2. **OPEN**: edición publicada, esperando condiciones para activarse.
3. **ACTIVE**: la edición está disponible.
4. **FINISHED**: terminó y se resolvió.
5. **CANCELLED**: se canceló (por ejemplo por falta de participantes).

### 5.2 Activación automática de ediciones (scheduler)
Cada hora, el backend revisa ediciones en `OPEN`:
- Si ya ha llegado su `startMatchday` (primer kickoff <= ahora) y hay al menos **2 participantes APPROVED**, pasa a **ACTIVE** y rechaza requests PENDING.
- Si no llega el quorum, se marca **CANCELLED**.

### 5.3 Elegir pick (modo torneo y modo liga)
Cuando un usuario hace `POST /editions/:editionId/picks`:
- Debe ser participante de la edición.
- La edición debe estar en `ACTIVE`, `OPEN` o `FINISHED` (según código; la UI solo lo usa cuando corresponde).
- No puede estar eliminado.
- Debe haber disponibilidad de jornada: `matchday.status` debe ser `SCHEDULED` o `ONGOING`.
- Existe **deadline duro**: si el primer kickoff de la jornada ya ha pasado, no se permite modificar.
- El equipo debe:
  - pertenecer a la liga de la edición
  - jugar esa jornada (home/away)
- Regla de reutilización:
  - se calcula si el matchday cae en `FIRST` o `SECOND` (según `pickResetAtMidseason`)
  - se usa `TeamUsage` para impedir usar un equipo ya usado en esa mitad (a menos que sea el mismo equipo del pick existente).

### 5.4 Procesado de resultados y resolución de picks
- Cuando un partido termina (`MatchStatus.FINISHED`), el backend procesa todos los picks `PENDING` de esa jornada y determina:
  - **TOURNAMENT**:
    - si el equipo elegido ganó -> `SURVIVED`
    - si empató -> `DRAW_ELIMINATED`
    - si perdió -> `LOSS_ELIMINATED`
    - además, si el pick elimina, el `Participant` pasa a `ELIMINATED`.
  - **LEAGUE**:
    - gana -> `+3`
    - empata -> `+1`
    - pierde -> `+0`

- También se dispara una comprobación para ver si la edición debe terminar (ver 5.5).

### 5.5 Deadline si no hay pick (sin pick)
Cada minuto el backend busca matchdays con `firstKickoff <= now` que siguen en `SCHEDULED`.
Para cada participante activo sin picks:
- **TOURNAMENT**: crea un pick marcador `NO_PICK_ELIMINATED` y elimina al participante.
- **LEAGUE**: aplica penalización de `-1` punto.
Luego comprueba si la edición debe terminar.

### 5.6 Fin de edición (EditionResolutionService)
Después de cada ciclo de procesado:
- **TOURNAMENT**: cuando quedan **≤ 1 participante activo**:
  - pasa a `FINISHED`
  - se resuelve ganador(es)
  - se distribuye el pot (si aplica)
  - se envía notificación `EDITION_FINISHED` a todos los participantes
- **LEAGUE**: cuando la última jornada (`endMatchday`) está `FINISHED`:
  - se resuelve por `totalPoints`
  - hay empate si comparten top score
  - distribución de pot + notificación

## 6. Notificaciones del sistema
La app guarda notificaciones en BD y puede enviar:
- Email con **Resend**
- Web-push con **web-push** (si el usuario tiene `pushEnabled` y `pushSubscriptionJson` válido)

### Recordatorios de pick
Cada 5 minutos, el scheduler:
- busca matchdays a ~2 horas vista
- para cada edición activa y participante activo que aún no tenga pick en esa matchday:
  - envía notificación `PICK_REMINDER` con enlace al “hacer mi pick”.

### Notificaciones al terminar edición
En `EditionResolutionService` se crea notificación `EDITION_FINISHED` para todos los participantes.

## 7. Frontend: pantallas y flujos (web app)

### 7.1 Login / Registro / Verificación
- Página de `login`, `register`, `verify-email`.
- Tras login se muestra el `dashboard`.

### 7.2 Dashboard principal (`/dashboard`)
Se muestra el estado global del usuario:
- Próxima deadline
- Calendario / matchdays
- Resumen de campeonatos (y tu pick si existe)
- Barra de navegación inferior móvil (`MobileBottomNav`)

Tabs móviles:
- Inicio
- Mis ligas
- Notificaciones
- Perfil

### 7.3 Crear campeonato (`/championship/new`)
Formulario:
- nombre
- `footballLeagueId` desde `/api/leagues`
- modo: torneo vs liga
- opción `pickResetAtMidseason`

Al crear: se navega a `/championship/:id`.

### 7.4 Detalle de campeonato (`/championship/:id`)
Vista:
- título + liga + modo
- lista de ediciones con sus estados

Para admin del campeonato:
- “Invitaciones”
- “Nueva edición”
- “Ajustes”
- botón de eliminación del campeonato

Botones para usuario:
- “Elegir pick” si hay edición disponible
- “Clasificación” si hay edición para mostrarla

### 7.5 Invitaciones (`/championship/:id/invite`)
Admin puede:
- generar/copiar link
- enviar invitaciones por email
- ver solicitudes `PENDING`
- aprobar o rechazar solicitudes

### 7.6 Unirse por token (`/join/:token`)
Si el usuario no está logueado, le pide login o registro.
Si ya está logueado:
- envía `POST /api/championships/join/:token`
- muestra confirmación (la decisión del admin puede tardar)

### 7.7 Edición / Elegir pick (`/edition/:id`)
Interfaz:
- muestra jornada actual `J{n}`
- controles para cambiar de jornada
- lista de partidos de esa jornada
- botón “Elegir” en casa y fuera dependiendo de `homeUsed/awayUsed` y reglas del usuario
- historial de tu pick actual si existe
- botón a:
  - `/edition/:id/standings` (clasificación)
  - `/edition/:id/history` (historial)

Validaciones de UI alineadas con el backend:
- si estás eliminado -> no permites picks
- si ya pasó deadline -> no permites modificar
- si el equipo está “usado” en la mitad -> el botón queda deshabilitado

### 7.8 Clasificación (`/edition/:id/standings`)
Muestra ranking:
- en **torneo**: `ACTIVE` primero, eliminados por `eliminatedAtMatchday` y métricas de racha
- en **liga**: orden por `totalPoints`

Además, el “pick actual” se revela solo cuando corresponde:
- en función de `deadlineMatchday.firstKickoff`
- antes del kickoff el sistema puede ocultar “pick actual” salvo para el propio usuario

### 7.9 Historial de picks (`/edition/:id/history`)
Muestra tus picks por jornada con:
- equipo
- estado (sobrevive/eliminado/pending/no pick…)
- points cuando aplica.

### 7.10 Perfil y Notificaciones
Perfil (`/profile`):
- alias, email y rol
- cerrar sesión

Notificaciones (`/dashboard` tab Notificaciones):
- lista
- marcar como leída
- eliminar
- preferencias (email/push) en `/notifications/prefs` si está implementado en UI.

## 8. Jobs/cron del backend (resumen)
- **Cada hora**: `EditionsScheduler`
  - activa `OPEN` si su startMatchday ya comenzó y hay >=2 aprobados
  - cancela si no hay quorum
- **Cada minuto**: `PicksScheduler`
  - procesa jornadas ya arrancadas sin picks del usuario y ajusta estados/puntos
  - marca matchday como `ONGOING`
- **Todos los días (3:00)**: `FootballDataScheduler.dailyFixtureSync`
  - sincroniza fixtures futuros (ventana ~30 días)
- **Intervalo configurable**: `FootballDataScheduler` para resultados terminados
  - envía procesamiento de partidos finalizados hacia la BD
- **Cada 5 minutos**: `NotificationsScheduler`
  - envía recordatorios de pick 2h antes del primer kickoff

## 9. Notas operativas
- El frontend lee datos desde la BD y no consulta APIs externas de resultados directamente.
- La sincronización depende de tokens y configuración de proveedor en el servidor.

---
Si quieres, puedo convertir este documento en una versión “para QA” con lista de casos de prueba por pantalla (login, crear campeonato, unirse, crear edición, pick, deadline sin pick, clasificación, etc.).

