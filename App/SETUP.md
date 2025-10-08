# 🚀 Setup para Desarrolladores

## Configuración rápida:

1. **Copia el archivo de API:**

   ```bash
   cp src/api/config.example.ts src/api/config.ts
   ```

2. **Encuentra tu IP local:**

   ```bash
   ipconfig
   ```

3. **Edita `src/api/config.ts` y cambia la IP por la tuya**

4. **Ejecuta el backend:**

   ```bash
   cd Backend && npm run dev
   ```

5. **Ejecuta la app:**
   ```bash
   cd App && npm start
   ```

## ⚠️ NO toques:

- `app.json`
- `eas.json`
- `restaurant-push-notifications-*.json`
