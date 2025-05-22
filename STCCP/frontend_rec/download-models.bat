@echo off
echo Downloading face-api.js model files...

set MODELS_DIR=public\models
set BASE_URL=https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights

echo Creating models directory if it doesn't exist...
if not exist %MODELS_DIR% mkdir %MODELS_DIR%

echo Downloading face recognition model files...
curl -L %BASE_URL%/face_recognition_model-shard1 -o %MODELS_DIR%\face_recognition_model-shard1
curl -L %BASE_URL%/face_recognition_model-shard2 -o %MODELS_DIR%\face_recognition_model-shard2
curl -L %BASE_URL%/face_recognition_model-weights_manifest.json -o %MODELS_DIR%\face_recognition_model-weights_manifest.json

echo Downloading face landmark model files...
curl -L %BASE_URL%/face_landmark_68_model-shard1 -o %MODELS_DIR%\face_landmark_68_model-shard1
curl -L %BASE_URL%/face_landmark_68_model-weights_manifest.json -o %MODELS_DIR%\face_landmark_68_model-weights_manifest.json

echo Downloading SSD MobileNet model files...
curl -L %BASE_URL%/ssd_mobilenetv1_model-shard1 -o %MODELS_DIR%\ssd_mobilenetv1_model-shard1
curl -L %BASE_URL%/ssd_mobilenetv1_model-shard2 -o %MODELS_DIR%\ssd_mobilenetv1_model-shard2
curl -L %BASE_URL%/ssd_mobilenetv1_model-weights_manifest.json -o %MODELS_DIR%\ssd_mobilenetv1_model-weights_manifest.json

echo All model files downloaded successfully!
