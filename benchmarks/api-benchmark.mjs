
import autocannon from 'autocannon';
import fs from 'fs';

async function runBenchmark() {
  console.log('🚀 Starting API Benchmarking...');

  const results = {};

  const endpoints = [
    { name: 'Dashboard Stats', url: 'http://localhost:3000/api/trpc/dashboard.getStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' },
    { name: 'Tickets List', url: 'http://localhost:3000/api/trpc/tickets.getTickets?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A50%7D%7D%7D' },
    { name: 'Reports: Tickets by Status', url: 'http://localhost:3000/api/trpc/reports.ticketsByStatus?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' },
    { name: 'Reports: Purchase Cycle Report', url: 'http://localhost:3000/api/trpc/reports.purchaseCycleReport?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' },
    { name: 'Reports: Maintenance Cycle Report', url: 'http://localhost:3000/api/trpc/reports.maintenanceCycleReport?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' },
    { name: 'Reports: Cost Report', url: 'http://localhost:3000/api/trpc/reports.costReport?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' },
    { name: 'KPI: Get Ticket Timelines', url: 'http://localhost:3000/api/trpc/kpi.getTicketTimelines?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' }
  ];

  for (const endpoint of endpoints) {
    console.log(`🔥 Benchmarking: ${endpoint.name}`);
    const result = await autocannon({
      url: endpoint.url,
      connections: 10,
      duration: 30,
      pipelining: 1
    });
    results[endpoint.name] = {
      requestsPerSecond: result.requests.average,
      latencyAverageMs: result.latency.average,
      throughputMb: (result.throughput.average / 1024 / 1024).toFixed(2)
    };
  }

  fs.writeFileSync('/home/ubuntu/CMMS_REAL/benchmarks/api-results.json', JSON.stringify(results, null, 2));
  console.log('✅ API Benchmarking Completed! Results saved to api-results.json');
}

// Check if server is up before running
import http from 'http';
const checkServer = () => {
  const req = http.get('http://localhost:3000', (res) => {
    runBenchmark();
  });
  req.on('error', () => {
    console.error('❌ Error: Local server is not running on port 3000. Please start the server first.');
    process.exit(1);
  });
};

checkServer();
