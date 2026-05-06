# 🎬 Sistema de Canales y Ganancias - Guía Completa

Esta plataforma ahora funciona como un sistema de canales similar a OnlyFans o Patreon, donde cada usuario puede crear su propio canal y ganar dinero a través de suscriptores.

## 🏗️ Arquitectura del Sistema

### Estructura de Datos

#### Colecciones en Firebase

1. **users**
   - `uid`: ID único del usuario
   - `email`: Email del usuario
   - `vip`: Boolean (acceso VIP general)
   - `balance`: Dinero acumulado del usuario
   - `role`: "creator", "subscriber", "owner"

2. **media**
   - `id`: ID único del contenido
   - `uploadedBy`: UID del creador
   - `title`: Título del contenido
   - `description`: Descripción
   - `url`: URL en Cloudflare R2
   - `isPublic`: Boolean (visible para todos o solo suscriptores)
   - `views`: Número de vistas
   - `commentsCount`: Número de comentarios
   - `uploadedAt`: Fecha de subida

3. **subscriptions** (NUEVO)
   - `subscriberId`: UID del suscriptor
   - `creatorId`: UID del creador
   - `orderId`: ID de la orden de PayPal
   - `subscribedAt`: Fecha de suscripción
   - `expiresAt`: Fecha de expiración (30 días)
   - `active`: Boolean

4. **transactions** (NUEVO)
   - `subscriberId`: UID del suscriptor
   - `creatorId`: UID del creador
   - `amount`: Monto total ($9.99)
   - `ownerEarnings`: Comisión del dueño
   - `creatorEarnings`: Ganancias del creador
   - `orderId`: ID de la orden
   - `status`: "completed", "pending", "failed"
   - `createdAt`: Fecha de la transacción

## 💰 Sistema de Comisiones

### Reparto de Ingresos

Por cada suscripción de **$9.99**:

- **Dueño de la Plataforma**: 20% = **$1.99**
- **Creador**: 80% = **$7.99**

### Configuración

Puedes cambiar el porcentaje en el archivo `.env`:

```env
# Comisión del dueño (en porcentaje)
OWNER_COMMISSION=20
```

El sistema calcula automáticamente:
- `CREATOR_PERCENTAGE = 100 - OWNER_COMMISSION`

## 🎯 Flujo de Uso

### Para Creadores

1. **Registrarse**: Crear cuenta con email y contraseña
2. **Activar VIP**: Pagar $9.99 para acceder a la plataforma
3. **Subir Contenido**: 
   - Subir videos/fotos
   - Marcar como "Público" o "Privado"
   - Contenido público: visible para todos
   - Contenido privado: solo para suscriptores
4. **Ver Ganancias**: Dashboard muestra:
   - Balance total
   - Número de suscriptores
   - Ganancias totales

### Para Suscriptores

1. **Registrarse**: Crear cuenta
2. **Navegar Canales**: Ver lista de creadores
3. **Suscribirse**: Pagar $9.99 para suscribirse a un canal
4. **Ver Contenido**: Acceder a todo el contenido exclusivo del creador
5. **Interactuar**: Comentar en videos

### Para el Dueño

1. **Monitorear**: Ver estadísticas globales
2. **Recibir Comisiones**: Automáticamente en cada suscripción
3. **Gestionar**: Panel de administración

## 📱 Páginas Principales

### 1. **home_v2.html** - Galería Pública
- Muestra contenido público de todos los creadores
- Visitantes pueden ver y comentar sin registrarse
- Botón para suscribirse a VIP

### 2. **dashboard_v2.html** - Dashboard del Creador
- Ver contenido personal
- Subir nuevos videos
- Ver ganancias y suscriptores
- Eliminar contenido

### 3. **channels.html** - Lista de Canales
- Ver todos los creadores disponibles
- Estadísticas de cada canal
- Botón para suscribirse

### 4. **channel.html** - Página de Canal Individual
- Ver contenido de un creador específico
- Contenido público: visible para todos
- Contenido privado: bloqueado para no suscriptores
- Estadísticas del canal

## 🔌 Endpoints de API

### Canales

#### GET `/api/channel/:creatorId`
Obtiene contenido de un canal específico

**Parámetros**:
- `creatorId`: ID del creador
- `userId` (query): ID del usuario que ve (para validar acceso)

