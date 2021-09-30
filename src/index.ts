import * as fs from './fs';
import * as aws from './aws';

// Ref: https://stackoverflow.com/a/41283945
export { fs, aws }; // named exports
export default { fs, aws }; // default export
