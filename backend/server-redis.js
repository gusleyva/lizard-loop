const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis setup
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Fallback counter
let fallbackCounter = 0;
let isRedisAvailable = false;

// Redis connection handling
redis.on('connect', () => {
  console.log('🔴 Connected to Redis');
  isRedisAvailable = true;
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
  isRedisAvailable = false;
});

redis.on('close', () => {
  console.log('🔴 Redis connection closed');
  isRedisAvailable = false;
});

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
      
      try {
        await redis.set('lizard:count', initialCount);
        isRedisAvailable = true;
        console.log(`🔴 Redis initialized with count: ${initialCount}`);
      } catch (redisErr) {
        console.log('⚠️ Redis not available, using fallback counter');
        fallbackCounter = initialCount;
        isRedisAvailable = false;
      }
    });
  } catch (error) {
    console.error('Error in loadInitialCount:', error.message);
  }
}

// Get current count
async function getCurrentCount() {
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
}

// Increment count
async function incrementCount() {
  if (isRedisAvailable) {
    try {
      const newCount = await redis.incr('lizard:count');
      return newCount;
    } catch (error) {
      isRedisAvailable = false;
      fallbackCounter++;
      return fallbackCounter;
    }
  } else {
    fallbackCounter++;
    return fallbackCounter;
  }
}

// Sync to database
async function syncToDatabase() {
  try {
    const currentCount = await getCurrentCount();
    db.run('INSERT INTO clicks (count) VALUES (?)', [currentCount], (err) => {
      if (err) {
        console.error('Error syncing to database:', err.message);
      } else {
        console.log(`📊 Synced count ${currentCount} to database`);
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
      source: isRedisAvailable ? 'redis' : 'fallback'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

app.post('/api/clicks', async (req, res) => {
  try {
    const newCount = await incrementCount();
    setImmediate(() => syncToDatabase());
    
    res.json({ 
      count: newCount,
      timestamp: new Date().toISOString(),
      source: isRedisAvailable ? 'redis' : 'fallback'
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
          redis_available: isRedisAvailable,
          fallback_counter: fallbackCounter
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
      redis_status: isRedisAvailable ? 'connected' : 'disconnected',
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
  console.log(`🦎 Lizard Loop server (Redis) running on port ${PORT}`);
  console.log(`🔴 Redis: ${isRedisAvailable ? 'ENABLED' : 'FALLBACK MODE'}`);
  console.log(`📊 Fallback counter: ${fallbackCounter}`);
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
      redis.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error('Final sync failed:', error.message);
    db.close();
    redis.disconnect();
    process.exit(1);
  }
});

// Periodic sync
setInterval(syncToDatabase, 30000);
