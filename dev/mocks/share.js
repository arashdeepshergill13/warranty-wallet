export const Share = {
  async share(o) {
    (window.__shared ||= []).push(o);
    window.__demoShare?.();
  },
};
