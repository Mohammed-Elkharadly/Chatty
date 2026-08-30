import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// routes
import authRoutes from './routes/auth.route.js';
import messageRoutes from './routes/message.route.js';
import { connectDB } from './lib/db.js';
const app = express();
const PORT = Number(process.env['PORT']) || 5000;
// 2. Define __dirname correctly for ESM (replacing path.resolve)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
// api routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
// Serve static files from Vite build (React frontend)
app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));
// Serve backend-specific static files (e.g. admin styles, fallback images, etc.)
// app.use(express.static(path.join(__dirname, 'public')));
// SPA fallback — send index.html for all non-API routes
app.get(/.*/, (req, res) => {
    // Optional: only send index.html for non-file requests
    if (req.originalUrl.includes('.')) {
        return res.status(404).end(); // let 404 happen for missing files
    }
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
});
import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // "!" This tells TypeScript: "I've checked, this is definitely not undefined."
    connectDB(process.env['MONGO_URI']);
});
//# sourceMappingURL=server.js.map