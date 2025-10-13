#!/usr/bin/env node

/**
 * Race Condition Test Script
 * Tests the server's ability to handle concurrent clicks without data loss
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const CONCURRENT_REQUESTS = 100;
const TEST_ROUNDS = 3;

async function testRaceCondition() {
  console.log('🧪 Starting Race Condition Test');
  console.log(`📊 Testing ${CONCURRENT_REQUESTS} concurrent requests`);
  console.log(`🔄 Running ${TEST_ROUNDS} test rounds\n`);

  for (let round = 1; round <= TEST_ROUNDS; round++) {
    console.log(`\n--- Test Round ${round} ---`);
    
    try {
      // Get initial count
      const initialResponse = await axios.get(`${SERVER_URL}/api/clicks`);
      const initialCount = initialResponse.data.count;
      console.log(`📈 Initial count: ${initialCount}`);

      // Create concurrent requests
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        promises.push(
          axios.post(`${SERVER_URL}/api/clicks`)
            .catch(err => {
              console.error(`❌ Request ${i} failed:`, err.message);
              return null;
            })
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Filter successful requests
      const successfulRequests = results.filter(result => result !== null);
      console.log(`✅ Successful requests: ${successfulRequests.length}/${CONCURRENT_REQUESTS}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🚀 Rate: ${(successfulRequests.length / duration * 1000).toFixed(2)} req/s`);

      // Get final count
      const finalResponse = await axios.get(`${SERVER_URL}/api/clicks`);
      const finalCount = finalResponse.data.count;
      const actualIncrement = finalCount - initialCount;

      console.log(`📈 Final count: ${finalCount}`);
      console.log(`📊 Expected increment: ${CONCURRENT_REQUESTS}`);
      console.log(`📊 Actual increment: ${actualIncrement}`);
      
      if (actualIncrement === CONCURRENT_REQUESTS) {
        console.log(`✅ SUCCESS: No data loss detected!`);
      } else {
        console.log(`❌ FAILURE: Data loss detected! Lost ${CONCURRENT_REQUESTS - actualIncrement} clicks`);
      }

      // Get debug info
      try {
        const debugResponse = await axios.get(`${SERVER_URL}/api/debug`);
        console.log(`🔍 Debug info:`, {
          total_clicks: debugResponse.data.total_clicks,
          recent_clicks: debugResponse.data.recent_clicks.length
        });
      } catch (err) {
        console.log(`⚠️  Debug endpoint not available`);
      }

    } catch (error) {
      console.error(`❌ Test round ${round} failed:`, error.message);
    }

    // Wait between rounds
    if (round < TEST_ROUNDS) {
      console.log(`⏳ Waiting 2 seconds before next round...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n🏁 Race condition test completed!`);
}

// Run the test
if (require.main === module) {
  testRaceCondition().catch(console.error);
}

module.exports = { testRaceCondition };
