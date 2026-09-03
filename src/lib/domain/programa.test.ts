import { describe, expect, it } from 'vitest';
import { emparejarPrograma, normalizar, resolverPrograma } from './programa';

describe('normalizar', () => {
  it('quita acentos, puntuación y mayúsculas', () => {
    expect(normalizar('Inmersión Ejecutiva')).toBe('inmersion ejecutiva');
    expect(normalizar('AI Sales — Cohorte 12')).toBe('ai sales cohorte 12');
    expect(normalizar('ai-sales_form.v2')).toBe('ai sales form v2');
  });

  it('colapsa espacios y recorta los extremos', () => {
    expect(normalizar('  Growth   Rockstar  ')).toBe('growth rockstar');
  });
});

describe('emparejarPrograma', () => {
  it('reconoce el mismo programa escrito de formas distintas', () => {
    for (const nombre of ['AI Sales — Cohorte 12', 'ai-sales_form', 'Formulario AI Sales 2026']) {
      expect(emparejarPrograma(nombre)?.id).toBe('ai-sales');
    }
  });

  it('prefiere la coincidencia más larga', () => {
    // "sales machine" no debe caer en "ai sales" ni en "linkedin sales".
    expect(emparejarPrograma('Sales Machine LATAM')?.id).toBe('sales-machine');
    expect(emparejarPrograma('LinkedIn Sales · cohorte 4')?.id).toBe('linkedin-sales');
    expect(emparejarPrograma('Inscripción Fundraising Fundamentals')?.id).toBe(
      'fundraising-fundamentals',
    );
  });

  it('exige límite de palabra y no coincidencias parciales', () => {
    // "next" no debe activarse dentro de otra palabra como "nextcloud".
    expect(emparejarPrograma('Formulario nextcloud interno')).toBeNull();
    expect(emparejarPrograma('Programa Next 2026')?.id).toBe('next');
  });

  it('devuelve null cuando no hay programa reconocible', () => {
    expect(emparejarPrograma('Encuesta de satisfacción interna')).toBeNull();
  });
});

describe('resolverPrograma', () => {
  it('adjunta el nombre legible y la rama', () => {
    expect(resolverPrograma('AI Sales')).toEqual({
      id: 'ai-sales',
      nombre: 'AI Sales',
      rama: 'Ventas',
    });
  });

  it('nunca descarta un formulario: lo agrupa como no identificado', () => {
    const resuelto = resolverPrograma('Encuesta interna Q3');
    expect(resuelto.id).toBe('sin-identificar');
    expect(resuelto.rama).toBeNull();
  });
});
