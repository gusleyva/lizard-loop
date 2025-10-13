#!/usr/bin/env node

/**
 * Redis Performance Test Script
 * Compares Redis vs in-memory performance
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const CONCURRENT_REQUESTS = 500;
const TEST_DURATION = 10000; // 10 seconds

async function testRedisPerformance() {
  console.log('🔴 Starting Redis Performance Test');
  console.log(`📊 Testing ${CONCURRENT_REQUESTS} concurrent requests over ${TEST_DURATION}ms\n`);

  try {
    // Get initial server info
    const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
    console.log('🏥 Server Health:', {
      status: healthResponse.data.status,
      redis_status: healthResponse.data.redis_status,
      current_count: healthResponse.data.current_count
    });

    // Get initial count
    const initialResponse = await axios.get(`${SERVER_URL}/api/clicks`);
    const initialCount = initialResponse.data.count;
    const dataSource = initialResponse.data.source;
    
    console.log(`📈 Initial count: ${initialCount} (source: ${dataSource})`);

    // Create concurrent requests
    const promises = [];
    const startTime = Date.now();
    const requestTimes = [];

    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      promises.push(
        new Promise(async (resolve) => {
          const requestStart = Date.now();
          try {
            const response = await axios.post(`${SERVER_URL}/api/clicks`);
            const requestEnd = Date.now();
            requestTimes.push(requestEnd - requestStart);
            
            resolve({
              success: true,
              count: response.data.count,
              source: response.data.source,
              latency: requestEnd - requestStart,
              timestamp: requestEnd
            });
          } catch (error) {
            resolve({
              success: false,
              error: error.message,
              latency: Date.now() - requestStart,
              timestamp: Date.now()
            });
          }
        })
      );
    }

    // Wait for all requests to complete
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Analyze results
    const successfulRequests = results.filter(r => r.success);
    const failedRequests = results.filter(r => !r.success);
    const successRate = (successfulRequests.length / CONCURRENT_REQUESTS) * 100;
    const requestsPerSecond = (successfulRequests.length / totalDuration) * 1000;

    // Calculate latency statistics
    const latencies = requestTimes.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`\n📊 Performance Results:`);
    console.log(`✅ Successful: ${successfulRequests.length}/${CONCURRENT_REQUESTS} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedRequests.length}`);
    console.log(`⏱️  Total duration: ${totalDuration}ms`);
    console.log(`🚀 Rate: ${requestsPerSecond.toFixed(2)} req/s`);
    console.log(`📈 Avg latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`📊 P50 latency: ${p50Latency}ms`);
    console.log(`📊 P95 latency: ${p95Latency}ms`);
    console.log(`📊 P99 latency: ${p99Latency}ms`);

    // Get final count
    const finalResponse = await axios.get(`${SERVER_URL}/api/clicks`);
    const finalCount = finalResponse.data.count;
    const finalSource = finalResponse.data.source;
    const actualIncrement = finalCount - initialCount;

    console.log(`\n📈 Final count: ${finalCount} (source: ${finalSource})`);
    console.log(`📊 Expected increment: ${CONCURRENT_REQUESTS}`);
    console.log(`📊 Actual increment: ${actualIncrement}`);
    
    if (actualIncrement === CONCURRENT_REQUESTS) {
      console.log(`✅ Data integrity: PERFECT (no data loss)`);
    } else {
      console.log(`❌ Data integrity: FAILED (lost ${CONCURRENT_REQUESTS - actualIncrement} clicks)`);
    }

    // Performance rating
    if (requestsPerSecond > 2000) {
      console.log(`🏆 Performance: EXCELLENT (>2000 req/s)`);
    } else if (requestsPerSecond > 1000) {
      console.log(`🥇 Performance: GOOD (1000-2000 req/s)`);
    } else if (requestsPerSecond > 500) {
      console.log(`🥈 Performance: FAIR (500-1000 req/s)`);
    } else {
      console.log(`🥉 Performance: POOR (<500 req/s)`);
    }

    // Redis vs Fallback comparison
    const redisRequests = successfulRequests.filter(r => r.source === 'redis');
    const fallbackRequests = successfulRequests.filter(r => r.source === 'fallback');
    
    if (redisRequests.length > 0) {
      const redisLatencies = redisRequests.map(r => r.latency);
      const avgRedisLatency = redisLatencies.reduce((a, b) => a + b, 0) / redisLatencies.length;
      console.log(`\n🔴 Redis performance: ${redisRequests.length} requests, avg latency: ${avgRedisLatency.toFixed(2)}ms`);
    }
    
    if (fallbackRequests.length > 0) {
      const fallbackLatencies = fallbackRequests.map(r => r.latency);
      const avgFallbackLatency = fallbackLatencies.reduce((a, b) => a + b, 0) / fallbackLatencies.length;
      console.log(`🔄 Fallback performance: ${fallbackRequests.length} requests, avg latency: ${avgFallbackLatency.toFixed(2)}ms`);
    }

    // Get final server stats
    try {
      const statsResponse = await axios.get(`${SERVER_URL}/api/stats`);
      const debugResponse = await axios.get(`${SERVER_URL}/api/debug`);
      
      console.log(`\n📊 Final Server Stats:`);
      console.log(`📈 Current count: ${statsResponse.data.current_memory_count}`);
      console.log(`🔴 Redis available: ${statsResponse.data.redis_available}`);
      console.log(`📊 Total clicks processed: ${debugResponse.data.total_clicks}`);
      console.log(`🔄 Database records: ${statsResponse.data.database_stats.total_records}`);
      
    } catch (error) {
      console.log(`⚠️  Could not fetch final stats:`, error.message);
    }

  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }

  console.log(`\n🏁 Redis performance test completed!`);
}

// Run the test
if (require.main === module) {
  testRedisPerformance().catch(console.error);
}

module.exports = { testRedisPerformance };
