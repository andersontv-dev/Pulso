/** Categorías de fallo, para que la interfaz pueda reaccionar sin adivinar
 *  a partir del texto del mensaje. */
export type CodigoError =
  | 'config' // falta la API key o la URL es inválida
  | 'auth' // 401 / 403
  | 'rate_limit' // 429
  | 'no_encontrado' // 404
  | 'servidor' // 5xx
  | 'red' // fallo de transporte o timeout
  | 'esquema' // la respuesta no tiene la forma documentada
  | 'desconocido';

export class Form30xError extends Error {
  readonly codigo: CodigoError;
  readonly status?: number;
  readonly reintentable: boolean;
  readonly detalle?: unknown;

  constructor(
    mensaje: string,
    opciones: { codigo: CodigoError; status?: number; reintentable?: boolean; detalle?: unknown },
  ) {
    super(mensaje);
    this.name = 'Form30xError';
    this.codigo = opciones.codigo;
    this.status = opciones.status;
    this.reintentable = opciones.reintentable ?? REINTENTABLES.has(opciones.codigo);
    this.detalle = opciones.detalle;
  }

  /** Mensaje para mostrar al usuario: dice qué hacer, no solo qué falló. */
  get mensajeUsuario(): string {
    switch (this.codigo) {
      case 'config':
        return 'Falta configuración. Revisa FORM30X_API_KEY en tu .env.local.';
      case 'auth':
        return 'form30x rechazó las credenciales. Comprueba que la API key es válida y tiene los scopes forms:read y responses:read.';
      case 'rate_limit':
        return 'form30x está limitando las peticiones. Espera unos segundos y reintenta.';
      case 'no_encontrado':
        return 'form30x no encontró el recurso solicitado.';
      case 'servidor':
        return 'form30x devolvió un error. El problema es del servidor, no de tus datos.';
      case 'red':
        return 'No pudimos conectar con form30x. Revisa tu conexión.';
      case 'esquema':
        return 'form30x devolvió datos con una forma inesperada. Puede que la API haya cambiado.';
      default:
        return 'No pudimos cargar los datos.';
    }
  }
}

const REINTENTABLES = new Set<CodigoError>(['rate_limit', 'servidor', 'red']);

export function codigoDesdeStatus(status: number): CodigoError {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'no_encontrado';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'servidor';
  return 'desconocido';
}
