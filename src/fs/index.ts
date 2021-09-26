import path from 'path';
import util from 'util';
import fs from 'fs';
import fsa from 'fs/promises';

import { CustomError } from '../common/error';

const assertPath = (p: string) => {
  if (!p || p.startsWith('/')) return p;
  return path.resolve(process.cwd(), p);
};

/**
 * Check whether a file exists
 * @param file file path
 * @param loud whether to throw errors [default: false]
 * @returns true if it exists, false otherwise
 */
export const existsFileSync = (file: string, loud = false) => {
  if (!file) return false;
  file = assertPath(file);
  try {
    if (!fs.existsSync(file)) {
      if (!loud) return false;
      throw new CustomError(`File does not exist: ${file}`);
    }
  } catch (e) {
    if (!loud) return false;
    if (e instanceof CustomError) {
      throw e;
    } else {
      throw new CustomError(`Error while accessing file: ${file}`);
    }
  }
  return true;
};

/**
 * Check whether a directory exists
 * @param dir directory path
 * @param loud whether to throw errors [default: false]
 * @returns true if it exists, false otherwise
 */
export const existsDirSync = (dir: string, loud = false) => {
  if (!dir) return false;
  dir = assertPath(dir);
  try {
    if (!fs.existsSync(dir)) {
      if (!loud) return false;
      throw new CustomError(`Directory does not exist: ${dir}`);
    }
  } catch (e) {
    if (!loud) return false;
    if (e instanceof CustomError) {
      throw e;
    } else {
      throw new CustomError(`Error while accessing directory: ${dir}`);
    }
  }
  return true;
};

/**
 * Read contents of a file
 * @param file file path
 * @param warn whether to show warnings [default: false]
 * @returns contents of the file, null in case of error
 */
export const readFile = async (file: string, warn = false) => {
  if (!file) return null;
  file = assertPath(file);
  let contents = null;
  try {
    contents = await fsa.readFile(file, 'utf8');
  } catch (e) {
    if (warn) console.warn(`Cannot read file: ${file}`);
  }
  return contents;
};

/**
 * Read contents of a file
 * @param file file path
 * @param warn whether to show warnings [default: false]
 * @returns contents of the file, null in case of error
 */
export const readFileSync = (file: string, warn = false) => {
  if (!file) return null;
  file = assertPath(file);
  let contents = null;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (warn) console.warn(`Cannot read file: ${file}`);
  }
  return contents;
};

/**
 * Get the list of files/directories in a directory
 * @param dir directory path
 * @param warn whether to show warnings [default: false]
 * @returns an object {dirs,files} containing list of directories & files
 */
export const readDir = async (dir: string, warn = false) => {
  if (!dir) return { dirs: null, files: null };
  dir = assertPath(dir);

  let files: string[] | null = null;
  let dirs: string[] | null = null;

  try {
    const items = await fsa.readdir(dir, { withFileTypes: true });
    items.forEach(item => {
      if (item.isDirectory()) {
        if (!dirs) {
          dirs = [item.name];
        } else {
          dirs.push(item.name);
        }
      } else if (item.isFile()) {
        if (!files) {
          files = [item.name];
        } else {
          files.push(item.name);
        }
      }
    });
  } catch (e) {
    if (warn) console.warn(`Cannot read dir: ${dir}`);
  }

  return { dirs, files } as { dirs: string[] | null; files: string[] | null };
};

/**
 * Get the list of files in a directory
 * @param dir directory path
 * @param warn whether to show warnings [default: false]
 * @returns list of files, null in case of error or no items
 */
export const readDirFiles = async (dir: string, warn = false) => {
  if (!dir) return null;
  dir = assertPath(dir);
  return (await readDir(dir, warn)).files;
};

/**
 * Get the list of directories in a directory
 * @param dir directory path
 * @param warn whether to show warnings [default: false]
 * @returns list of directories, null in case of error or no items
 */
export const readDirDirs = async (dir: string, warn = false) => {
  if (!dir) return null;
  dir = assertPath(dir);
  return (await readDir(dir, warn)).dirs;
};

