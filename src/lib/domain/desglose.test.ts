import { describe, expect, it } from 'vitest';
import { agendasPorDiaYCanal, agendasPorPais, totalesPorCanal } from './desglose';
import type { Registro } from './types';

const reg = (p: Partial<Registro>): Registro =>
  ({
    id: Math.random().toString(36),
    dia: '2026-10-01',
    canal: 'pauta',
    agendada: true,
    ciudad: null,
    pais: null,
    ...p,
  }) as Registro;

describe('desglose por canal', () => {
  it('parte cada día en pauta/orgánico/directo/otros e incluye días vacíos', () => {
    const registros = [
      reg({ canal: 'pauta' }),
      reg({ canal: 'organico' }),
      reg({ canal: 'directo' }),
      reg({ canal: 'referido' }),
      reg({ canal: 'sin-etiquetar' }),
      reg({ canal: 'pauta', agendada: false }),
    ];
    expect(agendasPorDiaYCanal(registros, ['2026-10-01', '2026-10-02'])).toEqual([
      { dia: '2026-10-01', pauta: 1, organico: 1, directo: 1, otros: 2, total: 5 },
      { dia: '2026-10-02', pauta: 0, organico: 0, directo: 0, otros: 0, total: 0 },
    ]);
    expect(totalesPorCanal(registros)).toEqual({ pauta: 1, organico: 1, directo: 1, otros: 2 });
  });
});

describe('desglose por país', () => {
  it('orden fijo por país (no por tamaño), con ciudades y "Otros" al final', () => {
    const registros = [
      reg({ pais: 'Estados Unidos', ciudad: 'Miami' }),
      reg({ pais: 'Colombia', ciudad: 'Bogotá' }),
      reg({ pais: 'Colombia', ciudad: 'Bogotá' }),
      reg({ pais: 'Colombia', ciudad: 'Medellín' }),
      reg({ pais: 'Perú', ciudad: 'Lima' }),
      reg({}),
      reg({ pais: 'Venezuela', ciudad: 'Caracas', agendada: false }),
    ];
    expect(agendasPorPais(registros)).toEqual([
      {
        pais: 'Colombia',
        cantidad: 3,
        detalle: [
          { nombre: 'Bogotá', cantidad: 2 },
          { nombre: 'Medellín', cantidad: 1 },
        ],
      },
      { pais: 'Estados Unidos', cantidad: 1, detalle: [{ nombre: 'Miami', cantidad: 1 }] },
      {
        pais: 'Otros / sin dato',
        cantidad: 2,
        detalle: [
          { nombre: 'Perú', cantidad: 1 },
          { nombre: 'Sin ciudad', cantidad: 1 },
        ],
      },
    ]);
  });
});
