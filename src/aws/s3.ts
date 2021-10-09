/**
 * Examples:
 * Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html
 */

import path from 'path';
import { Readable } from 'stream';
import fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  GetObjectCommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  HeadObjectCommand,
  HeadObjectCommandInput,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3';
import short from 'short-uuid';
import mime from 'mime-types';
import { chunkifyArray } from '@baadal-sdk/utils';

import { StringIndexable } from 'src/common/common.model';
import { assertPath, fileHash } from '../utils';
import { s3Client } from './client';
import { CustomError } from '../common/error';
import { warn, error } from '../common/logger';
import { BATCH_SIZE, CHUNK_SIZE } from '../common/const';

// import { Upload } from "@aws-sdk/lib-storage";
// Multipart upload: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_lib_storage.html

const AWSS3Error = (msg: string) => new CustomError(msg, { name: 'AWSS3Error' });

/** @internal */
export const init = (region: string) => {
  // Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/index.html
  if (!s3Client.client) {
    const awsS3Client = new S3Client({ region }); // may also pass `credentials`
    s3Client.client = awsS3Client;
    s3Client.id = short.uuid();
    return true;
  }
  return false;
};

/** @internal */
export const status = () => s3Client.id;

const tryInit = (silent = false) => {
  if (s3Client.client) return;
  const region = process.env.AWS_REGION || '';
  if (region) {
    if (init(region)) {
      // console.log('Auto-initialization of S3 successful');
      return;
    }
  }
  if (!silent) {
    // throw AWSS3Error('AWS S3 is possibly uninitialized!');
    throw AWSS3Error('Could not auto-initialize AWS S3!');
  }
};

// auto-initialize on load
tryInit(true);

/**
 * Create a new file in S3 bucket
 * @param bucket S3 bucket name
 * @param s3path S3 path to be created
 * @param contents contents of the file to be created
 * @returns true if the write is successful, null in case of error
 */
