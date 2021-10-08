import * as dbAll from './db';
import { error } from '../common/logger';

const { init: dbInit, status: dbStatus, ...db } = dbAll;

const init = (region: string) => {
  if (!region) {
    error(`AWS initialization error! Missing region: ${region}`);
    return false;
  }

  return dbInit(region);
};

const status = () => {
  return dbStatus();
};

export { db, init, status }; // named exports
