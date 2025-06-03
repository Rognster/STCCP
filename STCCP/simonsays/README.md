# Simon Says Emotion Game

A fun React-based game that tests your ability to follow (or resist) emotion-based commands using facial expression recognition. The game uses Azure Cognitive Services for facial emotion analysis.

## How to Play

1. The game gives commands in the format "Simon says: [emotion]" or just "[emotion]".
2. If Simon says to show an emotion, you should make that facial expression.
3. If Simon doesn't say (just the emotion is shown), you should NOT make that expression.
4. Points are awarded for correct responses and deducted for incorrect ones.

## Features

- Real-time webcam integration
- Facial emotion recognition using Azure Face API
- Score tracking
- Immediate feedback on your performance

## Technologies Used

- React + TypeScript
- Vite
- Tailwind CSS
- Azure Cognitive Services Face API

## Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Create an Azure Face API resource and get your API key and endpoint
4. Update the `faceApiKey` and `faceApiEndpoint` values in the `SimonSaysEmotionGame.tsx` file
5. Run `npm run dev` to start the development server
