import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/config/env';
import { vaciarCache } from './cache';

const api = vi.hoisted(() => ({
  dentroDeVentana: vi.fn(() => true),
  obtenerFormularios: vi.fn(),
  obtenerCamposCalendly: vi.fn(),
  obtenerRespuestas: vi.fn(),
}));
vi.mock('@/lib/api', () => api);

const { calcularAgendas } = await import('./agendas');

const vacio = {
  respuestas: [],
  paginas: 1,
  truncado: false,
  descartadas: 0,
  descargadas: 0,
  masAntigua: null,
  topeAlcanzado: false,
};

describe('calcularAgendas con forzar', () => {
  const rango = { desde: '2026-10-05', hasta: '2026-10-11' };

  beforeEach(() => {
    process.env.FORM30X_API_KEY = 'test-key';
    process.env.FORM30X_API_URL = 'https://form.test';
    resetEnvCache();
    api.obtenerFormularios.mockResolvedValue([
      { id: 'inm', title: '30X | Inmersivo Presencial', responses: 10 },
      { id: 'mul', title: '30X | Multipliers', responses: 10 },
    ]);
    api.obtenerCamposCalendly.mockResolvedValue(['booking']);
    api.obtenerRespuestas.mockResolvedValue(vacio);
  });

  afterEach(() => {
    vaciarCache();
    vi.clearAllMocks();
    delete process.env.FORM30X_API_KEY;
    delete process.env.FORM30X_API_URL;
    resetEnvCache();
  });

  it('con un programa filtrado solo vuelve a descargar las respuestas de sus formularios', async () => {
    await calcularAgendas({ rango, programas: [] });
    vi.clearAllMocks();

    await calcularAgendas({ rango, programas: ['inmersivo-presencial'], forzar: true });

    expect(api.obtenerRespuestas).toHaveBeenCalledTimes(1);
    expect(api.obtenerRespuestas).toHaveBeenCalledWith('inm');
    // La estructura no se fuerza: sigue en caché.
    expect(api.obtenerCamposCalendly).not.toHaveBeenCalled();
  });
});
