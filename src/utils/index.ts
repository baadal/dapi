import path from 'path';
import crypto from 'crypto';
import fsa from 'fs/promises';

import { error } from '../common/logger';

export const assertPath = (p: string) => {
  if (!p || p.startsWith('/')) return p;
  return path.resolve(process.cwd(), p);
};

export const sha1Hash = (data: string) => {
  if (!data) return null;
  const hashSum = crypto.createHash('sha1');
  hashSum.update(data);
  return hashSum.digest('hex');
};

export const sha256Hash = (data: string | Buffer) => {
  if (!data) return null;
  const hashSum = crypto.createHash('sha256');
  hashSum.update(data);
  return hashSum.digest('hex');
};

export const fileHash = async (file: string) => {
  if (!file) return null;
  let contents: Buffer | null = null;

  try {
    // get buffer (instead of utf8 string) to support binary data
    contents = await fsa.readFile(file);
  } catch (e) {
    error(e);
    return null;
  }

  return sha256Hash(contents);
};
