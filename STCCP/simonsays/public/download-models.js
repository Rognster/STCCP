const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, 'models');
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
        console.log(`Downloaded: ${url} -> ${dest}`);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const downloadModels = async () => {
  // Models needed for emotion detection
  const models = [
    // Tiny face detector
    {
      url: 'https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-shard1',
      dest: path.join(MODELS_DIR, 'tiny_face_detector_model-shard1')
    },
    {
      url: 'https://github.com/vladmandic/face-api/raw/master/model/tiny_face_detector_model-weights_manifest.json',
      dest: path.join(MODELS_DIR, 'tiny_face_detector_model-weights_manifest.json')
    },
    // Face expression (emotion detection)
    {
      url: 'https://github.com/vladmandic/face-api/raw/master/model/face_expression_model-shard1',
      dest: path.join(MODELS_DIR, 'face_expression_model-shard1')
    },
    {
      url: 'https://github.com/vladmandic/face-api/raw/master/model/face_expression_model-weights_manifest.json',
      dest: path.join(MODELS_DIR, 'face_expression_model-weights_manifest.json')
    }
  ];

  try {
    const downloadPromises = models.map(model => downloadFile(model.url, model.dest));
    await Promise.all(downloadPromises);
    console.log('All models downloaded successfully!');
  } catch (error) {
    console.error('Error downloading models:', error);
  }
};

downloadModels();
