import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { router } from "../routes/webhook.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.use("/webhook", router);

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server Listening on PORT:", PORT);
});

app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };
  response.send(status);
});

app.post("/message", (request, response) => {
  const { message } = request.body;
  const url = "https://graph.facebook.com/v17.0/606534115881714/messages";
  //console.log("Mensagem recebida:", message);
  const data = request.body;

  const config = {
    headers: {
      Authorization:
        "Bearer EAAuCW8hlB2wBO7DqVPBbtQzcueGj0MTSKb86C3O4x0ZAZBccFZBGNZCSjydrZBcWb394XvoY2s8I6GoMNFTSrgoNVSyRzLDxSY3AdJ0RxjRFBemW6docVcOlykHjH1dPtZBNspHIo7X3hieWUqHsr3KjYjusmGzLGPZBNTx6nzudLZBvbQ5hQiZC5PtRGPAtdPV7kEYN41QKkR7DocQzJ0DBqqg3hv2kZD",
      "Content-Type": "application/json",
    },
  };
  axios
    .post(url, data, config)
    .then((res) => {
      console.log("Mensagem enviada com sucesso:", res.data);
      response.send(res.data);
    })
    .catch((error) => {
      console.error(
        "Erro ao enviar mensagem:",
        error.res ? error.res.data : error.message
      );
    });
});
