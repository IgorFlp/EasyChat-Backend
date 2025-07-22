const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// WHATSAPP TOKEN ERA GRAPH_API_TOKEN;
const { WEBHOOK_VERIFY_TOKEN, WHATSAPP_TOKEN } = process.env;

export const webhookGet = async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // check the mode and token sent are correct
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    // respond with 200 OK and challenge token from the request
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    // respond with '403 Forbidden' if verify tokens do not match
    res.sendStatus(403);
  }
};

export const webhookPost = async (req, res) => {
  // log incoming messages

  // check if the webhook request contains a message
  // details on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  if (message) {
    console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));
    const url = `http://3.145.154.49:3000/LogIncomingMessage`;
    const data = req.body;
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };
    //data.mode = "received"
    axios.post(url, data, config).catch((error) => {
      console.error(
        "Erro ao salvar mensagem:",
        error.res ? error.res.data : error.message
      );
    });
  }
  // check if the incoming message contains text
  if (message?.type === "text") {
    // extract the business number to send the reply from it
    const business_phone_number_id =
      req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

    // send a reply message as per the docs here https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
    /* ECHO BACK
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v22.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        to: message.from,
        text: { body: "Echo: " + message.text.body },
        context: {
          message_id: message.id, // shows the message as a reply to the original user message
        },
      },
    });*/

    // mark incoming message as read
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v22.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: message.id,
      },
    });
  }

  res.sendStatus(200);
};
