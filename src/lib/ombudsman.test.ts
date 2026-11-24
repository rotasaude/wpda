import { afterEach, describe, it, expect, vi } from "vitest";
import { ApiError } from "./citizenApi";
import {
  ANONYMOUS_DISABLED, ANONYMOUS_WARNING, ANONYMOUS_WEB_FEATURE, ATTACHMENT_TYPES, KIND_OPTIONS, MAX_ATTACHMENTS, MODE_OPTIONS,
  OMBUDSMAN_FEATURE, PRESERVED_HINT, REPORT_HINT, SATISFACTION,
  attachmentError, attachmentFilename, bodyError, complementError, deadlineText, kindLabel, nameError, noticeTitle, ombudsmanMessage,
  readAsBase64, reasonError, stateLabel, textLength, timelineTitle,
  YES_NO_OPTIONS, ZOONOSES_ADDRESS_LABEL, ZOONOSES_NOTICE, ZOONOSES_QUESTION, ZOONOSES_SUBTYPES, placeAddressError, zoonosesAllowed
} from "./ombudsman";

afterEach(() => vi.useRealTimers());

describe("ombudsman — textos e constantes do contrato", () => {
  it("aviso da denúncia anônima, palavra por palavra (contrato §14)", () => {
    expect(ANONYMOUS_WARNING).toBe("Sem identificação, você não recebe protocolo nem acompanha a resposta.");
  });

  it("constantes da denúncia anônima (F-12) e das chaves", () => {
    expect(ANONYMOUS_DISABLED).toBe("A denúncia anônima não está disponível agora nesta cidade.");
    expect(REPORT_HINT).toBe("Conte o que aconteceu, onde e quando. Não escreva seu nome, CPF ou telefone.");
    expect(PRESERVED_HINT).toBe("Para manter sua identidade preservada, não escreva no texto seu nome, CPF, telefone ou endereço.");
    expect([ OMBUDSMAN_FEATURE, ANONYMOUS_WEB_FEATURE ]).toEqual([ "ombudsman", "ombudsman_anonymous_web" ]);
    expect(MAX_ATTACHMENTS).toBe(3);
  });

  it("opções de tipo, modo e pesquisa", () => {
    expect(KIND_OPTIONS.map(o => o.value)).toEqual([ "complaint", "report", "praise", "suggestion", "request" ]);
    expect(KIND_OPTIONS.map(o => o.label)).toEqual([ "Reclamação", "Denúncia", "Elogio", "Sugestão", "Solicitação" ]);
    expect(KIND_OPTIONS.every(o => o.hint.length > 0)).toBe(true);
    expect(MODE_OPTIONS.map(o => [ o.value, o.label ])).toEqual([
      [ "identified", "Identificada" ], [ "preserved", "Com identidade preservada" ]
    ]);
    expect(SATISFACTION.met.question).toBe("Sua demanda foi atendida?");
    expect(SATISFACTION.met.options).toEqual([ { value: "yes", label: "Sim" }, { value: "partly", label: "Em parte" }, { value: "no", label: "Não" } ]);
    expect(SATISFACTION.clear.question).toBe("A resposta foi fácil de entender?");
    expect(SATISFACTION.clear.options).toEqual([ { value: "true", label: "Sim" }, { value: "false", label: "Não" } ]);
    expect(SATISFACTION.score.question).toBe("De 1 a 5, qual sua satisfação com a ouvidoria?");
    expect(SATISFACTION.score.options.map(o => o.label)).toEqual([ "1 (muito insatisfeito)", "2", "3", "4", "5 (muito satisfeito)" ]);
    expect(SATISFACTION.score.options.map(o => o.value)).toEqual([ "1", "2", "3", "4", "5" ]);
  });

  it("kindLabel e stateLabel; forwarded é Em análise; desconhecido não mostra o código", () => {
    expect([ "complaint", "report", "praise", "suggestion", "request" ].map(kindLabel))
      .toEqual([ "Reclamação", "Denúncia", "Elogio", "Sugestão", "Solicitação" ]);
    expect([ "received", "in_analysis", "forwarded", "awaiting_complement", "answered", "archived", "xpto", "constructor" ].map(stateLabel))
      .toEqual([ "Recebida", "Em análise", "Em análise", "Aguardando seu complemento", "Respondida", "Arquivada", "Em andamento", "Em andamento" ]);
    expect(kindLabel("xpto")).toBe("Manifestação");
    expect(kindLabel("toString")).toBe("Manifestação");
  });

  it("timelineTitle usa os kinds do api (F-6); desconhecido vira neutro", () => {
    expect(timelineTitle("received")).toBe("Manifestação recebida");
    expect(timelineTitle("complement_requested")).toBe("A Ouvidoria pediu um complemento");
    expect(timelineTitle("complement_received")).toBe("Complemento recebido");
    expect(timelineTitle("extended")).toBe("Prazo prorrogado");
    expect(timelineTitle("interim_response")).toBe("Resposta parcial da Ouvidoria");
    expect(timelineTitle("final_response")).toBe("Resposta da Ouvidoria");
    expect(timelineTitle("archived")).toBe("Manifestação arquivada");
    expect(timelineTitle("reopen_requested")).toBe("Você pediu a reabertura");
    expect(timelineTitle("reopen_rejected")).toBe("Pedido de reabertura recusado");
    expect(timelineTitle("reopened")).toBe("Manifestação reaberta");
    expect(timelineTitle("forwarded")).toBe("Atualização da Ouvidoria");
    expect(timelineTitle("complement_sent")).toBe("Atualização da Ouvidoria");
    expect(timelineTitle("reopen_decided")).toBe("Atualização da Ouvidoria");
    expect(timelineTitle("constructor")).toBe("Atualização da Ouvidoria");
  });

  it("noticeTitle; desconhecido vira neutro", () => {
    expect(noticeTitle("interim_response")).toBe("Novidade na sua manifestação");
    expect(noticeTitle("final_response")).toBe("Sua manifestação foi respondida");
    expect(noticeTitle("complement_requested")).toBe("A Ouvidoria pediu um complemento");
    expect(noticeTitle("archived")).toBe("Sua manifestação foi arquivada");
    expect(noticeTitle("reopen_decided")).toBe("Pedido de reabertura respondido");
    expect(noticeTitle("")).toBe("Aviso da Ouvidoria");
    expect(noticeTitle("toString")).toBe("Aviso da Ouvidoria");
  });
});

