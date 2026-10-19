import { NextResponse, type NextRequest } from 'next/server';
import type { ErrorResponse } from '@/lib/contracts/agendas';
import { exclusionEntradaSchema, type ExclusionesResponse } from '@/lib/contracts/exclusiones';
import { excluir, obtenerExclusiones, restaurar } from '@/lib/server/exclusiones';

/**
 * Registros eliminados a mano (agendas de prueba del equipo).
 *
 * GET lista, POST elimina, DELETE ?id= restaura. Sin autenticación propia:
 * como el resto de Pulso, solo es alcanzable detrás de IAP, que además nos
 * dice quién hizo el cambio (`x-goog-authenticated-user-email`).
 */
export async function GET() {
  try {
    return await listar();
  } catch (e) {
    return fallo(e);
  }
}

export async function POST(request: NextRequest) {
  // Exigir JSON obliga a un preflight CORS desde cualquier otro origen: un
  // formulario de otro sitio no puede disparar esta escritura con la cookie
  // de IAP de quien lo visite.
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return error(415, 'tipo_contenido', 'Se espera application/json.');
  }
  const cuerpo = exclusionEntradaSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) {
    return error(400, 'parametros_invalidos', cuerpo.error.issues[0]?.message ?? 'Inválido');
  }
  try {
    await excluir(cuerpo.data, quien(request));
    return await listar();
  } catch (e) {
    return fallo(e);
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return error(400, 'parametros_invalidos', 'Falta el id del registro a restaurar.');
  try {
    await restaurar(id);
    return await listar();
  } catch (e) {
    return fallo(e);
  }
}

async function listar() {
  const datos = await obtenerExclusiones();
  const exclusiones = Object.values(datos).sort((a, b) =>
    b.eliminadoEn.localeCompare(a.eliminadoEn),
  );
  return NextResponse.json<ExclusionesResponse>(
    { exclusiones },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** IAP manda "accounts.google.com:persona@30x.com". */
function quien(request: NextRequest): string | null {
  const valor = request.headers.get('x-goog-authenticated-user-email');
  return valor ? valor.replace(/^accounts\.google\.com:/, '') : null;
}

function fallo(e: unknown) {
  console.error('[pulso] error en /api/exclusiones', e);
  return error(500, 'interno', 'No se pudo guardar el cambio. Intenta de nuevo.');
}

function error(status: number, codigo: string, mensaje: string) {
  return NextResponse.json<ErrorResponse>({ error: { codigo, mensaje } }, { status });
}
