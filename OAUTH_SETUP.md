# 🔐 Configuración de OAuth con Facebook/Instagram

Este documento explica cómo configurar la autenticación con Facebook (que incluye Instagram) en tu aplicación.

## ⚠️ Arquitectura Importante

**TODO EL FLUJO OAUTH PASA POR EL BACKEND**. La app no se comunica directamente con Supabase, sino con endpoints del backend que manejan la autenticación.

---

## 📊 Flujo de Autenticación

1. Usuario toca botón de Facebook en `RegisterScreen`
2. App llama a `POST /auth/social/init` con `provider: "facebook"`
3. Backend genera URL de OAuth con Supabase y la devuelve
4. App abre WebBrowser con esa URL
5. Usuario autoriza en Facebook
6. Facebook redirige a `thelastdance://auth/callback` con tokens
7. App extrae tokens y llama a `POST /auth/social/callback`
8. Backend valida tokens, obtiene datos del usuario de Facebook
9. Backend crea/actualiza usuario en Supabase
10. Si falta DNI/CUIL → App muestra `CompleteProfileScreen`
11. Si usuario completo → App navega a Home

---

## 🔧 Configuración de Facebook

### 1️⃣ Crear una App en Facebook Developer

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Crea una nueva app o selecciona una existente
3. En el Dashboard, ve a **Settings > Basic**
4. Copia el **App ID** y **App Secret**

### 2️⃣ Configurar Facebook Login

1. En el Dashboard de tu app, agrega el producto **Facebook Login**
2. En **Facebook Login > Settings**, configura:
   - **Valid OAuth Redirect URIs**:
     ```
     https://tu-proyecto.supabase.co/auth/v1/callback
     thelastdance://auth/callback
     ```
   - **Client OAuth Login**: ✅ Activado
   - **Web OAuth Login**: ✅ Activado
   - **Enforce HTTPS**: ✅ Activado (en producción)

### 3️⃣ Configurar Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com/)
2. Navega a **Authentication > Providers**
3. Busca **Facebook** y actívalo
4. Ingresa:
   - **Facebook Client ID**: Tu App ID de Facebook
   - **Facebook Client Secret**: Tu App Secret de Facebook
5. Guarda los cambios

### 4️⃣ Configurar Variables de Entorno (Backend)

En tu archivo `Backend/.env`:

```env
# Facebook OAuth
FACEBOOK_APP_ID=tu_app_id_de_facebook
FACEBOOK_APP_SECRET=tu_app_secret_de_facebook

# Supabase (ya existentes)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key
```

### 5️⃣ Configurar URL Scheme (Frontend)

Ya configurado en `App/app.json`:

```json
{
  "expo": {
    "scheme": "thelastdance",
    "plugins": ["expo-web-browser"]
  }
}
```

---

## 📸 Instagram

**Instagram usa el mismo OAuth de Facebook**. Cuando un usuario se autentica con Facebook, la app puede acceder a su cuenta de Instagram si está vinculada. No requiere configuración adicional.

Para acceder a datos de Instagram:

1. El usuario debe tener su cuenta de Instagram conectada a Facebook
2. La app de Facebook debe solicitar permisos de Instagram
3. El usuario debe autorizar el acceso a Instagram durante el login

---

## 🔑 Permisos Requeridos

La app solicita los siguientes permisos de Facebook:

- `email` - Email del usuario
- `public_profile` - Nombre, foto de perfil

Para agregar más permisos (por ejemplo, acceso a Instagram), debes:

1. Actualizar los scopes en `socialAuthController.ts`
2. Solicitar revisión de la app en Facebook Developer Console

---

## 🌐 Endpoints del Backend

### POST /auth/social/init

Inicia el flujo OAuth y devuelve la URL de autorización.

**Request:**

```json
{
  "provider": "facebook",
  "redirectUrl": "thelastdance://auth/callback"
}
```

**Response:**

```json
{
  "success": true,
  "url": "https://www.facebook.com/v13.0/dialog/oauth?...",
  "provider": "facebook"
}
```

---

### POST /auth/social/callback

Procesa los tokens y crea/actualiza el usuario.

**Request:**

```json
{
  "access_token": "token_from_facebook",
  "refresh_token": "refresh_token_from_facebook"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
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
    "email": "user@example.com",
    "dni": "12345678",
    "cuil": "20-12345678-9"
  }
}
```

---

## 📁 Archivos Modificados

### Backend

- `src/modules/auth/socialAuthController.ts` - Controladores OAuth
- `src/modules/auth/authRoutes.ts` - Rutas OAuth

### Frontend

- `src/Hooks/auth/useSocialAuth.ts` - Hook para OAuth
- `src/screens/auth-screens/RegisterScreen.tsx` - Botón de Facebook
- `src/screens/auth-screens/CompleteProfileScreen.tsx` - Formulario de datos adicionales
- `src/navigation/RootStackParamList.ts` - Tipo para CompleteProfile
- `app.json` - Configuración del scheme

---

## 🧪 Testing

1. Asegúrate de tener las credenciales de Facebook configuradas
2. Ejecuta el backend: `npm run dev` (desde `Backend/`)
3. Ejecuta la app: `npm start` (desde `App/`)
4. Presiona el botón de Facebook en la pantalla de registro
5. Autoriza la aplicación en Facebook
6. Si es la primera vez, completa DNI/CUIL
7. Verifica que se cree el usuario en Supabase

---

## 🛠️ Solución de Problemas

### ❌ "Invalid redirect URI"

**Solución:**

- Verifica que las URLs en Facebook Developer Console coincidan exactamente
- Asegúrate de incluir `thelastdance://auth/callback` en Valid OAuth Redirect URIs
- No olvides agregar también la URL de Supabase

### ❌ "Session error"

**Solución:**

- Verifica que las credenciales de Supabase estén correctas en `.env`
- Revisa que el App Secret de Facebook sea correcto
- Asegúrate de que Supabase tenga Facebook habilitado

### ❌ "User not created"

**Solución:**

- Verifica los logs del backend (`console.log` en `socialAuthController.ts`)
- Asegúrate de que Supabase Auth esté configurado correctamente
- Revisa que la tabla `users` exista en Supabase

### ❌ "WebBrowser not opening"

**Solución:**

- Verifica que `expo-web-browser` esté instalado
- Asegúrate de que el scheme esté configurado en `app.json`
- Prueba ejecutar `npx expo install expo-web-browser`

---

## 📚 Referencias

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Supabase Auth with Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)

---

## ✅ Checklist de Implementación

- [x] Instalar dependencias (`expo-auth-session`, `expo-crypto`, `expo-web-browser`)
- [x] Crear `socialAuthController.ts` en el backend
- [x] Crear rutas OAuth en `authRoutes.ts`
- [x] Crear hook `useSocialAuth.ts` en el frontend
- [x] Crear `CompleteProfileScreen.tsx`
- [x] Agregar botón de Facebook en `RegisterScreen.tsx`
- [x] Configurar scheme en `app.json`
- [ ] Configurar Facebook Developer App
- [ ] Configurar Supabase con credenciales de Facebook
- [ ] Agregar variables de entorno en `Backend/.env`
- [ ] Probar flujo OAuth completo
- [ ] Probar flujo de completar perfil

---

🎉 **¡Listo!** Con esta configuración, los usuarios podrán registrarse usando Facebook/Instagram.
