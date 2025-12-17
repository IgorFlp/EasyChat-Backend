import axios from "axios";
import { io } from "../api/socket.js";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// WHATSAPP TOKEN ERA GRAPH_API_TOKEN;
const { WEBHOOK_VERIFY_TOKEN, WHATSAPP_TOKEN } = process.env;

export const webhookPost = async (req, res) => {
  const payload = req.body;

  // 1. Logar o Payload da Evolution
  //console.log("Incoming Evolution webhook:", JSON.stringify(payload, null, 2));

  // 2. Verificar se o evento é uma nova mensagem
  // O evento 'messages.upsert' geralmente indica uma nova mensagem recebida/enviada
  if (payload.event === "messages.upsert" && payload.data) {
    // A mensagem em si está em payload.data[0] (pode ser um array)
    const mensagemRecebida = payload.data?.[0];

    if (mensagemRecebida) {
      // Extrair o texto da mensagem (pode estar em diferentes campos: conversation, extendedTextMessage, etc.)
      const textoMensagem =
        mensagemRecebida.message?.conversation ||
        mensagemRecebida.message?.extendedTextMessage?.text;

      // Extrair o ID da instância e WUID (número que enviou)
      const instanceName = payload.instance;
      const fromWUID = mensagemRecebida.key?.remoteJid;

      console.log(
        `Mensagem de [${instanceName}] de ${fromWUID}: ${textoMensagem}`
      );
      /*
            // 3. Sua Lógica de Salvar/Processar (LogIncomingMessage)
            const url = `http://3.145.154.49:3000/LogIncomingMessage`;
            const config = { headers: { "Content-Type": "application/json" } };

            // Adapte o objeto 'data' para o formato que seu LogIncomingMessage espera,
            // usando os dados da Evolution (payload)
            axios.post(url, {
                instance: instanceName,
                from: fromWUID,
                text: textoMensagem,
                // ... outros dados necessários
            }, config).catch((error) => {
                console.error("Erro ao salvar mensagem:", error.response ? error.response.data : error.message);
            });*/

      // 4. Seus métodos de Resposta/Leitura (usando a Evolution API)
      // Os métodos de resposta (ECHO BACK e mark as read) devem ser reescritos
      // para usar a API REST da Evolution, e NÃO a Graph API (https://graph.facebook.com).

      /* Exemplo de Marcar como Lida (usando a Evolution API)
            // Você precisará do URL base da sua Evolution API (e talvez do API Key)
            const evolutionUrl = `https://apiwp.igorflpdev.online/message/read/${instanceName}`;

            await axios({
                method: "POST",
                url: evolutionUrl,
                headers: {
                    "Content-Type": "application/json",
                    "apikey": "SUA_API_KEY_DA_EVOLUTION" // Se necessário
                },
                data: {
                    messageId: mensagemRecebida.key.id,
                    remoteJid: fromWUID
                }
            });
            */
    }
  }

  // 5. SEMPRE responda com 200 OK para o Evolution
  io.emit("new_message", payload);
  res.sendStatus(200);
};
