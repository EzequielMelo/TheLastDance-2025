# 🔐 Configuración de OAuth con Google

Este documento explica cómo configurar la autenticación con Google en tu aplicación para el proyecto de facultad.

## ⚠️ Arquitectura Importante

**TODO EL FLUJO OAUTH PASA POR EL BACKEND**. La app no se comunica directamente con Supabase, sino con endpoints del backend que manejan la autenticación.

---

## 📊 Flujo de Autenticación

1. Usuario toca botón de Google en `RegisterScreen`
2. App llama a `POST /auth/social/init` con `provider: "google"`
3. Backend genera URL de OAuth con Supabase y la devuelve
4. App abre WebBrowser con esa URL
5. Usuario autoriza en Google
6. Google redirige a `thelastdance://auth/callback` con tokens
7. App extrae tokens y llama a `POST /auth/social/callback`
8. Backend valida tokens, obtiene datos del usuario de Google
9. Backend crea/actualiza usuario en Supabase
10. Si falta DNI/CUIL → App muestra `CompleteProfileScreen`
11. Si usuario completo → App navega a Home

---

## 🔧 Configuración de Google Cloud Console

### 1️⃣ Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto:
   - Clic en el selector de proyectos (arriba)
   - Clic en "Nuevo proyecto"
   - Nombre: "TheLastDance" o similar
   - Clic en "Crear"

### 2️⃣ Habilitar Google+ API

1. En el menú lateral, ve a **APIs y servicios** > **Biblioteca**
2. Busca "Google+ API"
3. Clic en "Google+ API"
4. Clic en **"Habilitar"**

### 3️⃣ Crear Credenciales OAuth 2.0

1. Ve a **APIs y servicios** > **Credenciales**
2. Clic en **"Crear credenciales"** > **"ID de cliente de OAuth 2.0"**
3. Si es tu primera vez, deberás configurar la **pantalla de consentimiento OAuth**:

   **Configuración de Pantalla de Consentimiento:**

   ```
   Tipo de usuario: Externo
   Nombre de la aplicación: The Last Dance Restaurant
   Correo de asistencia: tu-email@gmail.com
   Dominios autorizados: (dejar vacío por ahora)
   Información de contacto del desarrollador: tu-email@gmail.com

   Alcances: No agregar ninguno adicional
   Usuarios de prueba: Agrega tu email y el de tus compañeros
   ```

   Clic en **"Guardar y continuar"** hasta finalizar

4. Vuelve a **Credenciales** > **"Crear credenciales"** > **"ID de cliente de OAuth 2.0"**
5. Tipo de aplicación: **"Aplicación web"**
6. Nombre: "TheLastDance Web Client"
7. En **"URIs de redireccionamiento autorizados"**, agrega:

   ```
   https://tu-proyecto.supabase.co/auth/v1/callback
   ```

   (Reemplaza `tu-proyecto` con tu ID real de Supabase)

8. Clic en **"Crear"**
9. ✅ **Copia el "ID de cliente" y el "Secreto del cliente"**

---

## 🗄️ Configuración en Supabase

### 1️⃣ Habilitar Google Provider

