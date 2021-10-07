import * as fs from './fs';
import * as aws from './aws';
import * as gh from './gh';

// Ref: https://stackoverflow.com/a/41283945
export { fs, aws, gh }; // named exports
export default { fs, aws, gh }; // default export
