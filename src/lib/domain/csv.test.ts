import { describe, expect, it } from 'vitest';
import { generarCsv, generarCsvRegistros, nombreArchivoCsv } from './csv';
import type { SeriePrograma } from './types';

const serie = (nombre: string, valores: number[]): SeriePrograma => ({
  programaId: nombre,
  programaNombre: nombre,
  rama: 'Ventas',
  total: valores.reduce((a, b) => a + b, 0),
  dias: valores.map((agendas, i) => ({
    fecha: `2026-03-0${i + 1}`,
    agendas,
  })),
});

const DIAS = ['2026-03-01', '2026-03-02'];

describe('generarCsv', () => {
  it('emite formato largo, una fila por día y programa', () => {
    const csv = generarCsv({
      series: [serie('AI Sales', [2, 0])],
      dias: DIAS,
      timezone: 'America/Bogota',
    });
    const lineas = csv.replace('﻿', '').trim().split('\r\n');

    expect(lineas[0]).toBe('fecha (America/Bogota),programa,rama,agendas');
    expect(lineas[1]).toBe('2026-03-01,AI Sales,Ventas,2');
    expect(lineas[2]).toBe('2026-03-02,AI Sales,Ventas,0');
  });

  it('declara el huso en la cabecera, sin romper el formato CSV', () => {
    // El huso va en el nombre de la columna y no en una línea de comentario,
    // que dejaría de ser CSV válido para cualquier parser.
    const csv = generarCsv({ series: [], dias: [], timezone: 'Europe/Madrid' });
    expect(csv).toContain('fecha (Europe/Madrid)');
  });

  it('empieza con BOM para que Excel no destroce los acentos', () => {
    const csv = generarCsv({
      series: [serie('Inmersión Ejecutiva', [1])],
      dias: ['2026-03-01'],
      timezone: 'America/Bogota',
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Inmersión Ejecutiva');
  });

  it('escapa comas, comillas y saltos de línea', () => {
    const csv = generarCsv({
      series: [serie('Ventas, "B2B"', [1])],
      dias: ['2026-03-01'],
      timezone: 'UTC',
    });
    expect(csv).toContain('"Ventas, ""B2B"""');
  });

  it('neutraliza las fórmulas para no ejecutarlas al abrir el archivo', () => {
    // Los nombres de formulario los edita cualquiera en form30x: sin este
    // saneado, el CSV sería un vector de inyección en Excel.
    const csv = generarCsv({
      series: [serie('=HYPERLINK("http://malo","clic")', [1])],
      dias: ['2026-03-01'],
      timezone: 'UTC',
    });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});

describe('nombreArchivoCsv', () => {
  it('lleva el rango dentro para que no se pisen las descargas', () => {
    expect(nombreArchivoCsv('2026-03-01', '2026-03-01')).toBe('pulso-agendas-2026-03-01.csv');
    expect(nombreArchivoCsv('2026-03-01', '2026-03-10')).toBe(
      'pulso-agendas-2026-03-01_a_2026-03-10.csv',
    );
    expect(nombreArchivoCsv('2026-03-01', '2026-03-10', 'registros')).toBe(
      'pulso-registros-2026-03-01_a_2026-03-10.csv',
    );
  });
});

describe('generarCsvRegistros', () => {
  const base = {
    id: 'r1',
    formId: 'f1',
    formTitle: 'AI Sales | Registro | 30X',
    programaId: 'ai-sales',
    programaNombre: 'AI Sales',
    submittedAt: '2026-09-01T14:35:00.000Z',
    dia: '2026-09-01',
    estado: 'completada' as const,
    agendada: true,
    llegoACalendly: true,
    email: 'ana@ejemplo.com',
    nombre: 'Ana Ruiz',
    telefono: '+57300',
    empresa: 'Acme',
    canal: 'pauta',
    fuente: 'google',
    campana: 'aix-sept',
    utm: { utm_source: 'google', utm_medium: 'cpc' },
    respuestas: [{ pregunta: '¿Cuál es tu cargo?', valor: 'CTO' }],
    score: 14,
    tags: ['qualified'],
  };

  it('lleva una columna por cada pregunta distinta', () => {
    // Es lo que hace que el archivo sea "completo": las respuestas literales,
    // no solo los agregados.
    const csv = generarCsvRegistros(
      [base, { ...base, id: 'r2', respuestas: [{ pregunta: '¿Presupuesto?', valor: 'USD 2k' }] }],
      'America/Bogota',
    );
    const [cabecera, fila1, fila2] = csv.replace('﻿', '').trim().split('\r\n');

    expect(cabecera).toContain('¿Cuál es tu cargo?');
    expect(cabecera).toContain('¿Presupuesto?');
    expect(fila1).toContain('CTO');
    expect(fila2).toContain('USD 2k');
  });

  it('incluye embudo, contacto y atribución', () => {
    const csv = generarCsvRegistros([base], 'America/Bogota');
    const fila = csv.split('\r\n')[1];
    for (const esperado of [
      '2026-09-01',
      '14:35',
      'AI Sales',
      'completada',
      'ana@ejemplo.com',
      'pauta',
      'google',
      'aix-sept',
      'qualified',
    ]) {
      expect(fila).toContain(esperado);
    }
  });

  it('declara el huso en la cabecera de fecha', () => {
    expect(generarCsvRegistros([], 'Europe/Madrid')).toContain('fecha (Europe/Madrid)');
  });

  it('sigue neutralizando las fórmulas', () => {
    const csv = generarCsvRegistros([{ ...base, nombre: '=cmd|x' }], 'UTC');
    expect(csv).toContain("'=cmd|x");
  });
});
