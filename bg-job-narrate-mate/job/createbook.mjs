import { S3Client, ListObjectsV2Command, CopyObjectCommand,GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import fs from "fs";

export class createbook {
    constructor(evt) {
        this.event = evt;
        this.bucket= this.event.DocumentLocation.S3Bucket;
        this.key=this.event.DocumentLocation.S3ObjectName;
        this.s3 = new S3Client();
        this.db = DynamoDBDocumentClient.from(new DynamoDBClient());
        this.ddbTable = process.env.DDB_BOOKS;
    }

    async init(){
        const md5Key = crypto.createHash("md5").update(this.key).digest("hex");
        // Copy folder to books folder
        await this.copyS3Folder(this.bucket,`temp/${md5Key}`,`books/${md5Key}`);
        // Save Data in DynamoDB
        await this.storeData(md5Key,`books/${md5Key}/book.json`);
        return "DONE"
    }

    async copyS3Folder(bucket, sourcePrefix, destinationPrefix) {
        let continuationToken;
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: sourcePrefix,
                ContinuationToken: continuationToken
            });  
            const res = await this.s3.send(listCommand);
            for (const obj of res.Contents || []) {
                const sourceKey = obj.Key;
                const destinationKey = sourceKey.replace(sourcePrefix, destinationPrefix);
    
                const copyCommand = new CopyObjectCommand({
                    Bucket: bucket,
                    CopySource: `${bucket}/${sourceKey}`,
                    Key: destinationKey
                });
    
                await this.s3.send(copyCommand);
                console.log(`Copied ${sourceKey} to ${destinationKey}`);
            }
            continuationToken = res.NextContinuationToken;
        } while (continuationToken);
    }
    async storeData(id,file){
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: file }));
        const jsonString = await this.streamToString(res.Body);
        const jsonData = JSON.parse(jsonString);
        // Transform: rename 'title' to 'name'
        if (jsonData.title) {
            jsonData.name = jsonData.title;
            delete jsonData.title;
        }
        delete jsonData.pages;
        // Add 'id' as md5 hash of s3 key
        jsonData.id = id;
        jsonData.thumbnail= `books/${id}/thumb.png`
        // Store in DynamoDB
        const putCmd = new PutCommand({
            TableName: this.ddbTable,
            Item: jsonData
        });
        await this.db.send(putCmd);
    }
    async streamToString(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", chunk => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            stream.on("error", reject);
        });
    }
}