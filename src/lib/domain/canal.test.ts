import { describe, expect, it } from 'vitest';
import { clasificarCanal, fuenteDe } from './canal';

describe('clasificarCanal', () => {
  it('detecta pauta por el auto-etiquetado de Google Ads', () => {
    expect(clasificarCanal({ hsa_acc: '123', hsa_cam: '456' })).toBe('pauta');
    expect(clasificarCanal({ gclid: 'abc' })).toBe('pauta');
    expect(clasificarCanal({ ad_id: '789' })).toBe('pauta');
  });

  it('detecta pauta por utm_medium', () => {
    for (const medio of ['cpc', 'PPC', 'paid_social', 'display']) {
      expect(clasificarCanal({ utm_medium: medio, utm_source: 'meta' })).toBe('pauta');
    }
  });

  it('no toma fbclid como prueba de pauta', () => {
    // La documentación de form30x lo dice: Meta añade fbclid también a las
    // comparticiones orgánicas, así que por sí solo no distingue nada.
    expect(clasificarCanal({ fbclid: 'IwAR123' })).toBe('sin-etiquetar');
  });

  it('distingue orgánico, referido y directo', () => {
    expect(clasificarCanal({ utm_source: 'newsletter', utm_medium: 'email' })).toBe('organico');
    expect(clasificarCanal({ utm_medium: 'referral' })).toBe('referido');
    expect(clasificarCanal({ referral_30x: 'ana' })).toBe('referido');
    expect(clasificarCanal({})).toBe('directo');
  });

  it('ignora los valores vacíos', () => {
    expect(clasificarCanal({ utm_source: '  ', gclid: '' })).toBe('directo');
  });
});

describe('fuenteDe', () => {
  it('prefiere utm_source', () => {
    expect(fuenteDe({ utm_source: 'newsletter', gclid: 'x' })).toBe('newsletter');
  });

  it('deduce la fuente cuando no hay utm_source', () => {
    expect(fuenteDe({ gclid: 'x' })).toBe('google');
    expect(fuenteDe({ fbclid: 'x' })).toBe('meta');
    expect(fuenteDe({ ig_account: '30x' })).toBe('instagram');
    expect(fuenteDe({})).toBe('sin fuente');
  });
});
