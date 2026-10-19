import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/lib/config/env';
import { excluir, obtenerExclusiones, reiniciarExclusiones, restaurar } from './exclusiones';

const entrada = (id: string) => ({
  id,
  formId: 'f',
  programaNombre: 'Inmersivo Presencial',
  email: `${id}@gmail.com`,
  nombre: null,
  submittedAt: '2026-10-08T15:00:00Z',
  agendada: true,
});

describe('exclusiones (almacén en memoria)', () => {
  afterEach(() => {
    reiniciarExclusiones();
    resetEnvCache();
  });

  it('elimina, guarda quién lo hizo y restaura', async () => {
    await excluir(entrada('a'), 'yo@30x.com');
    expect((await obtenerExclusiones()).a).toMatchObject({ id: 'a', eliminadoPor: 'yo@30x.com' });

    await restaurar('a');
    expect(await obtenerExclusiones()).toEqual({});
  });

  it('eliminaciones simultáneas no se pisan', async () => {
    await Promise.all(['a', 'b', 'c'].map((id) => excluir(entrada(id), null)));
    expect(Object.keys(await obtenerExclusiones()).sort()).toEqual(['a', 'b', 'c']);
  });
});
