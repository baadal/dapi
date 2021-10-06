import * as db from './db';
import { error } from '../common/logger';

const { init: dbInit } = db;

const init = (region: string) => {
  if (!region) {
    error(`AWS initialization error! Missing region: ${region}`);
    return;
  }

  dbInit(region);
};

export { db, init }; // named exports
