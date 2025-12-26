import express from "express";

import {
  register,
  login,
  logout,
  me,
  user_databases,
} from "../controllers/authController.js";
import { authenticateJWT } from "../middlewares/authenticateJWT.js";

export const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", authenticateJWT, logout);
authRouter.get("/me", authenticateJWT, me);
authRouter.get("/user_databases", authenticateJWT, user_databases);