1. Ve a [Supabase Dashboard](https://app.supabase.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** > **Providers**
4. Busca **Google** y actívalo
5. Pega las credenciales:
   - **Google Client ID**: (el que copiaste de Google Cloud)
   - **Google Client Secret**: (el secreto que copiaste)
6. **Copia la "Callback URL"** que te muestra Supabase
7. Clic en **"Save"**

### 2️⃣ Agregar Callback URL en Google Cloud

1. Vuelve a Google Cloud Console
2. Ve a **Credenciales**
3. Clic en tu cliente OAuth que creaste
4. En **"URIs de redireccionamiento autorizados"**, agrega la URL que copiaste de Supabase
5. Clic en **"Guardar"**

---

## 💻 Configuración del Backend

### Variables de Entorno

En tu archivo `Backend/.env`, agrega:

```env
# Google OAuth
GOOGLE_CLIENT_ID=tu_client_id_aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui

# Supabase (ya existentes)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key

# Base URL
BASE_URL=http://localhost:3000
```

### Reiniciar Backend

```bash
cd Backend
npm run dev
```

---

## 📱 Configuración del Frontend

Ya está configurado en `App/app.json`:

```json
{
  "expo": {
    "scheme": "thelastdance",
    "plugins": ["expo-web-browser"]
  }
}
```

---

## 🌐 Endpoints del Backend

### POST /auth/social/init

Inicia el flujo OAuth y devuelve la URL de autorización.

**Request:**

```json
{
  "provider": "google",
  "redirectUrl": "thelastdance://auth/callback"
}
```

**Response:**

```json
{
  "success": true,
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "provider": "google"
}
```

---

### POST /auth/social/callback

Procesa los tokens y crea/actualiza el usuario.

**Request:**

```json
{
  "access_token": "token_from_google",
  "refresh_token": "refresh_token_from_google"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "fullName": "John Doe",
    "needsAdditionalInfo": false
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

---

### PUT /auth/social/complete-profile

Completa el perfil del usuario con DNI/CUIL.

**Request:**

```json
{
  "dni": "12345678",
  "cuil": "20-12345678-9",
  "phone": "+541112345678"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "dni": "12345678",
    "cuil": "20-12345678-9"
  }
}
```

---

## 📁 Archivos Modificados

### Backend

- `src/modules/auth/socialAuthController.ts` - Controladores OAuth (Google)
- `src/auth/authRoutes.ts` - Rutas OAuth

### Frontend

- `src/Hooks/auth/useSocialAuth.ts` - Hook para OAuth con Google
- `src/screens/auth-screens/RegisterScreen.tsx` - Botón de Google
- `src/screens/auth-screens/CompleteProfileScreen.tsx` - Formulario de datos adicionales
- `src/navigation/RootStackParamList.ts` - Tipo para CompleteProfile
- `app.json` - Configuración del scheme

---

## 🧪 Testing

### Modo Development (100 usuarios)

Google permite hasta **100 usuarios sin verificación**. Perfecto para tu proyecto de facultad.

### Pasos para probar:

1. ✅ Asegúrate de tener las credenciales configuradas
2. ✅ Ejecuta el backend: `npm run dev` (desde `Backend/`)
3. ✅ Ejecuta la app: `npm start` (desde `App/`)
4. ✅ Presiona el botón de Google en la pantalla de registro
5. ✅ Autoriza la aplicación en Google
6. ✅ Si es la primera vez, completa DNI/CUIL
7. ✅ Verifica que se cree el usuario en Supabase

### Agregar Usuarios de Prueba

Si tu app está en modo "Testing":

1. Ve a Google Cloud Console
2. **APIs y servicios** > **Pantalla de consentimiento de OAuth**
3. Sección **"Usuarios de prueba"**
4. Clic en **"Agregar usuarios"**
5. Agrega los emails de tus compañeros/profesores
6. Ellos podrán usar Google OAuth sin problemas

---

## 🛠️ Solución de Problemas

### ❌ "Error 400: redirect_uri_mismatch"

**Solución:**

- Verifica que las URLs en Google Cloud Console coincidan EXACTAMENTE
- Debe incluir `https://tu-proyecto.supabase.co/auth/v1/callback`
- Sin espacios, sin `/` al final
- Espera 5 minutos para que los cambios se propaguen

### ❌ "Access blocked: This app's request is invalid"

**Solución:**

- Completa la configuración de la pantalla de consentimiento
- Agrega correo de asistencia
- Agrega información de contacto del desarrollador
- Guarda cambios

### ❌ "Session error"

**Solución:**

- Verifica que las credenciales en `Backend/.env` sean correctas
- Asegúrate de que el Client Secret esté correcto (sin espacios)
- Reinicia el backend después de cambiar `.env`

### ❌ "User not created"

**Solución:**

- Verifica los logs del backend (`console.log` en `socialAuthController.ts`)
- Asegúrate de que Supabase Auth tenga Google habilitado
- Revisa que la tabla `users` exista en Supabase

### ❌ "WebBrowser not opening"

**Solución:**

- Verifica que `expo-web-browser` esté instalado
- Ejecuta: `cd App && npx expo install expo-web-browser`
- Asegúrate de que el scheme esté en `app.json`

---

## 🎓 Ventajas para Proyecto de Facultad

### ✅ **Sin Verificación de Negocio**

- No necesitas documentos legales
- No necesitas empresa registrada
- Funciona inmediatamente

### ✅ **100 Usuarios Gratis**

- Suficiente para demostración
- Profesores y compañeros pueden probar
- Sin límites durante desarrollo

### ✅ **Configuración Rápida**

- Setup completo en 30 minutos
- Sin aprobaciones de terceros
- Sin tiempos de espera

### ✅ **Profesional y Confiable**

- Todo el mundo tiene cuenta de Google
- Interfaz familiar para usuarios
- Seguridad de Google

---

## 📚 Referencias

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)

---

## ✅ Checklist de Implementación

- [x] Instalar dependencias (`expo-auth-session`, `expo-crypto`, `expo-web-browser`)
- [x] Crear `socialAuthController.ts` en el backend
- [x] Crear rutas OAuth en `authRoutes.ts`
- [x] Crear hook `useSocialAuth.ts` en el frontend
- [x] Crear `CompleteProfileScreen.tsx`
- [x] Agregar botón de Google en `RegisterScreen.tsx`
- [x] Configurar scheme en `app.json`
- [ ] Crear proyecto en Google Cloud Console
- [ ] Habilitar Google+ API
- [ ] Crear credenciales OAuth 2.0
- [ ] Configurar pantalla de consentimiento
- [ ] Agregar usuarios de prueba
- [ ] Configurar Google en Supabase
- [ ] Agregar variables de entorno en `Backend/.env`
- [ ] Probar flujo OAuth completo
- [ ] Probar flujo de completar perfil

---

## 🎯 Próximos Pasos

1. **Crear proyecto en Google Cloud Console** (10 min)
2. **Obtener Client ID y Client Secret** (5 min)
3. **Configurar en Supabase** (5 min)
4. **Agregar credenciales a `.env`** (2 min)
5. **¡Probar!** (5 min)

---

🎉 **¡Listo para tu proyecto de facultad!** Con esta configuración tendrás un sistema de autenticación profesional y funcional sin complicaciones legales.
