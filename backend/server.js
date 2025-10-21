const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 2);

// 1. NODE.JS MAP (Current Implementation - Fastest & Simplest)
const counter = new Map();
counter.set('lizard:count', 0);

// 🔒 BATCH WRITES: Evita SQLite lock contention
let pendingWrites = [];
const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000; // 5 segundos
let batchTimer = null;

// Current cache status
let isCacheAvailable = true; // Always true for Map implementation
let cacheType = 'map'; // 'map', 'redis', 'memcached'

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://static.cloudflareinsights.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      // connectSrc: ["'self'", "https://hitscounter.dev"],
      connectSrc: ["'self'"],  // CAMBIO: Quitamos hitscounter.dev temporalmente
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: false,  // NUEVO: Desactivamos COOP
  crossOriginResourcePolicy: false,  // NUEVO: Desactivamos CORP
  hsts: false,
}));

/*
O más simple, reemplaza TODO el bloque de Helmet con esto:
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: false,
}));
*/

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1kb' })); // 🔒 Limita JSON payload
app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));


// rate limiting en Express (backup de Cloudflare)
const clickLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200, // 3 clicks/sec, 200 clicks/minuto por IP
  message: { error: 'Too many clicks, slow down! 🦎' },
  standardHeaders: true,
  legacyHeaders: false,
  // Usa X-Forwarded-For de Cloudflare/Nginx
  skip: (req) => {
    // Skip rate limit para health checks
    return req.path === '/api/health';
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 requests/minuto para otras APIs
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SQLite database
const db = new sqlite3.Database('./clicks.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Database table ready');
      loadInitialCount();
    }
  });
}

// Load initial count
async function loadInitialCount() {
  try {
    db.get('SELECT MAX(count) as max_count FROM clicks', async (err, row) => {
      if (err) {
        console.error('Error loading initial count:', err.message);
        return;
      }
      
      const initialCount = row?.max_count || 0;
      
      // Initialize with Map (current implementation)
      counter.set('lizard:count', initialCount);
      console.log(`🗺️ Map cache initialized with count: ${initialCount}`);
    });
  } catch (error) {
    console.error('Error in loadInitialCount:', error.message);
  }
}

// Get current count
async function getCurrentCount() {
  // MAP IMPLEMENTATION (Current)
  return counter.get('lizard:count') || 0;
}

// Increment count
async function incrementCount() {
  const current = counter.get('lizard:count') || 0;
  counter.set('lizard:count', current + 1);
  return current + 1;
}

// 🔒 BATCH WRITE: Agrupa writes para evitar lock contention
function addToBatch(count) {
  pendingWrites.push(count);
  
  // Si alcanzamos el batch size, escribir inmediatamente
  if (pendingWrites.length >= BATCH_SIZE) {
    clearTimeout(batchTimer);
    batchTimer = null;
    flushBatch();
  } 
  // Si no, programar flush después del timeout
  else if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_TIMEOUT);
  }
}

function flushBatch() {
  if (pendingWrites.length === 0) return;
  
  const batch = [...pendingWrites];
  pendingWrites = [];
  
  // Insertar todos los valores en una sola query
  const placeholders = batch.map(() => '(?)').join(',');
  const sql = `INSERT INTO clicks (count) VALUES ${placeholders}`;
  
  db.run(sql, batch, (err) => {
    if (err) {
      console.error('❌ Batch write error:', err.message);
      // En caso de error, reintentar individualmente
      batch.forEach(count => {
        db.run('INSERT INTO clicks (count) VALUES (?)', [count]);
      });
    } else {
      console.log(`📊 Batch wrote ${batch.length} records to database`);
    }
  });
}

// Sync to database
async function syncToDatabase() {
  try {
    const currentCount = await getCurrentCount();
    db.run('INSERT INTO clicks (count) VALUES (?)', [currentCount], (err) => {
      if (err) {
        console.error('Error syncing to database:', err.message);
      } else {
        // console.log(`📊 Synced count ${currentCount} to database`);
      }
    });
  } catch (error) {
    console.error('Error in syncToDatabase:', error.message);
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

app.get('/api/clicks', apiLimiter, async (req, res) => {
  try {
    const count = await getCurrentCount();
    res.json({ 
      count: count,
      timestamp: new Date().toISOString(),
      source: cacheType
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

app.post('/api/clicks', clickLimiter, async (req, res) => {
  // Falta protección anti-spam
  try {
    // 🔒 Body validation: Body is not expected
    if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: 'No body expected' });
    }

    const newCount = await incrementCount();

    // 🔒 Batch write en lugar de write inmediato
    addToBatch(newCount);
    // setImmediate(() => syncToDatabase());
    
    res.json({ 
      count: newCount,
      timestamp: new Date().toISOString(),
      source: cacheType
    });
  } catch (error) {
    console.error('❌ POST /api/clicks error:', error);
    res.status(500).json({ error: 'Failed to increment count' });
  }
});

app.get('/api/stats', apiLimiter, async (req, res) => {
  try {
    const currentCount = await getCurrentCount();
    
    db.get(`
      SELECT 
        COUNT(*) as total_records,
        MAX(count) as max_count,
        MIN(timestamp) as first_record,
        MAX(timestamp) as last_record
      FROM clicks
    `, (err, row) => {
      if (err) {
        console.error('❌ Stats query error:', err);
        res.status(500).json({ error: 'Database error' });
      } else {
        res.json({
          current_memory_count: currentCount,
          database_stats: row,
          cache_type: cacheType,
          cache_available: isCacheAvailable
        });
      }
    });
  } catch (error) {
    console.error('❌ GET /api/stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const currentCount = await getCurrentCount();
    res.json({ 
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache_type: cacheType,
      cache_status: isCacheAvailable ? 'connected' : 'disconnected',
      current_count: currentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(PORT, () => {
  console.log(`🦎 Lizard Loop server running on port ${PORT}`);
  console.log(`🗺️ Cache: ${cacheType.toUpperCase()} (${isCacheAvailable ? 'ENABLED' : 'DISABLED'})`);
  console.log(`📊 Current count: ${counter.get('lizard:count') || 0}`);
  console.log(`🔒 Rate limiting: ENABLED`);
  console.log(`📦 Batch writes: ENABLED (size: ${BATCH_SIZE})`);
  console.log(`📱 App: http://localhost:${PORT}`);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================


process.on('SIGINT', async () => {
  console.log('\n🔄 Final database sync...');
  try {
    const currentCount = await getCurrentCount();
    db.run('INSERT INTO clicks (count) VALUES (?)', [currentCount], (err) => {
      if (err) {
        console.error('Final sync error:', err.message);
      } else {
        console.log(`✅ Final count ${currentCount} saved to database`);
      }
      db.close();
      // redis.disconnect(); // Redis implementation (commented)
      process.exit(0);
    });
  } catch (error) {
    console.error('Final sync failed:', error.message);
    db.close();
    // redis.disconnect(); // Redis implementation (commented)
    process.exit(1);
  }
});

// Periodic sync
setInterval(syncToDatabase, 30000);