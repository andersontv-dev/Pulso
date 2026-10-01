'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CorteContenido, CorteEmbudo, FuentePagoOrganico } from '@/lib/contracts/agendas';
import { DESCRIPCIONES_CANAL, type Canal } from '@/lib/domain/canal';
import { formatearDecimal, formatearEntero } from '@/lib/formato';

function TablaCorte({
  titulo,
  descripcion,
  cortes,
  conAyuda = false,
}: {
  titulo: string;
  descripcion: string;
  cortes: CorteEmbudo[];
  conAyuda?: boolean;
}) {
  const maximo = Math.max(...cortes.map((c) => c.iniciadas), 1);

  return (
    // `min-w-0` es imprescindible: un elemento de grid no encoge por debajo de
    // su contenido a menos que se le diga. Sin esto, la tabla de dentro
    // (min-w-[34rem]) estira la tarjeta y hace que la PÁGINA se desplace de
    // lado en móvil, en vez de desplazarse solo la tabla.
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="rule-accent">{titulo}</CardTitle>
        <p className="text-muted-foreground text-xs">{descripcion}</p>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-4 sm:pt-0 sm:pb-4">
        {cortes.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Sin datos en este periodo.</p>
        ) : (
          // El scroll horizontal vive dentro de la tarjeta: el cuerpo de la
          // página nunca se desplaza de lado.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pl-4 text-xs font-medium sm:pl-0"
                  >
                    {titulo}
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
                  >
                    Iniciaron
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
                  >
                    Completaron
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
                  >
                    Agendaron
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-4 text-right text-xs font-medium sm:pr-0"
                  >
                    Conversión
                  </th>
                </tr>
              </thead>
              <tbody>
                {cortes.map((c) => {
                  const conversion = c.iniciadas === 0 ? null : (c.agendadas / c.iniciadas) * 100;
                  return (
                    <tr key={c.clave} className="border-border/60 border-b last:border-0">
                      <th scope="row" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                        {c.etiqueta}
                        {conAyuda ? (
                          <span className="text-muted-foreground block text-xs font-normal">
                            {DESCRIPCIONES_CANAL[c.clave as Canal] ?? ''}
                          </span>
                        ) : null}
                        {/* Barra de volumen: la proporción se ve sin leer cifras */}
                        <span
                          aria-hidden
                          className="bg-chart-mark mt-1 block h-1 rounded"
                          style={{ width: `${Math.max((c.iniciadas / maximo) * 100, 2)}%` }}
                        />
                      </th>
                      <td className="tabular py-2 pr-3 text-right">
                        {formatearEntero(c.iniciadas)}
                      </td>
                      <td className="tabular text-muted-foreground py-2 pr-3 text-right">
                        {formatearEntero(c.completadas)}
                      </td>
                      <td className="tabular py-2 pr-3 text-right font-semibold">
                        {formatearEntero(c.agendadas)}
                      </td>
                      <td className="tabular py-2 pr-4 text-right sm:pr-0">
                        {conversion === null ? '—' : `${formatearDecimal(conversion)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TablaFuentePagoOrganico({ cortes }: { cortes: FuentePagoOrganico[] }) {
  const maximo = Math.max(...cortes.map((c) => c.total), 1);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="rule-accent">Fuente · pagado vs orgánico</CardTitle>
        <p className="text-muted-foreground text-xs">
          Agendas de cada fuente (Substack, LinkedIn, Facebook, Instagram, entre otras), separando
          cuánto vino de pauta pagada y cuánto llegó de forma orgánica.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-4 sm:pt-0 sm:pb-4">
        {cortes.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Sin agendas en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <caption className="sr-only">
                Agendas por fuente, separadas en pagado y orgánico.
              </caption>
              <thead>
                <tr className="border-border border-b text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pl-4 text-xs font-medium sm:pl-0"
                  >
                    Fuente
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
                  >
                    Pagado
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium"
                  >
                    Orgánico
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-4 text-right text-xs font-medium sm:pr-0"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {cortes.map((c) => (
                  <tr key={c.fuente} className="border-border/60 border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                      {c.fuente}
                      {/* Barra apilada pagado/orgánico: la proporción se ve sin leer cifras. */}
                      <span aria-hidden className="mt-1 flex h-1.5 gap-0.5">
                        <span
                          className="bg-accent shrink-0 rounded-l"
                          style={{
                            width: `${Math.max((c.pagado / maximo) * 100, c.pagado > 0 ? 1.5 : 0)}%`,
                          }}
                        />
                        <span
                          className="bg-chart-mark shrink-0 rounded-r"
                          style={{
                            width: `${Math.max((c.organico / maximo) * 100, c.organico > 0 ? 1.5 : 0)}%`,
                          }}
                        />
                      </span>
                    </th>
                    <td className="tabular py-2 pr-3 text-right font-semibold">
                      {formatearEntero(c.pagado)}
                    </td>
                    <td className="tabular text-muted-foreground py-2 pr-3 text-right">
                      {formatearEntero(c.organico)}
                    </td>
                    <td className="tabular py-2 pr-4 text-right font-semibold sm:pr-0">
                      {formatearEntero(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TablaContenido({
  titulo,
  descripcion,
  columna,
  cortes,
}: {
  titulo: string;
  descripcion: string;
  columna: string;
  cortes: CorteContenido[];
}) {
  const maximo = Math.max(...cortes.map((c) => c.agendadas), 1);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="rule-accent">{titulo}</CardTitle>
        <p className="text-muted-foreground text-xs">{descripcion}</p>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-4 sm:pt-0 sm:pb-4">
        {cortes.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Sin agendas en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <caption className="sr-only">{descripcion}</caption>
              <thead>
                <tr className="border-border border-b text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pl-4 text-xs font-medium sm:pl-0"
                  >
                    {columna}
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground py-2 pr-4 text-right text-xs font-medium sm:pr-0"
                  >
                    Agendas
                  </th>
                </tr>
              </thead>
              <tbody>
                {cortes.map((c) => (
                  <tr key={c.contenido} className="border-border/60 border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                      {c.contenido}
                      {/* Barra de volumen: la proporción se ve sin leer cifras */}
                      <span
                        aria-hidden
                        className="bg-chart-mark mt-1 block h-1 rounded"
                        style={{ width: `${Math.max((c.agendadas / maximo) * 100, 2)}%` }}
                      />
                    </th>
                    <td className="tabular py-2 pr-4 text-right font-semibold sm:pr-0">
                      {formatearEntero(c.agendadas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Atribucion({
  porCanal,
  porFuente,
  porCampana,
  porFuentePagoOrganico,
  porPostOrganico,
  porVideoPagado,
  porCiudad,
  porEdicion,
}: {
  porCanal: CorteEmbudo[];
  porFuente: CorteEmbudo[];
  porCampana: CorteEmbudo[];
  porFuentePagoOrganico: FuentePagoOrganico[];
  porPostOrganico: CorteContenido[];
  porVideoPagado: CorteContenido[];
  porCiudad: CorteContenido[];
  porEdicion: CorteContenido[];
}) {
  return (
    <div className="space-y-4">
      <TablaCorte
        titulo="Canal"
        descripcion="De dónde vino cada registro, deducido de las UTM y los parámetros de campaña."
        cortes={porCanal}
        conAyuda
      />
      <TablaFuentePagoOrganico cortes={porFuentePagoOrganico} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaContenido
          titulo="Post orgánico"
          descripcion="De las agendas orgánicas, qué post concreto (utm_content) las generó."
          columna="Post"
          cortes={porPostOrganico}
        />
        <TablaContenido
          titulo="Video pagado"
          descripcion="De las agendas de pauta, qué video o creativo concreto las generó."
          columna="Video"
          cortes={porVideoPagado}
        />
      </div>
      {/* Solo aparecen si algún formulario del rango pregunta ciudad/edición
          (eventos presenciales, p.ej. Inmersivo): para el resto no hay nada
          que mostrar, y una tarjeta vacía sería ruido, no información. */}
      {porCiudad.length > 0 || porEdicion.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {porCiudad.length > 0 ? (
            <TablaContenido
              titulo="Agendas por ciudad"
              descripcion="Solo entre los formularios que preguntan ciudad o edición (eventos presenciales)."
              columna="Ciudad"
              cortes={porCiudad}
            />
          ) : null}
          {porEdicion.length > 0 ? (
            <TablaContenido
              titulo="Agendas por edición"
              descripcion="La sesión concreta elegida, con fecha — más fino que ciudad."
              columna="Edición"
              cortes={porEdicion}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaCorte
          titulo="Fuente"
          descripcion="utm_source, o el origen deducido cuando no viene etiquetado."
          cortes={porFuente}
        />
        <TablaCorte titulo="Campaña" descripcion="utm_campaign." cortes={porCampana} />
      </div>
    </div>
  );
}
