import { z } from "zod";
import type { Request, Response } from "express";
import { createMenuItemWithImages, listMenuItems } from "./menuServices";

const createSchema = z.object({
  category: z.enum(["plato", "bebida"]),
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(1000),
  prepMinutes: z.coerce.number().int().min(1).max(1000),
  price: z.coerce.number().positive(),
});

export async function createMenuItemHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const appUserId = req.user.appUserId;
    const position = req.user.position_code;

    const parsed = createSchema.parse(req.body);

    if (parsed.category === "plato" && position !== "cocinero")
      return res.status(403).json({ error: "Solo cocinero puede crear platos" });
    if (parsed.category === "bebida" && position !== "bartender")
      return res.status(403).json({ error: "Solo bartender puede crear bebidas" });

    const files = (req.files || []) as Express.Multer.File[];
    if (files.length !== 3)
      return res.status(400).json({ error: "Se requieren exactamente 3 imágenes" });

    const images = files.map((f) => ({
      filename: f.originalname,
      contentType: f.mimetype,
      buffer: f.buffer,
    }));

    const item = await createMenuItemWithImages({ ...parsed, images }, appUserId);
    return res.status(201).json(item);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

export async function listMenuHandler(req: Request, res: Response) {
  try {
    const raw = req.query["category"];
    const category = raw === "plato" || raw === "bebida" ? raw : undefined;

    const items = await listMenuItems(category);
    return res.json(items);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}
