import { describe, expect, it } from 'vitest';
import {
  calcularEmbudo,
  correosRepetidos,
  cortarPorCanal,
  cortarPorCiudad,
  cortarPorFuentePagoOrganico,
  cortarPorPostOrganico,
  cortarPorPrograma,
  cortarPorVideoPagado,
} from './embudo';
import type { Registro } from './types';

function reg(p: Partial<Registro> = {}): Registro {
  return {
    id: Math.random().toString(36).slice(2),
    formId: 'f1',
    formTitle: 'AI Sales',
    programaId: 'ai-sales',
    programaNombre: 'AI Sales',
    submittedAt: '2026-09-01T12:00:00.000Z',
    dia: '2026-09-01',
    estado: 'completada',
    agendada: false,
    llegoACalendly: false,
    email: null,
    nombre: null,
    telefono: null,
    empresa: null,
    ciudad: null,
    canal: 'directo',
    fuente: 'sin fuente',
    campana: null,
    utm: {},
    respuestas: [],
    score: null,
    tags: [],
    ...p,
  };
}

describe('calcularEmbudo', () => {
  it('cuenta las cuatro etapas y sus tasas', () => {
    const e = calcularEmbudo([
      reg({ estado: 'parcial' }),
      reg({ estado: 'parcial' }),
      reg({ estado: 'completada' }),
      reg({ estado: 'completada', llegoACalendly: true }),
      reg({ estado: 'completada', llegoACalendly: true, agendada: true }),
    ]);

    expect(e.iniciadas).toBe(5);
    expect(e.completadas).toBe(3);
    expect(e.llegaronACalendly).toBe(2);
    expect(e.agendadas).toBe(1);
    expect(e.tasaCompletado).toBe(60);
    expect(e.tasaAgendaSobreCompletadas).toBeCloseTo(33.33, 1);
    expect(e.tasaGlobal).toBe(20);
  });

  it('devuelve null en las tasas cuando no hay base', () => {
    // Un 0% inventado se lee como un dato real; null se lee como "no aplica".
    const e = calcularEmbudo([]);
    expect(e.tasaCompletado).toBeNull();
    expect(e.tasaAgendaSobreCompletadas).toBeNull();
    expect(e.tasaGlobal).toBeNull();
  });

  it('no divide entre cero cuando nadie completó', () => {
    const e = calcularEmbudo([reg({ estado: 'parcial' })]);
    expect(e.tasaCompletado).toBe(0);
    expect(e.tasaAgendaSobreCompletadas).toBeNull();
  });
});

describe('cortarPor', () => {
  it('agrupa por canal y ordena por agendas', () => {
    const cortes = cortarPorCanal([
      reg({ canal: 'organico' }),
      reg({ canal: 'pauta', agendada: true }),
      reg({ canal: 'pauta', agendada: true }),
      reg({ canal: 'pauta' }),
    ]);

    expect(cortes[0]).toMatchObject({
      clave: 'pauta',
      etiqueta: 'Pauta',
      iniciadas: 3,
      agendadas: 2,
    });
    expect(cortes[1]).toMatchObject({ clave: 'organico', etiqueta: 'Orgánico', agendadas: 0 });
  });

  it('agrupa por programa', () => {
    const cortes = cortarPorPrograma([
      reg({ programaNombre: 'AI Sales', agendada: true }),
      reg({ programaNombre: 'Next' }),
    ]);
    expect(cortes.map((c) => c.clave)).toEqual(['AI Sales', 'Next']);
  });
});

describe('cortarPorFuentePagoOrganico', () => {
  it('parte las agendas de cada fuente en pagado vs orgánico', () => {
    const cortes = cortarPorFuentePagoOrganico([
      reg({ fuente: 'facebook', canal: 'pauta', agendada: true }),
      reg({ fuente: 'facebook', canal: 'pauta', agendada: true }),
      reg({ fuente: 'facebook', canal: 'organico', agendada: true }),
      reg({ fuente: 'linkedin', canal: 'organico', agendada: true }),
      reg({ fuente: 'linkedin', canal: 'referido', agendada: true }),
    ]);

    expect(cortes).toEqual([
      { fuente: 'facebook', pagado: 2, organico: 1, total: 3 },
      { fuente: 'linkedin', pagado: 0, organico: 2, total: 2 },
    ]);
  });

  it('ignora los registros que no agendaron', () => {
    const cortes = cortarPorFuentePagoOrganico([
      reg({ fuente: 'facebook', canal: 'pauta', agendada: false }),
      reg({ fuente: 'facebook', canal: 'pauta', estado: 'parcial' }),
    ]);
    expect(cortes).toEqual([]);
  });

  it('ordena de mayor a menor total, y alfabético en empate', () => {
    const cortes = cortarPorFuentePagoOrganico([
      reg({ fuente: 'zeta', canal: 'organico', agendada: true }),
      reg({ fuente: 'alfa', canal: 'organico', agendada: true }),
    ]);
    expect(cortes.map((c) => c.fuente)).toEqual(['alfa', 'zeta']);
  });
});

