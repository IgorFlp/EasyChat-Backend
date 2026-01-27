import { getConnection } from "../config/db.js";
const MANAGEMENT_SCHEMA = "EasyChat";
export async function findUserByUsername(username) {
  try {
    const client = await getConnection(process.env.DB_DATABASE);
    const find = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${username}'`
    );
    console.log("User found: " + JSON.stringify(find.rows));
    client.end();
    return find;
  } catch (error) {
    throw new Error("Erro ao buscar usuario: " + error.message);
  }
}

export async function createUser(newUser) {
  try {
    const client = await getConnection(process.env.DB_DATABASE);
    const response = await client.query(
      `INSERT INTO "${MANAGEMENT_SCHEMA}".users (username,password) VALUES ('${newUser.username}', '${newUser.password}') RETURNING id;`
    );

    client.end();
    return response;
  } catch (error) {
    throw new Error("Erro ao criar usuario: " + error.message);
  }
}

export async function loginUser(user, password) {
  try {
    let client = await getConnection(process.env.DB_DATABASE);

    let response = await client.query(
      `SELECT * FROM "${MANAGEMENT_SCHEMA}".users WHERE username = '${user}' AND password = '${password}';`
    );
    client.end();
    return response;
  } catch (error) {
    throw new Error("Erro inexperado no login: " + error.message);
  }
}
