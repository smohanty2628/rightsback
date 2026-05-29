// compress-usco.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SOURCE_PATH = path.join(__dirname, 'data', 'usco', 'reg_musical_work.csv');
const OUTPUT_PATH = SOURCE_PATH + '.gz';

console.log('🔨 Compressing USCO file...');
console.log('Source:', SOURCE_PATH);
console.log('Output:', OUTPUT_PATH);

if (!fs.existsSync(SOURCE_PATH)) {
  console.error('❌ ERROR: Source file not found!');
  console.error('Expected at:', SOURCE_PATH);
  process.exit(1);
}

const sourceStats = fs.statSync(SOURCE_PATH);
const sourceSizeMB = (sourceStats.size / 1024 / 1024).toFixed(2);
console.log('Source size: ' + sourceSizeMB + ' MB');

const startTime = Date.now();
const gzip = zlib.createGzip({ level: 9 });
const source = fs.createReadStream(SOURCE_PATH);
const destination = fs.createWriteStream(OUTPUT_PATH);

let bytesProcessed = 0;
let lastProgress = 0;

source.on('data', (chunk) => {
  bytesProcessed += chunk.length;
  const progress = Math.floor((bytesProcessed / sourceStats.size) * 100);
  if (progress >= lastProgress + 5) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('Progress: ' + progress + '% (' + elapsed + 's elapsed)');
    lastProgress = progress;
  }
});

destination.on('finish', () => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const outputStats = fs.statSync(OUTPUT_PATH);
  const outputSizeMB = (outputStats.size / 1024 / 1024).toFixed(2);
  const compressionRatio = ((1 - outputStats.size / sourceStats.size) * 100).toFixed(1);
  console.log('\n✅ Compression complete!');
  console.log('Original size: ' + sourceSizeMB + ' MB');
  console.log('Compressed size: ' + outputSizeMB + ' MB');
  console.log('Compression ratio: ' + compressionRatio + '%');
  console.log('Time taken: ' + elapsed + ' seconds');
  console.log('\nCompressed file saved to: ' + OUTPUT_PATH);
  if (parseFloat(outputSizeMB) > 500) {
    console.log('\n⚠️  WARNING: Compressed file is larger than 500 MB!');
    console.log('You will need to upgrade Railway to Pro tier.');
  } else {
    console.log('\n✅ File fits in Railway Free tier (500 MB limit)!');
  }
});

source.on('error', (err) => {
  console.error('❌ Error reading source file:', err.message);
  process.exit(1);
});

destination.on('error', (err) => {
  console.error('❌ Error writing compressed file:', err.message);
  process.exit(1);
});

gzip.on('error', (err) => {
  console.error('❌ Compression error:', err.message);
  process.exit(1);
});

source.pipe(gzip).pipe(destination);
console.log('\nCompressing... (this may take 5-10 minutes for a 2GB file)');
console.log('Do not close this window!\n');
