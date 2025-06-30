import { readbook } from "./job/readbook.mjs";
import {analyze} from "./job/analyze.mjs";
import {createbook} from "./job/createbook.mjs";

export const handler = async (event) => {
    let act=null;
    let res=null;
    if(event.Records){
        // Call from Event
        if(event.Records[0].eventName=="ObjectCreated:Put"){
            // S3 Event
            let s3evt=event.Records[0].s3;
            console.log("Read the Document : ",s3evt.object)
            act= new readbook({"s3":s3evt.bucket.name,"object":s3evt.object});
        }else if(event.Records[0].EventSource=="aws:sns"){
            // SNS Event
            let snsevt=event.Records[0].Sns;
            let msg=JSON.parse(snsevt.Message);
            if(msg.API=="StartDocumentAnalysis"){
                console.log("Analyze the Document : ",msg)
                act= new analyze(msg);
            }else if(msg.API=="AnalysisReady"){
                console.log("Create Book : ",msg)
                act= new createbook(msg);
            }else{
                console.log(JSON.stringify(msg));
            }
        }else{
            console.log(JSON.stringify(event));
        }
    }
    if(act==null){
        res={"status":"error","message":"Bad Request."}
    }
    else{
        res=await act.init();
    }
    return res;
}