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
    client = await getConnection(process.env.DB_DATABASE);
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
async function GetUserDatabase(userId) {
  let client;
  try {
    client = await getConnection(process.env.DB_DATABASE);
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
  try {
    const { user, password } = req.body;
    const client = await getConnection(process.env.DB_DATABASE);
    const find = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${user}'`
    );

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

    let client = await getConnection(process.env.DB_DATABASE);

    let response = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${user}' AND password = '${password}';`
    );
    client.end();
    if (response.length === 0) {
      response.status(404).send("Usuario ou senha incorreto..");
      return;
    }
    let instances = [];
    let instancesIds = [];
    if (response.rows.length > 0) {
      const userId = response.rows[0].id;
      const userName = response.rows[0].username;
      console.log("UserId: " + userId + " UserName: " + userName);
      let client2 = await getConnection(process.env.DB_DATABASE);

      let response2 = await client2.query(
        `SELECT * FROM "${MANAGEMENT_SCHEMA}".users_instances WHERE user_id = '${userId}';`
      );
      client2.end();

      if (response2.rows.length === 0) {
        res.status(404).send("Nenhuma instancia para esse usuario..");
        return;
      } else {
        response2.rows.filter((inst) => {
          instancesIds.push(inst.instance_id);
        });
        let client3 = await getConnection(process.env.EVOLUTION_DB_DATABASE);
        console.log("Instances Ids: " + JSON.stringify(instancesIds));
        let response3 = await client3.query(
          `SELECT * FROM public."Instance" WHERE "id" = ANY($1::text[])`,
          [instancesIds]
        );
        //console.log("Instances data: " + JSON.stringify(response3.rows));
        client3.end();
        if (response3.rows.length === 0) {
          res.status(404).send("Nenhuma instancia para esse usuario..");
          return;
        } else {
          response3.rows.filter((inst) => {
            instances.push(inst.name);
          });
        }
      }
      const token = jwt.sign(
        { userId: userId, userName: userName, instances: instances },
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
      res.json({ instances: instances });
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
// Chats
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
