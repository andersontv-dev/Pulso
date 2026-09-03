import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Form30xError } from '@/lib/api';
import { getEnv } from '@/lib/config/env';
import {
  esClaveValida,
  hoyEnTz,
  ordenarRango,
  rangoDePreset,
  type RangoDias,
} from '@/lib/date/rangos';
import { calcularAgendas } from '@/lib/server/agendas';
import type { ErrorResponse } from '@/lib/contracts/agendas';

// Nota: no se exporta `dynamic`. En Next 16 dejó de ser una opción de route
// segment config, y este handler ya es dinámico por leer searchParams. La
// frescura se controla con Cache-Control: no-store y con el TTL propio de
// Pulso, no con la caché de rutas del framework.
const claveDia = z.string().refine(esClaveValida, 'Formato de fecha esperado: YYYY-MM-DD');

const consultaSchema = z.object({
  desde: claveDia.optional(),
  hasta: claveDia.optional(),
  /** Lista separada por comas. Vacío significa "todos los programas". */
  programas: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  forzar: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

// Tope de días por consulta. Sin filtro de fecha en la API, un rango enorme se
// traduce en paginar el histórico de cada formulario dos veces (el rango y el
// periodo anterior); es mejor rechazarlo con un mensaje claro que dejar la
// petición colgada varios minutos.
const MAXIMO_DIAS = 400;

export async function GET(request: NextRequest) {
  const parametros = consultaSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parametros.success) {
    return error(400, 'parametros_invalidos', parametros.error.issues[0]?.message ?? 'Inválido');
  }

  const { desde, hasta, programas, forzar } = parametros.data;

  let rango: RangoDias;
  try {
    const tz = getEnv().PULSO_TIMEZONE;
    rango =
      desde && hasta
        ? ordenarRango({ desde, hasta })
        : // Sin rango explícito, el mismo preset que abre la interfaz.
          rangoDePreset('ultimos7', tz);

    if (rango.hasta > hoyEnTz(tz)) {
      return error(400, 'rango_futuro', 'El rango no puede terminar en el futuro.');
    }
  } catch (e) {
    return error(500, 'config', e instanceof Error ? e.message : 'Configuración inválida');
  }

  const dias = Math.round(
    (Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / 86_400_000,
  );
  if (dias + 1 > MAXIMO_DIAS) {
    return error(
      400,
      'rango_demasiado_largo',
      `El rango no puede superar ${MAXIMO_DIAS} días. La API de form30x no permite filtrar por fecha, así que un rango mayor obliga a recorrer todo el histórico.`,
    );
  }

  try {
    const datos = await calcularAgendas({ rango, programas, forzar });
    return NextResponse.json(datos, {
      headers: {
        // El caché lo gobierna Pulso en servidor; que ninguna capa intermedia
        // sirva datos con una política distinta a la que anuncia la interfaz.
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof Form30xError) {
      const status = e.codigo === 'auth' ? 502 : e.codigo === 'rate_limit' ? 429 : 502;
      return error(status, e.codigo, e.mensajeUsuario);
    }
    // Un fallo de configuración (falta la API key) llega como Error normal.
    const mensaje = e instanceof Error ? e.message : 'Error inesperado';
    return error(500, 'interno', mensaje);
  }
}

function error(status: number, codigo: string, mensaje: string) {
  return NextResponse.json<ErrorResponse>({ error: { codigo, mensaje } }, { status });
}
