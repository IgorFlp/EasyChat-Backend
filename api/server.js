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
const allowedDomain = process.env.CORS_ORIGIN; //.replace(/^https?:\/\//, "");
const AUTH_SECRET = process.env.AUTH_SECRET;
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
async function InsertMessage(formatedMessage, database) {
  try {
    let client = await getConnection();
    const res = await client.query(`INSERT INTO "EC-${database}".mensagens
    (id, recipient, sender, "mode", "type", text, arquivo_url, "timestamp", metadados, "source")
    VALUES(${formatedMessage.id}, ${formatedMessage.recipient}, ${formatedMessage.sender}, ${formatedMessage.mode}, ${formatedMessage.type}, ${formatedMessage.text}, ${formatedMessage.arquivo_url}, ${formatedMessage.timestamp}, ${formatedMessage.metadados}, ${formatedMessage.source});`);

    if (!res) {
      return "Mensagem não inserida";
    } else {
      return 200;
    }
  } catch (e) {
    res.status(404).send("Erro inesperado em insert message: " + e.message);
  } finally {
    await client.end();
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
  //console.log("Token: "+token);
  if (!token) return res.sendStatus(401);
  jwt.verify(token, AUTH_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    //console.log("JWT user: "+JSON.stringify(user));
    req.user = user;
    next();
  });
}
async function GetUserDatabase(userId) {
  //console.log("Userid: "+userId)
  try {
    let client = await getConnection();
    const response = await client.query(`SELECT 
          ud.database_id,
          d.name
      FROM 
          "${MANAGEMENT_SCHEMA}".users_databases ud
      JOIN 
          "${MANAGEMENT_SCHEMA}".databases d ON ud.database_id = d.id
      WHERE 
          ud.user_id = '${userId}';`);

    return response.rows;
  } catch (e) {
    return "Error getting user databases: " + e.message;
  } finally {
    await client.end();
  }
}
async function DatabaseAuth(userId, database) {
  let databases = await GetUserDatabase(userId);
  let dbCount = databases.filter((a) => a.database_id == database);
  console.log(JSON.stringify(dbCount));
  if (dbCount.length == 1) {
    return true;
  } else {
    return false;
  }
}
app.get("/me", authenticateJWT, (req, res) => {
  res.json({ userName: req.user.userName });
});
app.post("/register", async (req, res) => {
  //console.log("Req: "+JSON.stringify(req.body))
  try {
    const { user, password } = req.body;
    const client = await getConnection();
    const find = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${user}'`
    );
    console.log("find rows: " + find.rows);
    if (find.rows.length > 0) {
      client.end();
      res
        .status(409)
        .json({ message: "Nome de usuario existente, favor escolher outro." });
    } else {
      const newUser = {
        id: 0,
        username: user,
        password: password,
      };

      const response = await client.query(
        `INSERT INTO "${MANAGEMENT_SCHEMA}".users (username,password) VALUES ('${newUser.username}', '${newUser.password}') RETURNING id;`
      );
      console.log("response: " + response.rows[0].id);
      //const userId = response.insertedId;
      client.end();
      if (response.rows[0].id) {
        res.status(200).json({ message: "Usuario criado" });
      } else {
        res.status(401).send("Invalid credentials");
      }
    }
  } catch (e) {
    res.status(404).send("Erro no registro de usuario: " + e.message);
  } finally {
    await client.end();
  }
});
app.post("/login", async (req, res) => {
  try {
    const { user, password } = req.body;
    //console.log("User: " + user);
    let client = await getConnection();
    let response = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${user}' AND password = '${password}';`
    );
    client.end();
    if (response.length === 0) {
      response.status(404).send("Usuario ou senha incorreto..");
      return;
    }
    console.log(response.rows);
    if (response.rows.length > 0) {
      const userId = response.rows[0].id;
      const userName = response.rows[0].username;
      const token = jwt.sign(
        { userId: userId, userName: userName },
        AUTH_SECRET,
        {
          expiresIn: "2h",
        }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 2 * 60 * 60 * 1000,
        path: "/",
        ...(process.env.NODE_ENV === "production" && { domain: COOKIE_DOMAIN }),
      });
      res.json({ userName: userName });
    } else {
      res.status(401).send("Invalid credentials");
    }
  } catch (e) {
    res.status(404).send("Erro inexperado no login: " + e.message);
  } finally {
    await client.end();
  }
});
app.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    ...(isProduction && { domain: COOKIE_DOMAIN }),
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
app.get("/user_databases", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    let databases = GetUserDatabase(userId);
    if (databases.length > 0) {
      res.status(200).send(response.rows);
    } else {
      res.status(404).send("Nenhum banco de dados para este usuario.");
    }
  } catch (e) {
    res
      .status(404)
      .send("Erro inesperado em get users_databases: " + e.message);
  } finally {
    await client.end();
  }
});