describe("deadlineText", () => {
  const TODAY = "2026-11-12";
  it.each([
    [ { state: "in_analysis", due_on: "2026-12-10", color: "green" }, "Resposta prevista até 10/12/2026" ],
    [ { state: "forwarded", due_on: "2026-11-15", color: "yellow" }, "Resposta prevista até 15/11/2026" ],
    [ { state: "in_analysis", due_on: "2026-11-12", color: "yellow" }, "Resposta prevista até 12/11/2026" ],
    [ { state: "in_analysis", due_on: "2026-11-11", color: "red" }, "O prazo de resposta venceu em 11/11/2026" ],
    [ { state: "in_analysis", due_on: "2026-11-11", color: null }, "O prazo de resposta venceu em 11/11/2026" ],
    [ { state: "in_analysis", due_on: "2026-12-10", color: "red" }, "O prazo de resposta venceu em 10/12/2026" ],
    [ { state: "awaiting_complement", due_on: "2026-12-10", color: "paused" }, "Prazo suspenso até você enviar o complemento" ],
    [ { state: "in_analysis", due_on: "2026-12-10", color: "paused" }, "Prazo suspenso até você enviar o complemento" ],
    [ { state: "awaiting_complement", due_on: null, color: null }, "Prazo suspenso até você enviar o complemento" ],
    [ { state: "answered", due_on: "2026-12-10", color: null }, null ],
    [ { state: "archived", due_on: null, color: null }, null ],
    [ { state: "received", due_on: null, color: null }, null ],
    [ { state: "received", due_on: "10/12/2026", color: "green" }, null ]
  ])("%o → %s", (m, text) => expect(deadlineText(m as never, TODAY)).toBe(text));

  it("sem 'today', usa o dia da cidade (relógio fixo em 12/11/2026) e a data de calendário, sem new Date", () => {
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00"));
    expect(deadlineText({ state: "in_analysis", due_on: "2026-11-12", color: "yellow" })).toBe("Resposta prevista até 12/11/2026");
    expect(deadlineText({ state: "in_analysis", due_on: "2026-11-11", color: null })).toBe("O prazo de resposta venceu em 11/11/2026");
  });
});

