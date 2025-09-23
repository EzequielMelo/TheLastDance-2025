import express from "express";
import multer from "multer";
import { createMenuItemHandler, listMenuHandler } from "./menuController";
import { authenticateUser } from "../../middlewares/authMiddleware";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Crear ítem (3 imágenes, rol requerido)
router.post(
  "/items",
  authenticateUser,
  upload.array("images", 3),
  createMenuItemHandler
);

// Listar ítems
router.get("/items", listMenuHandler);

export default router;