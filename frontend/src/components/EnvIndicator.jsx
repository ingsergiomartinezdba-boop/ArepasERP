const ENV_NAME = import.meta.env.VITE_ENV_NAME || 'Desarrollo';
const IS_PROD  = ENV_NAME === 'Producción';

export const envColor = IS_PROD ? '#22c55e' : '#fb923c';
export const envName  = ENV_NAME;
export const isProd   = IS_PROD;
