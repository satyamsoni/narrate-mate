import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class upload_token {
  
  constructor(evt, bucket = process.env.S3_BUCKET, region = process.env.AWS_REGION) {
    this.event = evt;
    this.bucket = bucket;
    this.region = region;
    this.s3 = new S3Client({ region: this.region });
  }

  async init() {
    const fileId = `temp/FILE_${Date.now()}.pdf`; // or you can use uuid

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileId,
      ContentType: "application/pdf",
      ACL: "private" // or "public-read" if you want it public
    });

    try {
      const signedUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 min
      return {
        status: "success",
        url: signedUrl,
        fileKey: fileId
      };
    } catch (err) {
      return {
        status: "error",
        message: "Failed to generate presigned URL",
        error: err.message
      };
    }
  }
}
