import type { Request, Response } from "express";
import {
  getClientsByState,
  processClientApproval,
  processClientRejection,
  createStaff,
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
} from "./adminServices";
import type { Actor } from "../../types/admin.types";

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

    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
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

    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const reason = (req.body?.reason as string) || "";

    await processClientRejection(id, reason, req.user.appUserId);

    res.json({ ok: true });
    return;
  } catch (e: any) {
    console.error("❌ Error en rejectClient controller:", e);
    console.error("❌ Stack trace:", e.stack);

    // Determinar el código de estado basado en el mensaje de error
    const statusCode = e.message.includes("no encontrado") ? 404 : 400;

    // Enviar mensaje de error más descriptivo
    const errorMessage = e.message || "Error rechazando cliente";

    res.status(statusCode).json({
      error: errorMessage,
      details: process.env["NODE_ENV"] === "development" ? e.stack : undefined,
    });
    return;
  }
}

export async function createStaffController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const actor: Actor = {
      profile_code: req.user.profile_code as "dueno" | "supervisor",
    };

    const result = await createStaff(actor, req.body, req.file);

    return res.json(result);
  } catch (e: any) {
    console.error("❌ Error en createStaffController:", e);
    const msg = e?.message || "Error al crear staff";
    const status = /obligatorio|permiso|solo el dueño/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
}

// ========== CONTROLADORES PARA MESAS ==========

// GET /api/admin/tables - Obtener todas las mesas
export async function listTables(_req: Request, res: Response) {
  try {
    const tables = await getAllTables();
    return res.json(tables);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// GET /api/admin/tables/:id - Obtener una mesa por ID
export async function getTable(req: Request, res: Response) {
  try {
    const id = req.params["id"];
    if (!id) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    const table = await getTableById(id);
    if (!table) {
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    return res.json(table);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// POST /api/admin/tables - Crear una nueva mesa
export async function createTableController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Verificar que se enviaron ambas imágenes usando el mismo patrón que menu
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length !== 2) {
      return res.status(400).json({
        error:
          "Se requieren exactamente 2 imágenes: foto de la mesa y código QR",
      });
    }

    // Convertir archivos al formato esperado por el servicio
    const images = files.map(f => ({
      filename: f.originalname,
      contentType: f.mimetype,
      buffer: f.buffer,
      fieldname: f.fieldname,
    }));

    const result = await createTable(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      req.body,
      images,
      req.user.appUserId,
    );

    return res.status(201).json(result);
  } catch (e: any) {
    const status = e.message.includes("Permisos insuficientes")
      ? 403
      : e.message.includes("Ya existe")
        ? 409
        : 400;
    return res.status(status).json({ error: e.message });
  }
}

// PUT /api/admin/tables/:id - Actualizar una mesa
export async function updateTableController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const id = req.params["id"];
    if (!id) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    // Manejar archivos opcionales usando el mismo patrón que menu
    const files = (req.files || []) as Express.Multer.File[];
    const images =
      files.length > 0
        ? files.map(f => ({
            filename: f.originalname,
            contentType: f.mimetype,
            buffer: f.buffer,
            fieldname: f.fieldname,
          }))
        : undefined;

    const result = await updateTable(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      id,
      req.body,
      images,
    );

    return res.json(result);
  } catch (e: any) {
    const status = e.message.includes("Permisos insuficientes")
      ? 403
      : e.message.includes("no encontrada")
        ? 404
        : e.message.includes("Ya existe")
          ? 409
          : 400;
    return res.status(status).json({ error: e.message });
  }
}

// DELETE /api/admin/tables/:id - Eliminar una mesa
export async function deleteTableController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const id = req.params["id"];
    if (!id) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    await deleteTable(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      id,
    );

    return res.json({ message: "Mesa eliminada correctamente" });
  } catch (e: any) {
    const status = e.message.includes("Permisos insuficientes")
      ? 403
      : e.message.includes("no encontrada")
        ? 404
        : 400;
    return res.status(status).json({ error: e.message });
  }
}
