import { describe, expect, it } from 'vitest';
import { clasificarCanal, fuenteDe, redDePauta } from './canal';

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
    expect(fuenteDe({})).toBe('sin fuente');
  });

  it('devuelve la cuenta de Instagram concreta, no un genérico', () => {
    // 30X corre más de una cuenta de Instagram: perder cuál fue impide saber
    // de dónde vino el registro, no solo que "vino de Instagram".
    expect(fuenteDe({ ig_account: '30x.oficial' })).toBe('30x.oficial');
    expect(fuenteDe({ ig_account: 'crece30x' })).toBe('crece30x');
  });
});

describe('Google Ads', () => {
  it('cuenta como pauta los clics que solo traen wbraid/gbraid o paid_search', () => {
    // Casos reales: un clic de iPhone solo trae wbraid + gad_source, y las
    // campañas de 30X en Google usan utm_medium=paid_search.
    expect(clasificarCanal({ wbraid: 'x', gad_source: '1' })).toBe('pauta');
    expect(clasificarCanal({ utm_source: 'google', utm_medium: 'paid_search' })).toBe('pauta');
    expect(fuenteDe({ wbraid: 'x', gad_source: '1' })).toBe('google');
  });

  it('separa la red de la pauta: Google, Meta u otra', () => {
    expect(redDePauta({ utm_source: 'google', utm_medium: 'paid_search', gclid: 'a' })).toBe(
      'google',
    );
    expect(redDePauta({ gbraid: 'x', gad_source: '1', utm_source: 'ig' })).toBe('google');
    expect(redDePauta({ utm_source: 'ig', utm_medium: 'paid_social', fbclid: 'f' })).toBe('meta');
    expect(
      redDePauta({ utm_source: 'Facebook_Mobile_Reels', hsa_net: 'facebook', hsa_acc: '1' }),
    ).toBe('meta');
    expect(redDePauta({ utm_source: 'linkedin', utm_medium: 'paid' })).toBe('otra');
  });

  it('YouTube orgánico (descripción, comentario fijado) no es pauta', () => {
    const hidden = { utm_source: 'youtube', utm_medium: 'video_description' };
    expect(clasificarCanal(hidden)).toBe('organico');
    expect(redDePauta(hidden)).toBeNull();
  });
});
