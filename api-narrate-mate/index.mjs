import { books } from "./api/books.mjs";
import {upload_token} from "./api/upload_token.mjs";
import {languages} from "./api/languages.mjs";

export const handler = async (event) => {
    // Handle Request
    let res=null;
    let act=null;
    if(event.resource.indexOf("/books")==0){
        // Load Books class
        act= new books(event);
    }else if(event.resource.indexOf("/languages")==0){
        // Load Languages
        act= new languages(event);
    }else if(event.resource.indexOf("/status")==0){
        // Load Status
    }else if(event.resource.indexOf("/upload_token")==0){
        // Load upload_token
        act= new upload_token(event);
    }
    if(act==null){
        res={"status":"error","message":"Bad Request."}
    }
    else{
        res=await act.init(function(d){});
    }
    const response = {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"  // for CORS
        },
        body: JSON.stringify(res)
    };
    return response;
};