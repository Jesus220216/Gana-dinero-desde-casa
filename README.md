# 💸 Gana Dinero Desde Tu Celular - Plataforma de Monetización

Una plataforma web completa para monetizar contenido de video con suscripción VIP integrada con PayPal.

## 🚀 Características

- ✅ **Autenticación de Usuarios**: Registro e inicio de sesión seguro con Firebase
- ✅ **Sistema VIP**: Suscripción mensual con pagos PayPal integrados
- ✅ **Dashboard de Contenido**: Visualización de galería de medios
- ✅ **Subida de Videos**: Solo usuarios VIP pueden subir contenido
- ✅ **Panel de Administración**: Gestión de usuarios y estadísticas
- ✅ **Monetización Completa**: Anuncios integrados y flujo de ingresos
- ✅ **Responsive Design**: Funciona perfectamente en móviles y desktop

## 📋 Requisitos Previos

- Node.js v14+ instalado
- npm o yarn
- Cuenta de Firebase (ya configurada)
- Cuenta de PayPal Business (para producción)

## 🔧 Instalación

### 1. Descargar e Instalar Dependencias

```bash
# Descomprimir el archivo
unzip gana-dinero-desde-tu-celular-main.zip
cd gana-dinero-desde-tu-celular-main

# Instalar dependencias
npm install
```

### 2. Configurar Firebase

El archivo `serviceAccountKey.json` ya está incluido. Asegúrate de que esté en la raíz del proyecto.

### 3. Configurar PayPal

Actualiza el Client ID de PayPal en `dashboard.html`:

```javascript
// Línea 8 en dashboard.html
<script src="https://www.paypal.com/sdk/js?client-id=TU_CLIENT_ID&currency=USD"></script>
```

Obtén tu Client ID en: https://developer.paypal.com/

### 4. Ejecutar el Servidor

```bash
npm start
# o
node server.js
```

El servidor estará disponible en: `http://localhost:3000`

## 📱 Acceso a las Páginas

- **Inicio**: http://localhost:3000/index.html
- **Dashboard**: http://localhost:3000/dashboard.html
- **Panel Admin**: http://localhost:3000/admin.html

## 💰 Flujo de Monetización

### 1. **Usuarios Normales**
- Ven la galería de contenido
- No pueden subir videos
- Ven el botón "Obtén Acceso VIP"
- Pueden pagar $9.99 USD/mes

### 2. **Usuarios VIP**
- Acceso completo a todo el contenido
- Pueden subir videos ilimitados
- Sus videos aparecen en la galería
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

## 📊 Endpoints de API

### POST `/verify-paypal`
Verifica y activa VIP después de pago
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

## 🐛 Solución de Problemas

### Error: "serviceAccountKey.json no encontrado"
- Verifica que el archivo esté en la raíz del proyecto
- Comprueba que el nombre sea exacto

### PayPal no funciona
- Verifica el Client ID
- Asegúrate de estar en modo sandbox o producción correcto
- Revisa la consola del navegador para errores

### Firebase no conecta
- Verifica las credenciales en serviceAccountKey.json
- Asegúrate de tener acceso a la base de datos

## 🚀 Despliegue en Producción

### Opción 1: Render.com
```bash
# Crear archivo Procfile
echo "web: node server.js" > Procfile

# Conectar repositorio a Render
# Seleccionar Node.js como runtime
```

### Opción 2: Heroku
```bash
heroku create tu-app-nombre
git push heroku main
```

### Opción 3: DigitalOcean
- Crear droplet Ubuntu
- Instalar Node.js
- Clonar repositorio
- Configurar PM2 para mantener el proceso activo

## 📝 Licencia

Este proyecto es de uso privado. No distribuir sin permiso.

## 📞 Soporte

Para problemas o preguntas, revisa la documentación de:
- Firebase: https://firebase.google.com/docs
- PayPal: https://developer.paypal.com/docs
- Express: https://expressjs.com/

## 🎉 ¡Listo para Monetizar!

Tu plataforma está lista para recibir tráfico y generar ingresos. Asegúrate de:

1. ✅ Configurar PayPal correctamente
2. ✅ Optimizar para SEO
3. ✅ Crear contenido de calidad
4. ✅ Promocionar en redes sociales
5. ✅ Monitorear estadísticas

¡Buena suerte! 🚀💰
