
import http from 'http';
import fs from 'fs';

const API_ENDPOINT = 'http://localhost:3000/api/trpc/tickets.getTickets?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A50%7D%7D%7D';
const DURATION_MINUTES = 5;
const INTERVAL_SECONDS = 60;
const HEAP_GROWTH_THRESHOLD_MB = 50;

async function runMemoryTest() {
  console.log(`🧠 Starting Memory Footprint Test for ${DURATION_MINUTES} minutes...`);

  const heapUsages = [];
  const startTime = Date.now();

  // Initial heap usage
  const initialHeap = process.memoryUsage().heapUsed;
  heapUsages.push(initialHeap);

  const intervalId = setInterval(async () => {
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

    if (elapsedMinutes >= DURATION_MINUTES) {
      clearInterval(intervalId);
      const finalHeap = process.memoryUsage().heapUsed;
      heapUsages.push(finalHeap);

      const heapStart_MB = (heapUsages[0] / (1024 * 1024));
      const heapEnd_MB = (heapUsages[heapUsages.length - 1] / (1024 * 1024));
      const growth_MB = heapEnd_MB - heapStart_MB;
      const leakDetected = growth_MB > HEAP_GROWTH_THRESHOLD_MB;

      const memoryResults = {
        heapStart_MB: heapStart_MB.toFixed(2),
        heapEnd_MB: heapEnd_MB.toFixed(2),
        growth_MB: growth_MB.toFixed(2),
        leakDetected: leakDetected
      };

      fs.writeFileSync(
        '/home/ubuntu/CMMS_REAL/benchmarks/memory-results.json',
        JSON.stringify(memoryResults, null, 2)
      );
      console.log(
        '✅ Memory Footprint Test Completed! Results saved to memory-results.json'
      );
      process.exit(0);
    }

    // Simulate load by hitting the API endpoint
    http.get(API_ENDPOINT, (res) => {
      res.resume();
    }).on('error', (e) => {
      console.error(`Error hitting API: ${e.message}`);
    });

    // Capture heap usage every minute
    heapUsages.push(process.memoryUsage().heapUsed);
    console.log(`Heap usage at ${elapsedMinutes.toFixed(0)} min: ${(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)} MB`);

  }, INTERVAL_SECONDS * 1000);
}

// Check if server is up before running
const checkServer = () => {
  const req = http.get('http://localhost:3000', (res) => {
    runMemoryTest();
  });
  req.on('error', () => {
    console.error('❌ Error: Local server is not running on port 3000. Please start the server first.');
    process.exit(1);
  });
};

checkServer();
