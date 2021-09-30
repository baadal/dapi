import * as dbAll from './db';

const { init: dbInit, ...db } = dbAll;

const init = (region: string) => {
  if (!region) {
    console.warn(`[WARN] AWS initialization error! Missing region: ${region}`);
    return;
  }

  dbInit(region);
};

export { db, init }; // named exports
