import { Router } from 'express';
import multer from 'multer';
import { createMenuItemHandler, listMenuHandler } from './menuController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // para recibir imágenes del celular

// GET /menu?category=plato|bebida
router.get('/', listMenuHandler);

// POST /menu  (exactamente 3 archivos: photos)
router.post('/', upload.array('photos', 3), createMenuItemHandler);

export default router;
