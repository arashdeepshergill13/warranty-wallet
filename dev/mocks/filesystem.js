export const Directory = { Library: 'LIBRARY', Cache: 'CACHE' };
export const Encoding = { UTF8: 'utf8' };
const saved = (() => { try { return JSON.parse(localStorage.getItem('__fs') || '[]'); } catch { return []; } })();
const fs = (window.__fs ||= new Map(saved));
const keep = () => { try { localStorage.setItem('__fs', JSON.stringify([...fs])); } catch {} };
const key = (o) => `${o.directory}/${o.path}`;
export const Filesystem = {
  async mkdir() {},
  async writeFile(o) { if (window.__failWrites) throw new Error('No space left on device'); fs.set(key(o), o.data); keep(); return { uri: `file:///${key(o)}` }; },
  async readFile(o) { if (!fs.has(key(o))) throw new Error('File does not exist'); return { data: fs.get(key(o)) }; },
  async deleteFile(o) { if (!fs.delete(key(o))) throw new Error('File does not exist'); keep(); },
  async getUri(o) { return { uri: `file:///${key(o)}` }; },
};
