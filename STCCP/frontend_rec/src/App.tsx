import { Box, LinearProgress, Portal } from '@mui/material';
import * as faceapi from 'face-api.js';
import { useEffect, useState, useRef } from 'react';

// Define types for our face recognizer
interface FaceDescriptorClass {
  className: string;
  faceDescriptors: Float32Array[];
}

interface Prediction {
  className: string;
  distance: number;
}

interface FaceRecognizer {
  descriptorsByClass: FaceDescriptorClass[];
  addFaces: (faces: HTMLImageElement[] | HTMLCanvasElement[], className: string) => Promise<void>;
  computeMeanDistance: (descriptors: Float32Array[], inputDescriptor: Float32Array) => number;
  predict: (face: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => Promise<Prediction[]>;
  predictBest: (face: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, unknownThreshold?: number) => Promise<Prediction>;
  clear: () => void;
}

// Adapted FaceRecognizer for client-side use with face-api.js
const createFaceRecognizer = (): FaceRecognizer => {
  // Helper functions
  const getBestPrediction = (predictions: Prediction[], unknownThreshold?: number): Prediction => {
    const best = predictions.sort((p1, p2) => p1.distance - p2.distance)[0];
    if (unknownThreshold && best.distance >= unknownThreshold) {
      best.className = 'unknown';
    }
    return best;
  };

  const faceRecognizer: FaceRecognizer = {
    descriptorsByClass: [] as FaceDescriptorClass[],
    
    async addFaces(faces: HTMLImageElement[] | HTMLCanvasElement[], className: string): Promise<void> {
      if (!faces || !faces.length) {
        throw new Error('train - expected an array containing at least one face image');
      }

      if (!className) {
        throw new Error('train - expected a class name');
      }

      const faceDescriptors: Float32Array[] = [];
      for (const face of faces) {
        const descriptor = await faceapi.computeFaceDescriptor(face);
        if (descriptor instanceof Float32Array) {
          faceDescriptors.push(descriptor);
        }
      }

      const idx = this.descriptorsByClass.findIndex(d => d.className === className);
      if (idx === -1) {
        this.descriptorsByClass.push({
          className,
          faceDescriptors
        });
      } else {
        this.descriptorsByClass[idx].faceDescriptors = 
          this.descriptorsByClass[idx].faceDescriptors.concat(faceDescriptors);
      }
    },

    // Compute mean distance between a descriptor and all descriptors of a class
    computeMeanDistance(descriptors: Float32Array[], inputDescriptor: Float32Array): number {
      if (!descriptors.length) return 1; // Return max distance if no descriptors
      const distances = descriptors.map(d => faceapi.euclideanDistance(d, inputDescriptor));
      return distances.reduce((sum, val) => sum + val, 0) / descriptors.length;
    },

    // Get prediction distances for all classes
    async predict(face: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<Prediction[]> {
      const inputDescriptor = await faceapi.computeFaceDescriptor(face);
      if (!(inputDescriptor instanceof Float32Array)) {
        return [];
      }
      
      return this.descriptorsByClass.map(ds => ({
        className: ds.className,
        distance: this.computeMeanDistance(ds.faceDescriptors, inputDescriptor)
      }));
    },

    // Return class name of prediction with lowest distance
    async predictBest(face: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, unknownThreshold = 0.6): Promise<Prediction> {
      const predictions = await this.predict(face);
      if (predictions.length === 0) {
        return { className: 'unknown', distance: 1 };
      }
      return getBestPrediction(predictions, unknownThreshold);
    },

    clear(): void {
      this.descriptorsByClass = [];
    }
  };

  return faceRecognizer;
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const [matchedPerson, setMatchedPerson] = useState<string>('No match found');
  const [recognitionStatus, setRecognitionStatus] = useState<string>('Initializing...');
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [matchDistance, setMatchDistance] = useState<number>(1);
  const ws = useRef<WebSocket | null>(null);
  const recognizerRef = useRef<FaceRecognizer | null>(null);
  const [flashLevel, setFlashLevel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function setupCamera() {
    if (videoRef.current) {
      videoRef.current.width = 600;
      videoRef.current.height = 560;
      videoRef.current.autoplay = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        videoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Error accessing camera:', error);
        setRecognitionStatus('Camera access failed. Please check permissions.');
      }
    }
  }

  async function loadModels() {
    setRecognitionStatus('Loading face recognition models...');
    const MODEL_URL = '/models';
    try {
      await Promise.all([
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      ]);
      console.log('All models loaded successfully');
      setRecognitionStatus('Models loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading face recognition models:', error);
      setRecognitionStatus(`Failed to load models: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  const loadTrainingImages = async () => {
    setRecognitionStatus('Loading training images...');
    if (!recognizerRef.current) {
      recognizerRef.current = createFaceRecognizer();
    } else {
      recognizerRef.current.clear();
    }

    try {
      // Process each image in recentImages
      for (const image of recentImages) {
        const imgUrl = `http://localhost:3001/uploads/${image}`;
        const img = await faceapi.fetchImage(imgUrl);
        
        // Detect face in the image
        const detections = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
          
        if (detections) {
          // Use the filename (without extension) as the className
          const className = image.split('-').pop()?.split('.')[0] || image;
          // Extract face for training
          await recognizerRef.current.addFaces([img], className);
          console.log(`Trained with image: ${image} as class: ${className}`);
        } else {
          console.warn(`No face detected in image: ${image}`);
        }
      }
      
      setRecognitionStatus('Training complete. Ready for recognition.');
      return true;
    } catch (error) {
      console.error('Error loading training images:', error);
      setRecognitionStatus('Training failed');
      return false;
    }
  };

  const startFaceRecognition = async () => {
    if (!videoRef.current || !canvasRef.current || isRecognizing) return;
    
    if (!recognizerRef.current || recognizerRef.current.descriptorsByClass.length === 0) {
      setRecognitionStatus('No training data available. Cannot start recognition.');
      return;
    }
    
    setIsRecognizing(true);
    setRecognitionStatus('Recognition started');
    
    const canvas = canvasRef.current;
    const displaySize = { width: videoRef.current.width, height: videoRef.current.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    const recognitionLoop = async () => {
      if (!videoRef.current || !isRecognizing || !canvasRef.current) return;
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
          
        if (detections.length > 0 && recognizerRef.current) {
          // Use the video element directly for recognition
          const bestMatch = await recognizerRef.current.predictBest(videoRef.current, 0.6);
          setMatchedPerson(bestMatch.className !== 'unknown' ? bestMatch.className : 'No match found');
          setMatchDistance(bestMatch.distance);
          
          // Draw recognition results
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            
            // Add text for the matched person
            if (bestMatch.className !== 'unknown') {
              ctx.font = '24px Arial';
              ctx.fillStyle = 'red';
              const text = `${bestMatch.className} (${bestMatch.distance.toFixed(2)})`;
              const detection = resizedDetections[0].detection;
              const box = detection.box;
              ctx.fillText(text, box.x, box.y - 10);
            }
          }
        } else {
          // Clear canvas when no faces detected
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          
          setMatchedPerson('No face detected');
          setMatchDistance(1);
        }
      } catch (error) {
        console.error('Error in recognition loop:', error);
      }
      
      // Continue the recognition loop
      if (isRecognizing) {
        requestAnimationFrame(recognitionLoop);
      }
    };
    
    recognitionLoop();
  };

  const stopFaceRecognition = () => {
    setIsRecognizing(false);
    setRecognitionStatus('Recognition stopped');
    
    // Clear canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Initialize on component mount
  useEffect(() => {
    setupCamera().then(async () => {
      const modelsLoaded = await loadModels();
      if (modelsLoaded) {
        // Canvas for drawing face detections
        if (!canvasRef.current) {
          const canvas = document.createElement('canvas');
          canvas.style.position = 'absolute';
          canvas.style.top = '0';
          canvas.style.left = '0';
          canvas.width = 600;
          canvas.height = 560;
          document.querySelector('.video-container')?.appendChild(canvas);
          canvasRef.current = canvas;
        }
      }
    });
    
    return () => {
      stopFaceRecognition();
    };
  }, []);

  // WebSocket connection to get recent images
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

  // Effect to load training images when recentImages updates
  useEffect(() => {
    if (recentImages.length > 0) {
      loadTrainingImages().then(success => {
        if (success) {
          // Start recognition if not already running
          if (!isRecognizing) {
            startFaceRecognition();
          }
        }
      });
    }
  }, [recentImages]);

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
        <div className="video-container" style={{ position: 'relative' }}>
          <video ref={videoRef} style={{ borderRadius: '20px' }} />
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
              <button
                style={{
                  marginTop: '20px',
                  padding: '15px',
                  fontSize: '18px',
                  borderRadius: '8px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onClick={takePictureAndSave}
              >
                Save Reference Image
              </button>
              <button
                style={{
                  marginTop: '20px',
                  marginLeft: '10px',
                  padding: '15px',
                  fontSize: '18px',
                  borderRadius: '8px',
                  backgroundColor: isRecognizing ? '#d32f2f' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onClick={isRecognizing ? stopFaceRecognition : startFaceRecognition}
              >
                {isRecognizing ? 'Stop Recognition' : 'Start Recognition'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Portal>
        {flashLevel > 0 && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: `rgba(255, 255, 255, ${flashLevel / 100})`, zIndex: 9999 }} />
          </>)}
      </Portal>

      {recentImages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignContent: 'center', margin: '20px', borderRadius: '10px', padding: '20px', backgroundColor: 'white' }}>
          <h2 style={{ textAlign: 'center' }}>Reference Images (Click to Delete):</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {recentImages.map((image, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <img 
                  onClick={() => deleteImage(image)} 
                  src={`http://localhost:3001/uploads/${image}`} 
                  alt={`Reference ${index}`} 
                  style={{width: '150px', height: '150px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer'}} 
                />
                <p>{image.split('-').pop()?.split('.')[0] || image}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;