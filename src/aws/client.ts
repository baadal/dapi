import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dbDocClient: DynamoDBDocumentClient | null = null;

export const dbClient = { client: dbDocClient, id: null } as DBClientType;

export interface DBClientType {
  client: DynamoDBDocumentClient | null;
  id: string | null;
}
