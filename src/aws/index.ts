import * as db from './db';
import { warn, error } from '../common/logger';

// Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
// Types: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_types.html

const { init: dbInit, status: dbStatus } = db;

/**
 * @deprecated explicit init deprecated!
 */
export const init = (region: string) => {
  warn('[@baadal-sdk/dapi] aws explicit init deprecated!');
  if (!region) {
    error(`AWS initialization error! Missing region: ${region}`);
    return false;
  }

  return dbInit(region);
};

export const status = () => {
  return {
    db: dbStatus(),
  };
};

export { db }; // named exports
