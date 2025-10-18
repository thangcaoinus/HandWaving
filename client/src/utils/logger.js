// Development-only logger utility
// In production builds, these calls are no-ops (zero performance impact)

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },

  warn: (...args) => {
    if (isDev) console.warn(...args);
  },

  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },

  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
};
