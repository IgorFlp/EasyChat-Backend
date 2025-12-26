import express from "express";

import {
  findContacts,
  updateContact,
} from "../controllers/contactController.js";
import { authenticateJWT } from "../middlewares/authenticateJWT.js";

export const contactRouter = express.Router();

contactRouter.post("/findContacts", authenticateJWT, findContacts);
contactRouter.put("/updateContact", authenticateJWT, updateContact);
