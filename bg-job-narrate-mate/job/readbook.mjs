import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from "@aws-sdk/client-textract";
import crypto from "crypto";
import { pdf } from "pdf-to-img";
import fs from "fs";

export class readbook {
    constructor(evt) {
        this.event = evt;
        this.s3 = new S3Client();
        this.textract = new TextractClient();
        this.bucket = this.event.s3;
    }

    async init() {
        
        const key = this.event.object.key;
        const md5Key = crypto.createHash("md5").update(key).digest("hex");
        this.folder = `temp/${md5Key}/`;
        // Step 1: Download PDF
        const pdfFile = await this.getPdfFromS3(this.bucket, key);
        // Step 2: Create and upload thumbnail
        const slides = await this.generateSlides(pdfFile);
        // Step 3: Textract extract text with layout
        const pages = await this.extractTextPageByPage(this.bucket, key);        
        // console.log(JSON.stringify(pages));
        return "Job Created";
    }

    async getPdfFromS3(bucket, key) {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return new Promise((resolve, reject) => {
            const chunks = [];
            res.Body.on("data", (chunk) => chunks.push(chunk));
            res.Body.on("end", function() {
                const tmpPath = "/tmp/input.pdf";
                fs.writeFileSync(tmpPath, Buffer.concat(chunks));
                resolve(tmpPath);          
            });
            res.Body.on("error", reject);
        });
    }

    async generateSlides(file){
        const document = await pdf(file, { scale: 1 });
        const page1Buffer = await document.getPage(1);
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.folder+"thumb.png",
            Body: page1Buffer,
            ContentType: "image/png"
        });
        await this.s3.send(command);
        let counter = 1;
        for await (const image of document) {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: `${this.folder}pages/${counter}.png`,
                Body: image,
                ContentType: "image/png"
            });
            await this.s3.send(command);
            counter++;
        }
    }
    async extractTextPageByPage(bucket, key) {
       const startCmd = new StartDocumentAnalysisCommand({
            DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
            FeatureTypes: ["LAYOUT"],
            NotificationChannel: {
                SNSTopicArn: process.env.SNS_TOPIC,
                RoleArn:process.env.ROLE_ARN
            }
        });
        const { JobId } = await this.textract.send(startCmd);
    }
}