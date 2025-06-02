import { Box, Button, LinearProgress } from '@mui/material';
import * as faceapi from 'face-api.js';
import { useEffect, useState, useRef } from 'react';



const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const [matchedPerson, setMatchedPerson] = useState<string>('No match found');
  const [recognitionStatus, setRecognitionStatus] = useState<string>('Initializing...');
  const [matchDistance, setMatchDistance] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const [modelsLoaded, setModelsLoaded] = useState(false); // NEW
  const ws = useRef<WebSocket | null>(null);

  // Track recognition loop state
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Load face-api.js models
useEffect(() => {
  const loadModels = async () => {
    const MODEL_URL = '/models';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    console.log('ssdMobilenetv1 loaded');
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('faceRecognitionNet loaded');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('faceLandmark68Net loaded');
    setModelsLoaded(true);
    setRecognitionStatus('Models loaded.');
  };
  loadModels();
}, []);

  // Load reference images and compute descriptors
  const [referenceDescriptors, setReferenceDescriptors] = useState<any[]>([]);
  useEffect(() => {
    const loadReferenceDescriptors = async () => {
      if (!modelsLoaded || recentImages.length === 0) return; // Only run if models loaded
      setRecognitionStatus('Loading reference images...');
      const descriptors: any[] = [];
      for (const imgName of recentImages) {
        try {
          const img = await faceapi.fetchImage(`http://localhost:3001/uploads/${imgName}`);
let detection = null;
if (videoRef.current) {
  detection = await faceapi
    .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
}
          if (detection) {
            descriptors.push({
              label: imgName,
              descriptor: detection.descriptor,
            });
          }
        } catch (e) {
          // Ignore failed images
        }
      }
      setReferenceDescriptors(descriptors);
      setRecognitionStatus('Reference images loaded.');
    };
    loadReferenceDescriptors();
  }, [recentImages, modelsLoaded]); // Depend on modelsLoaded

  // Setup camera on mount
  useEffect(() => {
    setupCamera();
  }, []);

  // Recognition loop
  useEffect(() => {
    console.log('Recognition loop started');
    console.log('Models loaded, starting recognition loop');
    let interval: NodeJS.Timeout;
    const recognize = async () => {
      if (
        !videoRef.current ||
        videoRef.current.readyState !== 4
      ) {
        return;
      }
      setIsRecognizing(true);
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();
      console.log('Detection:', detection);
      console.log('lol')

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      if (detection) {
        // Draw box
        if (canvasRef.current) {
          faceapi.draw.drawDetections(
            canvasRef.current,
            faceapi.resizeResults([detection], {
              width: canvasRef.current.width,
              height: canvasRef.current.height,
            })
          );
        }

        let bestMatch = { label: 'No match found', distance: 1 };
        if (referenceDescriptors.length > 0) {
          for (const ref of referenceDescriptors) {
            const distance = faceapi.euclideanDistance(detection.descriptor, ref.descriptor);
            if (distance < bestMatch.distance) {
              bestMatch = { label: ref.label, distance };
            }
          }
          setMatchedPerson(bestMatch.label);
          setMatchDistance(bestMatch.distance);
          setRecognitionStatus(
            bestMatch.distance < 0.6
              ? `Match: ${bestMatch.label} (distance: ${bestMatch.distance.toFixed(2)})`
              : 'No match found'
          );
        } else {
          setMatchedPerson('No match found');
          setMatchDistance(1);
          setRecognitionStatus('No reference images loaded.');
        }
      } else {
        setMatchedPerson('No face detected');
        setRecognitionStatus('No face detected');
        setMatchDistance(1);
      }
      setIsRecognizing(false);
    };

    interval = setInterval(recognize, 1000); // Run every second

    return () => clearInterval(interval);
  }, [modelsLoaded, referenceDescriptors]); // Only depend on modelsLoaded and referenceDescriptors

  async function setupCamera() {
    if (videoRef.current) {
      videoRef.current.width = 600;
      videoRef.current.height = 560;
      videoRef.current.autoplay = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        videoRef.current.srcObject = stream;
        setRecognitionStatus('Camera stream started.'); // Add this line
      } catch (error) {
        console.error('Error accessing camera:', error);
        setRecognitionStatus('Camera access failed. Please check permissions.');
      }
    }
  }

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
<div className="video-container" style={{ position: 'relative' }}>
  <video ref={videoRef} style={{ borderRadius: '20px' }} />
<canvas
  ref={canvasRef}
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: '20px',
    pointerEvents: 'none',
       zIndex: 10, 
  }}
  width={600}
  height={560}
/>
</div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignContent: 'center' }}>
          <div style={{ width: '600px', height: 'auto', borderRadius: '10px', padding: '20px' }}>
            <h1 style={{ textAlign: 'center', color: 'white' }}>Facial Recognition</h1>
            <div style={{ textAlign: 'center', fontSize: '24px' }}>
              <Box sx={{ width: '100%', marginBottom: '20px' }}>
                <p style={{ color: 'white' }}>Status: {recognitionStatus}</p>
                <p style={{ color: 'white' }}>Matched Person: {matchedPerson}</p>
                {recentImages.length === 0 && (
                  <p style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>
                    Take a reference photo first to start facial recognition!
                  </p>
                )}
                <LinearProgress
                  sx={{ height: "30px" }}
                  color={matchDistance < 0.6 ? 'success' : 'error'}
                  variant="determinate"
                  value={(1 - matchDistance) * 100}
                />
              </Box>
            </div>
          </div>
        </div>
      </div>
      <Button title="Check for Match" onClick={() => setIsRecognizing(!isRecognizing)} style={{ margin: '20px', backgroundColor: 'blue', color: 'white' }}>
        {isRecognizing ? 'Stop Recognition' : 'Start Recognition'}
      </Button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
        <h2 style={{ color: 'white' }}>Recent Images</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          {recentImages.map((imgName) => (
            <img
              key={imgName}
              src={`http://localhost:3001/uploads/${imgName}`}
              alt={imgName}
              style={{ width: '150px', height: '150px', objectFit: 'cover', margin: '10px', borderRadius: '10px' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
export default App;