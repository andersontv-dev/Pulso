import { NextResponse } from 'next/server';
import { precargar } from '@/lib/server/precarga';

/**
 * Precarga invocada por Cloud Scheduler cada PULSO_PRECARGA_CADA_MIN.
 *
 * Sin autenticación propia a propósito: Pulso solo es alcanzable a través
 * del load balancer con IAP (ingress internal-and-cloud-load-balancing), y
 * el job de Scheduler entra con un token OIDC de la cuenta de servicio
 * bold-cron, igual que los crons de Bold. Lo peor que puede hacer quien
 * llegue hasta aquí es refrescar el caché antes de tiempo.
 */
async function manejar() {
  const resumen = await precargar('cron');
  return NextResponse.json(resumen, {
    status: resumen.ok ? 200 : 502,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = manejar;
export const POST = manejar;
