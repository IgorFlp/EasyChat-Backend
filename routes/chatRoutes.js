import express from "express";

import { findChats } from "../controllers/chatController.js";
import { authenticateJWT } from "../middlewares/authenticateJWT.js";

export const chatRouter = express.Router();

chatRouter.post("/findChats", authenticateJWT, findChats);
