// `server-only` lanza un error cuando se resuelve con la condición de cliente,
// que es la que usa el entorno jsdom de Vitest. En los tests no hay bundle de
// navegador que proteger, así que se sustituye por un módulo vacío.
export {};
