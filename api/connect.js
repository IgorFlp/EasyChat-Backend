import { Client }  from 'pg';
import "./loadEnv.js";

  export async function getConnection() {
  const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('Conectado com SSL!'))
  .catch(e => console.error(e));

  return client;
}
