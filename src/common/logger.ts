import chalk from 'chalk';

let clog = console.log;
let cwarn = console.warn;
let cerror = console.error;

if (typeof window === typeof undefined) {
  clog = (...args: any[]) => console.log(chalk.green(...args));
  cwarn = (...args: any[]) => console.warn(chalk.yellow(...args));
  cerror = (...args: any[]) => console.error(chalk.red(...args));
}

const log = clog;
const warn = cwarn;
const error = cerror;

export { log, warn, error };
export default { log, warn, error };
