import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/citizenApi";
import { messageFor } from "./ui";

// Módulo 15 (contrato §3): todo código novo que chega ao cidadão tem texto
// próprio, nunca o genérico.
describe("messageFor — módulo 15", () => {
  it.each([
    [ "invalid_birth_date", "Data de nascimento inválida. Confira dia, mês e ano." ],
    [ "invalid_sex", "Escolha o sexo." ],
    [ "invalid_gender_identity", "Escolha uma opção de identidade de gênero." ],
    [ "profile_verified", "Este perfil foi conferido no posto e só pode ser corrigido lá." ],
    [ "profile_required", "Antes, informe a data de nascimento e o sexo desta pessoa." ],
    [ "not_offered", "Esta triagem não está mais disponível para esta pessoa." ],
    [ "triage_in_progress", "Já existe uma triagem em andamento para esta pessoa. Continue a que está aberta." ],
    [ "protocol_name_required", "Escolha uma triagem para começar." ]
  ])("%s", (code, message) => {
    expect(messageFor(new ApiError(409, code))).toBe(message);
  });
});
