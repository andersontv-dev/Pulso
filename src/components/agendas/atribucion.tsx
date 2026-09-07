'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CorteEmbudo } from '@/lib/contracts/agendas';
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

export function Atribucion({
  porCanal,
  porFuente,
  porCampana,
}: {
  porCanal: CorteEmbudo[];
  porFuente: CorteEmbudo[];
  porCampana: CorteEmbudo[];
}) {
  return (
    <div className="space-y-4">
      <TablaCorte
        titulo="Canal"
        descripcion="De dónde vino cada registro, deducido de las UTM y los parámetros de campaña."
        cortes={porCanal}
        conAyuda
      />
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