**Respuesta**:
```json
{
  "ok": true,
  "media": [
    {
      "id": "media_id",
      "title": "Título",
      "description": "Descripción",
      "url": "https://...",
      "locked": false,
      "views": 10,
      "comments": 2
    }
  ]
}
```

### Suscripciones

#### POST `/api/subscribe-channel`
Crear una suscripción a un canal

**Body**:
```json
{
  "subscriberId": "user_id",
  "creatorId": "creator_id",
  "orderId": "paypal_order_id"
}
```

**Respuesta**:
```json
{
  "ok": true,
  "message": "Suscripción creada",
  "subscriptionId": "sub_id"
}
```

### Estadísticas

#### GET `/api/user-stats/:userId`
Obtener estadísticas de un usuario

**Respuesta**:
```json
{
  "ok": true,
  "stats": {
    "balance": 79.90,
    "subscribers": 10,
    "totalEarnings": 79.90,
    "totalViews": 500,
    "contentCount": 5
  }
}
```

#### GET `/api/owner-stats`
Obtener estadísticas del dueño

**Respuesta**:
```json
{
  "ok": true,
  "stats": {
    "balance": 19.90,
    "totalRevenue": 19.90,
    "totalUsers": 50,
    "activeSubscriptions": 10,
    "commissionPercentage": 20
  }
}
```

## 🔐 Seguridad y Validación

### Acceso a Contenido Privado

1. El sistema verifica si el usuario es:
   - El propietario del contenido
   - Un suscriptor activo del canal
   
2. Si no cumple ninguna condición:
   - El contenido se muestra como "bloqueado"
   - Se muestra un mensaje: "Contenido exclusivo para suscriptores"

### Validación de Suscripción

```javascript
// En el backend
if (mediaData.isPublic) {
  // Mostrar a todos
} else {
  if (userId === creatorId) {
    // Es el propietario
  } else {
    // Verificar si es suscriptor activo
    // Si no, mostrar como bloqueado
  }
}
```

## 💳 Integración con PayPal

### Flujo de Suscripción

1. Usuario hace clic en "Suscribirse"
2. Se abre el modal de PayPal
3. Usuario completa el pago
4. PayPal retorna `orderId`
5. Se llama a `/api/subscribe-channel` con el `orderId`
6. Sistema crea la suscripción y registra la transacción
7. Se distribuyen las comisiones automáticamente

### Configuración

Para usar PayPal, necesitas:

1. **Client ID**: Para el SDK de PayPal
2. **Client Secret**: Para verificación en el backend (opcional en esta versión)

Ver `PAYPAL_SETUP.md` para instrucciones detalladas.

## 📊 Dashboard de Ganancias

El dashboard muestra en tiempo real:

- **Balance Total**: Dinero acumulado del creador
- **Suscriptores**: Número de usuarios suscritos
- **Ganancias Totales**: Suma de todas las transacciones
- **Vistas Totales**: Total de visualizaciones de contenido
- **Contenido**: Número de videos/fotos subidos

## 🚀 Próximas Mejoras Sugeridas

1. **Renovación Automática**: Renovar suscripciones automáticamente
2. **Retiros de Dinero**: Sistema para que creadores retiren sus ganancias
3. **Análisis Detallado**: Gráficos de ingresos y crecimiento
4. **Promociones**: Descuentos y ofertas especiales
5. **Notificaciones**: Avisos de nuevas suscripciones
6. **Recomendaciones**: Sugerir canales basados en intereses
7. **Búsqueda**: Buscar creadores por nombre o categoría
8. **Categorías**: Organizar contenido por tipo

## 🐛 Solución de Problemas

### "Contenido bloqueado pero estoy suscrito"
- Verifica que la suscripción esté activa
- Comprueba que no haya expirado (30 días)
- Intenta recargar la página

### "No veo mis ganancias"
- Las ganancias se actualizan en tiempo real
- Verifica que tengas suscriptores activos
- Comprueba que las transacciones hayan sido completadas

### "Suscripción no se crea"
- Verifica que PayPal haya completado el pago
- Comprueba que el `orderId` sea válido
- Revisa los logs del servidor

## 📞 Soporte

Para más información:
- [Firebase Documentation](https://firebase.google.com/docs)
- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [Express.js Documentation](https://expressjs.com/)

---

**Versión**: 3.0 (Sistema de Canales)
**Última actualización**: 2024
**Estado**: Producción
