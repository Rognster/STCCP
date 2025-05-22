// This script downloads the required face-api.js models
const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'models');

// Ensure models directory exists
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
        console.log(`Downloaded: ${dest}`);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
};

// List of models to download
const models = [
  // SSD MobileNet
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/ssd_mobilenetv1_model-weights_manifest.json',
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/ssd_mobilenetv1_model-shard1',
  // Face Landmark Model
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/face_landmark_68_model-weights_manifest.json',
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/face_landmark_68_model-shard1',
  // Face Recognition Model
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/face_recognition_model-weights_manifest.json',
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/face_recognition_model-shard1',
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/face_recognition_model-shard2',
  // Tiny Face Detector
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/tiny_face_detector_model-weights_manifest.json',
  'https://github.com/justadudewhohacks/face-api.js/blob/master/weights/tiny_face_detector_model-shard1'
];

(async () => {
  try {
    const downloads = models.map(url => {
      const filename = path.basename(url);
      return downloadFile(url, path.join(modelsDir, filename));
    });
    
    await Promise.all(downloads);
    console.log('All models downloaded successfully!');
  } catch (error) {
    console.error('Error downloading models:', error);
  }
})();
