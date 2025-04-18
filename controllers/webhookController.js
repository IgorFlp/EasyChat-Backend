const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export const webhookGet = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const webhookPost = (req, res) => {
  const body = req.body;
  console.log("📥 Webhook recebeu dados:", JSON.stringify(body, null, 2));
  res.sendStatus(200);
};
