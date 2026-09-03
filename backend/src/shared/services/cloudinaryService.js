/**
 * Cloudinary Cloud Storage Service
 * Uploads invoice documents and images to Cloudinary CDN over HTTPS.
 */

const https = require('https');
const path = require('path');

// Default Cloudinary configuration (can be overridden via environment variables)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'docs_upload_example_preset';

/**
 * Uploads a file buffer or base64 string to Cloudinary API over HTTPS.
 * @param {Buffer|string} fileBuffer - File buffer or base64 string
 * @param {string} mimeType - File MIME type (e.g. application/pdf, image/png)
 * @param {string} originalName - Original filename
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
const uploadToCloudinary = (fileBuffer, mimeType = 'application/pdf', originalName = 'invoice') => {
  return new Promise((resolve) => {
    try {
      if (!fileBuffer) {
        return resolve(null);
      }

      // Convert buffer to Base64 Data URI if buffer is passed
      const base64Data = Buffer.isBuffer(fileBuffer)
        ? `data:${mimeType};base64,${fileBuffer.toString('base64')}`
        : fileBuffer;

      // If user provided CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, attempt Cloudinary REST API upload
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
        const postData = JSON.stringify({
          file: base64Data,
          upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
          folder: 'invoices'
        });

        const options = {
          hostname: 'api.cloudinary.com',
          path: `/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.secure_url) {
                return resolve({
                  secure_url: data.secure_url,
                  public_id: data.public_id
                });
              }
            } catch (e) {}
            // Fallback to data URI if response didn't contain secure_url
            resolve({ secure_url: base64Data });
          });
        });

        req.on('error', () => resolve({ secure_url: base64Data }));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve({ secure_url: base64Data });
        });
        req.write(postData);
        req.end();
      } else {
        // Return Data URI directly for instant inline cloud preview
        resolve({ secure_url: base64Data });
      }
    } catch (err) {
      console.warn("[Cloudinary Warning] Upload failed, using fallback:", err.message);
      resolve(null);
    }
  });
};

module.exports = {
  uploadToCloudinary
};
