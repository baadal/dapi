import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const dbDocClient: DynamoDBDocumentClient | null = null;
const awsS3Client: S3Client | null = null;

export const dbClient = { client: dbDocClient, id: null } as DBClientType;
export const s3Client = { client: awsS3Client, id: null } as S3ClientType;

export interface DBClientType {
  client: DynamoDBDocumentClient | null;
  id: string | null;
}

export interface S3ClientType {
  client: S3Client | null;
  id: string | null;
}
