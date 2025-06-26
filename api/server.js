import express from "express";
import axios from "axios";
//import { GetMessages } from "./mensagensDAO.js";
import { getConnection } from "./connect.js";
import "./loadEnv.js";
import { router } from "../routes/webhook.js";
import cors from "cors";

const SCHEMA = "EasyChat";
const WPP_MY_NUMBER_ID = process.env.WPP_MY_NUMBER_ID;
const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
app.use("/webhook", router);

app.listen(PORT, "0.0.0.0", async () => {
  console.log("Server Listening on PORT:", PORT);
  console.log("WhatsApp Number ID:", WPP_MY_NUMBER_ID);
});

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

app.post("/messageDB/:mode", async (request, response) => {
  const { mode } = request.params;
  const message = request.body;
  let recepient = mode === "received" ? process.env.WPP_MY_NUMBER : message.to;
  console.log(
    "Received Message:",
    message.entry[0].changes[0].value.messages[0]
  );
  let formatedMessage = {};
  if (message.entry[0]) {
    formatedMessage = {
      id: message.entry[0].id,
      recipient: recepient,
      sender: message.entry[0].changes[0].value.messages[0].from,
      mode: mode,
      type: message.entry[0].changes[0].value.messages[0].type,
      text: message.entry[0].changes[0].value.messages[0].text.body,
      arquivo_url: "",
      timestamp: message.entry[0].changes[0].value.messages[0].timestamp,
      metadados: message.entry[0].changes[0].value.metadata,
      source: message.entry[0].changes[0].value.messaging_product,
    };
  }
  console.log("Formated Message:", formatedMessage);

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
    response.status(404).send("Mensagem não encontrada");
  } else {
    response.status(200).send(sent);
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
      data.mode = "sent";
      console.log(data);
      const sent = await db
        .collection("Sent_Messages")
        .insertOne(data)
        .catch((error) => {
          console.error("Erro ao inserir mensagem:", error);
          response.status(500).send("Erro ao inserir mensagem");
        });
      response.send(res.data);
    })
    .catch((error) => {
      console.error(
        "Erro ao enviar mensagem:",
        error.res ? error.res.data : error.message
      );
    });
});
