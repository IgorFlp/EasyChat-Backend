import express from "express";
import { webhookGet, webhookPost } from "../controllers/webhookcontroller.js";
export const router = express.Router();

router.get("/", webhookGet);
router.post("/", webhookPost);