describe("texto, motivo, complemento e nome", () => {
  it("conta code points depois do trim (emoji conta 1, como o Ruby)", () => {
    expect(textLength("  abc  ")).toBe(3);
    expect(textLength("😀".repeat(20))).toBe(20);
    expect("😀".repeat(20).length).toBe(40);
  });
  it("bodyError nos limites (20–4000)", () => {
    expect(bodyError(" ".repeat(30))).toBe("Escreva pelo menos 20 caracteres.");
    expect(bodyError("a".repeat(19))).toBe("Escreva pelo menos 20 caracteres.");
    expect(bodyError("a".repeat(20))).toBeNull();
    expect(bodyError("😀".repeat(20))).toBeNull();
    expect(bodyError("😀".repeat(4000))).toBeNull();
    expect(bodyError("a".repeat(4000))).toBeNull();
    expect(bodyError("a".repeat(4001))).toBe("Escreva no máximo 4.000 caracteres.");
  });
  it("reasonError (10–2000)", () => {
    expect(reasonError("a".repeat(9))).toBe("Escreva pelo menos 10 caracteres.");
    expect(reasonError("a".repeat(10))).toBeNull();
    expect(reasonError("a".repeat(2000))).toBeNull();
    expect(reasonError("a".repeat(2001))).toBe("Escreva no máximo 2.000 caracteres.");
  });
  it("complementError (10–4000, F-9)", () => {
    expect(complementError("a".repeat(9))).toBe("Escreva pelo menos 10 caracteres.");
    expect(complementError("a".repeat(10))).toBeNull();
    expect(complementError("a".repeat(4000))).toBeNull();
    expect(complementError("a".repeat(4001))).toBe("Escreva no máximo 4.000 caracteres.");
  });
  it("nameError (2–120, Q62)", () => {
    expect(nameError("")).toBe("Escreva seu nome.");
    expect(nameError("  a ")).toBe("Escreva seu nome.");
    expect(nameError("Jo")).toBeNull();
    expect(nameError("a".repeat(120))).toBeNull();
    expect(nameError("a".repeat(121))).toBe("Escreva no máximo 120 caracteres.");
  });
});

