import * as chatService from "../services/evolution/chat.service.js";
export async function findChats(request, response) {
  try {
    let instance = request.query.instance;
    const chats = await chatService.findChats(instance);
    response.status(200).send(chats);
  } catch (e) {
    response.status(404).send("Erro inesperado em get chats: " + e.message);
  }
}
