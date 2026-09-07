import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large JSON payloads for benchmark datasets
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Storage directory for persistent benchmark data across devices
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const storageFilePath = path.join(dataDir, 'benchmark_data.json');

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /api/groups - Retrieve persisted groups for cross-device synchronization
  app.get('/api/groups', (req, res) => {
    try {
      if (fs.existsSync(storageFilePath)) {
        const fileContent = fs.readFileSync(storageFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return res.json({
          success: true,
          groups: parsed.groups || parsed,
          updatedAt: parsed.updatedAt || null,
          source: 'server_disk',
        });
      }
      return res.json({ success: true, groups: null, source: 'none' });
    } catch (err: any) {
      console.error('Error reading benchmark data:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/groups - Save groups to disk so all devices accessing the URL see identical data
  app.post('/api/groups', (req, res) => {
    try {
      const { groups } = req.body;
      if (!groups || !Array.isArray(groups)) {
        return res.status(400).json({ success: false, error: 'Invalid groups array' });
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        count: groups.length,
        groups,
      };

      fs.writeFileSync(storageFilePath, JSON.stringify(payload, null, 2), 'utf-8');
      return res.json({ success: true, count: groups.length, updatedAt: payload.updatedAt });
    } catch (err: any) {
      console.error('Error saving benchmark data:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/reset - Clear server disk storage
  app.post('/api/reset', (req, res) => {
    try {
      if (fs.existsSync(storageFilePath)) {
        fs.unlinkSync(storageFilePath);
      }
      return res.json({ success: true, message: 'Server storage cleared' });
    } catch (err: any) {
      console.error('Error clearing benchmark data:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware in dev mode; static serve in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
