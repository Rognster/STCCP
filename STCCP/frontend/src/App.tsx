import { Box, LinearProgress, Portal } from '@mui/material';
import * as faceapi from 'face-api.js';
import { useEffect, useState, useRef } from 'react';


const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [happinessLevel, setHappinessLevel] = useState(0);
  const [angerLevel, setAngerLevel] = useState(0);
  const [surpriseLevel, setSurpriseLevel] = useState(0);
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);


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
        setAngerLevel(Math.round(expressions.angry * 100));
        setSurpriseLevel(Math.round(expressions.surprised * 100));
      } else {
        setHappinessLevel(prev => Math.max(prev - 1, 0));
        setAngerLevel(prev => Math.max(prev - 1, 0));
        setSurpriseLevel(prev => Math.max(prev - 1, 0));
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
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append('image', blob, 'snapshot.png');
        console.log('Image captured and ready to be sent:', dataUrl);
        const response = await fetch('http://localhost:3001/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          console.log('Image uploaded successfully');
        } else {
          console.error('Image upload failed:', response.statusText);
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
    ws.current = new WebSocket('ws://localhost:3001');

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.type === 'initial_images' || message.type === 'recent_images_update') {
          setRecentImages(message.payload);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    let happinessTimer: NodeJS.Timeout | null = null;

    if (happinessLevel >= 55 || angerLevel >= 55 || surpriseLevel >= 55) {
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
  }, [happinessLevel, angerLevel, surpriseLevel]);

  const [flashLevel, setFlashLevel] = useState(0);

  const deleteImage = async (filename: string) => {
    const response = await fetch('http://localhost:3001/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });
    if (response.ok) {
      console.log('Image deleted successfully');
    }
  };

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
                <p>Arghet: <span id="anger-level">{angerLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='error' variant="determinate" value={angerLevel} />
                <p>Förvånad: <span id="surprise-level">{surpriseLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='warning' variant="determinate" value={surpriseLevel} />
              </Box>
            </div>
          </div>
      </div>
      <Portal>
        {flashLevel > 0 && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: `rgba(255, 255, 255, ${flashLevel / 100})`, zIndex: 9999 }} />
          </>)}
      </Portal>
    </div>
          {recentImages.length > 0 && <div style={{ gap:'50px', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignContent: 'center', margin: '20px', borderRadius: '10px', padding: '20px', backgroundColor: 'white' }}>
            {recentImages.map((image, index) => (
              <img onClick={()=> deleteImage(image)} key={index} src={`http://localhost:3001/uploads/${image}`} alt={`Recent ${index}`} style={{width: '10vw', aspectRatio: 'auto',  borderRadius: '10px', marginBottom: '10px' }} />
            ))}
          </div>}
        </div>
  );
}
export default App;