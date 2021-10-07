/**
 * Partition key vs Composite primary key:
 * Ref: https://aws.amazon.com/premiumsupport/knowledge-center/primary-key-dynamodb-table/
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
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

import { StringIndexable } from '../common/common.model';
import { CustomError } from '../common/error';

let dbDocClient: DynamoDBDocumentClient | null = null;

const DynamoDBError = (msg: string) => new CustomError(msg, { name: 'DynamoDBError' });

const initializationError = () => {
  throw DynamoDBError('DynamoDB is possibly uninitialized!');
};

export const init = (region: string) => {
  const dbClient = new DynamoDBClient({ region });

  // Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_lib_dynamodb.html#configuration
  if (!dbDocClient) {
    dbDocClient = DynamoDBDocumentClient.from(dbClient);
  }
};

const writeItemForceHelper = async <T = any>(table: string, data: T, key: string, i: number): Promise<T | null> => {
  if (!dbDocClient) return initializationError();
  if (!table || !data) return null;

  if (!(data as any)[key]) {
    (data as any)[key] = short.uuid();
  }
  const cmdParams: PutCommandInput = { TableName: table, Item: data, ConditionExpression: `attribute_not_exists(${key})` };
  const command = new PutCommand(cmdParams);
  const numberOfAttempts = 3;

  try {
    await dbDocClient.send(command);
  } catch (err: any) {
    // console.error('PutCommandInput:', cmdParams);
    // console.error(err);
    if (err.name === 'ConditionalCheckFailedException') {
      if (i < numberOfAttempts - 1) {
        (data as any)[key] = short.uuid(); // new primary key
        const ret: T | null = await writeItemForceHelper(table, data, key, i + 1);
        return ret;
      }
      console.error('PutCommandInput:', cmdParams);
      console.error('[ERROR] Maximum attempts overflow!');
    }
    return null;
  }

  return data;
};

export const writeItemForce = async <T = any>(table: string, data: T, key = 'id'): Promise<T | null> => {
  return writeItemForceHelper<T>(table, data, key, 0);
};

export const writeItem = async (table: string, data: StringIndexable) => {
  if (!dbDocClient) return initializationError();
  if (!table || !data) return null;

  const cmdParams: PutCommandInput = { TableName: table, Item: data };
  const command = new PutCommand(cmdParams);

  try {
    await dbDocClient.send(command);
  } catch (err) {
    console.error('PutCommandInput:', cmdParams);
    console.error(err);
    return null;
    // throw err;
  }

  return true;
};

export const updateItem = async (
  table: string,
  key: StringIndexable,
  update: string,
  attr: StringIndexable,
  attrNames?: StringIndexable
) => {
  if (!dbDocClient) return initializationError();
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
    await dbDocClient.send(command);
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
  if (!dbDocClient) return initializationError();
  if (!table || !key) return null;

  let contents: T | null = null;
  let cmdParams: GetCommandInput = { TableName: table, Key: key };

  // Ref: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ProjectionExpressions.html
  if (projection) cmdParams = { ...cmdParams, ProjectionExpression: projection };
  if (attrNames) cmdParams = { ...cmdParams, ExpressionAttributeNames: attrNames };

  const command = new GetCommand(cmdParams);

  try {
    const results = await dbDocClient.send(command);
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

export const queryItems = async (
  table: string,
  indexName: string,
  cond: string,
  attr: StringIndexable,
  projection = '',
  desc = false
) => {
  if (!dbDocClient) return initializationError();
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
    const results = await dbDocClient.send(command);
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
  if (!dbDocClient) return initializationError();
  if (!table) return null;

  let contents: StringIndexable[] | null = null;

  // Ref: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-query-scan.html
  let cmdParams: ScanCommandInput = {
    TableName: table,
  };

  if (projection) cmdParams = { ...cmdParams, ProjectionExpression: projection };

  const command = new ScanCommand(cmdParams);

  try {
    const results = await dbDocClient.send(command);
    const items = results.Items;

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
  if (!dbDocClient) return initializationError();
  if (!table || !key) return null;

  const cmdParams: DeleteCommandInput = { TableName: table, Key: key };
  const command = new DeleteCommand(cmdParams);

  try {
    await dbDocClient.send(command);
  } catch (err) {
    console.error('DeleteCommandInput:', cmdParams);
    console.error(err);
    // throw err;
    return false;
  }

  return true;
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
