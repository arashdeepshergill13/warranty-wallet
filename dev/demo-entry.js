import { startDemo } from './demo-setup.js';

startDemo().then(() => import('../src/main.jsx'));
