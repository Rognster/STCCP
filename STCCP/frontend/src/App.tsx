import { Box, Input, LinearProgress, Portal } from '@mui/material';
import * as faceapi from 'face-api.js';
import { useEffect, useState, useRef } from 'react';


const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [happinessLevel, setHappinessLevel] = useState(0);
  const [tempname, setTempname] = useState<string | null>(null);


  async function setupCamera() {
    if (videoRef.current) {
      videoRef.current.width = 600;
      videoRef.current.height = 560;
      videoRef.current.autoplay = true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      videoRef.current.srcObject = stream;
    }
  }

  async function loadModels() {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    ]);
  }

  async function detectFaces() {
    if (videoRef.current) {
      const detectionsWithExpressions = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (detectionsWithExpressions.length > 0) {
        const expressions = detectionsWithExpressions[0].expressions;
        setHappinessLevel(Math.round(expressions.happy * 100));
      } else {
        setHappinessLevel(prev => Math.max(prev - 1, 0));
      }

      setTimeout(() => {
        requestAnimationFrame(detectFaces);
      }, 200);
    }
  }

  useEffect(() => {
    setupCamera().then(async () => {
      await loadModels();

      if (videoRef.current && videoRef.current.readyState >= 3) {
        detectFaces();
      } else if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          detectFaces();
        };
      }
    });
  }, []);


  const takePictureAndSave = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');

      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const detections = await faceapi
          .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detections.length > 0) {
          const happyFace = detections.reduce((prevFace, currentFace) => {
            return (prevFace.expressions.happy > currentFace.expressions.happy) ? prevFace : currentFace;
          });

          const box = happyFace.detection.box;
          const padding = {
            width: box.width * 0.1,
            height: box.height * 0.1
          };

          const cropArea = {
            x: Math.max(0, box.x - padding.width),
            y: Math.max(0, box.y - padding.height),
            width: Math.min(canvas.width - box.x + padding.width, box.width + padding.width * 2),
            height: Math.min(canvas.height - box.y + padding.height, box.height + padding.height * 2)
          };

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropArea.width;
          croppedCanvas.height = cropArea.height;
          const croppedContext = croppedCanvas.getContext('2d');

          if (croppedContext) {
            croppedContext.drawImage(
              canvas,
              cropArea.x, cropArea.y, cropArea.width, cropArea.height,
              0, 0, cropArea.width, cropArea.height
            );

            // Convert the cropped canvas to a data URL
            const croppedDataUrl = croppedCanvas.toDataURL('image/png');
            const blob = await (await fetch(croppedDataUrl)).blob();
            const formData = new FormData();
            formData.append('image', blob, `${tempname || 'snapshot'}.png`);

            console.log('Cropped face image captured and ready to be sent');
            const response = await fetch('http://localhost:3001/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              console.log('Cropped face image uploaded successfully');
            } else {
              console.error('Cropped face image upload failed:', response.statusText);
            }
          }
        } else {
          console.log('No face detected, saving full image');
          const dataUrl = canvas.toDataURL('image/png');
          const blob = await (await fetch(dataUrl)).blob();
          const formData = new FormData();
          formData.append('image', blob, 'snapshot.png');

          console.log('Full image captured and ready to be sent');
          const response = await fetch('http://localhost:3001/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            console.log('Full image uploaded successfully');
          } else {
            console.error('Image upload failed:', response.statusText);
          }
        }
      }
      setFlashLevel(100);
      const flashDuration = 1000;
      const interval = 50;
      const steps = flashDuration / interval;
      for (let i = 0; i <= steps; i++) {
        setTimeout(() => {
          const linearProgress = 1 - i / steps;
          const curvedProgress = linearProgress * linearProgress;
          setFlashLevel(curvedProgress * 100);
        }, i * interval);
      }
      await new Promise(resolve => setTimeout(resolve, flashDuration));
    }
  };



  useEffect(() => {
    let happinessTimer: NodeJS.Timeout | null = null;

    if (happinessLevel >= 55) {
      if (!happinessTimer) {
        happinessTimer = setTimeout(() => {
          takePictureAndSave();
        }, 1000);
      }
    } else {
      if (happinessTimer) {
        clearTimeout(happinessTimer);
        happinessTimer = null;
      }
    }
    return () => {
      if (happinessTimer) {
        clearTimeout(happinessTimer);
      }
    };
  }, [happinessLevel]);
  const [flashLevel, setFlashLevel] = useState(0);


  return (
    <div style={{
      maxWidth: '1500px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignContent: 'center'
    }}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'center', alignContent: 'center', backgroundColor: 'black', borderRadius: '20px' }}>
        <video ref={videoRef} style={{ borderRadius: '20px' }} />
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignContent: 'center' }}>
          <div style={{ width: '600px', height: 'auto', borderRadius: '10px', padding: '20px' }}>
            <h1 style={{ textAlign: 'center' }}>Personalundersökning</h1>
            <div style={{ textAlign: 'center', fontSize: '24px' }}>
              <Box sx={{ width: '100%' }}>
                <p>Gladhet: <span id="happiness-level">{happinessLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='success' variant="determinate" value={happinessLevel} />
              </Box>
            </div>
            <Input
              type="text"
              placeholder="Skriv in ditt namn annars kommer du heta 'snapshot'"
              value={tempname || ''}
              onChange={(e) => setTempname(e.target.value)}
              style={{ width: '100%', marginTop: '20px', padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#FFFFFF' }}
            />
            {
              tempname && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p> {tempname}!</p>
                </div>
              )
            }
          </div>
        </div>
        <Portal>
          {flashLevel > 0 && (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: `rgba(255, 255, 255, ${flashLevel / 100})`, zIndex: 9999 }} />
            </>)}
        </Portal>
      </div>
    </div>
  );
}
export default App;