import { Box, Input, LinearProgress, Portal, Button } from '@mui/material';
import * as faceapi from 'face-api.js';
import { useEffect, useState, useRef } from 'react';


const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [happinessLevel, setHappinessLevel] = useState(0);
  const [angerLevel, setAngerLevel] = useState(0);
  const [sadnessLevel, setSadnessLevel] = useState(0);
  const [neutralLevel, setNeutralLevel] = useState(0);
  const [supriseLevel, setSurpriseLevel] = useState(0);
  const [fearLevel, setFearLevel] = useState(0);
  const [tempname, setTempname] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [showNameWarning, setShowNameWarning] = useState(false);
  const [showEmailWarning, setShowEmailWarning] = useState(false);
  const [flashLevel, setFlashLevel] = useState(0);
  
  // Game state variables
  const [points, setPoints] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPointTimeRef = useRef<number>(0);
  
  // Background effect state
  const [bgEffect, setBgEffect] = useState<{color: string, opacity: number}>({color: 'transparent', opacity: 0});
  
  // High scores state
  const [highScores, setHighScores] = useState<Array<{name: string, points: number, timestamp: string}>>([]);
  const [showHighScores, setShowHighScores] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  
  // Instagram popup state
  const [showInstagramPopup, setShowInstagramPopup] = useState(false);


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
        setSadnessLevel(Math.round(expressions.sad * 100));
        setNeutralLevel(Math.round(expressions.neutral * 100));
        setSurpriseLevel(Math.round(expressions.surprised * 100));
        setFearLevel(Math.round(expressions.fearful * 100));
      } else {
        setHappinessLevel(prev => Math.max(prev - 1, 0));
        setAngerLevel(prev => Math.max(prev - 1, 0));
        setSadnessLevel(prev => Math.max(prev - 1, 0));
        setNeutralLevel(prev => Math.max(prev - 1, 0));
        setSurpriseLevel(prev => Math.max(prev - 1, 0));
        setFearLevel(prev => Math.max(prev - 1, 0));
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
    let hasError = false;
    
    if (!tempname || tempname.trim() === '') {
      setShowNameWarning(true);
      hasError = true;
    } else {
      setShowNameWarning(false);
    }
    
    if (!email || email.trim() === '' || !email.includes('@')) {
      setShowEmailWarning(true);
      hasError = true;
    } else {
      setShowEmailWarning(false);
    }
    
    if (hasError) {
      return; // Prevent taking picture if required fields are missing
    }

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

  // Game management functions
  const startGame = () => {
    // Check if name and email are provided
    if (!tempname || tempname.trim() === '') {
      setShowNameWarning(true);
      return;
    }
    
    if (!email || email.trim() === '' || !email.includes('@')) {
      setShowEmailWarning(true);
      return;
    }
    
    // Reset game state
    setPoints(0);
    setTimeLeft(10);
    setGameActive(true);
    lastPointTimeRef.current = 0;
    
    // Hide Instagram popup if it's showing
    if (showInstagramPopup) {
      setShowInstagramPopup(false);
    }
    
    // Start countdown timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // End game when timer reaches 0
          clearInterval(timerRef.current as NodeJS.Timeout);
          timerRef.current = null;
          setGameActive(false);
          
          // Save the game results when the game ends
          if (points > 0) {
            saveGameResults();
          } else {
            // Even if no points, still show Instagram popup
            setShowInstagramPopup(true);
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Check if the player matched the emotion correctly and award points
  useEffect(() => {
    if (!gameActive) return;
    
    const expressions = [
      { label: 'Gladhet', value: happinessLevel, key: 'happinessLevel' },
      { label: 'Angry', value: angerLevel, key: 'angerLevel' },
      { label: 'Sad', value: sadnessLevel, key: 'sadnessLevel' },
      { label: 'Surprise', value: supriseLevel, key: 'supriseLevel' },
      { label: 'Fear', value: fearLevel, key: 'fearLevel' }
    ];

    // Find the dominant expression (highest value above threshold)
    let highestValue = 0;
    let dominantExpressionIndex = -1;
    
    expressions.forEach((exp, index) => {
      if (exp.value > highestValue && exp.value > 70) {
        highestValue = exp.value;
        dominantExpressionIndex = index;
      }
    });
    
    // If we found a dominant expression
    if (dominantExpressionIndex !== -1) {
      // Get the current expression being shown in the game
      const gameInstructionElement = document.querySelector('[data-game-instruction="true"]');
      if (!gameInstructionElement) return;
      
      const simonSaysText = gameInstructionElement.textContent || '';
      
      const matchedExpression = expressions[dominantExpressionIndex].label;
      const isSimonSays = simonSaysText.includes('Simon says');
      const matchesTarget = simonSaysText.includes(matchedExpression);
      
      // Track when we last awarded points to prevent rapid scoring
      const now = Date.now();
      const lastPointChange = lastPointTimeRef.current || 0;
      
      if (now - lastPointChange > 1000) { // Only allow point changes once per second
        if (isSimonSays && matchesTarget) {
          // Correctly followed "Simon says"
          setPoints(prev => prev + 1);
          lastPointTimeRef.current = now;
          
          // Show green effect when gaining a point
          setBgEffect({color: '#4caf50', opacity: 0.3}); // Green color with lower opacity
          setTimeout(() => {
            // Fade out effect
            setBgEffect({color: '#4caf50', opacity: 0.1});
            setTimeout(() => {
              setBgEffect({color: 'transparent', opacity: 0});
            }, 200);
          }, 300);
        } else if (!isSimonSays && matchesTarget) {
          // Incorrectly followed when Simon didn't say
          setPoints(prev => Math.max(0, prev - 1));
          lastPointTimeRef.current = now;
          
          // Show red effect when losing a point
          setBgEffect({color: '#f44336', opacity: 0.3}); // Red color with lower opacity
          setTimeout(() => {
            // Fade out effect
            setBgEffect({color: '#f44336', opacity: 0.1});
            setTimeout(() => {
              setBgEffect({color: 'transparent', opacity: 0});
            }, 200);
          }, 300);
        }
      }
    }
  }, [gameActive, happinessLevel, angerLevel, sadnessLevel, supriseLevel, fearLevel]);


  // Function to save game results to the database
  const saveGameResults = async () => {
    if (!tempname || tempname.trim() === '') {
      setShowNameWarning(true);
      return false;
    }
    
    if (!email || email.trim() === '' || !email.includes('@')) {
      setShowEmailWarning(true);
      return false;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/saveResults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tempname,
          email: email,
          points: points,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (response.ok) {
        console.log('Game results saved successfully');
        // Show Instagram popup when game results are saved successfully
        setShowInstagramPopup(true);
        return true;
      } else {
        console.error('Failed to save game results:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error saving game results:', error);
      return false;
    }
  };

  // Function to fetch high scores from the server
  const fetchHighScores = async () => {
    setLoadingScores(true);
    try {
      const response = await fetch('http://localhost:3001/api/highscores', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setHighScores(data);
        setShowHighScores(true);
      } else {
        console.error('Failed to fetch high scores:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching high scores:', error);
    } finally {
      setLoadingScores(false);
    }
  };

  // Clean up the game timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: '1500px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignContent: 'center', marginTop: '20px', marginBottom: '20px' }}>
        <video ref={videoRef} style={{ borderRadius: '20px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignContent: 'center', marginTop: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignContent: 'center' }}>
          <div style={{ width: '600px', height: 'auto', borderRadius: '10px', padding: '20px' }}>
            <h1 style={{ textAlign: 'center' }}>Express yoursels</h1>
            
            {/* Game status section */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  Points: {points}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: timeLeft <= 3 ? '#ff0000' : '#000000' }}>
                  Time: {timeLeft}s
                </div>
              </div>
              <Button 
                variant="contained" 
                color="primary"
                disabled={gameActive}
                onClick={startGame}
                style={{ 
                  marginBottom: '15px',
                  backgroundColor: !gameActive ? '#4caf50' : '#cccccc',
                  padding: '10px 20px',
                  fontSize: '18px'
                }}
              >
                {gameActive ? 'Game in Progress' : 'Start Game (10s)'}
              </Button>
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '24px' }}>
              
                {/* Display a "Simon says" message and check for correct emotion */}
                {(() => {
                const expressions = [
                  { label: 'Gladhet', value: happinessLevel, key: 'happinessLevel' },
                  { label: 'Angry', value: angerLevel, key: 'angerLevel' },
                  { label: 'Sad', value: sadnessLevel, key: 'sadnessLevel' },
                  { label: 'Surprise', value: supriseLevel, key: 'supriseLevel' },
                  { label: 'Fear', value: fearLevel, key: 'fearLevel' }
                ];

                // Keep track of the current target expression in a ref/state
                const [targetIndex, setTargetIndex] = useState(() => Math.floor(Math.random() * expressions.length));
                const [simonSays, setSimonSays] = useState(() => Math.random() < 0.8);

                useEffect(() => {
                  // Only change expressions during active game
                  if (!gameActive) return;
                  
                  const currentValue = expressions[targetIndex].value;
                  if (currentValue > 90) {
                    // Change to a new random expression and simonSays value
                    let newIndex = targetIndex;
                    while (newIndex === targetIndex && expressions.length > 1) {
                      newIndex = Math.floor(Math.random() * expressions.length);
                    }
                    setTargetIndex(newIndex);
                    setSimonSays(Math.random() < 0.8);
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [happinessLevel, angerLevel, sadnessLevel, neutralLevel, supriseLevel, fearLevel, gameActive]);

                const target = expressions[targetIndex];
                return gameActive ? (simonSays ? (
                  <p 
                    data-game-instruction="true"
                    style={{ fontWeight: 'bold', fontSize: '28px' }}
                  >
                    Simon says {target.label} ({target.value})
                  </p>
                ) : (
                  <p 
                    data-game-instruction="true"
                    style={{ fontSize: '28px' }}
                  >
                    {target.label} ({target.value})
                  </p>
                )) : (
                  <p>Press Start to Play Simon Says!</p>
                );
                })()}
              
              {/* <Box sx={{ width: '100%' }}>
                <p>Gladhet: <span id="happiness-level">{happinessLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='success' variant="determinate" value={happinessLevel} />
              </Box>
              <Box sx={{ width: '100%' }}>
                <p>angry: <span id="happiness-level">{angerLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='success' variant="determinate" value={angerLevel} />
              </Box>
              <Box sx={{ width: '100%' }}>
                <p>sad: <span id="happiness-level">{sadnessLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='success' variant="determinate" value={sadnessLevel} />
              </Box>
              <Box sx={{ width: '100%' }}>
                <p>neutral: <span id="neutral-level">{neutralLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='primary' variant="determinate" value={neutralLevel} />
              </Box>
              <Box sx={{ width: '100%' }}>
                <p>surprise: <span id="surprise-level">{supriseLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='warning' variant="determinate" value={supriseLevel} />
             </Box>
              <Box sx={{ width: '100%' }}>
                <p>fear: <span id="fear-level">{fearLevel}</span></p>
                <LinearProgress sx={{ height: "50px" }} color='error' variant="determinate" value={fearLevel} />
              </Box> */}
            </div>
            <Input
              type="text"
              placeholder="Skriv in ditt namn"
              value={tempname || ''}
              onChange={(e) => {
                setTempname(e.target.value);
                if (e.target.value.trim() !== '') {
                  setShowNameWarning(false);
                }
              }}
              style={{ width: '100%', marginTop: '20px', marginBottom: '10px', padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#FFFFFF' }}
            />
            {showNameWarning && (
              <div style={{ marginTop: '5px', marginBottom: '10px', color: 'red', textAlign: 'center', fontWeight: 'bold' }}>
                Du måste lägga till namn!
              </div>
            )}
            
            <Input
              type="email"
              placeholder="Din e-postadress"
              value={email || ''}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.trim() !== '' && e.target.value.includes('@')) {
                  setShowEmailWarning(false);
                }
              }}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#FFFFFF' }}
            />
            {showEmailWarning && (
              <div style={{ marginTop: '5px', marginBottom: '10px', color: 'red', textAlign: 'center', fontWeight: 'bold' }}>
                Du måste ange en giltig e-postadress!
              </div>
            )}
            {
              tempname && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <p> {tempname}!</p>
                </div>
              )
            }
            
            {/* Game results */}
            {!gameActive && points > 0 && (
              <div style={{ 
                marginTop: '20px', 
                textAlign: 'center', 
                padding: '15px',
                backgroundColor: '#e8f5e9',
                borderRadius: '8px',
                border: '1px solid #4caf50'
              }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>Game Over!</h2>
                <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  Final Score: {points} {points === 1 ? 'point' : 'points'}
                </p>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={startGame}
                  style={{ 
                    backgroundColor: '#4caf50',
                    marginTop: '10px',
                    padding: '8px 16px'
                  }}
                >
                  Play Again
                </Button>
              </div>
            )}

            {/* High scores section */}
            <div style={{ marginTop: '30px', textAlign: 'center' }}>
              <Button 
                variant="outlined" 
                color="primary"
                onClick={fetchHighScores}
                style={{ 
                  padding: '10px 20px',
                  fontSize: '18px',
                  borderColor: '#4caf50',
                  color: '#4caf50'
                }}
              >
                Visa High Scores
              </Button>
              
              {loadingScores ? (
                <div style={{ marginTop: '10px', fontSize: '16px' }}>Laddar high scores...</div>
              ) : showHighScores && highScores.length > 0 ? (
                <div style={{ marginTop: '10px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>High Scores</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' }}>
                    {highScores.map((score, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                        <span style={{ fontSize: '16px' }}>{index + 1}. {score.name}</span>
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{score.points} poäng</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : showHighScores && highScores.length === 0 ? (
                <div style={{ marginTop: '10px', fontSize: '16px' }}>Inga high scores att visa än.</div>
              ) : null}
            </div>
          </div>
        </div>
        <Portal>
          {/* Instagram popup */}
          {showInstagramPopup && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 10000
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '30px',
                borderRadius: '15px',
                width: '90%',
                maxWidth: '500px',
                textAlign: 'center',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)'
              }}>
                <h2 style={{ 
                  fontSize: '28px', 
                  marginTop: '0',
                  color: '#4caf50',
                  marginBottom: '20px' 
                }}>
                  Thanks for playing!
                </h2>
                <p style={{ 
                  fontSize: '18px', 
                  marginBottom: '25px',
                  lineHeight: '1.5'
                }}>
                  Follow us on Instagram for more updates, events, and fun activities!
                </p>
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px'
                }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      window.open('https://www.instagram.com/softronicab?igsh=NDF5aTVwMjViY3Vh', '_blank');
                      setShowInstagramPopup(false);
                    }}
                    style={{
                      backgroundColor: '#E1306C', // Instagram color
                      color: 'white',
                      padding: '12px 20px',
                      fontSize: '18px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      textTransform: 'none'
                    }}
                  >
                    Follow us on Instagram
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => setShowInstagramPopup(false)}
                    style={{
                      color: '#555',
                      padding: '8px',
                      fontSize: '16px'
                    }}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {flashLevel > 0 && (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: `rgba(255, 255, 255, ${flashLevel / 100})`, zIndex: 9999 }} />
            </>
          )}
          
          {/* Background color effect when gaining or losing points */}
          {bgEffect.opacity > 0 && (
            <div 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                backgroundColor: `${bgEffect.color}`, 
                opacity: bgEffect.opacity,
                transition: 'opacity 0.3s ease-out',
                zIndex: 9998 
              }} 
            />
          )}
        </Portal>
      </div>
    </div>
  );
}
export default App;