# 💳 Configuración de PayPal - Guía Completa

Esta guía te ayudará a configurar PayPal en tu plataforma de monetización, tanto para pruebas (Sandbox) como para producción real.

## 📋 Requisitos Previos

- Cuenta de PayPal Business
- Acceso al [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
- Node.js y npm instalados

## 🔧 Paso 1: Obtener Credenciales de PayPal

### Para SANDBOX (Pruebas)

1. Ve a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Inicia sesión con tu cuenta de PayPal
3. En la sección **Apps & Credentials**, asegúrate de estar en la pestaña **Sandbox**
4. Busca tu aplicación o crea una nueva:
   - Haz clic en **Create App**
   - Dale un nombre (ej: "Monetización Plataforma")
   - Selecciona **Merchant** como tipo
5. Copia el **Client ID** de Sandbox
6. Haz clic en **Show** para ver el **Client Secret**

### Para PRODUCCIÓN (Dinero Real)

1. Ve a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Cambia a la pestaña **Live** (arriba a la derecha)
3. Busca tu aplicación o crea una nueva
4. Copia el **Client ID** de Producción
5. Haz clic en **Show** para ver el **Client Secret**

## 🚀 Paso 2: Configurar Variables de Entorno

### Crear archivo `.env` en la raíz del proyecto

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar el archivo .env con tus credenciales
nano .env
```

### Configuración para SANDBOX (Pruebas)

```env
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_CLIENT_SECRET
PAYPAL_MODE=sandbox
```

### Configuración para PRODUCCIÓN

```env
PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_LIVE_CLIENT_SECRET
PAYPAL_MODE=live
```

## 🧪 Paso 3: Probar en Sandbox

1. Inicia el servidor:
   ```bash
   npm install
   npm start
   ```

2. Abre http://localhost:3000 en tu navegador

3. Crea una cuenta de prueba:
   - Email: usa cualquier email (ej: test@example.com)
   - Contraseña: cualquier contraseña

4. Intenta hacer un pago con PayPal:
   - Haz clic en "Obtén VIP"
   - Completa el pago con PayPal
   - Usa una cuenta de prueba de PayPal (disponible en el Dashboard)

## ✅ Paso 4: Verificar que Funciona

Después de hacer un pago de prueba:

1. Verifica en tu Dashboard de PayPal que la transacción aparezca
2. Comprueba que el usuario tenga VIP activo en tu plataforma
3. Intenta subir un video para confirmar que el acceso VIP funciona

## 🔐 Paso 5: Pasar a Producción

Cuando estés listo para aceptar pagos reales:

1. Actualiza el archivo `.env` con tus credenciales de **Live**
2. Cambia `PAYPAL_MODE=live`
3. Redeploy tu aplicación
4. Prueba con un pago real de bajo monto para confirmar

## 📊 Monitorear Pagos

### En PayPal Dashboard:

1. Ve a **Transactions** para ver todos los pagos
2. Filtra por fecha, monto o estado
3. Descarga reportes de transacciones

### En tu Aplicación:

Los pagos se registran automáticamente en Firebase con:
- Email del usuario
- ID de la orden
- Fecha del pago
- Estado VIP

## 🐛 Solución de Problemas

### "Error: PayPal SDK no carga"
- Verifica que el `PAYPAL_CLIENT_ID` sea correcto
- Asegúrate de estar usando el ID correcto (Sandbox vs Live)
- Revisa la consola del navegador para más detalles

### "Pago completado pero VIP no se activa"
- Verifica que Firebase esté correctamente configurado
- Comprueba que el email en la base de datos coincida con el de PayPal
- Revisa los logs del servidor para errores

### "Transacción rechazada"
- En Sandbox, usa cuentas de prueba de PayPal
- En Live, asegúrate de que tu cuenta de PayPal esté verificada
- Verifica que el monto sea correcto

## 📞 Soporte

- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal Community Forum](https://www.paypal-community.com/)
- [Firebase Documentation](https://firebase.google.com/docs)

## 🎯 Próximos Pasos

1. Configura webhooks de PayPal para notificaciones en tiempo real
2. Implementa renovación automática de suscripciones
3. Agrega soporte para múltiples monedas
4. Implementa reembolsos automáticos

---

**Nota Importante**: Nunca compartas tu `PAYPAL_CLIENT_SECRET` en código público o repositorios de GitHub. Siempre usa variables de entorno.
