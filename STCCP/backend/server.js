import express from 'express';
import http from 'http';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket as WS } from 'ws';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import net from 'net'; // Import net module for port checking
// Load environment variables
dotenv.config();
// Function to check if a port is available
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', () => {
            // Port is in use
            resolve(false);
        })
            .once('listening', () => {
            // Port is available, close the server
            tester.close(() => resolve(true));
        })
            .listen(port, '0.0.0.0');
    });
}
// Function to find an available port starting from the preferred port
async function findAvailablePort(startPort, maxAttempts = 10) {
    // In Azure App Service, always use the provided PORT env variable
    if (process.env.WEBSITE_HOSTNAME) {
        console.log('Running in Azure App Service, using provided port');
        return startPort; // Return the startPort directly in Azure
    }
    let port = startPort;
    let attempts = 0;
    while (attempts < maxAttempts) {
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
        port++;
        attempts++;
    }
    throw new Error(`Unable to find an available port after ${maxAttempts} attempts`);
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://stccp-frontend.azurewebsites.net',
        'https://stccp-frontend-draqhhcfgkdbg3em.swedencentral-01.azurewebsites.net'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
// Configure Cosmos DB
const cosmosEndpoint = process.env.COSMOSDB_ENDPOINT || '';
const cosmosKey = process.env.COSMOSDB_KEY || '';
const databaseName = process.env.COSMOSDB_DATABASE_NAME || 'gamescores';
const containerName = process.env.COSMOSDB_CONTAINER_NAME || 'results';
// Initialize Cosmos client
const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
// Initialize database and container
let database;
let container;
async function initializeCosmosDB() {
    try {
        // Create database if it doesn't exist
        const { database: db } = await cosmosClient.databases.createIfNotExists({ id: databaseName });
        database = db;
        // Create container if it doesn't exist
        const { container: cont } = await database.containers.createIfNotExists({
            id: containerName,
            partitionKey: { paths: ["/email"] }
        });
        container = cont;
        console.log("Cosmos DB initialized successfully");
    }
    catch (error) {
        console.error("Error initializing Cosmos DB:", error);
    }
}
// Initialize Cosmos DB if endpoint and key are provided
if (cosmosEndpoint && cosmosKey) {
    initializeCosmosDB();
}
else {
    console.warn("Cosmos DB credentials not provided. Game results will not be saved to database.");
}
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
const cleanupOldFiles = () => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) {
            console.error('Error reading upload directory for cleanup:', err);
            return;
        }
        files.forEach((file) => {
            const filePath = path.join(UPLOAD_DIR, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) {
                    console.error('Error getting file stats for cleanup:', statErr);
                    return;
                }
                if (Date.now() - stats.mtime.getTime() > TWO_WEEKS_IN_MS) {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Error deleting old file:', unlinkErr);
                        }
                        else {
                            console.log('Deleted old file:', filePath);
                        }
                    });
                }
            });
        });
    });
};
const getRecentImageFilenames = () => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const filesWithStats = files.map((file) => {
            const filePath = path.join(UPLOAD_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                return { name: file, mtime: stats.mtime };
            }
            catch (statErr) {
                console.error('Error getting stats for file:', filePath, statErr);
                return null;
            }
        }).filter((file) => file !== null);
        filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        return filesWithStats.slice(0, 5).map((file) => file.name);
    }
    catch (err) {
        console.error('Error reading upload directory for listing images:', err);
        return [];
    }
};
app.get('/api/images', (req, res) => {
    const recentFiles = getRecentImageFilenames();
    if (recentFiles.length === 0 && fs.readdirSync(UPLOAD_DIR).length > 0) {
        return res.status(500).json({ message: 'Error reading images directory.' });
    }
    res.json(recentFiles);
});
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    cleanupOldFiles();
    const recentFiles = getRecentImageFilenames();
    wss.clients.forEach((client) => {
        if (client.readyState === WS.OPEN) {
            client.send(JSON.stringify({ type: 'recent_images_update', payload: recentFiles }));
        }
    });
    res.json({ message: 'File uploaded successfully!', filename: req.file.filename });
});
app.post('/api/delete', (req, res) => {
    const { filename } = req.body;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' });
    }
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ message: 'Error deleting file.' });
        }
        const recentFiles = getRecentImageFilenames();
        wss.clients.forEach((client) => {
            if (client.readyState === WS.OPEN) {
                client.send(JSON.stringify({ type: 'recent_images_update', payload: recentFiles }));
            }
        });
        res.json({ message: 'File deleted successfully!' });
    });
});
// API endpoint for saving game results to Cosmos DB
app.post('/api/saveResults', async (req, res) => {
    const { name, email, points, timestamp } = req.body;
    // Validate required fields
    if (!name || !email || points === undefined) {
        return res.status(400).json({ message: 'Name, email, and points are required.' });
    }
    // Create a unique ID for the result
    const resultId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Create the result item
    const resultItem = {
        id: resultId,
        name,
        email,
        points,
        timestamp: timestamp || new Date().toISOString(),
        game: 'SimonSays'
    };
    try {
        // Check if Cosmos DB is configured
        if (!container) {
            console.warn('Cosmos DB not configured. Storing result locally only.');
            // Here you could store results in a local file as a fallback
            return res.json({ message: 'Result saved locally', result: resultItem });
        }
        // Save the result to Cosmos DB
        const { resource } = await container.items.create(resultItem);
        console.log(`Game result saved for ${name} with ID: ${resource.id}`);
        res.json({ message: 'Result saved to database', result: resource });
    }
    catch (error) {
        console.error('Error saving game result to database:', error);
        res.status(500).json({ message: 'Error saving game result to database' });
    }
});
// API endpoint to get high scores
app.get('/api/highscores', async (req, res) => {
    try {
        // Check if Cosmos DB is configured
        if (!container) {
            console.warn('Cosmos DB not configured. Cannot retrieve high scores.');
            return res.status(503).json({ message: 'High score database not available' });
        }
        // Query for top 10 scores
        const querySpec = {
            query: "SELECT TOP 10 c.name, c.email, c.points, c.timestamp FROM c WHERE c.game = 'SimonSays' ORDER BY c.points DESC"
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        res.json(resources);
    }
    catch (error) {
        console.error('Error retrieving high scores:', error);
        res.status(500).json({ message: 'Error retrieving high scores' });
    }
});
wss.on('connection', (ws) => {
    console.log('Client connected');
    const recentFiles = getRecentImageFilenames();
    ws.send(JSON.stringify({ type: 'initial_images', payload: recentFiles }));
    ws.on('message', (data) => {
        console.log('Received:', data.toString());
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
// Start the server with port conflict handling
async function startServer() {
    try {
        // Log environment information for debugging
        console.log('Node environment:', process.env.NODE_ENV);
        console.log('Server starting with process.env.PORT =', process.env.PORT);
        console.log('Server running in Azure?', !!process.env.WEBSITE_HOSTNAME);
        const port = await findAvailablePort(DEFAULT_PORT);
        server.listen(port, () => {
            console.log(`HTTP and WebSocket server running on port ${port}`);
            if (process.env.WEBSITE_HOSTNAME) {
                console.log(`Server running in Azure App Service: https://${process.env.WEBSITE_HOSTNAME}`);
                console.log('Available environment variables:', Object.keys(process.env).filter(k => k.includes('WEBSITE') || k.includes('AZURE')));
            }
            else if (port !== DEFAULT_PORT) {
                console.log(`Note: Default port ${DEFAULT_PORT} was in use, server started on port ${port} instead`);
            }
            cleanupOldFiles();
        }); // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port is already in use. Please try again with a different port.`);
            }
            else {
                console.error('Server error:', error);
            }
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start the server
startServer();
