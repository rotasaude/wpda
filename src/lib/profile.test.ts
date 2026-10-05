import { afterEach, describe, expect, it } from "vitest";
import {
  BIRTH_DATE_FUTURE, BIRTH_DATE_INVALID, BIRTH_DATE_TOO_OLD, GENDER_IDENTITY_OPTIONS, SEX_OPTIONS, SEX_REQUIRED,
  ageOn, genderIdentityLabel, maskDate, parseBirthDate, sexLabel, toMaskedDate, todayInCity, validateProfile
} from "./profile";
import { setCityTimeZone } from "./format";

afterEach(() => setCityTimeZone(null));

describe("opções e rótulos (contrato §2)", () => {
  it("sexo: os dois valores do contrato", () => {
    expect(SEX_OPTIONS).toEqual([ { value: "female", label: "Feminino" }, { value: "male", label: "Masculino" } ]);
    expect(sexLabel("female")).toBe("Feminino");
    expect(sexLabel("male")).toBe("Masculino");
  });
  it("identidade de gênero: 'Prefiro não informar' primeiro (null), depois os sete valores", () => {
    expect(GENDER_IDENTITY_OPTIONS).toEqual([
      { value: null, label: "Prefiro não informar" },
      { value: "cis_woman", label: "Mulher cis" },
      { value: "cis_man", label: "Homem cis" },
      { value: "trans_woman", label: "Mulher trans" },
      { value: "trans_man", label: "Homem trans" },
      { value: "travesti", label: "Travesti" },
      { value: "non_binary", label: "Não binária" },
      { value: "other", label: "Outra" }
    ]);
    expect(genderIdentityLabel(null)).toBe("Não informado");
    expect(genderIdentityLabel("non_binary")).toBe("Não binária");
  });
});

describe("maskDate", () => {
  it.each([
    [ "", "" ], [ "0", "0" ], [ "02", "02" ], [ "020", "02/0" ], [ "0204", "02/04" ], [ "02041", "02/04/1" ],
    [ "02041963", "02/04/1963" ], [ "020419639", "02/04/1963" ], [ "02/04/1963", "02/04/1963" ], [ "ab02cd", "02" ]
  ])("%s → %s", (input, out) => expect(maskDate(input)).toBe(out));
});

describe("parseBirthDate", () => {
  it("dia/mês/ano vira AAAA-MM-DD", () => expect(parseBirthDate("02/04/1963")).toBe("1963-04-02"));
  it("29/02 em ano bissexto existe", () => expect(parseBirthDate("29/02/2024")).toBe("2024-02-29"));
  it.each([ "", "02/04/63", "2/4/1963", "31/02/2000", "29/02/2025", "00/01/2000", "01/13/2000", "01/01/0063" ])(
    "recusa %s", (s) => expect(parseBirthDate(s)).toBeNull());
});

describe("toMaskedDate", () => {
  it("AAAA-MM-DD vira DD/MM/AAAA", () => expect(toMaskedDate("1963-04-02")).toBe("02/04/1963"));
  it("inválido vira vazio", () => expect(toMaskedDate("1963-4-2")).toBe(""));
});

describe("ageOn", () => {
  it("aniversário hoje conta o ano", () => expect(ageOn("1966-10-05", "2026-10-05")).toBe(60));
  it("véspera do aniversário ainda não", () => expect(ageOn("1966-10-06", "2026-10-05")).toBe(59));
  it("nascido em 29/02 faz aniversário em 01/03 no ano comum", () => {
    expect(ageOn("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageOn("2000-02-29", "2025-03-01")).toBe(25);
  });
  it("nascido hoje tem 0", () => expect(ageOn("2026-10-05", "2026-10-05")).toBe(0));
});

describe("todayInCity", () => {
  it("23h30 em Brasília ainda é o mesmo dia (no UTC já virou)", () => {
    expect(todayInCity(new Date("2026-10-05T23:30:00-03:00"))).toBe("2026-10-05");
  });
  it("segue o fuso da cidade da sessão", () => {
    setCityTimeZone("America/Manaus");
    expect(todayInCity(new Date("2026-10-06T00:30:00-03:00"))).toBe("2026-10-05");
  });
});

describe("validateProfile", () => {
  const TODAY = "2026-10-05";

  it("válido: data ISO, sexo e identidade null", () => {
    expect(validateProfile({ birthDate: "02/04/1963", sex: "female", genderIdentity: null }, TODAY))
      .toEqual({ ok: true, value: { birth_date: "1963-04-02", sex: "female", gender_identity: null } });
  });
  it("identidade escolhida vai no valor do contrato", () => {
    const r = validateProfile({ birthDate: "02/04/1963", sex: "male", genderIdentity: "trans_man" }, TODAY);
    expect(r).toEqual({ ok: true, value: { birth_date: "1963-04-02", sex: "male", gender_identity: "trans_man" } });
  });
  it("vazio aponta os dois campos", () => {
    expect(validateProfile({ birthDate: "", sex: null, genderIdentity: null }, TODAY))
      .toEqual({ ok: false, errors: { birthDate: BIRTH_DATE_INVALID, sex: SEX_REQUIRED } });
  });
  it("data incompleta ou que não existe é inválida", () => {
    for (const d of [ "02/04/19", "31/02/2000" ]) {
      expect(validateProfile({ birthDate: d, sex: "female", genderIdentity: null }, TODAY))
        .toEqual({ ok: false, errors: { birthDate: BIRTH_DATE_INVALID } });
    }
  });
  it("nascido hoje passa; amanhã é futuro", () => {
    expect(validateProfile({ birthDate: "05/10/2026", sex: "female", genderIdentity: null }, TODAY).ok).toBe(true);
    expect(validateProfile({ birthDate: "06/10/2026", sex: "female", genderIdentity: null }, TODAY))
      .toEqual({ ok: false, errors: { birthDate: BIRTH_DATE_FUTURE } });
  });
  it("130 anos é o teto; 131 é recusado", () => {
    expect(validateProfile({ birthDate: "05/10/1896", sex: "female", genderIdentity: null }, TODAY).ok).toBe(true);
    expect(validateProfile({ birthDate: "06/10/1895", sex: "female", genderIdentity: null }, TODAY).ok).toBe(true);
    expect(validateProfile({ birthDate: "05/10/1895", sex: "female", genderIdentity: null }, TODAY))
      .toEqual({ ok: false, errors: { birthDate: BIRTH_DATE_TOO_OLD } });
  });
});
