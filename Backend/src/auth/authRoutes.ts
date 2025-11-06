import express from "express";
import {
  registerUser,
  loginUser,
  checkTokenValidity,
  registerAnonymousUser,
  updatePushToken,
  deleteAnonymousUser,
  refreshToken,
} from "./authController";
import {
  initSocialAuth,
  processSocialCallback,
  completeProfile,
} from "../modules/auth/socialAuthController";
import { authenticateUser } from "../middlewares/authMiddleware";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", upload.single("file"), registerUser);
router.post("/anonymous", upload.single("image"), registerAnonymousUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.post("/update-push-token", updatePushToken);
router.delete("/anonymous", deleteAnonymousUser);
router.get("/validate-token", checkTokenValidity);

// Rutas de autenticación social
router.post("/social/init", initSocialAuth);
router.post("/social/callback", processSocialCallback);
router.put("/social/complete-profile", authenticateUser, completeProfile);

export default router;
