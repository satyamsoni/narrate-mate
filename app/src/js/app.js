import $ from 'dom7';
import Framework7 from 'framework7/bundle';

// Import F7 Styles
import 'framework7/css/bundle';

// Import Icons and App Custom Styles
import '../css/icons.css';
import '../css/app.less';


// Import Routes
import routes from './routes.js';
// Import Store
import store from './store.js';

// Import main app component
import App from '../app.f7';
window.$=$;
var app = new Framework7({
  name: 'Narrate Mate', // App name
  theme: 'ios', // Automatic theme detection
  el: '#app', // App root element
  component: App, // App main component
  // App store
  store: store,
  // App routes
  routes: routes,
  on: {
    init: async function () {
      // Open login screen when app is initialized
      app.loginScreen.open('#my-login-screen');
      let lang=await nm.api.languages();
      store.state.languages=lang.languages;
    }
  }
});
window.nm={"url":{"api":"https://ig2ecizsx5.execute-api.eu-west-1.amazonaws.com/prod","cdn":"https://d27z3sxywybsho.cloudfront.net/"}};
nm.fetch=function(url,params){
  return new Promise(async (resolve) =>  {
    var res="";
    var p={method:"GET",mode: "cors",cache: "no-cache",headers:{"Content-Type": "application/json"},redirect: "follow",referrerPolicy: "no-referrer"};
    if(params.method){p.method=params.method;}
    if(params.headers){
      if(params.headers.Authorization){p.headers.Authorization=params.headers.Authorization;}
    }
    if(params.body){p.body=JSON.stringify(params.body);}
    var response = await fetch(url, p);
    var res=response.json();
    if(params.cache==true){
      //res;
    }
      resolve(res);
    });
}

nm.api={
  books:{
    list:function () {
      return new Promise(async (resolve) =>  {
            var res=await nm.fetch(nm.url.api+"/books",{"method":"GET"});
            resolve(res);
          });
    },
    get:function(id){
      return new Promise(async (resolve) =>  {
            var res=await nm.fetch(nm.url.api+"/books/"+id,{"method":"GET"});
            resolve(res);
      });
    },
    audio:function(book,language,page){
      https://ig2ecizsx5.execute-api.eu-west-1.amazonaws.com/prod/books/f76eff0b14e9a6916c1d83fee5917161/audio/en/1
      return new Promise(async (resolve) =>  {
            var res=await nm.fetch(nm.url.api+"/books/"+book+"/audio/"+language+"/"+page,{"method":"GET"});
            resolve(res);
      });
    }
  },
  upload_token:function(){
    return new Promise(async (resolve) =>  {
            var res=await nm.fetch(nm.url.api+"/upload_token",{"method":"GET"});
            resolve(res);
          });
  },
  languages:function(){
    return new Promise(async (resolve) =>  {
            var res=await nm.fetch(nm.url.api+"/languages",{"method":"GET"});
            resolve(res);
          });
  }
}

window.putObject=function(minfo,url,file,ofile,cb){
    var _=this;
    let formData=file;
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', minfo.mime_typ);
    xhr.setRequestHeader('Content-Disposition', 'attachment; filename='+ofile.replace(/[^a-zA-Z0-9. -_@#*;,?:   ]/g, ""));
    xhr.onerror = function(e){
              cb({"status":"error","id":minfo.id});
    };
    xhr.upload.onprogress = function(evt){
              let p=Math.round(evt.loaded/evt.total*100);
              cb({"status":"progress","progress":p,"id":minfo.id});
    };
    xhr.onload = function(){
              // Now Save Metadata and then delete from the list
              setTimeout(function(){
                cb({"status":"completed","id":minfo.id});
              },1500);
    };
    xhr.send(file);
  }
function ajax(options) {
    var xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', options.url, true);
    xhr.setRequestHeader('Content-Type', options.contentType || 'application/x-www-form-urlencoded');
    
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            options.success && options.success(xhr.responseText);
        } else {
            options.error && options.error(xhr);
        }
    };
    
    xhr.onerror = function() {
        options.error && options.error(xhr);
    };
    
    xhr.send(options.data || null);
}