import * as fs from './fs';
import * as aws from './aws';
import * as gh from './gh';
import * as utils from './utils';

// Ref: https://stackoverflow.com/a/41283945
export { fs, aws, gh, utils }; // named exports
export default { fs, aws, gh, utils }; // default export