export const putObject = async (bucket: string, s3path: string, contents: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3path || !contents) return null;

  let baseParams: PutObjectCommandInput | null = null;

  try {
    baseParams = {
      Bucket: bucket,
      Key: s3path,
      Body: '<contents>',
      ContentType: 'text/plain; charset=utf-8',
      ACL: 'public-read',
      // CacheControl: 'max-age=86400,public',
    };
    const cmdParams: PutObjectCommandInput = { ...baseParams, Body: contents };
    const command = new PutObjectCommand(cmdParams);

    await s3Client.client.send(command);
  } catch (err) {
    console.error('PutObjectCommandInput:', baseParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

/**
 * Upload a file to S3 bucket
 * @param bucket S3 bucket name
 * @param file (local) path of the file to upload
 * @param s3path [optional] S3 path to be created, if not provided then derived from `file` path
 * @returns true if the write is successful, null in case of error
 */
export const uploadFile = async (bucket: string, file: string, s3path?: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !file) return null;

  const filepath = assertPath(file);
  const basename = path.basename(filepath);
  const ext = basename.substr(basename.lastIndexOf('.'));
  const contentType = mime.lookup(ext);
  if (!contentType) {
    error(`Could not detect file type for: ${basename} [${filepath}]`);
    return null;
  }

  if (!s3path) {
    if (file !== filepath) {
      s3path = file;
    } else {
      s3path = basename;
    }
  }

  let baseParams: PutObjectCommandInput | null = null;

  try {
    const hash = (await fileHash(filepath)) || '';
    const fileStream = fs.createReadStream(filepath);

    baseParams = {
      Bucket: bucket,
      Key: s3path,
      Body: '<fileStream>',
      ContentType: contentType,
      ACL: 'public-read',
      // CacheControl: 'max-age=86400,public',
      Metadata: { hash },
    };
    const cmdParams: PutObjectCommandInput = { ...baseParams, Body: fileStream };
    const command = new PutObjectCommand(cmdParams);

    await s3Client.client.send(command);
  } catch (err) {
    console.error('PutObjectCommandInput:', baseParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

/**
 * Upload a list of files to S3 bucket
 * @param bucket S3 bucket name
 * @param files (local) list of file paths to upload
 * @param s3paths [optional] S3 path to be created, if not provided then derived from `file` path
 * @returns true if the write is successful, null in case of error
 */
export const uploadFilesAll = async (bucket: string, files: string[], s3paths?: string[]) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !files || !Array.isArray(files) || !files.length) return null;
  if (s3paths && (!Array.isArray(s3paths) || !s3paths.length || files.length !== s3paths.length)) return null;

  let errFlag = false;

  const chunkedFiles = chunkifyArray(files, CHUNK_SIZE);
  const chunkedPaths = s3paths ? chunkifyArray(s3paths, CHUNK_SIZE) : chunkedFiles;

  for (let i = 0; i < chunkedFiles.length; i += 1) {
    const filesChunk = chunkedFiles[i];
    const pathsChunk = chunkedPaths[i];
    const pList = filesChunk.map((item, j) => uploadFile(bucket, item, pathsChunk[j]));
    const rList = await Promise.all(pList); // eslint-disable-line no-await-in-loop

    const isSuccess = rList.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};

/**
 * Get the contents of a file in S3 bucket
 * @param bucket S3 bucket name
 * @param s3path S3 path of the file to be read
 * @returns contents of the file, null in case of error
 */
export const getObject = async (bucket: string, s3path: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3path) return null;

  let contents: string | null = null;
  const cmdParams: GetObjectCommandInput = { Bucket: bucket, Key: s3path };
  const command = new GetObjectCommand(cmdParams);

  try {
    // helper function to convert a ReadableStream to a string
    const streamToString = (stream: Readable): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });

    const data = await s3Client.client.send(command);
    const bodyContents = await streamToString(data.Body as Readable);
    // const metaData = data.Metadata;

    if (bodyContents) {
      contents = bodyContents as string;
    }
  } catch (err) {
    console.error('GetObjectCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return contents;
};

/**
 * Download a file from S3 bucket
 * @param bucket S3 bucket name
 * @param s3path S3 path of the file to be downloaded
 * @param outPath [optional] path where the downloaded file is written, if not provided then derived from `s3path`
 * @returns true if download is successful, null in case of error
 */
export const downloadFile = async (bucket: string, s3path: string, outPath?: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3path) return null;

  if (!outPath) outPath = s3path;
  outPath = assertPath(outPath);
  const cmdParams: GetObjectCommandInput = { Bucket: bucket, Key: s3path };
  const command = new GetObjectCommand(cmdParams);

  try {
    // helper function to write a ReadableStream to a file
    const writeStreamToFile = (stream: Readable): Promise<void> =>
      new Promise((resolve, reject) => {
        // Ref: https://stackabuse.com/writing-to-files-in-node-js/
        const writeStream = fs.createWriteStream(outPath as string);
        stream.on('data', chunk => writeStream.write(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(writeStream.close()));
      });

    const data = await s3Client.client.send(command);
    await writeStreamToFile(data.Body as Readable);
    // const metaData = data.Metadata;
  } catch (err: any) {
    if (err.name !== 'NoSuchKey') {
      console.error('GetObjectCommandInput:', cmdParams);
      console.error(err);
    }
    return null;
    // throw err;
  }

  return true;
};

/**
 * List objects in a S3 bucket
 * @param bucket S3 bucket name
 * @param prefix [optional] prefix for object names in the bucket
 * @returns list of objects in the S3 bucket (optionally starting with the given prefix), null in case of error
 */
export const listObjects = async (bucket: string, prefix?: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket) return null;

  let filesList: string[] | null = null;

  let cmdParams: ListObjectsV2CommandInput = { Bucket: bucket };
  if (prefix) cmdParams = { ...cmdParams, Prefix: prefix };
  const command = new ListObjectsV2Command(cmdParams);

  try {
    const results = await s3Client.client.send(command);
    const items = results.Contents;

    // Ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/ListingKeysUsingAPIs.html
    if (results.IsTruncated) {
      warn('[listObjects] Partial results obtained! Consider pagination.');
    }

    if (items) {
      filesList = items.map(t => t.Key).filter(e => !!e) as string[];
    }
  } catch (err) {
    console.error('ListObjectsV2CommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return filesList;
};

/**
 * Get head content for a file in S3 bucket
 * @param bucket S3 bucket name
 * @param s3path S3 path of the file
 * @returns head content for the given file, null in case of error
 */
export const getObjectHead = async (bucket: string, s3path: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3path) return null;

  let contents: HeadObject | null = null;

  const cmdParams: HeadObjectCommandInput = { Bucket: bucket, Key: s3path };
  const command = new HeadObjectCommand(cmdParams);

  try {
    const data = await s3Client.client.send(command);
    if (data) {
      const { ContentLength, ContentType, ETag, CacheControl, Expires, LastModified, Metadata } = data;
      contents = { Key: s3path, ContentLength, ContentType, ETag, CacheControl, Expires, LastModified, Metadata };
    }
  } catch (err: any) {
    if (err.name !== 'NotFound') {
      console.error('HeadObjectCommandInput:', cmdParams);
      console.error(err);
    }
    return null;
    // throw err;
  }

  return contents;
};

/**
 * Get head contents for a list of files in S3 bucket
 * @param bucket S3 bucket name
 * @param s3paths list of S3 paths of the files
 * @returns head contents for the given files, null in case of error
 */
export const getObjectHeadsAll = async (bucket: string, s3paths: string[]) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3paths || !Array.isArray(s3paths) || !s3paths.length) return null;

  let contents: (HeadObject | null)[] | null = null;

  const chunkedItems = chunkifyArray(s3paths, CHUNK_SIZE);

  for (let i = 0; i < chunkedItems.length; i += 1) {
    const chunk = chunkedItems[i];
    const pList = chunk.map(item => getObjectHead(bucket, item));
    const rList = await Promise.all(pList); // eslint-disable-line no-await-in-loop

    if (contents) {
      contents = contents.concat(rList);
    } else {
      contents = rList;
    }
  }

  if (contents?.length) {
    contents = contents.filter(e => !!e);
  }

  return contents;
};

