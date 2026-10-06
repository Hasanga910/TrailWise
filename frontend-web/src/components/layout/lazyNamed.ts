import { lazy, type ComponentType } from 'react';

/** React.lazy for modules that use named exports. */
export function lazyNamed<T extends Record<string, ComponentType<never>>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType<Record<string, unknown>> }));
}
