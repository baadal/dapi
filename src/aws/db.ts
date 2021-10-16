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
import { chunkifyArray } from '@baadal-sdk/utils';

import { dbClient } from './client';
import { StringIndexable } from '../common/common.model';
import { CustomError } from '../common/error';
import { warn, error } from '../common/logger';
import { BATCH_SIZE, CHUNK_SIZE } from '../common/const';

const DynamoDBError = (msg: string) => new CustomError(msg, { name: 'DynamoDBError' });

/** @internal */
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

/** @internal */
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

const writeItemForceHelper = async <T = any>(table: string, item: T, key: string, i: number): Promise<T | null> => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!table || !item) return null;

  if (!(item as any)[key]) {
    (item as any)[key] = short.uuid();
  }
  const cmdParams: PutCommandInput = { TableName: table, Item: item, ConditionExpression: `attribute_not_exists(${key})` };
  const command = new PutCommand(cmdParams);
  const numberOfAttempts = 3;

  try {
    await dbClient.client.send(command);
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      if (i < numberOfAttempts - 1) {
        (item as any)[key] = short.uuid(); // new primary key
        const ret: T | null = await writeItemForceHelper(table, item, key, i + 1);
        return ret;
      }
      console.error('PutCommandInput:', cmdParams);
      error('[ERROR] Maximum attempts overflow!');
    }
    return null;
  }

  return item;
};

export interface WriteItemForceInput<T = any> {
  table: string;
  item: T;
  key?: string;
}

/**
 * Write an item to a DynamoDB table, retry in case of key conflict
 * @param input input command object
 * @returns the created item, null in case of error
 *
 * ```js
 * writeItemForce({
 *   table: 'lesson_list',
 *   item: { title: 'My Lesson' },
 *   key: 'id',
 * });
 *
 * interface WriteItemForceInput<T = any> {
 *   table: string;
 *   item: T;
 *   key?: string; // default: `id`
 * }
 * ```
 */
export const writeItemForce = async <T = any>(input: WriteItemForceInput<T>): Promise<T | null> => {
  const key = input.key || 'id';
  return writeItemForceHelper<T>(input.table, input.item, key, 0);
};

export interface WriteItemInput {
  table: string;
  item: StringIndexable;
}

/**
 * Write an item to a DynamoDB table
 * @param input input command object
 * @returns true if successful, null in case of error
 *
 * ```js
 * writeItem({
 *   table: 'lesson_list',
 *   item: { id: 'id_001', title: 'My Lesson' },
 * });
 *
 * interface WriteItemInput {
 *   table: string;
 *   item: StringIndexable;
 * }
 * ```
 */
export const writeItem = async (input: WriteItemInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.item) return null;

  const cmdParams: PutCommandInput = { TableName: input.table, Item: input.item };
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

export interface WriteItemsAllInput {
  table: string;
  items: StringIndexable[];
}

/**
 * Write an list of items to a DynamoDB table
 * @param input input command object
 * @returns true if successful, null in case of error
 *
 * ```js
 * writeItemsAll({
 *   table: 'lesson_list',
 *   items: [{ id: 'id_001', title: 'My Lesson' }, { id: 'id_002', title: 'My Lesson 2' }],
 * });
 *
 * interface WriteItemInput {
 *   table: string;
 *   items: StringIndexable[];
 * }
 * ```
 */
export const writeItemsAll = async (input: WriteItemsAllInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.items || !Array.isArray(input.items) || !input.items.length) return null;

  let errFlag = false;

  const batchedItems = chunkifyArray(input.items, BATCH_SIZE);
  const chunkedItems = chunkifyArray(batchedItems, CHUNK_SIZE);

  for (let i = 0; i < chunkedItems.length; i += 1) {
    const bchunks = chunkedItems[i];

    const brlist = bchunks.map(iItems => batchWriteItems(input.table, iItems));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const isSuccess = bslist.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};

export interface UpdateItemInput {
  table: string;
  key: StringIndexable;
  update: string;
  attr: StringIndexable;
  attrNames?: StringIndexable;
}

