import express from "express";

import { webhookPost } from "../controllers/webhookController.js";

export const webhookRouter = express.Router();

webhookRouter.post("/", webhookPost);
