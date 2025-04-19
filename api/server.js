import express from "express";
import axios from "axios";
import "./loadEnv.js";
import { router } from "../routes/webhook.js";

const WPP_MY_NUMBER_ID = process.env.WPP_MY_NUMBER_ID;
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.use("/webhook", router);

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server Listening on PORT:", PORT);
  console.log("WhatsApp Number ID:", WPP_MY_NUMBER_ID);
});

app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };
  response.send(status);
});

app.post("/message", (request, response) => {
  const { message } = request.body;

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
    .then((res) => {
      response.send(res.data);
    })
    .catch((error) => {
      console.error(
        "Erro ao enviar mensagem:",
        error.res ? error.res.data : error.message
      );
    });
});