describe("anexos", () => {
  const file = (type: string, size = 100) => { const f = new File([ "x" ], "RG João Silva.pdf", { type }); Object.defineProperty(f, "size", { value: size }); return f; };
  it("attachmentError: tipo, tamanho e quantidade", () => {
    expect(attachmentError(file("application/pdf"), 0)).toBeNull();
    expect(attachmentError(file("image/jpeg"), 2)).toBeNull();
    expect(attachmentError(file("image/png", 10 * 1024 * 1024), 0)).toBeNull();
    expect(attachmentError(file("image/png", 10 * 1024 * 1024 + 1), 0)).toBe("O arquivo passa de 10 MB.");
    expect(attachmentError(file("image/gif"), 0)).toBe("Envie um PDF, uma foto JPEG ou PNG.");
    expect(attachmentError(file("application/pdf"), 3)).toBe("No máximo 3 anexos.");
    expect(attachmentError(file("image/gif", 99999999), 3)).toBe("No máximo 3 anexos.");
  });
  it("attachmentError: arquivo vazio (0 byte) é recusado aqui, com a frase do anexo", () => {
    expect(attachmentError(file("application/pdf", 0), 0)).toBe("Envie um PDF, uma foto JPEG ou PNG, de até 10 MB.");
    expect(attachmentError(file("image/png", 1), 0)).toBeNull();
  });
  it("ATTACHMENT_TYPES e attachmentFilename: genérico, pela ordem e pelo tipo", () => {
    expect(ATTACHMENT_TYPES).toEqual({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" });
    expect(attachmentFilename(0, "application/pdf")).toBe("anexo-1.pdf");
    expect(attachmentFilename(1, "image/jpeg")).toBe("anexo-2.jpg");
    expect(attachmentFilename(2, "image/png")).toBe("anexo-3.png");
  });
  it("readAsBase64: só o conteúdo, sem o prefixo data:", async () => {
    expect(await readAsBase64(new File([ "%PDF-1" ], "a.pdf", { type: "application/pdf" }))).toBe("JVBERi0x");
  });
});

describe("ombudsmanMessage", () => {
  it.each([
    [ "feature_disabled", "A Ouvidoria não está disponível agora nesta cidade." ],
    [ "too_many_requests", "Muitos envios em pouco tempo. Tente mais tarde." ],
    [ "daily_cap_reached", "O canal de denúncias recebeu muitas mensagens hoje. Tente mais tarde." ],
    [ "payload_too_large", "O texto ficou grande demais. Encurte e tente de novo." ],
    [ "http_413", "O texto ficou grande demais. Encurte e tente de novo." ],
    [ "not_own_citizen", "Escolha uma das pessoas deste celular." ],
    [ "invalid_file", "Envie um PDF, uma foto JPEG ou PNG, de até 10 MB." ],
    [ "too_many_attachments", "No máximo 3 anexos." ],
    [ "manifestation_changed", "A manifestação mudou. Veja como ela está agora." ],
    [ "invalid_transition", "A manifestação mudou. Veja como ela está agora." ],
    [ "reopen_window_closed", "O prazo de 30 dias para pedir a reabertura terminou." ],
    [ "reopen_pending", "Você já pediu a reabertura desta manifestação." ],
    [ "reopen_already_requested", "Você já pediu a reabertura desta manifestação." ],
    [ "already_answered", "Você já respondeu a pesquisa desta manifestação." ],
    [ "satisfaction_window_closed", "O prazo para responder a pesquisa terminou." ],
    [ "not_found", "Esta manifestação não está disponível por aqui." ],
    [ "invalid_cpf", "CPF inválido. Confira os números." ],
    [ "too_many_people", "Este celular já tem 10 pessoas cadastradas." ]
  ])("%s", (code, text) => expect(ombudsmanMessage(new ApiError(422, code))).toBe(text));

  it.each([
    [ "body", "Confira o tamanho do texto." ],
    [ "reason", "Escreva o motivo com 10 a 2.000 caracteres." ],
    [ "full_name", "Escreva seu nome, com 2 a 120 caracteres." ],
    [ "cpf", "CPF inválido. Confira os números." ],
    [ "citizen_id", "Escolha uma das pessoas deste celular." ],
    [ "health_unit_id", "Essa unidade não está mais na lista. Escolha de novo." ],
    [ "attachment_ids", "Um dos anexos não vale mais. Remova e anexe de novo." ]
  ])("invalid_request com path %s", (path, text) =>
    expect(ombudsmanMessage(new ApiError(422, "invalid_request", path))).toBe(text));

  it("invalid_request com outro path, sem path ou path hostil cai na frase genérica", () => {
    expect(ombudsmanMessage(new ApiError(422, "invalid_request", "score"))).toBe("Algo deu errado. Tente de novo.");
    expect(ombudsmanMessage(new ApiError(422, "invalid_request"))).toBe("Algo deu errado. Tente de novo.");
    expect(ombudsmanMessage(new ApiError(422, "invalid_request", "constructor"))).toBe("Algo deu errado. Tente de novo.");
  });

  it("códigos mortos do plano e desconhecidos viram a frase genérica, nunca o texto do servidor", () => {
    for (const code of [ "rate_limited", "already_requested", "body", "invalid_body", "reason", "invalid_reason", "toString", "Erro interno: SELECT * FROM x" ]) {
      const msg = ombudsmanMessage(new ApiError(500, code));
      expect(msg).toBe("Algo deu errado. Tente de novo.");
      expect(msg).not.toContain(code);
    }
  });

  // api-shapes.md §5: os 20 códigos do api. json_required (415) não chega às telas.
  const API_CODES = [
    "json_required", "unauthenticated", "feature_disabled", "too_many_requests", "daily_cap_reached", "payload_too_large",
    "invalid_request", "invalid_cpf", "too_many_people", "not_own_citizen", "too_many_attachments", "invalid_file", "not_found",
    "manifestation_changed", "invalid_transition", "reopen_window_closed", "reopen_pending", "reopen_already_requested",
    "already_answered", "satisfaction_window_closed"
  ];
  const GENERIC = "Algo deu errado. Tente de novo.";
  it("os 20 códigos do api têm frase própria (json_required cai na genérica)", () => {
    expect(API_CODES).toHaveLength(20);
    for (const code of API_CODES) {
      const msg = ombudsmanMessage(new ApiError(422, code, code === "invalid_request" ? "body" : undefined));
      expect(msg, code).not.toBe("");
      if (code === "json_required") expect(msg).toBe(GENERIC);
      else expect(msg, code).not.toBe(GENERIC);
    }
  });

  it("sem rede cai em messageFor", () => {
    expect(ombudsmanMessage(new TypeError("offline"))).toBe("Sem conexão. Verifique a internet e tente de novo.");
  });
});

describe("zoonoses (módulo 35b)", () => {
  it("frases fixas do contrato §14", () => {
    expect(ZOONOSES_QUESTION).toBe("É sobre animais, insetos ou bichos?");
    expect(ZOONOSES_ADDRESS_LABEL).toBe("Onde fica o problema? (endereço do local)");
    expect(ZOONOSES_NOTICE).toBe("Seu pedido vai direto ao centro de zoonoses. Não escreva seu nome nem telefone no texto.");
    expect(YES_NO_OPTIONS).toEqual([ { value: "yes", label: "Sim" }, { value: "no", label: "Não" } ]);
  });

  it("subtipos na ordem e com os rótulos do §4", () => {
    expect(ZOONOSES_SUBTYPES.map(s => s.value)).toEqual([ "scorpion", "bat", "rodent", "tick", "aggressive_animal",
      "neurological_animal", "sporotrichosis", "other" ]);
    expect(ZOONOSES_SUBTYPES.map(s => s.label)).toEqual([ "Escorpião", "Morcego", "Rato ou outro roedor", "Carrapato",
      "Animal que mordeu ou atacou", "Animal com comportamento estranho ou paralisia", "Gato com feridas (esporotricose)",
      "Outro problema com animal" ]);
  });

  it("placeAddressError: 10 a 300 code points depois do trim", () => {
    expect(placeAddressError("Rua A, 1")).toBe("Escreva pelo menos 10 caracteres.");
    expect(placeAddressError("  Rua A, 123  ")).toBeNull();
    expect(placeAddressError("a".repeat(301))).toBe("Escreva no máximo 300 caracteres.");
    expect(placeAddressError("🦂".repeat(300))).toBeNull();
  });

  it("zoonosesAllowed: só solicitação e denúncia", () => {
    expect(zoonosesAllowed("request")).toBe(true);
    expect(zoonosesAllowed("report")).toBe(true);
    for (const k of [ "complaint", "praise", "suggestion", undefined ]) expect(zoonosesAllowed(k)).toBe(false);
  });

  it("frases de path novas", () => {
    expect(ombudsmanMessage(new ApiError(422, "invalid_request", "zoonoses_subtype")))
      .toBe("O envio direto ao centro de zoonoses não está disponível agora. Sua manifestação pode seguir sem essa escolha.");
    expect(ombudsmanMessage(new ApiError(422, "invalid_request", "place_address")))
      .toBe("Escreva o endereço do local com 10 a 300 caracteres.");
  });
});
