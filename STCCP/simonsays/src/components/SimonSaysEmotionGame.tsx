// SimonSaysEmotionGame.tsx
import React, { useEffect, useRef, useState } from 'react';

const EMOTIONS = ['happiness', 'anger', 'surprise', 'sadness', 'neutral'] as const;
type Emotion = typeof EMOTIONS[number];

function getRandomEmotion(): Emotion {
  return EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
}

async function analyzeEmotion(imageBlob: Blob, faceApiKey: string, endpoint: string) {
  const response = await fetch(`${endpoint}/face/v1.0/detect?returnFaceAttributes=emotion`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': faceApiKey,
      'Content-Type': 'application/octet-stream'
    },
    body: imageBlob
  });
  const data = await response.json();
  return data?.[0]?.faceAttributes?.emotion ?? null;
}

const SimonSaysEmotionGame: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentCommand, setCurrentCommand] = useState<string>('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const faceApiKey = import.meta.env.VITE_FACE_API_KEY || 'YOUR_API_KEY';
  const faceApiEndpoint = import.meta.env.VITE_FACE_API_ENDPOINT || 'https://YOUR_REGION.api.cognitive.microsoft.com';

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(async blob => {
      if (!blob) return;
      const emotionData = await analyzeEmotion(blob, faceApiKey, faceApiEndpoint);
      const dominant = Object.entries(emotionData || {}).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

      if (currentCommand.startsWith('Simon says')) {
        const target = currentCommand.split(':')[1].trim();
        if (dominant === target) {
          setScore(s => s + 1);
          setFeedback('✅ Correct!');
        } else {
          setFeedback('❌ Wrong emotion.');
        }
      } else {
        if (dominant === currentCommand.trim()) {
          setScore(s => s - 1);
          setFeedback("❌ Simon didn't say!");
        } else {
          setFeedback('✅ You resisted correctly!');
        }
      }
    }, 'image/jpeg');
  };

  const nextRound = () => {
    const shouldSimonSay = Math.random() < 0.7;
    const emotion = getRandomEmotion();
    setCurrentCommand(shouldSimonSay ? `Simon says: ${emotion}` : `${emotion}`);
    setFeedback('');
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Simon Says: Emotion Edition</h1>
      <video ref={videoRef} autoPlay muted className="mx-auto border rounded" width="320" height="240" />
      <p className="text-lg mt-4">Command: <strong>{currentCommand}</strong></p>
      <button onClick={captureAndAnalyze} className="bg-blue-500 text-white px-4 py-2 rounded m-2">Submit Emotion</button>
      <button onClick={nextRound} className="bg-green-500 text-white px-4 py-2 rounded m-2">Next Round</button>
      <p className="mt-2 text-xl">Score: {score}</p>
      <p className="mt-1 text-lg">{feedback}</p>
    </div>
  );
};

export default SimonSaysEmotionGame;
