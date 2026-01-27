import { Client } from "pg";
import "./loadEnv.js";

export async function getConnection(database) {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: database,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  client
    .connect()
    .then(() => console.log("Conectado com SSL!"))
    .catch((e) => console.error(e));

  return client;
}
/*
async function GetContato() {
  let database = "10000";
  let coluna = "whatsapp_id";
  let common_id = "5518998200826";
  let client = await getConnection();
  const query1 = `SELECT * FROM "EC-${database}".contatos WHERE ${coluna} = '${common_id}'`;
  let res = await client.query(query1);
  if (res.rows.length > 0) {
    console.log("Linha: " + JSON.stringify(res.rows[0].id));
  }
}
GetContato();
*/