/**
 * Delete a file in S3 bucket
 * @param bucket S3 bucket name
 * @param s3path S3 file path to be deleted
 * @returns true if delete is successful, null in case of error
 */
export const deleteObject = async (bucket: string, s3path: string) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3path) return null;

  const cmdParams: DeleteObjectCommandInput = { Bucket: bucket, Key: s3path };
  const command = new DeleteObjectCommand(cmdParams);

  try {
    await s3Client.client.send(command);
  } catch (err) {
    console.error('DeleteObjectCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

const batchDeleteObjects = async (bucket: string, s3paths: string[]) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3paths || !Array.isArray(s3paths) || !s3paths.length) return null;

  const keys = s3paths.map(key => ({ Key: key }));
  const cmdParams: DeleteObjectsCommandInput = { Bucket: bucket, Delete: { Objects: keys } };
  const command = new DeleteObjectsCommand(cmdParams);

  try {
    await s3Client.client.send(command);
  } catch (err) {
    console.error('DeleteObjectsCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

/**
 * Delete a list of files in S3 bucket
 * @param bucket S3 bucket name
 * @param s3paths list of S3 file paths to be deleted
 * @returns true if all deletes are successful, null in case of error
 */
export const deleteObjectsAll = async (bucket: string, s3paths: string[]) => {
  if (!s3Client.client) tryInit();
  if (!s3Client.client) return null;
  if (!bucket || !s3paths || !Array.isArray(s3paths) || !s3paths.length) return null;

  let errFlag = false;

  const batchedFiles = chunkifyArray(s3paths, BATCH_SIZE);
  const chunkedFiles = chunkifyArray(batchedFiles, CHUNK_SIZE);

  for (let i = 0; i < chunkedFiles.length; i += 1) {
    const batchFiles = chunkedFiles[i];

    const brlist = batchFiles.map(paths => batchDeleteObjects(bucket, paths));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const isSuccess = bslist.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};

export interface HeadObject {
  Key: string;
  ContentLength?: number;
  ContentType?: string;
  ETag?: string;
  CacheControl?: string;
  Expires?: Date;
  LastModified?: Date;
  Metadata?: StringIndexable;
}