const readDirFilesRecHelper = async (dir: string, basePath = ''): Promise<string[] | null> => {
  if (!dir) return null;
  dir = assertPath(dir);

  const dirPath = basePath ? `${dir}/${basePath}` : dir;
  const { dirs, files } = await readDir(dirPath);
  let allFiles: string[] = files || [];
  allFiles = allFiles.map(file => (basePath ? `${basePath}/${file}` : file));
  const absDirs = (dirs || []).map(d => (basePath ? `${basePath}/${d}` : d));

  const pList = absDirs.map(dirx => readDirFilesRecHelper(dir, dirx));
  const filesxList = await Promise.all(pList);
  filesxList.forEach(filesx => {
    if (filesx) {
      allFiles = [...allFiles, ...filesx];
    }
  });

  return allFiles.length ? allFiles : null;
};

/**
 * Get the (recursive) list of files in a directory
 * @param dir directory path
 * @returns complete (recursive) list of files, null in case of error or no items
 */
export const readDirFilesRec = (dir: string) => readDirFilesRecHelper(dir);

/**
 * Write contents to a file (creates the file path if it doesn't exist)
 * @param file file path
 * @param contents contents to write
 * @returns true if successful, false on error
 */
export const writeFile = async (file: string, contents: string) => {
  if (!file || !contents) return false;
  file = assertPath(file);
  try {
    const dir = file.substring(0, file.lastIndexOf('/'));
    await fsa.mkdir(dir, { recursive: true });
    await fsa.writeFile(file, contents);
  } catch (e) {
    console.error(`Error while writing to ${file}`, e);
    return false;
  }
  return true;
};

/**
 * Append contents to a file
 * @param file file path
 * @param contents contents to append
 * @returns true if successful, false on error
 */
export const appendToFile = async (file: string, contents: string) => {
  if (!file || !contents) return false;
  file = assertPath(file);
  try {
    const dir = file.substring(0, file.lastIndexOf('/'));
    await fsa.mkdir(dir, { recursive: true });

    await fsa.appendFile(file, contents + '\n');

    // Ref: https://stackoverflow.com/a/43370201
    // const stream = fs.createWriteStream(file, { flags: 'a' });
    // stream.write(contents + '\n');
    // stream.end();
  } catch (e) {
    console.error(`Error while appending to ${file}`, e);
    return false;
  }
  return true;
};

/**
 * Rename a file
 * @param oldpath old file path
 * @param newpath new file path
 * @returns true if successful, false on error
 */
export const renameFile = async (oldpath: string, newpath: string) => {
  if (!oldpath || !newpath) return false;
  oldpath = assertPath(oldpath);
  newpath = assertPath(newpath);
  try {
    await fsa.rename(oldpath, newpath);
  } catch (e) {
    console.error(`Error while renaming file ${oldpath} to ${newpath}`, e);
    return false;
  }
  return true;
};

/**
 * Create a directory, if it doesn't exist
 * @param dir directory path
 * @returns true if successful, false in case of failure
 */
export const createDir = async (dir: string) => {
  if (!dir) return false;
  dir = assertPath(dir);
  try {
    if (!existsDirSync(dir)) {
      await fsa.mkdir(dir, { recursive: true });
    }
  } catch (e) {
    console.error(`Error while creating directory: ${dir}`, e);
    return false;
  }
  return true;
};

/**
 * Delete a file
 * @param file file path
 * @returns true if successful, false on error
 */
export const deleteFile = async (file: string) => {
  if (!file) return false;
  file = assertPath(file);
  try {
    await fsa.unlink(file);
  } catch (e) {
    console.error(`Error while deleting file ${file}`, e);
    return false;
  }
  return true;
};

/**
 * Delete a directory
 * @param dir directory path
 * @returns true if successful, false on error
 */
export const deleteDir = async (dir: string) => {
  if (!dir) return false;
  dir = assertPath(dir);
  try {
    const rimraf = require('rimraf');
    const rimrafPr = util.promisify(rimraf);
    await rimrafPr(dir);

    // Added in: v14.14.0
    // await fsa.rm(dir, { recursive: true, force: true });
  } catch (e) {
    console.error(`Error while deleting dir ${dir}`, e);
    return false;
  }
  return true;
};
