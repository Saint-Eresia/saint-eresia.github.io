const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const env = require('../config/environment');

class LocalStorage {
  async put(buffer, extension, category) {
    const key = `${category}/${crypto.randomUUID()}${extension}`;
    const target = path.join(env.uploadDir, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return { key, url: `/uploads/${key.replaceAll('\\','/')}` };
  }
  async signedDownload(key) { return `/uploads/${String(key).replaceAll('\\','/')}`; }
}

class S3Storage {
  constructor() {
    const { S3Client } = require('@aws-sdk/client-s3');
    this.bucket = process.env.S3_BUCKET;
    this.client = new S3Client({ endpoint: process.env.S3_ENDPOINT || undefined, region: process.env.S3_REGION || 'auto', forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  }
  async put(buffer, extension, category, contentType='application/octet-stream') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3'); const key=`${category}/${crypto.randomUUID()}${extension}`;
    await this.client.send(new PutObjectCommand({ Bucket:this.bucket, Key:key, Body:buffer, ContentType:contentType, Metadata:{'saint-eresia-category':category} })); return { key, url:null };
  }
  async signedDownload(key) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3'); const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket,Key:key}),{expiresIn:300});
  }
}

module.exports = env.storageDriver === 's3' || env.storageDriver === 'r2' ? new S3Storage() : new LocalStorage();
