# narrate-mate
Narrate Mate turns books into interactive, voice-enabled knowledge. Listen, learn — powered by AI, serverless AWS, and future-ready RAG/CAG for students, kids, and pros.

How to Setup 
1. Install Layer dependency by
  a. cd layers/pdf2img-layer
  b. npm install
2. Setup terraform dependencies , by terraform init
3. Please set aws credentials in CLI ( secret key and access key )
4. setup infra by "terraform apply"
5. install depencencies for UI by
   a. cd app
   b. npm install
6. Update URL of CDN and API in app/src/js/app.js line no: 38
7. run "npm run dev" to run the application.
