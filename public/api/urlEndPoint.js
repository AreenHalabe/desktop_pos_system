//export  const url = 'https://restorant-menu.s11923535.workers.dev';
// export const urlServer = 'https://restaurants-system-server.s11923535.workers.dev';


import {config} from '../../env.js';

export  const url = `http://localhost:${config.DEFAULT_PORT}`;


export const urlServer = `http://localhost:${config.DEFAULT_PORT}`;

export const urlServerCS = 'https://customer-supplier.s11923535.workers.dev';
