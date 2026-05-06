[README_ACTUALIZADO.md](https://github.com/user-attachments/files/27451778/README_ACTUALIZADO.md)

# 💸 Plataforma de Monetización - Versión Actualizada v2.1

Una plataforma web completa para monetizar contenido de video con suscripción VIP integrada con PayPal, gestión personal de contenido y eliminación de archivos.

## 🚀 Nuevas Características (v2.1)

### ✨ Gestión Personal de Contenido
- **Mi Contenido**: Cada usuario VIP ve únicamente los videos y fotos que ha subido
- **Filtrado por Usuario**: El backend filtra automáticamente el contenido por usuario autenticado
- **Interfaz Mejorada**: Overlay con opciones de ver detalles y eliminar contenido

### 🗑️ Eliminación de Contenido
- **Botón de Eliminar**: Cada usuario puede eliminar sus propios archivos
- **Eliminación Segura**: Verifica que el usuario sea el propietario antes de eliminar
- **Limpieza Automática**: Elimina archivos tanto de Cloudflare R2 como de Firebase
- **Confirmación de Seguridad**: Pide confirmación antes de eliminar

### 💳 PayPal Configurado para Producción
- **Soporte Sandbox y Live**: Configurable mediante variables de entorno
- **Documentación Completa**: Archivo `PAYPAL_SETUP.md` con guía paso a paso
- **Endpoints Mejorados**: Nuevo endpoint `/api/verify-paypal-production` para verificación real
- **Seguridad**: Validación de propietario de contenido

## 📋 Características Originales

- ✅ **Autenticación de Usuarios**: Registro e inicio de sesión seguro con Firebase
- ✅ **Sistema VIP**: Suscripción mensual con pagos PayPal integrados
- ✅ **Dashboard de Contenido**: Visualización de galería de medios personal
- ✅ **Subida de Videos**: Solo usuarios VIP pueden subir contenido
- ✅ **Panel de Administración**: Gestión de usuarios y estadísticas
- ✅ **Monetización Completa**: Anuncios integrados y flujo de ingresos
- ✅ **Responsive Design**: Funciona perfectamente en móviles y desktop
- ✅ **Contenido Público/Privado**: Los usuarios eligen la visibilidad de su contenido
- ✅ **Contador de Visitas**: Cada contenido registra número de visualizaciones
- ✅ **Sistema de Comentarios**: Visitantes pueden comentar en contenido público

## 📋 Requisitos Previos

- Node.js v14+ instalado
- npm o yarn
- Cuenta de Firebase (ya configurada)
- Cuenta de PayPal Business (para producción)
- Cloudflare R2 (para almacenamiento de archivos)

## 🔧 Instalación

### 1. Descargar e Instalar Dependencias

```bash
# Descomprimir el archivo
unzip monetizacion_actualizada_v2.zip
cd monetizacion_actualizada_v2

# Instalar dependencias
npm install
```

### 2. Configurar Firebase

El archivo `serviceAccountKey.json` debe estar en la raíz del proyecto.

```bash
# Si tienes el archivo JSON, cópialo a la raíz
cp /ruta/a/serviceAccountKey.json ./
```

O configura la variable de entorno:

```bash
# En el archivo .env
FIREBASE_CONFIG_JSON={"type":"service_account",...}
```

### 3. Configurar Cloudflare R2

Actualiza el archivo `.env` con tus credenciales de R2:

```env
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-public-url.r2.dev
```

### 4. Configurar PayPal

**IMPORTANTE**: Lee el archivo `PAYPAL_SETUP.md` para instrucciones detalladas.

Para **SANDBOX** (pruebas):

```env
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_MODE=sandbox
```

Para **PRODUCCIÓN** (dinero real):

```env
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_client_secret
PAYPAL_MODE=live
```

Obtén tus credenciales en: https://developer.paypal.com/dashboard/

### 5. Crear archivo .env

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar con tus credenciales
nano .env
```

### 6. Ejecutar el Servidor

```bash
npm start
# o
node server.js
```

El servidor estará disponible en: `http://localhost:3000`

## 📱 Acceso a las Páginas

- **Inicio (Pública)**: http://localhost:3000/
- **Dashboard (VIP)**: http://localhost:3000/dashboard.html
- **Panel Admin**: http://localhost:3000/admin.html

## 💰 Flujo de Monetización

### 1. **Usuarios Normales**
- Ven la galería pública de contenido
- No pueden subir videos
- Ven el botón "Obtén Acceso VIP"
- Pueden pagar $9.99 USD/mes

### 2. **Usuarios VIP**
- Acceso completo a todo el contenido
- Pueden subir videos ilimitados
- Ven únicamente sus propios videos en el dashboard
- Pueden eliminar sus videos en cualquier momento
- Sus videos aparecen en la galería pública (si los marcan como públicos)
- Reciben ingresos por visualizaciones

### 3. **Administrador**
- Panel de control completo
- Ver estadísticas de usuarios
- Monitorear conversiones VIP
- Gestionar contenido

## 🔐 Seguridad

- Autenticación Firebase con contraseñas hasheadas
- Tokens de sesión seguros
- Validación de VIP en tiempo real
- Verificación de pagos PayPal
- **Validación de Propietario**: Solo el usuario que subió un archivo puede eliminarlo
- Eliminación segura de archivos en R2 y Firebase

## 📊 Endpoints de API

### GET `/api/media-user?userId=USER_ID`
Obtiene solo el contenido subido por un usuario específico
```json
{
  "ok": true,
  "media": [
    {
      "id": "media_id",
      "url": "https://...",
      "title": "Mi Video",
      "description": "Descripción",
      "uploadedBy": "user_id",
      "views": 10,
      "comments": 2,
      "isPublic": true
    }
  ]
}
```

### DELETE `/api/media/:mediaId`
Elimina un archivo (solo el propietario puede hacerlo)
```json
{
  "userId": "user_id"
}
```
Respuesta:
```json
{
  "ok": true,
  "message": "Contenido eliminado correctamente"
}
```

### POST `/api/verify-paypal-production`
Verifica y activa VIP después de pago
```json
{
  "orderId": "ORDER_ID",
  "email": "usuario@email.com"
}
```

### POST `/verify-paypal`
Endpoint legacy para verificación de PayPal
```json
{
  "email": "usuario@email.com",
  "orderId": "ORDER_ID"
}
```

### POST `/check-vip`
Verifica si un usuario tiene VIP activo
```json
{
  "email": "usuario@email.com"
}
```

### GET `/api/media-public`
Obtiene solo contenido público (sin autenticación)

### POST `/api/increment-views`
Incrementa contador de visitas
```json
{
  "mediaId": "media_id"
}
```

### POST `/api/add-comment`
Añade comentario a contenido
```json
{
  "mediaId": "media_id",
  "userId": "user_id",
  "userName": "Nombre",
  "text": "Comentario"
}
```

### GET `/api/comments/:mediaId`
Obtiene comentarios de un contenido

### GET `/admin-users`
Lista todos los usuarios (requiere autenticación)

### GET `/media-stats`
Obtiene estadísticas de la plataforma

### GET `/health`
Verifica estado del servidor

## 🎯 Estrategia de Tráfico

### 1. **Optimización SEO**
- Títulos y descripciones atractivas
- Palabras clave relevantes
- Meta tags optimizados

### 2. **Marketing**
- Botones CTA flotantes
- Contador de usuarios activos
- Badges de "HOT" y "NUEVO"
- Animaciones llamativas

### 3. **Conversión**
- Página de aterrizaje optimizada
- Flujo de pago simplificado
- Prueba gratuita de 7 días (opcional)
- Testimonios de usuarios

### 4. **Retención**
- Contenido exclusivo VIP
- Actualizaciones regulares
- Notificaciones de nuevos videos
- Programa de referidos

## 💡 Tips para Generar Ingresos

1. **Crear Contenido de Calidad**: Videos atractivos y útiles
2. **SEO Optimizado**: Palabras clave en títulos y descripciones
3. **Publicidad**: Integra anuncios en la página de inicio
4. **Afiliados**: Promociona productos relacionados
5. **Email Marketing**: Construye lista de suscriptores
6. **Redes Sociales**: Promociona en TikTok, Instagram, YouTube

## 📈 Métricas Clave

- **Tasa de Conversión**: % de usuarios que se hacen VIP
- **Retención**: % de usuarios que renuevan VIP
- **LTV**: Valor de vida útil del cliente
- **CAC**: Costo de adquisición de cliente
- **Vistas por Video**: Promedio de visualizaciones
- **Comentarios por Video**: Engagement del contenido

## 🐛 Solución de Problemas

### Error: "serviceAccountKey.json no encontrado"
- Verifica que el archivo esté en la raíz del proyecto
- Comprueba que el nombre sea exacto
- O configura `FIREBASE_CONFIG_JSON` en `.env`

### PayPal no funciona
- Verifica el Client ID y Client Secret
- Asegúrate de estar en modo sandbox o live correcto
- Revisa la consola del navegador para errores
- Lee `PAYPAL_SETUP.md` para instrucciones detalladas

### Firebase no conecta
- Verifica las credenciales en serviceAccountKey.json
- Asegúrate de tener acceso a la base de datos
- Comprueba que `FIREBASE_CONFIG_JSON` sea válido

### No puedo eliminar un video
- Verifica que estés logueado como el propietario
- Comprueba que el video exista en la base de datos
- Revisa los logs del servidor para errores

### Cloudflare R2 no funciona
- Verifica todas las variables de R2 en `.env`
- Asegúrate de que el bucket exista
- Comprueba que las credenciales sean correctas

## 🚀 Despliegue en Producción

### Opción 1: Render.com

```bash
# Crear archivo Procfile (ya incluido)
# Conectar repositorio a Render
# Seleccionar Node.js como runtime
# Agregar variables de entorno en Render Dashboard
```

### Opción 2: Heroku

```bash
heroku create tu-app-nombre
git push heroku main
# Agregar variables de entorno:
heroku config:set PAYPAL_CLIENT_ID=xxx
heroku config:set FIREBASE_CONFIG_JSON=xxx
```

### Opción 3: DigitalOcean

- Crear droplet Ubuntu
- Instalar Node.js
- Clonar repositorio
- Configurar PM2 para mantener el proceso activo
- Configurar Nginx como reverse proxy

## 📝 Archivos Importantes

- `server.js` - Backend con Express
- `dashboard_v2.html` - Dashboard VIP con gestión personal
- `home_v2.html` - Galería pública
- `admin.html` - Panel de administración
- `PAYPAL_SETUP.md` - Guía de configuración de PayPal
- `.env.example` - Plantilla de variables de entorno

## 📞 Soporte

Para problemas o preguntas, revisa la documentación de:
- Firebase: https://firebase.google.com/docs
- PayPal: https://developer.paypal.com/docs
- Express: https://expressjs.com/
- Cloudflare R2: https://developers.cloudflare.com/r2/

## 🎉 ¡Listo para Monetizar!

Tu plataforma está lista para recibir tráfico y generar ingresos. Asegúrate de:

1. ✅ Configurar PayPal correctamente (lee `PAYPAL_SETUP.md`)
2. ✅ Configurar Firebase y Cloudflare R2
3. ✅ Optimizar para SEO
4. ✅ Crear contenido de calidad
5. ✅ Promocionar en redes sociales
6. ✅ Monitorear estadísticas

## 📄 Licencia

Este proyecto es de uso privado. No distribuir sin permiso.

---

**Versión**: 2.1
**Última actualización**: 2024
**Estado**: Producción
