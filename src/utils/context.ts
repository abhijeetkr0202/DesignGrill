export interface Context {
  now: () => string;
  newId: (prefix: string) => string;
}

export const defaultContext: Context = {
  now: () => new Date().toISOString(),
  newId: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
};