describe('cortarPorPostOrganico y cortarPorVideoPagado', () => {
  it('agrupa por utm_content dentro de cada canal', () => {
    const registros = [
      reg({ canal: 'organico', agendada: true, utm: { utm_content: 'post-a' } }),
      reg({ canal: 'organico', agendada: true, utm: { utm_content: 'post-a' } }),
      reg({ canal: 'organico', agendada: true, utm: { utm_content: 'post-b' } }),
      reg({ canal: 'pauta', agendada: true, utm: { utm_content: 'video-x' } }),
    ];

    expect(cortarPorPostOrganico(registros)).toEqual([
      { contenido: 'post-a', agendadas: 2 },
      { contenido: 'post-b', agendadas: 1 },
    ]);
    expect(cortarPorVideoPagado(registros)).toEqual([{ contenido: 'video-x', agendadas: 1 }]);
  });

  it('cae a ad_id cuando no hay utm_content, y a "sin identificar" cuando no hay ninguno', () => {
    const registros = [
      reg({ canal: 'pauta', agendada: true, utm: { ad_id: '12345' } }),
      reg({ canal: 'pauta', agendada: true, utm: {} }),
    ];
    expect(cortarPorVideoPagado(registros)).toEqual(
      expect.arrayContaining([
        { contenido: '12345', agendadas: 1 },
        { contenido: 'sin identificar', agendadas: 1 },
      ]),
    );
  });

  it('no cruza canales: un post orgánico no cuenta como video pagado', () => {
    const registros = [reg({ canal: 'organico', agendada: true, utm: { utm_content: 'post-a' } })];
    expect(cortarPorVideoPagado(registros)).toEqual([]);
    expect(cortarPorPostOrganico(registros)).toEqual([{ contenido: 'post-a', agendadas: 1 }]);
  });

  it('ignora los registros que no agendaron', () => {
    const registros = [reg({ canal: 'organico', agendada: false, utm: { utm_content: 'post-a' } })];
    expect(cortarPorPostOrganico(registros)).toEqual([]);
  });
});

describe('cortarPorCiudad', () => {
  it('cuenta las agendas de cada ciudad, de mayor a menor', () => {
    const registros = [
      reg({ ciudad: 'Bogotá', agendada: true }),
      reg({ ciudad: 'Bogotá', agendada: true }),
      reg({ ciudad: 'Medellín', agendada: true }),
    ];
    expect(cortarPorCiudad(registros)).toEqual([
      { contenido: 'Bogotá', agendadas: 2 },
      { contenido: 'Medellín', agendadas: 1 },
    ]);
  });

  it('descarta los registros sin ciudad en vez de agruparlos como "sin ciudad"', () => {
    const registros = [
      reg({ ciudad: null, agendada: true }),
      reg({ ciudad: 'Cali', agendada: true }),
    ];
    expect(cortarPorCiudad(registros)).toEqual([{ contenido: 'Cali', agendadas: 1 }]);
  });

  it('ignora los registros que no agendaron, aunque tengan ciudad', () => {
    const registros = [reg({ ciudad: 'Bogotá', agendada: false })];
    expect(cortarPorCiudad(registros)).toEqual([]);
  });
});

describe('correosRepetidos', () => {
  it('encuentra a la misma persona en varios programas', () => {
    // Contar dos inscripciones de la misma persona como dos leads distintos
    // infla el número sin que nadie lo note.
    const r = correosRepetidos([
      reg({ email: 'ana@x.com', programaNombre: 'AI Sales' }),
      reg({ email: 'ana@x.com', programaNombre: 'Next' }),
      reg({ email: 'ana@x.com', programaNombre: 'Next' }),
      reg({ email: 'beto@x.com' }),
    ]);

    expect(r).toEqual([{ email: 'ana@x.com', veces: 3, programas: ['AI Sales', 'Next'] }]);
  });

  it('ignora los registros sin correo', () => {
    expect(correosRepetidos([reg(), reg()])).toEqual([]);
  });
});
