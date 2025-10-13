# 🚀 Server Selection Guide

This guide explains how to choose and run different server implementations in the Lizard Loop project.

## 📁 Available Servers

| Server File | Cache Type | Performance | Dependencies | Use Case |
|-------------|------------|-------------|--------------|----------|
| `server.js` | Node.js Map | 1,000,000+ ops/sec | None | Development, Single server |
| `server-redis.js` | Redis | 100,000+ ops/sec | Redis server | Production, Multi-server |
| `server-memcached.js` | Memcached | 200,000+ ops/sec | Memcached server | High load, Multi-server |

## 🎯 Quick Start

### **Development (Recommended)**
```bash
# Node.js Map - Zero dependencies
npm run dev
```

### **Production with Redis**
```bash
# Install Redis first
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu

# Start Redis
redis-server

# Run with Redis
npm run start:redis
```

### **Production with Memcached**
```bash
# Install Memcached first
brew install memcached  # macOS
sudo apt install memcached  # Ubuntu

# Start Memcached
memcached -d

# Run with Memcached
npm run start:memcached
```

## 🛠️ Available Scripts

### **Production Scripts**
```bash
npm start                    # Node.js Map (default)
npm run start:redis          # Redis implementation
npm run start:memcached      # Memcached implementation
```

### **Development Scripts**
```bash
npm run dev                  # Node.js Map with hot reload
npm run dev:redis            # Redis with hot reload
npm run dev:memcached        # Memcached with hot reload
```

## 📊 Performance Comparison

| Implementation | Ops/sec | Latency | Memory | Setup Time | Scalability |
|----------------|---------|---------|--------|-------------|-------------|
| **Node.js Map** | 1,000,000+ | 0.1ms | <1MB | 0 seconds | ❌ Single |
| **Redis** | 100,000+ | 1ms | 10-50MB | 2 minutes | ✅ Multi |
| **Memcached** | 200,000+ | 0.5ms | 5-20MB | 1 minute | ✅ Multi |

## 🎯 When to Use Each

### **Node.js Map (`server.js`)**
- ✅ **Development** - Zero setup
- ✅ **Single server** production
- ✅ **Maximum performance** needed
- ✅ **Simple deployment**

### **Redis (`server-redis.js`)**
- ✅ **Multi-server** production
- ✅ **Shared state** across instances
- ✅ **Persistence** required
- ✅ **Complex data structures** needed

### **Memcached (`server-memcached.js`)**
- ✅ **High throughput** required
- ✅ **Simple key-value** operations
- ✅ **Multi-server** with simple caching
- ✅ **Lower memory** usage than Redis

## 🔧 Setup Instructions

### **1. Node.js Map (Default)**
```bash
# No setup required
npm install
npm run dev
```

### **2. Redis Setup**
```bash
# Install Redis
brew install redis          # macOS
sudo apt install redis-server  # Ubuntu

# Start Redis
redis-server

# Install Redis dependency
npm install ioredis

# Run server
npm run start:redis
```

### **3. Memcached Setup**
```bash
# Install Memcached
brew install memcached      # macOS
sudo apt install memcached  # Ubuntu

# Start Memcached
memcached -d

# Install Memcached dependency
npm install memcached

# Run server
npm run start:memcached
```

## 🐳 Docker Support

### **With Redis**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  app:
    build: .
    command: ["node", "backend/server-redis.js"]
    depends_on: [redis]
```

### **With Memcached**
```yaml
# docker-compose.yml
services:
  memcached:
    image: memcached:alpine
    ports: ["11211:11211"]
  
  app:
    build: .
    command: ["node", "backend/server-memcached.js"]
    depends_on: [memcached]
```

## 🔄 Switching Between Servers

### **Environment Variables**
```bash
# Set server type
export SERVER_TYPE=redis
export SERVER_TYPE=memcached
export SERVER_TYPE=map  # default
```

### **PM2 Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'lizard-loop',
    script: 'backend/server.js',        // Change this line
    // script: 'backend/server-redis.js',
    // script: 'backend/server-memcached.js',
  }]
};
```

## 📈 Monitoring

### **Health Check Endpoints**
```bash
# All servers provide the same endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/debug
```

### **Server-Specific Info**
- **Map**: Shows `cache_type: "map"`
- **Redis**: Shows `redis_status: "connected"`
- **Memcached**: Shows `memcached_status: "connected"`

## 🎯 Recommendations

### **Development**
```bash
npm run dev  # Node.js Map - fastest setup
```

### **Production (Single Server)**
```bash
npm start  # Node.js Map - best performance
```

### **Production (Multiple Servers)**
```bash
npm run start:redis  # Redis - shared state
```

### **High Load**
```bash
npm run start:memcached  # Memcached - highest throughput
```

## 🚀 Quick Commands

```bash
# Development
npm run dev

# Production with Map
npm start

# Production with Redis
npm run start:redis

# Production with Memcached
npm run start:memcached

# Test performance
npm run test:race
npm run test:load
npm run test:redis
```

Choose the server that best fits your needs! 🦎
