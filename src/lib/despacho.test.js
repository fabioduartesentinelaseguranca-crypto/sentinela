import { describe, it, expect } from "vitest";
import { filtrarAgentesPorRaio } from "./geo";

/**
 * Teste de integração — seleção de destinatários de push por raio.
 * Simula o fluxo de despacho (criarOcorrenciaDespachar):
 *   1) agentes em campo disponíveis;
 *   2) filtro Haversine <= 2km;
 *   3) coleta dos tokens FCM (sendMulticast) apenas dos agentes no raio.
 *
 * Origem: Prefeitura de SBC (Paço Municipal).
 */
describe("despacho de push — seleção de agentes por raio (SBC)", () => {
  const prefeitura = { lat: -23.6931, lng: -46.5498 };

  const agentes = [
    // Agente 1: ~300m ao norte da prefeitura
    { id: "1", nome: "Agente Perto", lat: -23.6904, lng: -46.5498, push_token: "token_agente_perto" },
    // Agente 2: ~800m ao norte da prefeitura
    { id: "2", nome: "Agente Médio", lat: -23.6859, lng: -46.5498, push_token: "token_agente_medio" },
    // Agente 3: ~5km ao sul da prefeitura
    { id: "3", nome: "Agente Longe", lat: -23.7381, lng: -46.5498, push_token: "token_agente_longe" },
  ];

  it("inclui apenas os agentes dentro de 2km (perto + médio) e ordena do mais próximo", () => {
    const no_raio = filtrarAgentesPorRaio(prefeitura, agentes, 2000);
    const tokens = no_raio.map((a) => a.push_token);

    expect(tokens).toEqual(["token_agente_perto", "token_agente_medio"]);
    expect(tokens).not.toContain("token_agente_longe");
  });

  it("o agente a 5km fica estritamente fora do raio", () => {
    const no_raio = filtrarAgentesPorRaio(prefeitura, agentes, 2000);
    expect(no_raio.find((a) => a.id === "3")).toBeUndefined();
  });

  it("sendMulticast receberia exatamente 2 tokens", () => {
    const no_raio = filtrarAgentesPorRaio(prefeitura, agentes, 2000);
    expect(no_raio).toHaveLength(2);
    expect(no_raio.map((a) => a.push_token)).toHaveLength(2);
  });
});