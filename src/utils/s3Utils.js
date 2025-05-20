const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const dotenv = require('dotenv');
dotenv.config();

// Check if AWS credentials are properly configured
const validateAWSConfig = () => {
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION', 
    'AWS_S3_BUCKET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`Missing AWS environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  return true;
};

// Initialize S3 client
let s3Client;
const BUCKET_NAME = process.env.AWS_S3_BUCKET;

if (validateAWSConfig()) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
} else {
  console.warn('AWS S3 integration is disabled due to missing configuration');
}

/**
 * Optimizes image quality and size
 * @param {Buffer} buffer - Original image buffer
 * @param {String} format - Target format
 * @returns {Promise<Buffer>} - Optimized image buffer
 */
const optimizeImage = async (buffer, format = 'jpeg') => {
  try {
    let sharpImage = sharp(buffer);
    
    // Get image metadata
    const metadata = await sharpImage.metadata();
    
    // Resize if too large (preserving aspect ratio)
    if (metadata.width > 1600 || metadata.height > 1600) {
      sharpImage = sharpImage.resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Convert and optimize
    if (format === 'jpeg' || format === 'jpg') {
      return sharpImage.jpeg({ quality: 80 }).toBuffer();
    } else if (format === 'png') {
      return sharpImage.png({ compressionLevel: 8 }).toBuffer();
    } else if (format === 'webp') {
      return sharpImage.webp({ quality: 80 }).toBuffer();
    } else {
      // Default to JPEG
      return sharpImage.jpeg({ quality: 80 }).toBuffer();
    }
  } catch (error) {
    console.error('Image optimization error:', error);
    return buffer; // Return original buffer if optimization fails
  }
};

/**
 * Uploads a file to S3
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} - S3 upload result
 */
exports.uploadToS3 = async (file) => {
  try {
    // Validate AWS configuration before proceeding
    if (!validateAWSConfig() || !s3Client) {
      throw new Error('AWS S3 is not properly configured. Check your environment variables.');
    }
    
    // Get file extension
    const extension = file.originalname.split('.').pop().toLowerCase();
    
    // Generate unique filename
    const filename = `products/${uuidv4()}.${extension}`;
    
    // Optimize image before upload
    const optimizedBuffer = await optimizeImage(file.buffer, extension);
    
    // Create the upload command
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: optimizedBuffer,
      ContentType: file.mimetype
    });
    
    // Upload to S3
    await s3Client.send(uploadCommand);
    
    // Generate a public URL for the file
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
    
    return {
      Key: filename,
      Location: fileUrl,
      ETag: 'etag'  // This is not returned in v3 but we keep it for compatibility
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Deletes a file from S3
 * @param {String} key - S3 object key
 * @returns {Promise<Object>} - S3 deletion result
 */
exports.deleteFromS3 = async (key) => {
  try {
    // Validate AWS configuration
    if (!validateAWSConfig() || !s3Client) {
      throw new Error('AWS S3 is not properly configured. Check your environment variables.');
    }
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    return await s3Client.send(command);
  } catch (error) {
    console.error('S3 deletion error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Generates a signed URL for temporary access to a private S3 object
 * @param {String} key - S3 object key
 * @param {Number} expires - Expiration time in seconds (default: 60)
 * @returns {Promise<String>} - Signed URL
 */
exports.getSignedUrl = async (key, expires = 60) => {
  try {
    // Validate AWS configuration
    if (!validateAWSConfig() || !s3Client) {
      throw new Error('AWS S3 is not properly configured. Check your environment variables.');
    }
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn: expires });
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Lists all files in an S3 folder
 * @param {String} folder - S3 folder path
 * @returns {Promise<Array>} - Array of file objects
 */
exports.listS3Files = async (folder) => {
  try {
    // Validate AWS configuration
    if (!validateAWSConfig() || !s3Client) {
      throw new Error('AWS S3 is not properly configured. Check your environment variables.');
    }
    
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folder
    });
    
    const response = await s3Client.send(command);
    
    return (response.Contents || []).map(item => ({
      key: item.Key,
      lastModified: item.LastModified,
      size: item.Size,
      url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
    }));
  } catch (error) {
    console.error('S3 list files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};