import * as fs from './fs';
import * as aws from './aws';
import * as utils from './common/utils';

// Ref: https://stackoverflow.com/a/41283945
export { fs, aws, utils }; // named exports
export default { fs, aws, utils }; // default export
