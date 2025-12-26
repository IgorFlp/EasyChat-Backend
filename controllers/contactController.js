import * as contactService from "../services/evolution/contact.service.js";
export async function findContacts(request, response) {
  try {
    let instance = request.query.instance;
    let contacts = await contactService.findContacts(instance);
    response.status(200).send(contacts);
  } catch (e) {
    response.status(404).send("Erro inesperado em get contatos: " + e.message);
  }
}

// Contatos
export const updateContact = async (request, response) => {
  try {
    let contact = request.body;
    let result = await contactService.updateContact(contact);

    if (result instanceof Error) {
      response.status(500).send("Erro ao atualizar contato: " + result.message);
      return;
    } else if (result.rowCount === 0) {
      response.status(404).send("Contato não encontrado para atualização");
      return;
    }
    response
      .status(200)
      .send("Contato atualizado com sucesso " + result.rowCount);
  } catch (e) {
    response
      .status(404)
      .send("Erro inesperado em update contact: " + e.message);
  }
};
