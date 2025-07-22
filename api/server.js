import express from "express";
import axios from "axios";
import { httpServer, io, app } from "./socket.js";
import { getConnection } from "./connect.js";
import "./loadEnv.js";
import { router } from "../routes/webhook.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cookieParser = require("cookie-parser");
const allowedDomain = process.env.CORS_ORIGIN //.replace(/^https?:\/\//, "");
const AUTH_SECRET = process.env.AUTH_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
//const app = express();


const SCHEMA = "EasyChat";
const WPP_MY_NUMBER_ID = process.env.WPP_MY_NUMBER_ID;
//const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors(
  {
  origin: process.env.CORS_ORIGIN,
  credentials: true
}
));

const PORT = process.env.PORT || 3000;
async function InsertMessage(formatedMessage) {
  let client = await getConnection();
  const res = await client`INSERT INTO ${client(SCHEMA)}.mensagens
    (id, recipient, sender, "mode", "type", text, arquivo_url, "timestamp", metadados, "source")
    VALUES(${formatedMessage.id}, ${formatedMessage.recipient}, ${
    formatedMessage.sender
  }, ${formatedMessage.mode}, ${formatedMessage.type}, ${
    formatedMessage.text
  }, ${formatedMessage.arquivo_url}, ${formatedMessage.timestamp}, ${
    formatedMessage.metadados
  }, ${formatedMessage.source});`;

  if (!res) {
    return "Mensagem não encontrada";
  } else {
    return 200;
  }
}
app.use("/webhook", router);
/*
app.listen(PORT, "0.0.0.0", async () => {
  console.log("Server Listening on PORT:", PORT);
  console.log("WhatsApp Number ID:", WPP_MY_NUMBER_ID);
});*/
io.on("connection", (socket) => {
  console.log("Socket conectado (do server.js também):", socket.id);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor com WebSocket rodando na porta:", PORT);
});
// AUTH METHODS
function authenticateJWT(req, res, next) {  
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];  
  if (!token) return res.sendStatus(401);
  jwt.verify(token, AUTH_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.get("/me", authenticateJWT, (req, res) => {
  res.json({ userName: req.user.userName });
});
app.post("/register", async (req, res) => {
  console.log("Req: "+JSON.stringify(req.body))
  const { user, password } = req.body;  
  const client = await getConnection();

  const find = await client`SELECT * FROM ${client(SCHEMA)}.users WHERE userName = ${user}`
  console.log(find)
  if (find.length > 0) {
    res
      .status(409)
      .json({ message: "Nome de usuario existente, favor escolher outro." });
  } else {
    const newUser = {
      id: 0,
      username: user,
      password: password,      
    };
    
    const response = await client`INSERT INTO ${client(
    SCHEMA
  )}.users (username,password) VALUES (${newUser.username}, ${newUser.password}) RETURNING id;`
    console.log("response: " + response[0].id);
    //const userId = response.insertedId;

    if (response[0].id) {
      res.status(200).json({ message: "Usuario criado" });
    } else {
      res.status(401).send("Invalid credentials");
    }
  }
});
app.post("/login", async (req, res) => {
  const { user, password } = req.body;
  //console.log("User: " + user);  
  let client = await getConnection();  
  let response = await client`SELECT * FROM ${client(
    SCHEMA
  )}.users WHERE userName = ${user} AND password = ${password};`;
  if (response.length === 0) {
    response
      .status(404)
      .send("Usuario ou senha incorreto..");
    return;
  }

  if (response) {
    const userId = response.id;
    const userName = response.userName;
    const token = jwt.sign({ userId: userId, userName: userName }, AUTH_SECRET, {
      expiresIn: "2h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 2 * 60 * 60 * 1000,
      path: "/",
      ...(process.env.NODE_ENV === "production" && { domain: COOKIE_DOMAIN })
    });

    res.json({ userName: userName });
  } else {
    res.status(401).send("Invalid credentials");
  }
});
app.post("/logout", (req, res) => {
  
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    ...(isProduction && { domain: COOKIE_DOMAIN })
  });
  

  res.status(200).json({ message: "Logout realizado com sucesso" });
});

// EASYCHAT METHODS
app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };
  response.send(status);
});

app.get("/messagesDB", async (request, response) => {
  let client = await getConnection();
  const messages = await client`SELECT * FROM ${client(SCHEMA)}.mensagens;`;
  response.send(messages);
});
app.get("/contacts", async (request, response) => {
  let client = await getConnection();
  const contacts = await client`SELECT * FROM ${client(SCHEMA)}.contatos;`;
  if (contacts.length === 0) {
    response.status(204).send("Nenhum contato encontrado.");
    return;
  }
  response.status(200).send(contacts);
});

app.get("/messagesDB/:contact", async (request, response) => {
  const { contact } = request.params;
  let client = await getConnection();
  //msgRecieved "recipient_id": "5518998200826"
  //msgSent "to": "5518998200826"
  let messages = await client`SELECT * FROM ${client(
    SCHEMA
  )}.mensagens WHERE recipient = ${contact} OR sender = ${contact};`;
  if (messages.length === 0) {
    response
      .status(404)
      .send("Nenhuma mensagem encontrada para este número ou perfil.");
    return;
  }
  response.send(messages);
});

app.post("/LogIncomingMessage", async (request, response) => {
  const message = request.body;

  let formatedMessage = {};
  if (message.entry[0]) {
    formatedMessage = {
      id: message.entry[0].changes[0].value.messages[0].id,
      recipient: process.env.WPP_MY_NUMBER,
      sender: message.entry[0].changes[0].value.messages[0].from,
      mode: "received",
      type: message.entry[0].changes[0].value.messages[0].type,
      text: message.entry[0].changes[0].value.messages[0].text.body,
      arquivo_url: "",
      timestamp: message.entry[0].changes[0].value.messages[0].timestamp,
      metadados: JSON.stringify(message.entry[0].changes[0].value.metadata),
      source: message.entry[0].changes[0].value.messaging_product,
    };
  }

  console.log("Formated Message:", formatedMessage);
  let res = await InsertMessage(formatedMessage);
  io.emit("new_message", formatedMessage);
  if (!res) {
    response.status(404).send("Mensagem não encontrada");
  } else {
    response.status(200).send("Mensagem recebida e registrada com sucesso");
  }
});

app.post("/message", async (request, response) => {
  const url = `https://graph.facebook.com/${process.env.WPP_VERSION}/${process.env.WPP_MY_NUMBER_ID}/messages`;

  const data = request.body;
  console.log(data);

  const config = {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  axios
    .post(url, data, config)
    .then(async (res) => {
      let mode = "sent";
      let formatedMessage = {};
      try {
        formatedMessage = {
          id: res.data.messages[0].id,
          recipient: data.to,
          sender: process.env.WPP_MY_NUMBER,
          mode: mode,
          type: data.type,
          text: data.text.body,
          arquivo_url: "",
          timestamp: Date.now(),
          metadados: "",
          source: res.data.messaging_product,
        };
        InsertMessage(formatedMessage);
      } catch (error) {
        console.error("Erro no log de informações:", error);
        response.status(500).send("Erro no log de informações");
        return;
      }
      response.send(formatedMessage);
    })
    .catch((error) => {
      console.error(
        "Erro ao enviar mensagem:",
        error.res ? error.res.data : error.message
      );
    });
});