/**
 * Update an item in DynamoDB table
 * @param input input command object
 * @returns true if successful, null in case of error
 *
 * ```js
 * updateItem({
 *   table: 'lesson_list',
 *   key: { id: 'id_001' },
 *   update: 'SET status = :status, #rev = 10',
 *   attr: { ':status': 'completed' },
 *   attrNames: { '#rev': 'revision' },
 * });
 *
 * interface UpdateItemInput {
 *   table: string;
 *   key: StringIndexable;
 *   update: string;
 *   attr: StringIndexable;
 *   attrNames?: StringIndexable;
 * }
 * ```
 */
export const updateItem = async (input: UpdateItemInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.key || !input.update || !input.attr) return null;

  let cmdParams: UpdateCommandInput = {
    TableName: input.table,
    Key: input.key,
    UpdateExpression: input.update,
    ExpressionAttributeValues: input.attr,
  };
  if (input.attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: input.attrNames };
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

export interface ReadItemInput {
  table: string;
  key: StringIndexable;
  projection?: string;
  attrNames?: StringIndexable;
}

/**
 * Read an item from DynamoDB table
 * @param input input command object
 * @returns item contents, null in case of error
 *
 * ```js
 * readItem({
 *   table: 'lesson_list',
 *   key: { id: 'id_001' },
 *   projection: 'id, lesson, status',
 * });
 *
 * interface ReadItemInput {
 *   table: string;
 *   key: StringIndexable;
 *   projection?: string;
 *   attrNames?: StringIndexable;
 * }
 * ```
 */
export const readItem = async <T = any>(input: ReadItemInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.key) return null;

  let contents: T | null = null;
  let cmdParams: GetCommandInput = { TableName: input.table, Key: input.key };

  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ProjectionExpressions.html
  if (input.projection) cmdParams = { ...cmdParams, ProjectionExpression: input.projection };
  if (input.attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: input.attrNames };

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
    return null;
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
    return null;
    // throw err;
  }

  return contents;
};

export interface ReadItemsAllInput {
  table: string;
  keys: StringIndexable[];
  projection?: string;
  attrNames?: StringIndexable;
}

/**
 * Read a list of items from DynamoDB table
 * Note: ordering of items in result may not be same as that in `keys`
 * @param input input command object
 * @returns list of contents for items, null in case of error
 *
 * ```js
 * readItemsAll({
 *   table: 'lesson_list',
 *   keys: [{ id: 'id_001' }, { id: 'id_002' }],
 *   projection: 'id, lesson, status',
 * });
 *
 * interface ReadItemsAllInput {
 *   table: string;
 *   keys: StringIndexable[];
 *   projection?: string;
 *   attrNames?: StringIndexable;
 * }
 * ```
 */
export const readItemsAll = async <T = any>(input: ReadItemsAllInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.keys || !Array.isArray(input.keys) || !input.keys.length) return null;

  let contents: StringIndexable<T>[] | null = null;
  let errFlag = false;

  const batchedKeys = chunkifyArray(input.keys, BATCH_SIZE);
  const chunkedKeys = chunkifyArray(batchedKeys, CHUNK_SIZE);

  for (let i = 0; i < chunkedKeys.length; i += 1) {
    const bchunks = chunkedKeys[i];

    const brlist = bchunks.map(ikeys => batchReadItems(input.table, ikeys, input.projection, input.attrNames));
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

export interface QueryItemsInput {
  table: string;
  indexName?: string;
  cond: string;
  attr: StringIndexable;
  attrNames?: StringIndexable;
  projection?: string;
  desc?: boolean;
}

/**
 * Query items from a DynamoDB table based on some condition
 * @param input input command object
 * @returns query results array, null in case of error
 *
 * ```js
 * dbQueryItems({
 *   table: 'lesson_list',
 *   indexName: 'status-revision-index',
 *   cond: 'status = :comp AND #rev >= :rev',
 *   attr: { ':comp': 'completed', ':rev': 9 },
 *   attrNames: { '#rev': 'revision' },
 *   projection: 'id, lesson, status, revision',
 * });
 *
 * interface QueryItemsInput {
 *   table: string;
 *   indexName?: string;
 *   cond: string;
 *   attr: StringIndexable;
 *   attrNames?: StringIndexable;
 *   projection?: string;
 *   desc?: boolean;
 * }
 * ```
 */
export const queryItems = async (input: QueryItemsInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.cond || !input.attr) return null;

  let contents: StringIndexable[] | null = null;
  const desc = input.desc || false;

  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html
  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
  // Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-query-scan.html
  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SQLtoNoSQL.Indexes.QueryAndScan.html#SQLtoNoSQL.Indexes.QueryAndScan.DynamoDB
  let cmdParams: QueryCommandInput = {
    TableName: input.table,
    KeyConditionExpression: input.cond,
    ExpressionAttributeValues: input.attr,
    // FilterExpression: "contains (category_id, :cid)",
  };

  if (input.indexName) cmdParams = { ...cmdParams, IndexName: input.indexName };
  if (input.attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: input.attrNames };
  if (input.projection) cmdParams = { ...cmdParams, ProjectionExpression: input.projection };
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
    return null;
    // throw err;
  }

  return contents;
};

