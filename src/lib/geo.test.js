import { describe, it, expect } from "vitest";
import { filtrarAgentesPorRaio, distanceKm } from "./geo";

/**
 * Testes unitários — filtrarAgentesPorRaio
 * Coordenadas reais de São Bernardo do Campo - SP.
 */
describe("filtrarAgentesPorRaio — São Bernardo do Campo", () => {
  // Paço Municipal de SBC — centro da ocorrência
  const pacoMunicipal = { lat: -23.6931, lng: -46.5498 };

  // Agente A — Terminal Rodoviário (muito próximo, ~290m)
  const agenteA = { id: "A", nome: "Agente A", lat: -23.6915, lng: -46.5475 };

  // Agente B — São Bernardo Plaza Shopping (longe, ~2,4km)
  const agenteB = { id: "B", nome: "Agente B", lat: -23.7145, lng: -46.5442 };

  it("inclui apenas agentes estritamente dentro do raio de 1km", () => {
    const r = filtrarAgentesPorRaio(pacoMunicipal, [agenteA, agenteB], 1000);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("A");
  });

  it("exclui o Agente B (fora do raio de 2km) do envio de push", () => {
    const r = filtrarAgentesPorRaio(pacoMunicipal, [agenteA, agenteB], 2000);
    const ids = r.map((a) => a.id);
    expect(ids).not.toContain("B");
  });

  it("ordena os agentes do mais próximo para o mais distante", () => {
    // Agente C ainda mais perto que A (~120m)
    const agenteC = { id: "C", nome: "Agente C", lat: -23.692, lng: -46.549 };
    const r = filtrarAgentesPorRaio(pacoMunicipal, [agenteA, agenteC, agenteB], 1000);
    expect(r.map((a) => a.id)).toEqual(["C", "A"]);
  });

  it("respeita o raio de forma estrita (limite exato exclui)", () => {
    const distA_m = distanceKm(pacoMunicipal, agenteA) * 1000;
    const r = filtrarAgentesPorRaio(pacoMunicipal, [agenteA], distA_m - 1);
    expect(r).toHaveLength(0);
  });

  it("retorna array vazio para entradas inválidas", () => {
    expect(filtrarAgentesPorRaio(null, [agenteA], 1000)).toEqual([]);
    expect(filtrarAgentesPorRaio(pacoMunicipal, null, 1000)).toEqual([]);
    expect(filtrarAgentesPorRaio(pacoMunicipal, [agenteA], NaN)).toEqual([]);
  });
});