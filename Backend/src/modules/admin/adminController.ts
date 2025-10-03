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
    console.log("📥 Petición createStaff recibida:", {
      hasUser: !!req.user,
      userProfile: req.user?.profile_code,
      bodyKeys: Object.keys(req.body || {}),
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      contentType: req.headers['content-type']
    });

    if (!req.user) {
      console.log("❌ No hay usuario autenticado");
      return res.status(401).json({ error: "No autenticado" });
    }

    const actor: Actor = {
      profile_code: req.user.profile_code as "dueno" | "supervisor",
    };

    console.log("🚀 Llamando a createStaff service...");
    const result = await createStaff(actor, req.body, req.file);
    console.log("✅ Staff creado, enviando respuesta:", result.message);

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

    // Verificar que se enviaron ambas imágenes
    if (!req.files || !Array.isArray(req.files) || req.files.length !== 2) {
      return res.status(400).json({
        error:
          "Se requieren exactamente 2 archivos: foto de la mesa y código QR",
      });
    }

    const files = req.files as Express.Multer.File[];

    // Identificar qué archivo es qué (por el nombre del campo o por orden)
    const photoFile = files.find(f => f.fieldname === "photo") || files[0];
    const qrFile = files.find(f => f.fieldname === "qr") || files[1];

    if (!photoFile || !qrFile) {
      return res.status(400).json({
        error: "Se requieren ambos archivos: 'photo' y 'qr'",
      });
    }

    const result = await createTable(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      req.body,
      photoFile,
      qrFile,
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

    let photoFile: Express.Multer.File | undefined;
    let qrFile: Express.Multer.File | undefined;

    // Manejar archivos opcionales
    if (req.files && Array.isArray(req.files)) {
      photoFile = req.files.find(f => f.fieldname === "photo");
      qrFile = req.files.find(f => f.fieldname === "qr");
    }

    const result = await updateTable(
      { profile_code: req.user.profile_code as "dueno" | "supervisor" },
      id,
      req.body,
      photoFile,
      qrFile,
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
