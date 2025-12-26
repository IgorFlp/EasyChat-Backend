import { getConnection } from "../config/db.js";
const MANAGEMENT_SCHEMA = "EasyChat";

export async function listUserInstances(userId) {
  try {
    let client = await getConnection(process.env.DB_DATABASE);

    let response = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users_instances WHERE user_id = '${userId}';`
    );
    client.end();
    return response.rows;
  } catch (error) {
    throw new Error("Erro ao listar instancias do usuario: " + error.message);
  }
}
export async function GetUserDatabase(userId) {
  let client;
  try {
    client = await getConnection(process.env.DB_DATABASE);
    const response = await client.query(`SELECT 
          ud.database_id,
          d.name
      FROM 
          "${MANAGEMENT_SCHEMA}".users_databases ud
      JOIN 
          "${MANAGEMENT_SCHEMA}".databases d ON ud.database_id = d.id
      WHERE 
          ud.user_id = '${userId}';`);

    return response.rows;
  } catch (e) {
    return "Error getting user databases: " + e.message;
  } finally {
    await client.end();
  }
}
