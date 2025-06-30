import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command, CopyObjectCommand,GetObjectCommand,HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

export class books {
  constructor(evt) {
    this.event = evt;
    const client = new DynamoDBClient(); // You can pass region if needed
    this.db = DynamoDBDocumentClient.from(client);
  }

  async init() {
    let pp=this.event.pathParameters;
    let res=null;
    if(!pp){
      // Get Booklist
      res=await this.books();
    }
    else if(pp.book_id){
      if(!pp.language){
        // Get Book 
        res=await this.book(pp.book_id);
      }else if(pp.language){
        // Get Audio
        res=await this.audio(pp.book_id,pp.language,parseInt(pp.page_no));
      }
    }
    return res;
  }
  async audio(book_id,lang,page){
    const pollyClient = new PollyClient();
    // First get page content
    let s3 = new S3Client();
    let res = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: "books/"+book_id+"/book.json" }));
    res = await this.streamToString(res.Body);res=JSON.parse(res);
    // Now Get Language list
    const command = new ScanCommand({TableName: process.env.DDB_LANGUAGES});
    let langList = await this.db.send(command);langList=langList.Items;
    let clang=langList.find(item=>item.id==res.language.toLowerCase());
    let cpage=res.pages.find(p => p.page === page);
    if(!cpage){
        return {
          status: "success",
          content:"",
          audio: "",
          language:clang.code
        };
    }
    else if(cpage.content==""){
      return {
        status: "success",
        content:"",
        audio: "",
        language:clang.code
      };
    }
    
    
    // Get Language info of Requested Language
    const language = langList.find(item=>item.id==lang.toLowerCase());
    // Now check if file in s3 exist books/[book_id]/audio/[lang]/[page_no].mp3
    const audioKey = `books/${book_id}/audio/${language.id}/${page}.mp3`;
    const s3Url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${audioKey}`;
    console.log(s3Url)
    cpage.content=this.formatValue(cpage.content);
    try{
      let fileEx=await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: audioKey }));
      return {
        status: "success",
        content:cpage.content,
        audio: audioKey,
        language:clang.code
      };
    }catch(e){
      console.log(lang.toLowerCase(),clang.id);
      if(lang.toLowerCase()!=clang.id){
        const translate = new TranslateClient();
        const params = {
          Text: cpage.content,
          SourceLanguageCode: clang.code.split("-")[0],
          TargetLanguageCode: language.code.split("-")[0]
        };
        const command = new TranslateTextCommand(params);
        const response = await translate.send(command);
        cpage.content=response.TranslatedText
      }
      
      const synthRes = await pollyClient.send(new SynthesizeSpeechCommand({
        OutputFormat: "mp3",
        Engine: "neural",
        Text: cpage.content,
        VoiceId: language.voice_id,
        LanguageCode: language.code
      }));
  
      const audioBuffer = await this.streamToBuffer(synthRes.AudioStream);
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: "audio/mpeg"
      }));
      return {
        status: "success",
        content:cpage.content,
        audio: audioKey,
        language:language.code
      };
    }
  }
  async book(bookId){
    let s3 = new S3Client();
    try{
      let res = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: "books/"+bookId+"/book.json" }));
      res = await this.streamToString(res.Body);res=JSON.parse(res);
      res.id=bookId;
      return {
        status: "success",
        data: res
      };
    }catch(e){
      return {
          status: "error",
          message: `No book found with id: ${bookId}`
        };
    }
  }
  async books(){
    const query = this.event.queryStringParameters || {};
    const count = parseInt(query.count) || 25;
    const page = parseInt(query.page) || 1;

    const command = new ScanCommand({
      TableName: process.env.DDB_BOOKS
    });
    try {
      const result = await this.db.send(command);
      const items = result.Items || [];
      const total = items.length;

      // Simple offset-based pagination
      const startIndex = (page - 1) * count;
      const paginatedItems = items.slice(startIndex, startIndex + count);

      return {
        status: "success",
        page,
        count,
        total,
        books: paginatedItems
      };
    } catch (err) {
      console.error("Error reading from DynamoDB:", err);
      return {
        status: "error",
        message: "Failed to fetch items.",
        error: err.message
      };
    }
  }
  async streamToString(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", chunk => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            stream.on("error", reject);
        });
    }
    async streamToBuffer(stream) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }
    formatValue(value) {
      if (Array.isArray(value)) {
          return value.join(',');
      }
      return value; // If it's a string, leave as-is
  }
}