import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/config/env';
import { vaciarCache } from './cache';
import { excluir, reiniciarExclusiones } from './exclusiones';

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
    reiniciarExclusiones();
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

describe('calcularAgendas con registros eliminados', () => {
  const rango = { desde: '2026-10-05', hasta: '2026-10-11' };
  const respuesta = (id: string, email: string) => ({
    responseId: id,
    submittedAt: '2026-10-08T15:00:00Z',
    answers: [{ fieldRef: 'e', type: 'email', question: 'Correo', value: email }],
  });

  beforeEach(() => {
    process.env.FORM30X_API_KEY = 'test-key';
    process.env.FORM30X_API_URL = 'https://form.test';
    resetEnvCache();
    api.obtenerFormularios.mockResolvedValue([
      { id: 'inm', title: '30X | Inmersivo Presencial', responses: 2 },
    ]);
    api.obtenerCamposCalendly.mockResolvedValue(['booking']);
    api.obtenerRespuestas.mockResolvedValue({
      ...vacio,
      respuestas: [respuesta('r1', 'real@cliente.com'), respuesta('r2', 'prueba@gmail.com')],
      descargadas: 2,
    });
  });

  afterEach(() => {
    vaciarCache();
    reiniciarExclusiones();
    vi.clearAllMocks();
    delete process.env.FORM30X_API_KEY;
    delete process.env.FORM30X_API_URL;
    resetEnvCache();
  });

  it('no cuenta lo eliminado, lo avisa, y lo vuelve a contar al restaurar sin re-descargar', async () => {
    const antes = await calcularAgendas({ rango, programas: [] });
    expect(antes.registros.map((r) => r.id).sort()).toEqual(['r1', 'r2']);

    await excluir(
      {
        id: 'r2',
        formId: 'inm',
        programaNombre: 'Inmersivo Presencial',
        email: 'prueba@gmail.com',
        nombre: null,
        submittedAt: '2026-10-08T15:00:00Z',
        agendada: false,
      },
      'yo@30x.com',
    );

    const despues = await calcularAgendas({ rango, programas: [] });
    expect(despues.registros.map((r) => r.id)).toEqual(['r1']);
    expect(despues.avisos).toContainEqual(
      expect.objectContaining({ tipo: 'eliminadas', cantidad: 1 }),
    );
    // El filtro se aplica sobre lo cacheado: eliminar no vuelve a pedir a form30x.
    expect(api.obtenerRespuestas).toHaveBeenCalledTimes(1);
  });
});
