# 🗑️ URL de Eliminación de Datos para Facebook

## 📍 URL del Callback

Cuando Facebook te pida la **"URL de devolución de llamada para la eliminación de datos"**, usa esta URL:

### Para Desarrollo (localhost):

```
http://localhost:3000/auth/data-deletion/callback
```

### Para Producción (cuando tengas dominio):

```
https://tu-dominio.com/auth/data-deletion/callback
```

---

## 🔧 Cómo Configurarlo en Facebook

1. Ve a tu app en **Facebook Developers**
2. Ve a **Configuración de la app** > **Básica**
3. Busca la sección **"URL de devolución de llamada para la eliminación de datos"**
4. Pega la URL: `http://localhost:3000/auth/data-deletion/callback`
5. **Guarda cambios**

---

## ✅ ¿Qué hace este endpoint?

Cuando un usuario solicita eliminar sus datos de Facebook:

1. Facebook envía una solicitud POST a esta URL
2. El backend verifica la firma de Facebook
3. Busca al usuario por su Facebook ID
4. Elimina:
   - Su cuenta de Supabase Auth
   - Sus datos de la tabla `users`
   - Toda su información personal
5. Responde a Facebook con:
   - URL de estado de eliminación
   - Código de confirmación

---

## 📊 URL de Estado

Los usuarios pueden verificar el estado de su solicitud en:

```
http://localhost:3000/auth/data-deletion/status?id=CODIGO_CONFIRMACION
```

Esta URL muestra una página HTML con:

- ✅ Confirmación de eliminación
- 📋 Lista de datos eliminados
- ℹ️ Información sobre el proceso
- 📧 Contacto de soporte

---

## 🧪 Probar el Endpoint

**No puedes probarlo manualmente** porque Facebook envía un `signed_request` cifrado.

Solo se activará cuando:

1. Un usuario vaya a **Configuración de Facebook** > **Apps y sitios web**
2. Encuentre tu app "The Last Dance Restaurant"
3. Haga clic en **"Eliminar"**
4. Facebook enviará la solicitud automáticamente

---

## 📝 Variables de Entorno Necesarias

Asegúrate de tener en tu `Backend/.env`:

```env
FACEBOOK_APP_SECRET=tu_app_secret_aqui
BASE_URL=http://localhost:3000
```

El `FACEBOOK_APP_SECRET` es necesario para verificar la firma de Facebook.

---

## ⚠️ Importante

- Esta URL es **requerida por Facebook** para cumplir con GDPR
- La eliminación es **permanente e irreversible**
- Los datos se eliminan **inmediatamente** cuando Facebook envía la solicitud
- El usuario verá un código de confirmación en la página de estado

---

## 🚀 Siguientes Pasos

1. ✅ Copia la URL del callback
2. ✅ Pégala en Facebook Developer Console
3. ✅ Guarda cambios en Facebook
4. ✅ Continúa con la configuración de Facebook Login
5. ✅ Prueba el login con Facebook en tu app

---

## 📞 Logs del Backend

Cuando Facebook envíe una solicitud, verás estos logs:

```
📩 Solicitud de eliminación de datos recibida de Facebook
🔍 Procesando eliminación para Facebook ID: 1234567890
✅ Usuario encontrado: usuario@email.com
🗑️  Usuario eliminado de Auth: uuid-del-usuario
🗑️  Datos del usuario eliminados de tabla users
✅ Solicitud de eliminación completada
```

---

🎉 **¡Listo!** Ahora puedes pegar esta URL en Facebook y continuar con la configuración.
