# 🍽️ Sistema de Mesas y Lista de Espera - API Documentation

## 📊 **Estructura Implementada**

### **Módulo Tables**

```
Backend/src/modules/tables/
├── tables.types.ts      # Tipos TypeScript
├── tablesServices.ts    # Lógica de negocio
├── tablesController.ts  # Controladores HTTP
└── tablesRoutes.ts      # Definición de rutas
```

## 🔗 **Endpoints Disponibles**

### **📋 Lista de Espera**

#### **`GET /api/tables/waiting-list`** (Staff Only)

Obtener lista completa de espera para el maitre

- **Permisos**: Dueño, Supervisor, Maitre
- **Respuesta**:

```json
{
  "waiting_list": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "party_size": 4,
      "preferred_table_type": "vip",
      "special_requests": "Celebración de cumpleaños",
      "status": "waiting",
      "priority": 0,
      "joined_at": "2025-10-04T10:30:00Z",
      "users": {
        "first_name": "Juan",
        "last_name": "Pérez",
        "profile_image": "https://..."
      }
    }
  ],
  "total_waiting": 5,
  "average_wait_time": 25
}
```

#### **`POST /api/tables/waiting-list`** (Authenticated)

Agregar cliente a la lista de espera

- **Body**:

```json
{
  "client_id": "uuid", // Opcional, usa req.user.appUserId si no se proporciona
  "party_size": 4,
  "preferred_table_type": "vip", // "vip" | "estandar" | "accesible"
  "special_requests": "Mesa cerca de la ventana",
  "priority": 0 // Opcional, default 0
}
```

#### **`GET /api/tables/waiting-list/my-position`** (Client)

Ver mi posición en la cola

- **Respuesta**:

```json
{
  "position": 3,
  "estimatedWait": 45
}
```

#### **`GET /api/tables/waiting-list/position/:clientId`** (Staff Only)

Ver posición de cliente específico

- **Permisos**: Dueño, Supervisor, Maitre

#### **`PUT /api/tables/waiting-list/:id/cancel`** (Authenticated)

Cancelar entrada en lista de espera

- **Body**:

```json
{
  "reason": "Cliente cambió de opinión"
}
```

#### **`PUT /api/tables/waiting-list/:id/no-show`** (Staff Only)

Marcar cliente como no show

- **Permisos**: Dueño, Supervisor, Maitre

### **🪑 Gestión de Mesas**

#### **`GET /api/tables/status`** (Staff Only)

Ver estado de todas las mesas

- **Permisos**: Dueño, Supervisor, Maitre, Mozo
- **Respuesta**:

```json
{
  "tables": [
    {
      "id": "uuid",
      "number": 5,
      "capacity": 4,
      "type": "vip",
      "is_occupied": true,
      "client_id": "uuid",
      "photo_url": "https://...",
      "qr_url": "https://...",
      "client": {
        "first_name": "Ana",
        "last_name": "García",
        "profile_image": "https://..."
      }
    }
  ],
  "occupied_count": 8,
  "available_count": 4,
  "total_capacity": 48,
  "occupied_capacity": 32
}
```

#### **`POST /api/tables/assign`** (Maitre, Supervisor, Dueño)

Asignar cliente de la lista de espera a una mesa

- **Body**:

```json
{
  "waiting_list_id": "uuid",
  "table_id": "uuid"
}
```

#### **`POST /api/tables/:id/free`** (Staff)

Liberar una mesa

- **Permisos**: Dueño, Supervisor, Maitre, Mozo

## 🔐 **Sistema de Permisos**

### **Roles y Accesos:**

- **🔴 Dueño**: Acceso completo a todo
- **🟡 Supervisor**: Acceso completo a gestión de mesas
- **🟢 Maitre**: Gestión completa de lista de espera y asignaciones
- **🔵 Mozo**: Ver estado de mesas y liberarlas
- **⚪ Cliente**: Solo unirse a lista y ver su posición

## 📈 **Flujo de Trabajo**

### **1. Cliente se une a la lista:**

```bash
POST /api/tables/waiting-list
{
  "party_size": 4,
  "preferred_table_type": "vip",
  "special_requests": "Celebración"
}
```

### **2. Maitre ve la lista:**

```bash
GET /api/tables/waiting-list
# Ve lista ordenada por prioridad y tiempo de llegada
```

### **3. Maitre asigna mesa:**

```bash
POST /api/tables/assign
{
  "waiting_list_id": "uuid-cliente",
  "table_id": "uuid-mesa"
}
```

### **4. Cliente termina, mozo libera mesa:**

```bash
POST /api/tables/{table-id}/free
```

## 🎯 **Validaciones Automáticas**

- ✅ **Cliente no duplicado** en lista de espera
- ✅ **Mesa disponible** antes de asignar
- ✅ **Capacidad suficiente** (party_size <= table.capacity)
- ✅ **Estados consistentes** (waiting → seated → completed)
- ✅ **Permisos por rol** en cada endpoint
- ✅ **Rollback automático** si falla alguna operación

## 🔧 **Características Avanzadas**

### **📊 Métricas Incluidas:**

- Tiempo promedio de espera del día
- Posición estimada en cola
- Ocupación total del restaurante
- Capacidad disponible vs ocupada

### **🎨 Frontend Ready:**

- Respuestas estructuradas para UI
- Información de usuarios incluida
- Estados claros para mostrar
- Estimaciones de tiempo

## 🚀 **Siguiente Paso: Frontend**

El sistema está listo para ser consumido desde el frontend. Sugerencia de pantallas:

1. **Pantalla Cliente**: Unirse a lista + ver posición
2. **Pantalla Maitre**: Lista de espera + asignar mesas
3. **Pantalla General Staff**: Estado de mesas + liberar

¡El backend está 100% funcional y listo para usar! 🎉
