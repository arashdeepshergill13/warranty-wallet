const store = (window.__notifications ||= { permission: 'prompt', pending: [], listeners: [] });
export const LocalNotifications = {
  async checkPermissions() { return { display: store.permission }; },
  async requestPermissions() { store.permission = 'granted'; return { display: 'granted' }; },
  async getPending() { return { notifications: store.pending.map((n) => ({ id: n.id })) }; },
  async cancel({ notifications }) { const ids = new Set(notifications.map((n) => n.id)); store.pending = store.pending.filter((n) => !ids.has(n.id)); },
  async schedule({ notifications }) { store.pending.push(...notifications); return { notifications }; },
  async addListener(_, fn) { store.listeners.push(fn); return { remove() {} }; },
};
