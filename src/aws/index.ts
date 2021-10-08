import * as db from './db';
import { error } from '../common/logger';

const { init: dbInit, status: dbStatus } = db;

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
