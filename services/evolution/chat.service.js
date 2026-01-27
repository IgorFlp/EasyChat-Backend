import { evolutionClient } from "./evolutionClient.js";
import axios from "axios";

export async function findChats(instance) {
  const { data } = await evolutionClient.post(
    `/chat/findChats/${instance}`,
    {}
  );
  return data;
}