export interface ScanItemsInput {
  table: string;
  projection?: string;
}

/**
 * Scan all items in a DynamoDB table
 * Note: avoid using this method in favour of `queryItems` method due to performance reasons
 * @param input input command object
 * @returns results of the scan query, null in case of error
 *
 * ```js
 * scanItems({
 *   table: 'lesson_list',
 *   projection: 'id, status',
 * });
 *
 * interface ScanItemsInput {
 *   table: string;
 *   projection?: string;
 * }
 * ```
 */
export const scanItems = async (input: ScanItemsInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table) return null;

  let contents: StringIndexable[] | null = null;

  // Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-query-scan.html
  let cmdParams: ScanCommandInput = {
    TableName: input.table,
  };

  if (input.projection) cmdParams = { ...cmdParams, ProjectionExpression: input.projection };

  const command = new ScanCommand(cmdParams);

  try {
    const results = await dbClient.client.send(command);
    const items = results.Items;

    // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.Pagination
    if (results.LastEvaluatedKey) {
      warn('[scanItems] Partial results obtained! Consider pagination.');
    }

    if (items) {
      contents = items;
    }
  } catch (err) {
    console.error('ScanCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return contents;
};

export interface DeleteItemInput {
  table: string;
  key: StringIndexable;
}

/**
 * Delete an item in a DynamoDB table
 * @param input input command object
 * @returns true if successful, null in case of error
 *
 * ```js
 * deleteItem({
 *   table: 'lesson_list',
 *   key: { id: 'id_001' },
 * });
 *
 * interface DeleteItemInput {
 *   table: string;
 *   key: StringIndexable;
 * }
 * ```
 */
export const deleteItem = async (input: DeleteItemInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.key) return null;

  const cmdParams: DeleteCommandInput = { TableName: input.table, Key: input.key };
  const command = new DeleteCommand(cmdParams);

  try {
    await dbClient.client.send(command);
  } catch (err) {
    console.error('DeleteCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
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

export interface DeleteItemsAllInput {
  table: string;
  keys: StringIndexable[];
}

/**
 * Delete a list of items in a DynamoDB table
 * @param input input command object
 * @returns true if successful, null in case of error
 *
 * ```js
 * deleteItemsAll({
 *   table: 'lesson_list',
 *   keys: [{ id: 'id_001' }, { id: 'id_002' }],
 * });
 *
 * interface DeleteItemsAllInput {
 *   table: string;
 *   keys: StringIndexable[];
 * }
 * ```
 */
export const deleteItemsAll = async (input: DeleteItemsAllInput) => {
  if (!dbClient.client) tryInit();
  if (!dbClient.client) return null;
  if (!input.table || !input.keys || !Array.isArray(input.keys) || !input.keys.length) return null;

  let errFlag = false;

  const batchedItems = chunkifyArray(input.keys, BATCH_SIZE);
  const chunkedItems = chunkifyArray(batchedItems, CHUNK_SIZE);

  for (let i = 0; i < chunkedItems.length; i += 1) {
    const bchunks = chunkedItems[i];

    const brlist = bchunks.map(ikeys => batchDeleteItems(input.table, ikeys));
    const bslist = await Promise.all(brlist); // eslint-disable-line no-await-in-loop

    const isSuccess = bslist.every(e => e === true);
    if (!isSuccess) errFlag = true;
  }

  return errFlag ? null : true;
};
