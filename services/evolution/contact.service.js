import { evolutionClient } from "./evolutionClient.js";
import { getConnection } from "../../config/db.js";
import axios from "axios";

export async function findContacts(instance) {
  const { data } = await evolutionClient.post(
    `/chat/findContacts/${instance}`,
    {}
  );
  return data;
}

export async function updateContact(contact) {
  try {
    let client = await getConnection(process.env.EVOLUTION_DB_DATABASE);
    console.log("Contact to update: " + JSON.stringify(contact));
    const res = await client.query(
      `UPDATE public."Contact" SET "pushName"='${contact.pushName}', "updatedAt"=CURRENT_TIMESTAMP
        WHERE "remoteJid"='${contact.remoteJid}' AND "instanceId"='${contact.instanceId}'`
    );
    return res;
  } catch (error) {
    return error;
  }
}
