import { encode, decode } from 'js-base64';

// @ts-ignore
import sha1 from 'sha-1';

/**
 * base64-encode given data
 * @param data data string to be base64-encoded
 * @returns base64-encoded string
 */
export const base64Encode = (data: string) => {
  // return Buffer.from(data, 'utf-8').toString('base64');
  return encode(data);
};

/**
 * decode base64-encoded data
 * @param base64 base64 string to be decoded
 * @returns base64-decoded string
 */
export const base64Decode = (base64: string) => {
  // return Buffer.from(base64, 'base64').toString();
  return decode(base64);
};

/**
 * Generate SHA1 hash from given data
 * @param data data string for which SHA1 hash has to be generated
 * @returns SHA1 hash of the given data
 */
export const sha1Hash = (data: string) => {
  return sha1(data) as string;
};
