import express from "express";
import { registerUser, loginUser, checkTokenValidity, registerAnonymousUser, updatePushToken, deleteAnonymousUser } from "./authController";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", upload.single("file"), registerUser);
router.post("/anonymous", upload.single("image"), registerAnonymousUser);
router.post("/login", loginUser);
router.post("/update-push-token", updatePushToken);
router.delete("/anonymous", deleteAnonymousUser);
router.get("/validate-token", checkTokenValidity);

export default router;
