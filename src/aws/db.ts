/**
 * Examples:
 * Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-examples.html
 *
 * Partition key vs Composite primary key:
 * Ref: https://aws.amazon.com/premiumsupport/knowledge-center/primary-key-dynamodb-table/
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  BatchGetCommand,
  BatchGetCommandInput,
  PutCommand,
  PutCommandInput,
  BatchWriteCommand,
  BatchWriteCommandInput,
  UpdateCommand,
  UpdateCommandInput,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
  DeleteCommand,
  DeleteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import short from 'short-uuid';

import { dbClient } from './client';
import { StringIndexable } from '../common/common.model';
import { CustomError } from '../common/error';
import { warn, error } from '../common/logger';

const BATCH_SIZE = 20; // (max) number of items in a batch request
const CHUNK_SIZE = 10; // (max) number of parallel requests at a time

const DynamoDBError = (msg: string) => new CustomError(msg, { name: 'DynamoDBError' });

export const init = (region: string) => {
  // Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_lib_dynamodb.html#configuration
  if (!dbClient.client) {
    const dydbClient = new DynamoDBClient({ region }); // may also pass `credentials`
    dbClient.client = DynamoDBDocumentClient.from(dydbClient);
    dbClient.id = short.uuid();
    return true;
  }
  return false;
};

export const status = () => dbClient.id;

const tryInit = (silent = false) => {
  if (dbClient.client) return;
  const region = process.env.AWS_REGION || '';
  if (region) {
    if (init(region)) {
      // console.log('Auto-initialization of DynamoDB successful');
      return;
    }
  }
  if (!silent) {
    // throw DynamoDBError('DynamoDB is possibly uninitialized!');
    throw DynamoDBError('Could not auto-initialize DynamoDB!');
  }
};

// auto-initialize on load
tryInit(true);

const writeItemForceHelper = async <T = any>(table: string, data: T, key: string, i: number): Promise<T | null> => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !data) return null;

  if (!(data as any)[key]) {
    (data as any)[key] = short.uuid();
  }
  const cmdParams: PutCommandInput = { TableName: table, Item: data, ConditionExpression: `attribute_not_exists(${key})` };
  const command = new PutCommand(cmdParams);
  const numberOfAttempts = 3;

  try {
    await dbClient.client.send(command);
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      if (i < numberOfAttempts - 1) {
        (data as any)[key] = short.uuid(); // new primary key
        const ret: T | null = await writeItemForceHelper(table, data, key, i + 1);
        return ret;
      }
      console.error('PutCommandInput:', cmdParams);
      error('[ERROR] Maximum attempts overflow!');
    }
    return null;
  }

  return data;
};

export const writeItemForce = async <T = any>(table: string, data: T, key = 'id'): Promise<T | null> => {
  return writeItemForceHelper<T>(table, data, key, 0);
};

export const writeItem = async (table: string, item: StringIndexable) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !item) return null;

  const cmdParams: PutCommandInput = { TableName: table, Item: item };
  const command = new PutCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('PutCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

// Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-table-read-write-batch.html
const batchWriteItems = async (table: string, items: StringIndexable[]) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !items || !Array.isArray(items) || !items.length) return null;

  const reqList = items.map(item => ({ PutRequest: { Item: item } }));
  const cmdParams: BatchWriteCommandInput = {
    RequestItems: {
      [table]: reqList,
    },
  };

  const command = new BatchWriteCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('BatchWriteCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

export const writeItemsAll = async (table: string, items: StringIndexable[]) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !items || !Array.isArray(items) || !items.length) return null;

  let errFlag = false;

  const batchSize = BATCH_SIZE;
  const chunkSize = CHUNK_SIZE;

  const batchedItems = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const bitems = items.slice(i, i + batchSize);
    batchedItems.push(bitems);
  }

  for (let i = 0; i < batchedItems.length; i += chunkSize) {
    const bchunks = batchedItems.slice(i, i + chunkSize);

    const brlist = bchunks.map(iItems => batchWriteItems(table, iItems));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const isSuccess = bslist.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};

export const updateItem = async (
  table: string,
  key: StringIndexable,
  update: string,
  attr: StringIndexable,
  attrNames?: StringIndexable
) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !key || !update || !attr) return null;

  let cmdParams: UpdateCommandInput = {
    TableName: table,
    Key: key,
    UpdateExpression: update,
    ExpressionAttributeValues: attr,
  };
  if (attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: attrNames };
  const command = new UpdateCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('UpdateCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

export const readItem = async <T = any>(
  table: string,
  key: StringIndexable,
  projection?: string,
  attrNames?: StringIndexable
) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !key) return null;

  let contents: T | null = null;
  let cmdParams: GetCommandInput = { TableName: table, Key: key };

  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ProjectionExpressions.html
  if (projection) cmdParams = { ...cmdParams, ProjectionExpression: projection };
  if (attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: attrNames };

  const command = new GetCommand(cmdParams);

  try {
    const results = await dbClient.client.send(command);
    const item = results.Item;

    if (item) {
      contents = item as T;
    }
  } catch (err) {
    console.error('GetCommandInput:', cmdParams);
    console.error(err);
    // throw err;
  }

  return contents;
};

// Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-table-read-write-batch.html
const batchReadItems = async <T = any>(
  table: string,
  keys: StringIndexable[],
  projection?: string,
  attrNames?: StringIndexable
) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !keys || !Array.isArray(keys) || !keys.length) return null;

  let contents: StringIndexable<T>[] | null = null;

  let reqParams: any = { Keys: keys };
  if (projection) reqParams = { ...reqParams, ProjectionExpression: projection };
  if (attrNames) reqParams = { ...reqParams, ExpressionAttributeNames: attrNames };

  const cmdParams: BatchGetCommandInput = {
    RequestItems: {
      [table]: reqParams,
    },
  };

  const command = new BatchGetCommand(cmdParams);

  try {
    const results = await dbClient.client.send(command);
    const items = results.Responses;

    if (items && items[table]) {
      contents = items[table];
    }
  } catch (err) {
    console.error('BatchGetCommandInput:', cmdParams);
    console.error(err);
    // throw err;
  }

  return contents;
};

// Note: ordering of items in result may not be same as that in `keys`
export const readItemsAll = async <T = any>(
  table: string,
  keys: StringIndexable[],
  projection?: string,
  attrNames?: StringIndexable
) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !keys || !Array.isArray(keys) || !keys.length) return null;

  let contents: StringIndexable<T>[] | null = null;
  let errFlag = false;

  const batchSize = BATCH_SIZE;
  const chunkSize = CHUNK_SIZE;

  const batchedKeys = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    const bkeys = keys.slice(i, i + batchSize);
    batchedKeys.push(bkeys);
  }

  for (let i = 0; i < batchedKeys.length; i += chunkSize) {
    const bchunks = batchedKeys.slice(i, i + chunkSize);

    const brlist = bchunks.map(ikeys => batchReadItems(table, ikeys, projection, attrNames));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const icontents = bslist.flat();
    const isError = icontents.find(e => e === null) === null;
    if (isError) {
      errFlag = true;
      contents = null;
    } else if (!errFlag) {
      if (contents) {
        contents = contents.concat(icontents as StringIndexable[]);
      } else {
        contents = icontents as StringIndexable[];
      }
    }
  }

  return contents;
};

export const queryItems = async (
  table: string,
  indexName: string,
  cond: string,
  attr: StringIndexable,
  projection = '',
  desc = false
) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !cond || !attr) return null;

  let contents: StringIndexable[] | null = null;

  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
  // Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-query-scan.html
  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SQLtoNoSQL.Indexes.QueryAndScan.html#SQLtoNoSQL.Indexes.QueryAndScan.DynamoDB
  let cmdParams: QueryCommandInput = {
    TableName: table,
    KeyConditionExpression: cond,
    ExpressionAttributeValues: attr,
    // FilterExpression: "contains (category_id, :cid)",
  };

  if (indexName) cmdParams = { ...cmdParams, IndexName: indexName };
  if (projection) cmdParams = { ...cmdParams, ProjectionExpression: projection };
  if (desc) cmdParams = { ...cmdParams, ScanIndexForward: false };

  const command = new QueryCommand(cmdParams);

  try {
    const results = await dbClient.client.send(command);
    const items = results.Items;

    if (items) {
      contents = items;
    }
  } catch (err) {
    console.error('QueryCommandInput:', command.input);
    console.error(err);
    // throw err;
  }

  return contents;
};

export const scanItems = async (table: string, projection = '') => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table) return null;

  let contents: StringIndexable[] | null = null;

  // Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-query-scan.html
  let cmdParams: ScanCommandInput = {
    TableName: table,
  };

  if (projection) cmdParams = { ...cmdParams, ProjectionExpression: projection };

  const command = new ScanCommand(cmdParams);

  try {
    const results = await dbClient.client.send(command);
    const items = results.Items;

    // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.Pagination
    if (results.LastEvaluatedKey) {
      warn('Partial results obtained! Consider pagination.');
    }

    if (items) {
      contents = items;
    }
  } catch (err) {
    console.error('ScanCommandInput:', cmdParams);
    console.error(err);
    // throw err;
  }

  return contents;
};

export const deleteItem = async (table: string, key: StringIndexable) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !key) return null;

  const cmdParams: DeleteCommandInput = { TableName: table, Key: key };
  const command = new DeleteCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('DeleteCommandInput:', cmdParams);
    console.error(err);
    // throw err;
    return false;
  }

  return true;
};

// Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-table-read-write-batch.html
// Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/interfaces/batchwriteitemcommandinput.html#requestitems
const batchDeleteItems = async (table: string, keys: StringIndexable[]) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !keys || !Array.isArray(keys) || !keys.length) return null;

  const reqList = keys.map(key => ({ DeleteRequest: { Key: key } }));
  const cmdParams: BatchWriteCommandInput = {
    RequestItems: {
      [table]: reqList,
    },
  };

  const command = new BatchWriteCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('BatchWriteCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

export const deleteItemsAll = async (table: string, keys: StringIndexable[]) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !keys || !Array.isArray(keys) || !keys.length) return null;

  let errFlag = false;

  const batchSize = BATCH_SIZE;
  const chunkSize = CHUNK_SIZE;

  const batchedItems = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    const bitems = keys.slice(i, i + batchSize);
    batchedItems.push(bitems);
  }

  for (let i = 0; i < batchedItems.length; i += chunkSize) {
    const bchunks = batchedItems.slice(i, i + chunkSize);

    const brlist = bchunks.map(ikeys => batchDeleteItems(table, ikeys));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const isSuccess = bslist.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};

// ----------------

// await dbWriteItem('lesson_list', { id: 'id_001', title: 'My Lesson' });

// const contents = await dbReadItem('lesson_list', { id: 'id_001' });
// console.log(contents);

// await dbUpdateItem(
//   'lesson_list',
//   { id: 'id_001' },
//   'set #a = :a, #b = :b',
//   { ':a': 'abhi@raj.me', ':b': 'Abhishek Raj' },
//   { '#a': 'email', '#b': 'name' }
// );

// ----------------
