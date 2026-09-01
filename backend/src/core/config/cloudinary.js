const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dydnryger';
const apiKey = process.env.CLOUDINARY_API_KEY || '595344579828597';
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const config = {
  cloud_name: cloudName,
  api_key: apiKey
};

if (apiSecret) {
  config.api_secret = apiSecret;
  console.log('Cloudinary configured with API Secret (Signed uploads active).');
} else {
  console.warn('Cloudinary API Secret missing (Unsigned uploads active if preset is provided).');
}

cloudinary.config(config);

module.exports = cloudinary;
