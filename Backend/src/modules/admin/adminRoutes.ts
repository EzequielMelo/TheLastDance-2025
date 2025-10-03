import express from "express";
import multer from "multer";
import { authenticateUser } from "../../middlewares/authMiddleware";
import { roleGuard } from "../../middlewares/roleGuard";
import { STORAGE_LIMITS } from "../../lib/storage/storageConfig";
import {
  listClients,
  approveClient,
  rejectClient,
  listTables,
  getTable,
  createTableController,
  updateTableController,
  deleteTableController,
} from "./adminController";

// Configuración de multer para manejar archivos múltiples
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: STORAGE_LIMITS.MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    // Aceptar solo imágenes permitidas
    if (STORAGE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen (JPG, PNG, WebP)"));
    }
  },
});

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|png|webp)/.test(file.mimetype || "");
    if (!ok) {
      return cb(new Error("Tipo de imagen inválido (jpg/png/webp)"));
    }
    cb(null, true);
  },
});

// Solo dueño/supervisor
router.use(authenticateUser, roleGuard(["dueno", "supervisor"]));

router.get("/clients", listClients);
router.post("/clients/:id/approve", approveClient);
router.post("/clients/:id/reject", rejectClient);

// ========== RUTAS PARA MESAS ==========

// GET /api/admin/tables - Listar todas las mesas
router.get("/tables", listTables);

// GET /api/admin/tables/:id - Obtener una mesa específica
router.get("/tables/:id", getTable);

// POST /api/admin/tables - Crear nueva mesa (requiere 2 archivos: photo y qr)
router.post(
  "/tables",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "qr", maxCount: 1 },
  ]),
  createTableController,
);

// PUT /api/admin/tables/:id - Actualizar mesa (archivos opcionales)
router.put(
  "/tables/:id",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "qr", maxCount: 1 },
  ]),
  updateTableController,
);

// DELETE /api/admin/tables/:id - Eliminar mesa
router.delete("/tables/:id", deleteTableController);

export default router;
