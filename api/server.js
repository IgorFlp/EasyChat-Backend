import express from "express";
import axios from "axios";
import { httpServer, io, app } from "./socket.js";
import { getConnection } from "../config/db.js";
import "../config/loadEnv.js";
import { authenticateJWT } from "../middlewares/authenticateJWT.js";
import { webhookRouter } from "../routes/webhook.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
import e from "express";
import { authRouter } from "../routes/authRoutes.js";
import { contactRouter } from "../routes/contactRoutes.js";
import { chatRouter } from "../routes/chatRoutes.js";

const require = createRequire(import.meta.url);
const cookieParser = require("cookie-parser");
const allowedDomain = process.env.CORS_ORIGIN; //.replace(/^https?:\/\//, "");

const CORS_ORIGIN = process.env.CORS_ORIGIN;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
//const app = express();

const MANAGEMENT_SCHEMA = "EasyChat";
const WPP_MY_NUMBER_ID = process.env.WPP_MY_NUMBER_ID;
//const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

const PORT = process.env.PORT || 3000;

app.use("/webhook", webhookRouter);
app.use("/auth", authRouter);
app.use("/chat", chatRouter);
app.use("/contact", contactRouter);

io.on("connection", (socket) => {
  console.log("Socket conectado (do server.js também):", socket.id);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor com WebSocket rodando na porta:", PORT);
});

// AUTENTICAÇÃO

// EASYCHAT METHODS
app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };
  response.send(status);
});

// Contatos
app.put(
  "/contact/updateContact",
  authenticateJWT,
  async (request, response) => {
    try {
      let client = await getConnection(process.env.EVOLUTION_DB_DATABASE);
      let contact = request.body;
      console.log("Contact to update: " + JSON.stringify(contact));
      const res = await client.query(
        `UPDATE public."Contact" SET "pushName"='${contact.pushName}', "updatedAt"=CURRENT_TIMESTAMP
        WHERE "remoteJid"='${contact.remoteJid}' AND "instanceId"='${contact.instanceId}'`
      );
      response.status(200).send("Contato: " + JSON.stringify(contact));
    } catch (e) {
      response
        .status(404)
        .send("Erro inesperado em update contact: " + e.message);
    }
  }
);

//Fetch messages da api
app.post("/chat/findMessages", authenticateJWT, async (request, response) => {
  try {
    let instance = request.query.instance;
    const { remoteJid } = request.body;
    const WPP_API_URL = process.env.WPP_API_URL;
    const url = `${WPP_API_URL}/chat/findMessages/${instance}`;
    const config = {
      headers: {
        apiKey: `${process.env.WPP_GLOBAL_KEY}`,
        "Content-Type": "application/json",
      },
    };
    const body = {
      where: {
        key: {
          remoteJid: `${remoteJid}`,
        },
      },
      // optional
      page: 1,
      offset: 10,
    };

    axios
      .post(url, body, config)
      .then((res) => {
        response.status(200).send(res.data);
      })
      .catch((error) => {
        console.error("Erro ao buscar chats:" + error);
        response.status(500).send("Erro ao buscar contatos");
        return;
      });
  } catch (e) {
    response.status(404).send("Erro inesperado em get contatos: " + e.message);
  }
});

//Enviar mensagem de texto via API WPP
app.post("/sendText", authenticateJWT, async (request, response) => {
  const data = request.body;
  console.log("query params: " + JSON.stringify(request.query));
  console.log("user: " + JSON.stringify(request.user));
  const requestedInstance = request.query.instance;

  if (!request.user.instances.includes(requestedInstance)) {
    return response
      .status(403)
      .json({ error: "Você não tem permissão para esta instância" });
  }
  const WPP_API_URL = process.env.WPP_API_URL;
  const url = `${WPP_API_URL}/message/sendText/${requestedInstance}`;
  console.log("instance:" + requestedInstance);
  console.log("Data: " + JSON.stringify(data));

  const config = {
    headers: {
      apiKey: `${process.env.WPP_GLOBAL_KEY}`,
      "Content-Type": "application/json",
    },
  };

  axios
    .post(url, data, config)
    .then(async (res) => {
      console.log("Resposta da API WPP: " + res.status);
      if (res.status !== 201) {
        console.error("Erro ao enviar mensagem:");
        response.status(500).send("Erro ao enviar mensagem");
        return;
      } else {
        console.log("Mensagem enviada com sucesso:", res.data);
        response.status(200).send("Mensagem enviada com sucesso");
      }
    })
    .catch((error) => {
      console.error(
        "Erro ao enviar mensagem:",
        error.res ? error.res.data : error.message
      );
      response.status(500).send("Erro ao enviar mensagem");
    });
});
