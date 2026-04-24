export type AuthReturnRoute = '/home' | '/order-review';

export function resolveAuthReturnTo(value?: string | string[]): AuthReturnRoute {
  const nextValue = Array.isArray(value) ? value[0] : value;
  return nextValue === '/order-review' ? '/order-review' : '/home';
}
