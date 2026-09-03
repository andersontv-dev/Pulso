import { describe, expect, it } from 'vitest';
import {
  diaDeNegocio,
  diasDelRango,
  diferenciaDias,
  esClaveValida,
  hoyEnTz,
  incluyeHoy,
  limitesInstantaneos,
  longitudRango,
  ordenarRango,
  rangoAnterior,
  rangoDePreset,
  sumarDias,
} from './rangos';

const BOGOTA = 'America/Bogota';
// 2026-03-11T03:30Z son las 22:30 del día 10 en Bogotá: el caso que rompe
// cualquier implementación que corte el ISO por los diez primeros caracteres.
const MADRUGADA_UTC = new Date('2026-03-11T03:30:00.000Z');

describe('diaDeNegocio', () => {
  it('agrupa según el huso de negocio, no según UTC', () => {
    expect(diaDeNegocio('2026-03-11T03:30:00.000Z', BOGOTA)).toBe('2026-03-10');
    expect(diaDeNegocio('2026-03-11T03:30:00.000Z', 'UTC')).toBe('2026-03-11');
    expect(diaDeNegocio('2026-03-11T03:30:00.000Z', 'Asia/Tokyo')).toBe('2026-03-11');
  });

  it('rechaza una fecha inválida en vez de devolver basura', () => {
    expect(() => diaDeNegocio('no-es-una-fecha', BOGOTA)).toThrow(RangeError);
  });
});

describe('aritmética de días', () => {
  it('suma y resta cruzando meses y años', () => {
    expect(sumarDias('2026-03-04', -7)).toBe('2026-02-25');
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('cruza un cambio de horario de verano sin perder el día', () => {
    // 2026-03-08 es el inicio del horario de verano en EE. UU. El anclaje a
    // mediodía UTC hace que la aritmética no dependa del huso.
    expect(sumarDias('2026-03-07', 1)).toBe('2026-03-08');
    expect(sumarDias('2026-03-08', 1)).toBe('2026-03-09');
    expect(diferenciaDias('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('valida el formato de clave', () => {
    expect(esClaveValida('2026-03-10')).toBe(true);
    expect(esClaveValida('2026-02-30')).toBe(false);
    expect(esClaveValida('10/03/2026')).toBe(false);
  });
});

describe('rangoDePreset', () => {
  it('calcula los presets en el huso de negocio', () => {
    expect(rangoDePreset('hoy', BOGOTA, MADRUGADA_UTC)).toEqual({
      desde: '2026-03-10',
      hasta: '2026-03-10',
    });
    expect(rangoDePreset('ayer', BOGOTA, MADRUGADA_UTC)).toEqual({
      desde: '2026-03-09',
      hasta: '2026-03-09',
    });
    // "Últimos 7 días" incluye hoy, que es lo que la gente espera.
    expect(rangoDePreset('ultimos7', BOGOTA, MADRUGADA_UTC)).toEqual({
      desde: '2026-03-04',
      hasta: '2026-03-10',
    });
    expect(rangoDePreset('ultimos30', BOGOTA, MADRUGADA_UTC)).toEqual({
      desde: '2026-02-09',
      hasta: '2026-03-10',
    });
    expect(rangoDePreset('mesActual', BOGOTA, MADRUGADA_UTC)).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-10',
    });
  });

  it('el mismo instante da un preset distinto en otro huso', () => {
    expect(hoyEnTz(BOGOTA, MADRUGADA_UTC)).toBe('2026-03-10');
    expect(hoyEnTz('UTC', MADRUGADA_UTC)).toBe('2026-03-11');
  });
});

describe('rangoAnterior', () => {
  it('devuelve una ventana de la misma longitud, inmediatamente anterior', () => {
    expect(rangoAnterior({ desde: '2026-03-04', hasta: '2026-03-10' })).toEqual({
      desde: '2026-02-25',
      hasta: '2026-03-03',
    });
  });

  it('funciona con un rango de un solo día', () => {
    expect(rangoAnterior({ desde: '2026-03-10', hasta: '2026-03-10' })).toEqual({
      desde: '2026-03-09',
      hasta: '2026-03-09',
    });
  });

  it('no deja huecos ni solapes con el rango original', () => {
    const rango = { desde: '2026-03-04', hasta: '2026-03-10' };
    const previo = rangoAnterior(rango);
    expect(longitudRango(previo)).toBe(longitudRango(rango));
    expect(sumarDias(previo.hasta, 1)).toBe(rango.desde);
  });
});

describe('diasDelRango', () => {
  it('enumera todos los días, extremos incluidos', () => {
    expect(diasDelRango({ desde: '2026-03-08', hasta: '2026-03-11' })).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ]);
  });

  it('un rango de un día devuelve ese día', () => {
    expect(diasDelRango({ desde: '2026-03-10', hasta: '2026-03-10' })).toEqual(['2026-03-10']);
  });

  it('un rango invertido devuelve vacío, y ordenarRango lo arregla', () => {
    expect(diasDelRango({ desde: '2026-03-11', hasta: '2026-03-08' })).toEqual([]);
    expect(ordenarRango({ desde: '2026-03-11', hasta: '2026-03-08' })).toEqual({
      desde: '2026-03-08',
      hasta: '2026-03-11',
    });
  });
});

describe('incluyeHoy', () => {
  it('distingue un rango vivo de uno histórico', () => {
    // De esto depende que el auto-refresco se active o no (ADR 0001).
    expect(incluyeHoy({ desde: '2026-03-04', hasta: '2026-03-10' }, BOGOTA, MADRUGADA_UTC)).toBe(
      true,
    );
    expect(incluyeHoy({ desde: '2026-02-01', hasta: '2026-02-28' }, BOGOTA, MADRUGADA_UTC)).toBe(
      false,
    );
  });
});

describe('limitesInstantaneos', () => {
  it('abarca el día completo en el huso de negocio', () => {
    const { desde, hasta } = limitesInstantaneos(
      { desde: '2026-03-10', hasta: '2026-03-10' },
      BOGOTA,
    );
    // Bogotá es UTC-5: el día empieza a las 05:00Z y termina a las 05:00Z del
    // día siguiente.
    expect(new Date(desde).toISOString()).toBe('2026-03-10T05:00:00.000Z');
    expect(new Date(hasta).toISOString()).toBe('2026-03-11T05:00:00.000Z');
  });

  it('el límite superior es exclusivo, sin perder el final del último día', () => {
    const { desde, hasta } = limitesInstantaneos(
      { desde: '2026-03-10', hasta: '2026-03-10' },
      BOGOTA,
    );
    const ultimoInstante = new Date('2026-03-11T04:59:59.999Z').getTime();
    expect(ultimoInstante).toBeGreaterThanOrEqual(desde);
    expect(ultimoInstante).toBeLessThan(hasta);
  });
});
