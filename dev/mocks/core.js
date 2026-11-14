// Stand-ins for the native layer, used only by the browser test harness in dev/.
export const Capacitor = { isNativePlatform: () => Boolean(window.__NATIVE__) };
export function registerPlugin(name) {
  return new Proxy({}, { get: (_, method) => (...args) => {
    const impl = window.__plugins?.[name]?.[method];
    return impl ? Promise.resolve().then(() => impl(...args)) : Promise.reject(new Error(`${name}.${String(method)} not implemented`));
  } });
}
