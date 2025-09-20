import { RequestHandler } from "express";
import * as authService from "./authServices";

export const registerUser: RequestHandler = async (req, res) => {
  try {
    console.log("=== REQUEST DEBUG ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body keys:", Object.keys(req.body));
    console.log("File received:", !!req.file);

    if (req.file) {
      console.log("File info:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } else {
      console.log("NO FILE - Body contains:", req.body);
      // Si el archivo viene en body en lugar de req.file, es que no es FormData real
    }
    console.log("====================");

    const result = await authService.registerUser(req.body, req.file);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const loginUser: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.status(200).json({ message: "Login exitoso", ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    res.status(400).json({ error: message });
  }
};

export const checkTokenValidity: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }
    const user = await authService.verifyToken(token);

    res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err: unknown) {
    let errorMessage = "Token inválido.";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    res.status(401).json({
      valid: false,
      error: errorMessage,
    });
  }
};
