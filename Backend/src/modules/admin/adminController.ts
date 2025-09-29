import type { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import { sendApprovedEmail, sendRejectedEmail } from "../../lib/emails";

// Obtenemos el email REAL de Supabase Auth (no lo guardamos en users)
async function getAuthEmailById(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  return data.user.email ?? null;
}

// GET /api/admin/clients?state=pendiente|aprobado|rechazado
export async function listClients(req: Request, res: Response) {
  try {
    const state = (req.query["state"] as string) || "pendiente";
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, first_name, last_name, profile_code, profile_image,state, created_at",
      )
      .eq("profile_code", "cliente_registrado")
      .eq("state", state)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

export async function approveClient(req: Request, res: Response) {
  try {
    const id = req.params["id"];
    if (!id) {
      res.status(400).json({ error: "id requerido en params" });
      return;
    }

    // Actualizar estado a 'aprobado'
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ state: "aprobado" })
      .eq("id", id)
      .eq("profile_code", "cliente_registrado")
      .select("id, first_name, last_name")
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // Obtener email desde Auth
    const email = await getAuthEmailById(id);
    if (!email) {
      res.status(404).json({ error: "Email no encontrado en Auth" });
      return;
    }

    // Enviar correo usando la nueva función
    await sendApprovedEmail(email, data.first_name);

    res.json({ ok: true });
    return;
  } catch (e: any) {
    res.status(400).json({ error: e.message });
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

    // Actualizar estado a 'rechazado'
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ state: "rechazado" })
      .eq("id", id)
      .eq("profile_code", "cliente_registrado")
      .select("id, first_name, last_name")
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // Obtener email desde Auth
    const email = await getAuthEmailById(id);
    if (!email) {
      res.status(404).json({ error: "Email no encontrado en Auth" });
      return;
    }

    // Enviar correo usando la nueva función
    await sendRejectedEmail(email, data.first_name, reason);

    res.json({ ok: true });
    return;
  } catch (e: any) {
    res.status(400).json({ error: e.message });
    return;
  }
}
