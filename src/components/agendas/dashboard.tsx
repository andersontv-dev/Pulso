'use client';

import { useState } from 'react';
import { FiltroProgramas } from '@/components/filtros/filtro-programas';
import { FiltroRango } from '@/components/filtros/filtro-rango';
import { useAgendas, ErrorAgendas } from '@/hooks/use-agendas';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { Atribucion } from './atribucion';
import { Buscador } from './buscador';
import { EmbudoConversion } from './embudo';
import { Avisos, EstadoCargando, EstadoError, EstadoVacio } from './estados';
import { ExportarCsv } from './exportar-csv';
import { DesgloseInmersivo } from './desglose-inmersivo';
import { GraficaTotal } from './grafica-total';
import { IndicadorFrescura } from './indicador-frescura';
import { KpisAgendas } from './kpis';
import { TablaProgramas } from './tabla-programas';

const INMERSIVO = 'inmersivo-presencial';

export interface ConfiguracionCliente {
  timezone: string;
  intervaloMs: number;
}

export function Dashboard({ timezone, intervaloMs }: ConfiguracionCliente) {
  const { filtros, actualizar } = useFiltrosUrl(timezone);
  const [autoRefresco, setAutoRefresco] = useState(true);

  const consulta = useAgendas({
    rango: filtros.rango,
    programas: filtros.programas,
    timezone,
    intervaloMs,
    autoRefresco,
  });

  const {
    data,
    error,
    isPending,
    isFetching,
    refetch,
    rangoVivo,
    refrescoActivo,
    actualizarAhora,
    actualizando,
    errorActualizar,
  } = consulta;
  const sinDatos = data && data.embudo.iniciadas === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="rule-accent text-xl font-bold tracking-tight sm:text-2xl">
            Agendas por programa
          </h1>
          <div className="flex items-center gap-2">
            {data ? <ExportarCsv datos={data} /> : null}
          </div>
        </div>

        <p className="text-muted-foreground max-w-prose text-xs">
          Una agenda es un booking confirmado (Calendly o el asignador interno), contado por la
          fecha en que se agendó (huso {timezone}). form30x no recibe cancelaciones de ninguno de
          los dos, así que estos números son bookings creados, no reuniones vigentes.
        </p>

        <div className="border-border flex flex-col gap-4 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FiltroRango
            rango={filtros.rango}
            timezone={timezone}
            onCambio={(rango) => actualizar({ rango })}
          />
          <FiltroProgramas
            disponibles={data?.programasDisponibles ?? []}
            seleccionados={filtros.programas}
            onCambio={(programas) => actualizar({ programas })}
            cargando={isPending}
          />
        </div>

        <IndicadorFrescura
          datosDe={data?.actualizacion.datosDe}
          generadoEn={data?.generadoEn}
          cadaMinutos={data?.actualizacion.cadaMinutos}
          estimacionMs={data?.actualizacion.estimacionMs}
          alcance={
            filtros.programas.length > 0
              ? (data?.programasDisponibles ?? [])
                  .filter((p) => filtros.programas.includes(p.id))
                  .map((p) => p.nombre)
              : null
          }
          cargando={isPending || (isFetching && !data)}
          actualizando={actualizando}
          errorActualizar={errorActualizar}
          autoRefresco={autoRefresco}
          refrescoActivo={refrescoActivo}
          rangoVivo={rangoVivo}
          onActualizarAhora={() => void actualizarAhora()}
          onCambiarAuto={setAutoRefresco}
        />
      </div>

      {isPending ? <EstadoCargando /> : null}

      {error ? (
        <EstadoError
          mensaje={error instanceof ErrorAgendas ? error.message : 'Ocurrió un error inesperado.'}
          onReintentar={() => void refetch()}
          reintentando={isFetching}
        />
      ) : null}

      {data && !error ? (
        <div className="space-y-4">
          <Avisos avisos={data.avisos} />
          <KpisAgendas
            kpis={data.kpis}
            rangoPrevio={data.rangoPrevio}
            coberturaDesde={data.coberturaDesde}
            corteComparacion={data.corteComparacion}
            registros={data.registros}
          />

          {sinDatos ? (
            <EstadoVacio
              onLimpiar={
                filtros.programas.length > 0 ? () => actualizar({ programas: [] }) : undefined
              }
            />
          ) : (
            <>
              <EmbudoConversion embudo={data.embudo} />
              {/* Solo Inmersivo lleva el desglose por canal y país: es el
                  programa presencial, el único con varias sedes. */}
              {filtros.programas.length === 1 && filtros.programas[0] === INMERSIVO ? (
                <DesgloseInmersivo
                  dias={data.dias}
                  registros={data.registros}
                  programaNombre={
                    data.programasDisponibles.find((p) => p.id === INMERSIVO)?.nombre ??
                    'Inmersivo Presencial'
                  }
                />
              ) : (
                <GraficaTotal
                  dias={data.totalPorDia}
                  mejorDia={data.kpis.mejorDia?.fecha ?? null}
                  registros={data.registros}
                />
              )}
              <Buscador registros={data.registros} />
              <Atribucion
                porCanal={data.porCanal}
                porFuente={data.porFuente}
                porCampana={data.porCampana}
                porFuentePagoOrganico={data.porFuentePagoOrganico}
                porPostOrganico={data.porPostOrganico}
                porVideoPagado={data.porVideoPagado}
                porCiudad={data.porCiudad}
                porEdicion={data.porEdicion}
              />
              <TablaProgramas series={data.series} dias={data.dias} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
