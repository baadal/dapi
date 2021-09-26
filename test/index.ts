import { fs } from '../src';

// Test `existsFileSync`
void (() => {
  const filepath = 'test/sandbox/sample.txt';
  console.log('A1:', fs.existsFileSync(filepath));
  console.log('A2:', fs.existsFileSync(filepath + 'x'));
})();

// Test `existsDirSync`
void (() => {
  const dirpath = 'test/sandbox';
  console.log('B1:', fs.existsDirSync(dirpath));
  console.log('B2:', fs.existsDirSync(dirpath + 'x'));
})();

// Test `createDir`
void (async () => {
  const newdirpath = 'test/sandbox/xyz';
  const success = await fs.createDir(newdirpath);
  console.log('C1:', success);
})();

// Test `writeFile`
void (async () => {
  const filepath = 'test/sandbox/01/02/hello.txt';
  const success = await fs.writeFile(filepath, 'hello world');
  console.log('D1:', success);
})();

// Test `readDir`
void (async () => {
  const dirpath = 'test/sandbox';
  const output = await fs.readDir(dirpath);
  console.log('E1:', output);
})();

// Test `readDirFiles`
void (async () => {
  const dirpath = 'test/sandbox';
  const output = await fs.readDirFiles(dirpath);
  console.log('F1:', output);
})();

// Test `readDirDirs`
void (async () => {
  const dirpath = 'test/sandbox';
  const output = await fs.readDirDirs(dirpath);
  console.log('G1:', output);
})();

// Test `readDirFilesRec`
void (async () => {
  const dirpath = 'test/sandbox';
  const output = await fs.readDirFilesRec(dirpath);
  console.log('H1:', output);
})();
