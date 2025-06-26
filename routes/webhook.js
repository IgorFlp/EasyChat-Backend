import express from "express";

import { webhookGet, webhookPost } from "../controllers/webhookController.js";

export const router = express.Router();

router.get("/", webhookGet);
router.post("/", webhookPost);
