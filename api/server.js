import express from "express";
import axios from "axios";
import { httpServer, io, app } from "./socket.js";
import { getConnection } from "./connect.js";
import "./loadEnv.js";
import { router } from "../routes/webhook.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
import e from "express";

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
  //console.log("Formated Message to insert:", JSON.stringify(formatedMessage));
  let client;
  let res;
  try {
    client = await getConnection();
    let coluna;
    switch (formatedMessage.source) {
      case "whatsapp":
        coluna = "whatsapp_id";
        break;
      case "telegram":
        coluna = "telegram_id";
        break;
      case "instagram":
        coluna = "instagram_id";
        break;
    }
    let contact_id;
    const query1 = `SELECT * FROM "EC-${database}".contatos WHERE ${coluna} = '${formatedMessage.common_id}'`;
    let res1 = await client.query(query1);
    if (res1.rows.length > 0) {
      contact_id = res1.rows[0].id;
    } else {
      contact_id = null;
    }
    const values = [
      formatedMessage.id,
      formatedMessage.recipient,
      formatedMessage.sender,
      formatedMessage.mode,
      formatedMessage.type,
      formatedMessage.text || null,
      formatedMessage.arquivo_url || null,
      formatedMessage.timestamp,
      formatedMessage.metadados || null,
      formatedMessage.source,
      formatedMessage.common_id || null,
      formatedMessage.contact_id || contact_id,
    ];
    const query2 = `
      INSERT INTO "EC-${database}".mensagens
      (id, recipient, sender, "mode", "type", text, arquivo_url, "timestamp", metadados, "source", common_id,contact_id)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12)
    `;
    let res2 = await client.query(query2, values);
    console.log("Insert message response: " + JSON.stringify(res2));
    if (!res2) {
      return "Mensagem não inserida";
    } else {
      return 200;
    }
  } catch (e) {
    return "Erro ao inserir mensagem: " + e.message;
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
  let client;
  try {
    client = await getConnection();
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

// AUTENTICAÇÃO
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
    console.log(req.body);
    let client = await getConnection();
    //console.log("User: " + user);
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
    let databases = await GetUserDatabase(userId);
    console.log(databases);
    if (databases.length > 0) {
      res.status(200).send(databases);
    } else {
      res.status(404).send("Nenhum banco de dados para este usuario.");
    }
  } catch (e) {
    res
      .status(404)
      .send("Erro inesperado em get users_databases: " + e.message);
  }
});
// Chats e contatos
app.post("/chat/findChats", authenticateJWT, async (request, response) => {
  try {
    let instance = request.query.instance;
    console.log("Instance: " + instance);
    const WPP_API_URL = process.env.WPP_API_URL;
    const url = `${WPP_API_URL}/chat/findChats/${instance}`;
    console.log(url);
    const config = {
      headers: {
        timeout: 300,
        apiKey: `${process.env.WPP_GLOBAL_KEY}`,
        "Content-Type": "application/json",
      },
    };

    axios
      .post(url, {}, config)
      .then((res) => {
        response.status(200).send(res.data);
      })
      .catch((error) => {
        console.error("Erro ao buscar chats:" + error);
        response.status(500).send("Erro ao buscar chats");
        return;
      });
  } catch (e) {
    response.status(404).send("Erro inesperado em get chats: " + e.message);
  }
});

app.post("/chat/findContacts", authenticateJWT, async (request, response) => {
  try {
    let instance = request.query.instance;
    //console.log("Instance: " + instance);
    const WPP_API_URL = process.env.WPP_API_URL;
    const url = `${WPP_API_URL}/chat/findContacts/${instance}`;
    //console.log(url);
    const config = {
      headers: {
        apiKey: `${process.env.WPP_GLOBAL_KEY}`,
        "Content-Type": "application/json",
      },
    };

    axios
      .post(url, {}, config)
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

//Fetch messages da api
app.post("/chat/findMessages", authenticateJWT, async (request, response) => {
  try {
    let instance = request.query.instance;
    const { number } = request.body;
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
          remoteJid: `${number}`,
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
  const { instance } = request.query;
  const WPP_API_URL = process.env.WPP_API_URL;
  const url = `${WPP_API_URL}/message/sendText/${instance}`;
  console.log("instance:" + instance);
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
