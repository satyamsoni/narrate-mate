import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import crypto from "crypto";
import { TextractClient, GetDocumentAnalysisCommand } from "@aws-sdk/client-textract";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export class analyze {
    constructor(evt) {
        this.event = evt;
        this.bucket= this.event.DocumentLocation.S3Bucket;
        this.key=this.event.DocumentLocation.S3ObjectName;
        this.s3 = new S3Client();
        this.textract = new TextractClient();
        this.bedrock = new BedrockRuntimeClient();
        this.sns = new SNSClient();
    }
    async init(){
        if(this.event.Status=="SUCCEEDED"){
            let extracted=await this.fetchTextractResults(this.event.JobId);
            const md5Key = crypto.createHash("md5").update(this.key).digest("hex");
            this.folder = `temp/${md5Key}/`;
            extracted = await this.generateFinal(extracted);
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: this.folder+"book.json",
                Body: extracted,
                ContentType: "application/json"
            });
            await this.s3.send(command);
            await this.publishSnsEvent({"API":"AnalysisReady","DocumentLocation":{"S3Bucket":this.bucket,"S3ObjectName":this.key}});
        }else{
            console.log(this.event.Status,"job failed");
        }
        return "Done";
    }
    async fetchTextractResults(jobId) {
        let results = [];
        let nextToken = undefined;
        do {
            const params = {
                JobId: jobId
            };
            if (nextToken) {
                params.NextToken = nextToken;
            }
            const response = await this.textract.send(new GetDocumentAnalysisCommand(params));
    
            if (response.Blocks) {
                results = results.concat(response.Blocks);
            }
            nextToken = response.NextToken;
        } while (nextToken);
        results= this.processResult(results);
        return results;
    }
    processResult(json){
        let pages =[];
        let i=0;
        let title="";
        let titleHeight=0;
        for(let index in json){
            let itm=json[index];
            let pn=itm.Page;
            if(itm.BlockType=="PAGE"){
                if(itm.Page==1){
                    titleHeight=itm.Geometry.BoundingBox.Height*70/100;
                }
                pages[pn-1]={"page":pn,"content":[]};
            }
            if(itm.Page==1&&itm.Geometry.BoundingBox.Top<titleHeight&&itm.Text){
                title+=" "+itm.Text;
            }
            if(itm.BlockType=="LINE"){
                pages[pn-1].content.push(itm.Text);
            }
            i++;
        }
        return {"name":title,"pages":pages};
    }
    async generateFinal(json) {
        const prompt = `\n\nHuman:
    Rules:
    1. Read the following JSON content extracted from a book.
    2. Correct formatting, remove repetitive footer text if present.
    3. Fix any mistakes and provide:
    
    - Title of the Book
    - Author
    - Language
    - Short summary (~100 characters)
    - Detailed summary (~500 characters)
    - Page by page content like [{"page":1,"content":"CONTENT OF THIS PAGE"}]
    
    Document content:
    
    <json>
    ${JSON.stringify(json)}
    </json>
    
    Respond strictly as minified JSON only, with fields: title, author, language, shortSummary, longSummary, pages.
    
    \n\nAssistant:`;
    
        const body = JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [
                { role: "user", content: prompt }
            ],
            max_tokens: 4000
        });
    
        const command = new InvokeModelCommand({
            modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body
        });
    
        const res = await this.bedrock.send(command);
        let responseJson = JSON.parse(new TextDecoder().decode(res.body));
        responseJson=responseJson.content[0].text.replace("</json>","").replace("<json>","");
        return responseJson;
    }
    async publishSnsEvent(message) {
        const command = new PublishCommand({
            TopicArn: process.env.SNS_TOPIC,
            Message: JSON.stringify(message)
        });
        await this.sns.send(command);
    }
}