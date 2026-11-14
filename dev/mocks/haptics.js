export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
export const NotificationType = { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' };
const log = (kind) => { (window.__haptics ||= []).push(kind); };
export const Haptics = {
  async impact() { log('impact'); },
  async notification(o) { log(o.type); },
};
