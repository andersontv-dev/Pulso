#!/usr/bin/env node
/**
 * Diagnóstico de la API de form30x.
 *
 * Comprueba las tres limitaciones que hoy condicionan a Pulso y dice si
 * siguen ahí. Existe para que verificar el estado de la API sea un comando y
 * no una sesión de curl a mano:
 *
 *   npm run diagnostico
 *
 * Cuando el equipo de form30x diga que arregló la paginación, esto lo
 * confirma en diez segundos.
 */

const BASE = (process.env.FORM30X_API_URL ?? 'https://form.oracle30x.co').replace(/\/+$/, '');
const KEY = process.env.FORM30X_API_KEY;
const LIMITE_SPEC = 200;

const c = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  mal: (t) => `\x1b[31m${t}\x1b[0m`,
  avis: (t) => `\x1b[33m${t}\x1b[0m`,
  tenue: (t) => `\x1b[90m${t}\x1b[0m`,
  fuerte: (t) => `\x1b[1m${t}\x1b[0m`,
};

if (!KEY) {
  console.error(
    c.mal('Falta FORM30X_API_KEY.') +
      '\nEjecuta:  node --env-file=.env.local scripts/diagnostico.mjs' +
      '\n(o `npm run diagnostico`, que ya lo hace)',
  );
  process.exit(1);
}

async function pedir(ruta) {
  const url = `${BASE}/api/v1${ruta}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status} en ${ruta}`);
  return { cuerpo: await r.json(), cabeceras: r.headers };
}

const hallazgos = [];
const registrar = (estado, titulo, detalle) => {
  const marca = { ok: c.ok('✔'), mal: c.mal('✘'), avis: c.avis('!') }[estado];
  console.log(`${marca} ${titulo}`);
  if (detalle) console.log(`  ${c.tenue(detalle)}`);
  hallazgos.push(estado);
};

console.log(`\n${c.fuerte('Diagnóstico de la API de form30x')}`);
console.log(c.tenue(`  ${BASE}/api/v1\n`));

// 1 · Conectividad y auth
let formularios;
try {
  const { cuerpo } = await pedir('/forms?limit=200&published=true');
  formularios = cuerpo.data ?? [];
  registrar('ok', 'Conexión y credenciales', `${formularios.length} formularios publicados`);
} catch (e) {
  registrar('mal', 'Conexión y credenciales', String(e.message));
  console.log(`\n${c.mal('Sin acceso a la API. Revisa FORM30X_API_KEY y sus scopes.')}\n`);
  process.exit(1);
}

// El formulario con más respuestas es el que mejor destapa el techo.
const mayor = [...formularios].sort((a, b) => (b.responses ?? 0) - (a.responses ?? 0))[0];
if (!mayor) {
  console.log(c.avis('\nNo hay formularios publicados que analizar.\n'));
  process.exit(0);
}
console.log(
  c.tenue(`\n  Formulario de prueba: "${mayor.title}" — ${mayor.responses} respuestas\n`),
);

// 2 · ¿Se puede superar el tope de 200?
const { cuerpo, cabeceras } = await pedir(`/forms/${mayor.id}/responses?limit=5000`);
const devueltas = (cuerpo.data ?? []).length;
const cursor = cabeceras.get('x-next-cursor');

if (cursor) {
  registrar('ok', 'Paginación por cursor', `X-Next-Cursor presente: ${cursor.slice(0, 24)}…`);
} else if (devueltas < LIMITE_SPEC) {
  registrar('ok', 'Paginación por cursor', 'No hace falta: cabe todo en una página');
} else {
  registrar(
    'mal',
    'Paginación por cursor — ROTA',
    `Se pidieron 5000 y llegaron ${devueltas}, sin cabecera X-Next-Cursor. ` +
      'El openapi.json la declara. Sin ella no hay forma de leer más de ' +
      `${LIMITE_SPEC} respuestas por formulario.`,
  );
}

// 3 · ¿Cuánto histórico se alcanza?
const fechas = (cuerpo.data ?? [])
  .map((r) => r.submittedAt)
  .filter(Boolean)
  .sort();
if (fechas.length > 0) {
  const dias = (Date.parse(fechas.at(-1)) - Date.parse(fechas[0])) / 86_400_000;
  const cubreTodo = devueltas < LIMITE_SPEC;
  registrar(
    cubreTodo ? 'ok' : dias >= 30 ? 'ok' : dias >= 7 ? 'avis' : 'mal',
    'Ventana de histórico alcanzable',
    cubreTodo
      ? `Completa: las ${devueltas} respuestas del formulario`
      : `${dias.toFixed(1)} días (${fechas[0].slice(0, 10)} → ${fechas.at(-1).slice(0, 10)}). ` +
          `Los presets más largos que eso saldrán incompletos.`,
  );
}

// 4 · ETag, que la documentación promete para todo GET
registrar(
  cabeceras.get('etag') ? 'ok' : 'avis',
  'Cabecera ETag',
  cabeceras.get('etag')
    ? 'Presente: permitiría revalidación condicional'
    : 'Ausente pese a que la documentación dice que todo GET la devuelve. No afecta a Pulso, que solo lee.',
);

// 5 · Filtro por fecha
const { cuerpo: filtrado } = await pedir(
  `/forms/${mayor.id}/responses?limit=200&since=2099-01-01T00:00:00Z`,
);
const honra = (filtrado.data ?? []).length === 0;
registrar(
  honra ? 'ok' : 'avis',
  'Filtro por fecha en /responses',
  honra
    ? '¡El servidor honra `since`! Pulso puede dejar de descargar el histórico entero.'
    : 'No existe: `since` se ignora. Todo rango obliga a descargar y filtrar en memoria.',
);

// Veredicto
const rotos = hallazgos.filter((h) => h === 'mal').length;
console.log();
if (rotos === 0) {
  console.log(c.ok(c.fuerte('  Todo en orden. Pulso puede leer los datos completos.')));
  console.log(c.tenue('  Si antes veías avisos de cobertura incompleta, deberían desaparecer.\n'));
} else {
  console.log(c.mal(c.fuerte(`  ${rotos} limitación(es) siguen activas.`)));
  console.log(
    c.tenue(
      '  Pulso sigue siendo exacto para "Hoy" y "Ayer", y avisa en pantalla\n' +
        '  de los rangos donde los totales están por debajo del real.\n',
    ),
  );
}
process.exit(0);
