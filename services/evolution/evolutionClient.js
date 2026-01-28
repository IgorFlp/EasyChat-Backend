import axios from "axios";
import { getConnection } from "../../config/db.js";

const evolutionClient = axios.create({
  baseURL: process.env.WPP_API_URL,
  timeout: 5000,
  headers: {
    apikey: process.env.WPP_GLOBAL_KEY,
  },
});

export async function getInstancesByIds(instancesIds) {
  try {
    let client = await getConnection(process.env.EVOLUTION_DB_DATABASE);
    //console.log("Instances Ids: " + JSON.stringify(instancesIds));
    let response = await client.query(
      `SELECT * FROM public."Instance" WHERE "id" = ANY($1::text[])`,
      [instancesIds]
    );

    client.end();
    return response.rows;
  } catch (error) {
    throw new Error("Erro ao buscar instancias: " + error.message);
  }
}

export { evolutionClient };
