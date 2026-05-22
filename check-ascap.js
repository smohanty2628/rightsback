const fs = require('fs');
const path = require('path');

const ASCAP_PATH = path.join(__dirname, 'data', 'ascap', 'ascap_repertoire.csv');

console.log('Checking for ASCAP data...\n');

if (fs.existsSync(ASCAP_PATH)) {
  const stats = fs.statSync(ASCAP_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log('✅ ASCAP file FOUND!');
  console.log('   Location:', ASCAP_PATH);
  console.log('   Size:', sizeMB, 'MB');
  console.log('\n✨ We can implement ASCAP ISWC lookup!');
  
  // Show first few lines
  const readline = require('readline');
  const fileStream = fs.createReadStream(ASCAP_PATH, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  console.log('\nFirst 5 lines:');
  let count = 0;
  rl.on('line', (line) => {
    count++;
    if (count <= 5) {
      console.log(`Line ${count}: ${line.substring(0, 150)}...`);
    }
    if (count === 5) {
      rl.close();
      process.exit(0);
    }
  });
  
} else {
  console.log('❌ ASCAP file NOT FOUND at:', ASCAP_PATH);
  console.log('\nExpected location: data/ascap/ascap_repertoire.csv');
  console.log('\nIf you have ASCAP data, copy it there and I\'ll implement the lookup!');
}