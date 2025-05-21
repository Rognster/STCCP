import express, { Request, Response } from 'express';
import http from 'http';
import multer, { Multer } from 'multer';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket as WS, RawData } from 'ws';
import { fileURLToPath } from 'url';
import cors from 'cors';


///node --loader ts-node/esm server.ts
declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;


if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const cleanupOldFiles = () => {
    fs.readdir(UPLOAD_DIR, (err: NodeJS.ErrnoException | null, files: string[]) => {
        if (err) {
            console.error('Error reading upload directory for cleanup:', err);
            return;
        }

        files.forEach((file: string) => {
            const filePath = path.join(UPLOAD_DIR, file);
            fs.stat(filePath, (statErr: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (statErr) {
                    console.error('Error getting file stats for cleanup:', statErr);
                    return;
                }

                if (Date.now() - stats.mtime.getTime() > TWO_WEEKS_IN_MS) {
                    fs.unlink(filePath, (unlinkErr: NodeJS.ErrnoException | null) => {
                        if (unlinkErr) {
                            console.error('Error deleting old file:', unlinkErr);
                        } else {
                            console.log('Deleted old file:', filePath);
                        }
                    });
                }
            });
        });
    });
};

interface FileWithStats {
    name: string;
    mtime: Date;
}

const getRecentImageFilenames = (): string[] => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const filesWithStats: FileWithStats[] = files.map((file: string): FileWithStats | null => {
            const filePath = path.join(UPLOAD_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                return { name: file, mtime: stats.mtime };
            } catch (statErr) {
                console.error('Error getting stats for file:', filePath, statErr);
                return null;
            }
        }).filter((file): file is FileWithStats => file !== null);

        filesWithStats.sort((a: FileWithStats, b: FileWithStats) => b.mtime.getTime() - a.mtime.getTime());
        return filesWithStats.slice(0, 5).map((file: FileWithStats) => file.name);
    } catch (err) {
        console.error('Error reading upload directory for listing images:', err);
        return [];
    }
};

app.get('/api/images', (req: Request, res: Response) => {
    const recentFiles = getRecentImageFilenames();
    if (recentFiles.length === 0 && fs.readdirSync(UPLOAD_DIR).length > 0) {
        return res.status(500).json({ message: 'Error reading images directory.' });
    }
    res.json(recentFiles);
});


app.post('/api/upload', upload.single('image'), (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    cleanupOldFiles();

    const recentFiles = getRecentImageFilenames();
    wss.clients.forEach((client: WS) => {
        if (client.readyState === WS.OPEN) {
            client.send(JSON.stringify({ type: 'recent_images_update', payload: recentFiles }));
        }
    });

    res.json({ message: 'File uploaded successfully!', filename: req.file.filename });
});

app.post('/api/delete', (req: Request, res: Response) => {
    const { filename } = req.body;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' });
    }

    fs.unlink(filePath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ message: 'Error deleting file.' });
        }
        const recentFiles = getRecentImageFilenames();
        wss.clients.forEach((client: WS) => {
            if (client.readyState === WS.OPEN) {
                client.send(JSON.stringify({ type: 'recent_images_update', payload: recentFiles }));
            }
        });
        res.json({ message: 'File deleted successfully!' });
    });
});



wss.on('connection', (ws: WS) => {
    console.log('Client connected');

    const recentFiles = getRecentImageFilenames();
    ws.send(JSON.stringify({ type: 'initial_images', payload: recentFiles }));

    ws.on('message', (data: RawData) => {
        console.log('Received:', data.toString());
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server running on http://localhost:${PORT} and ws://localhost:${PORT}`);
    cleanupOldFiles();
});