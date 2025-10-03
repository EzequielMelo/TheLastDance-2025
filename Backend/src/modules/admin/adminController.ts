import type { Request, Response } from "express";
import {
  getClientsByState,
  processClientApproval,
  processClientRejection,
  createStaff,
} from "./adminServices";

// GET /api/admin/clients?state=pendiente|aprobado|rechazado
export async function listClients(req: Request, res: Response) {
  try {
    const state = (req.query["state"] as string) || "pendiente";
    const clients = await getClientsByState(state);
    return res.json(clients);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// POST /api/admin/clients/:id/approve
export async function approveClient(req: Request, res: Response) {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "id requerido en params" });
      return;
    }

    await processClientApproval(id);
    res.json({ ok: true });
    return;
  } catch (e: any) {
    // Determinar el código de estado basado en el mensaje de error
    const statusCode = e.message.includes("no encontrado") ? 404 : 400;
    res.status(statusCode).json({ error: e.message });
    return;
  }
}
// POST /api/admin/clients/:id/reject
export async function rejectClient(req: Request, res: Response) {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "id requerido en params" });
      return;
    }

    const reason = (req.body?.reason as string) || "";
    await processClientRejection(id, reason);
    res.json({ ok: true });
    return;
  } catch (e: any) {
    // Determinar el código de estado basado en el mensaje de error
    const statusCode = e.message.includes("no encontrado") ? 404 : 400;
    res.status(statusCode).json({ error: e.message });
    return;
  }
}

export async function createStaffController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const result = await createStaff(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      req.body,
      req.file,
    );

    return res.json(result);
  } catch (e: any) {
    const msg = e?.message || "Error al crear staff";
    const status = /obligatorio|permiso|solo el dueÃ±o/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
}
