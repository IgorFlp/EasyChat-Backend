import express from "express";
import axios from "axios";
import "./loadEnv.js";
import { router } from "../routes/webhook.js";
import { db } from "./connect.js";
import cors from "cors";

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
  const received = await db
    .collection("Received_Messages")
    .find({})
    .toArray()
    .catch((error) => {
      console.error("Erro ao buscar mensagens:", error);
      response.status(500).send("Erro ao buscar mensagens");
    });
  const sent = await db
    .collection("Sent_Messages")
    .find({})
    .toArray()
    .catch((error) => {
      console.error("Erro ao buscar mensagens:", error);
      response.status(500).send("Erro ao buscar mensagens");
    });
  if (!received || !sent) {
    response.status(404).send("Mensagem não encontrada");
  } else {
    response.status(200).send({ received, sent });
  }
});

app.get("/messagesDB/:number", async (request, response) => {
  const { number } = request.params;
  //msgRecieved "recipient_id": "5518998200826"
  //msgSent "to": "5518998200826"
  const received = await db
    .collection("Received_Messages")
    .find({ "entry.changes.value.messages.from": number })
    .toArray()
    .catch((error) => {
      console.error("Erro ao buscar mensagem:", error);
      response.status(500).send("Erro ao buscar mensagem");
    });
  const sent = await db
    .collection("Sent_Messages")
    .find({ to: number })
    .toArray()
    .catch((error) => {
      console.error("Erro ao buscar mensagem:", error);
      response.status(500).send("Erro ao buscar mensagem");
    });
  if (!received || !sent) {
    response.status(404).send("Mensagem não encontrada");
  } else {
    response.status(200).send({ received, sent });
  }
});

app.post("/messageDB/:mode", async (request, response) => {
  const { mode } = request.params;
  if (mode == "sent") {
    const message = request.body;
    message.mode = "sent";
    console.log(message);
    const sent = await db
      .collection("Sent_Messages")
      .insertOne(message)
      .catch((error) => {
        console.error("Erro ao inserir mensagem:", error);
        response.status(500).send("Erro ao inserir mensagem");
      });
    if (!sent) {
      response.status(404).send("Mensagem não encontrada");
    } else {
      response.status(200).send(sent);
    }
  }
  if (mode == "received") {
    const message = request.body;
    message.mode = "received";
    console.log(message);
    const sent = await db
      .collection("Received_Messages")
      .insertOne(message)
      .catch((error) => {
        console.error("Erro ao inserir mensagem:", error);
        response.status(500).send("Erro ao inserir mensagem");
      });
    if (!sent) {
      response.status(404).send("Mensagem não encontrada");
    } else {
      response.status(200).send(sent);
    }
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
