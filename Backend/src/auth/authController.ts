import { RequestHandler } from "express";
import * as authService from "./authServices";

export const registerUser: RequestHandler = async (req, res) => {
  try {
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
    res.status(400).json({ error: (error as Error).message });
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
