const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
// const Redis = require('ioredis'); // Redis implementation (commented)
// const Memcached = require('memcached'); // Memcached implementation (commented)

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CACHE IMPLEMENTATIONS (Choose one)
// ============================================================================

// 1. NODE.JS MAP (Current Implementation - Fastest & Simplest)
const counter = new Map();
counter.set('lizard:count', 0);

// 2. REDIS IMPLEMENTATION (Commented - for future use)
/*
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});
*/

// 3. MEMCACHED IMPLEMENTATION (Commented - for future use)
/*
const memcached = new Memcached('localhost:11211');

function incrementCountMemcached() {
  return new Promise((resolve, reject) => {
    memcached.incr('lizard:count', 1, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
*/

// Current cache status
let isCacheAvailable = true; // Always true for Map implementation
let cacheType = 'map'; // 'map', 'redis', 'memcached'

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://hitscounter.dev"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
      
      // REDIS IMPLEMENTATION (Commented - for future use)
      /*
      try {
        await redis.set('lizard:count', initialCount);
        isRedisAvailable = true;
        console.log(`🔴 Redis initialized with count: ${initialCount}`);
      } catch (redisErr) {
        console.log('⚠️ Redis not available, using fallback counter');
        fallbackCounter = initialCount;
        isRedisAvailable = false;
      }
      */
    });
  } catch (error) {
    console.error('Error in loadInitialCount:', error.message);
  }
}

// Get current count
async function getCurrentCount() {
  // MAP IMPLEMENTATION (Current)
  return counter.get('lizard:count') || 0;
  
  // REDIS IMPLEMENTATION (Commented - for future use)
  /*
  if (isRedisAvailable) {
    try {
      const count = await redis.get('lizard:count');
      return parseInt(count) || 0;
    } catch (error) {
      isRedisAvailable = false;
      return fallbackCounter;
    }
  }
  return fallbackCounter;
  */
  
  // MEMCACHED IMPLEMENTATION (Commented - for future use)
  /*
  return new Promise((resolve, reject) => {
    memcached.get('lizard:count', (err, result) => {
      if (err) reject(err);
      else resolve(parseInt(result) || 0);
    });
  });
  */
}

// Increment count
async function incrementCount() {
  const current = counter.get('lizard:count') || 0;
  counter.set('lizard:count', current + 1);
  return current + 1;
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

// API Routes
app.get('/api/clicks', async (req, res) => {
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

app.post('/api/clicks', async (req, res) => {
  // Falta rate limiting
  // Falta validación del cuerpo
  // Falta protección anti-spam
  try {
    const newCount = await incrementCount();
    setImmediate(() => syncToDatabase());
    
    res.json({ 
      count: newCount,
      timestamp: new Date().toISOString(),
      source: cacheType
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to increment count' });
  }
});

app.get('/api/stats', async (req, res) => {
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
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🦎 Lizard Loop server running on port ${PORT}`);
  console.log(`🗺️ Cache: ${cacheType.toUpperCase()} (${isCacheAvailable ? 'ENABLED' : 'DISABLED'})`);
  console.log(`📊 Current count: ${counter.get('lizard:count') || 0}`);
  console.log(`📱 App: http://localhost:${PORT}`);
});

// Graceful shutdown
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