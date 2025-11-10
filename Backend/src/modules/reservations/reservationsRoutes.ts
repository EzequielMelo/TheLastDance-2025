import { Router } from 'express';
import { ReservationsController } from './reservationsController';
import { authenticateUser } from '../../middlewares/authMiddleware';
import { roleGuard } from '../../middlewares/roleGuard';

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateUser);

// Rutas específicas primero (para evitar conflictos con :id)
router.get('/tables', ReservationsController.getTablesByType);
router.get('/table-availability', ReservationsController.checkTableAvailability);
router.get('/availability', ReservationsController.checkAvailability);
router.get('/my-reservations', ReservationsController.getUserReservations);
router.get('/all', roleGuard(['dueno', 'supervisor']), ReservationsController.getAllReservations);
router.get('/check-table-reserved', roleGuard(['dueno', 'supervisor', 'maitre']), ReservationsController.checkTableReserved);

// Rutas para clientes
router.post('/', ReservationsController.createReservation);
router.put('/:id/cancel', ReservationsController.cancelReservation);
router.get('/:id', ReservationsController.getReservationDetails);

// Rutas para admin (dueño/supervisor)
router.put('/:id/status', roleGuard(['dueno', 'supervisor']), ReservationsController.updateReservationStatus);

export default router;