app.get("/messagesDB", authenticateJWT, async (request, response) => {
  try {
    let database = request.query.database;
    let userId = request.user.userId;
    let databases = await GetUserDatabase(userId);
    let dbCount = databases.filter((a) => a.database_id == database);
    //console.log("databases: "+JSON.stringify(databases))
    //console.log("dbCount: "+JSON.stringify(dbCount))
    let messages = [];
    if (dbCount.length == 1) {
      let client = await getConnection();
      messages = await client.query(
        `SELECT * FROM "EC-${database}".mensagens;`
      );
      client.end();
    } else {
      response.status(401).send("Usuario não autorizado neste banco de dados");
    }
    if (messages.rows.length > 0) {
      response.status(200).send(messages.rows);
    } else {
      response.status(404).send("Nenhuma mensagem encontrada");
    }
  } catch (e) {
    res.status(404).send("Erro inesperado em get messagesDB: " + e.message);
  } finally {
    await client.end();
  }
});
app.get("/contacts", authenticateJWT, async (request, response) => {
  try {
    let database = request.query.database;
    let userId = request.user.userId;
    let contacts = [];
    let client = await getConnection();
    let IsUserAuthorized = await DatabaseAuth(userId, database);
    console.log("authorized: " + IsUserAuthorized);
    if (IsUserAuthorized) {
      contacts = await client.query(`SELECT * FROM "EC-${database}".contatos;`);
    } else {
      response.status(401).send("Usuario não autorizado nesse banco de dados.");
    }
    if (contacts.length === 0) {
      await client.end();
      response.status(204).send("Nenhum contato encontrado.");
      return;
    }
    await client.end();
    response.status(200).send(contacts.rows);
  } catch (e) {
    res.status(404).send("Erro inesperado em get contacts: " + e.message);
  } finally {
    await client.end();
  }
});

app.get("/messagesDB/:contact", authenticateJWT, async (request, response) => {
  try {
    const { contact } = request.params;
    let database = request.query.database;
    let userId = request.user.userId;
    let messages = [];
    let client = await getConnection();
    let IsUserAuthorized = await DatabaseAuth(userId, database);
    console.log("authorized: " + IsUserAuthorized);

    if (IsUserAuthorized) {
      messages = await client.query(
        `SELECT * FROM "EC-${database}".mensagens WHERE recipient = '${contact}' OR sender = '${contact}';`
      );
    } else {
      response.status(401).send("Usuario não autorizado nesse banco de dados.");
    }
    if (messages.rows.length === 0) {
      response
        .status(404)
        .send("Nenhuma mensagem encontrada para este número ou perfil.");
      return;
    }
    response.status(200).send(messages);
  } catch (e) {
    return "Erro ao buscar mensagens por contato: " + e.message;
  } finally {
    await client.end();
  }
});

app.post("/LogIncomingMessage", async (request, response) => {
  try {
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
  } catch (e) {
    res
      .status(404)
      .send("Erro inesperado em log incoming messages: " + e.message);
  }
});

app.post("/message", authenticateJWT, async (request, response) => {
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
