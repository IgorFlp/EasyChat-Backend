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
