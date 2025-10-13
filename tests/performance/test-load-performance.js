#!/usr/bin/env node

/**
 * Load Performance Test Script
 * Tests the server's performance under high load
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function testLoadPerformance() {
  console.log('🚀 Starting Load Performance Test');
  console.log('📊 Testing server performance under high load\n');

  const testScenarios = [
    { name: 'Light Load', requests: 50, duration: 1000 },
    { name: 'Medium Load', requests: 200, duration: 2000 },
    { name: 'Heavy Load', requests: 500, duration: 5000 },
    { name: 'Extreme Load', requests: 1000, duration: 10000 }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n--- ${scenario.name} Test ---`);
    console.log(`📈 ${scenario.requests} requests over ${scenario.duration}ms`);

    try {
      // Get initial count
      const initialResponse = await axios.get(`${SERVER_URL}/api/clicks`);
      const initialCount = initialResponse.data.count;
      
      // Create requests with controlled timing
      const requests = [];
      const startTime = Date.now();
      
      for (let i = 0; i < scenario.requests; i++) {
        const delay = (scenario.duration / scenario.requests) * i;
        
        requests.push(
          new Promise(resolve => {
            setTimeout(async () => {
              try {
                const response = await axios.post(`${SERVER_URL}/api/clicks`);
                resolve({
                  success: true,
                  count: response.data.count,
                  timestamp: Date.now()
                });
              } catch (error) {
                resolve({
                  success: false,
                  error: error.message,
                  timestamp: Date.now()
                });
              }
            }, delay);
          })
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(requests);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Analyze results
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      const successRate = (successfulRequests.length / scenario.requests) * 100;
      const requestsPerSecond = (successfulRequests.length / totalDuration) * 1000;

      // Get final count
      const finalResponse = await axios.get(`${SERVER_URL}/api/clicks`);
      const finalCount = finalResponse.data.count;
      const actualIncrement = finalCount - initialCount;

      console.log(`✅ Successful: ${successfulRequests.length}/${scenario.requests} (${successRate.toFixed(1)}%)`);
      console.log(`❌ Failed: ${failedRequests.length}`);
      console.log(`⏱️  Total duration: ${totalDuration}ms`);
      console.log(`🚀 Rate: ${requestsPerSecond.toFixed(2)} req/s`);
      console.log(`📊 Expected increment: ${scenario.requests}`);
      console.log(`📊 Actual increment: ${actualIncrement}`);
      
      if (actualIncrement === scenario.requests) {
        console.log(`✅ Data integrity: PERFECT (no data loss)`);
      } else {
        console.log(`❌ Data integrity: FAILED (lost ${scenario.requests - actualIncrement} clicks)`);
      }

      // Performance rating
      if (requestsPerSecond > 1000) {
        console.log(`🏆 Performance: EXCELLENT (>1000 req/s)`);
      } else if (requestsPerSecond > 500) {
        console.log(`🥇 Performance: GOOD (500-1000 req/s)`);
      } else if (requestsPerSecond > 100) {
        console.log(`🥈 Performance: FAIR (100-500 req/s)`);
      } else {
        console.log(`🥉 Performance: POOR (<100 req/s)`);
      }

    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }

    // Wait between scenarios
    console.log(`⏳ Waiting 3 seconds before next scenario...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Final server stats
  try {
    console.log(`\n--- Final Server Stats ---`);
    const statsResponse = await axios.get(`${SERVER_URL}/api/stats`);
    const debugResponse = await axios.get(`${SERVER_URL}/api/debug`);
    
    console.log(`📊 Current count: ${statsResponse.data.current_memory_count}`);
    console.log(`📈 Total clicks processed: ${debugResponse.data.total_clicks}`);
    console.log(`🔄 Database records: ${statsResponse.data.database_stats.total_records}`);
    console.log(`⏱️  Last sync: ${statsResponse.data.last_sync}`);
    
  } catch (error) {
    console.log(`⚠️  Could not fetch final stats:`, error.message);
  }

  console.log(`\n🏁 Load performance test completed!`);
}

// Run the test
if (require.main === module) {
  testLoadPerformance().catch(console.error);
}

module.exports = { testLoadPerformance };
