import { Router } from 'express';
import { invoiceController } from './invoiceController';
import { authenticateUser } from '../../middlewares/authMiddleware';

const router = Router();

// Obtener factura por ID
router.get('/download/:fileName', authenticateUser, invoiceController.downloadInvoice);

// Generar factura manualmente (para testing)
router.post('/generate/:tableId', authenticateUser, invoiceController.generateInvoice);

export { router as invoiceRoutes };