import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

export class languages{
    constructor(evt){
        this.event=evt;
        const client = new DynamoDBClient(); // You can pass region if needed
        this.db = DynamoDBDocumentClient.from(client);

    }
    async init(d){
        const command = new ScanCommand({
          TableName: process.env.DDB_LANGUAGES
        });
        const result = await this.db.send(command);
        return {"status":"success","languages":result.Items};
    }
}