const http = require('http');

const data = JSON.stringify({
  userId: 'aman',
  latitude: 28.51,
  longitude: 77.38,
  timestamp: Date.now(),
  date: '2026-07-21',
  locationEnabled: true,
  trackingMethod: 'GPS',
  accuracy: 10
});

const options = {
  hostname: '127.0.0.1',
  port: 8000,
  path: '/api/footprints',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // we don't have a token, but let's see if it gets rejected
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
