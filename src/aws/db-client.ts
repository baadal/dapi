import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dbDocClient: DynamoDBDocumentClient | null = null;
const id: string | null = null;

export default { dbDocClient, id } as { dbDocClient: DynamoDBDocumentClient | null; id: string | null };
