import express from "express";

import { webhookPost } from "../controllers/webhookController.js";

export const router = express.Router();

router.post("/", webhookPost);
