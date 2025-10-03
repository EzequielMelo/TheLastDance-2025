import express from "express";
import multer from "multer";
import { authenticateUser } from "../../middlewares/authMiddleware";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  listClients,
  approveClient,
  rejectClient,
  createStaffController,
} from "./adminController";

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

// ----- NUEVA: crear empleado/supervisor -----
router.post("/users/staff", upload.single("file"), createStaffController);
// Ruta final:  POST /api/admin/users/staff

export default router;
