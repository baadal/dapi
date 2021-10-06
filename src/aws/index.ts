import * as dbAll from './db';
import { error } from '../common/logger';

const { init: dbInit, ...db } = dbAll;

const init = (region: string) => {
  if (!region) {
    error(`AWS initialization error! Missing region: ${region}`);
    return;
  }

  dbInit(region);
};

export { db, init }; // named exports
