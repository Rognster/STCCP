# Getting Started with Simon Says Emotion Game

## Prerequisites
- Node.js (v18+ recommended)
- An Azure subscription
- Azure Face API resource (for emotion recognition)

## Setup Instructions

1. Clone or download this repository

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the project root and add your Azure Face API credentials:
   ```
   VITE_FACE_API_KEY=your_face_api_key
   VITE_FACE_API_ENDPOINT=https://your-region.api.cognitive.microsoft.com
   ```

4. Run the setup script:
   ```
   # On Windows PowerShell:
   .\scripts\setup.ps1
   
   # On Linux/Mac:
   ./scripts/setup.sh
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5173`

## Game Instructions

1. Click "Next Round" to start the game
2. Follow the command if it says "Simon says", otherwise DON'T make the expression
3. Click "Submit Emotion" when you're ready to have your expression analyzed
4. Score points by correctly following Simon's commands!
