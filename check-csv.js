const fs = require('fs');
const readline = require('readline');
const path = require('path');

const USCO_PATH = path.join(__dirname, 'data', 'usco', 'reg_musical_work.csv');

console.log('='.repeat(80));
console.log('USCO DATABASE DIAGNOSTIC TOOL');
console.log('='.repeat(80));
console.log('');

// Check if file exists
console.log('1. Checking if file exists...');
if (!fs.existsSync(USCO_PATH)) {
  console.error('   ✗ FILE NOT FOUND at:', USCO_PATH);
  console.log('');
  console.log('   FIX: Copy the CSV file:');
  console.log('   copy ..\\main_db\\music-rights-db\\data\\usco\\reg_musical_work.csv data\\usco\\');
  process.exit(1);
}
console.log('   ✓ File exists at:', USCO_PATH);

// Check file size
const stats = fs.statSync(USCO_PATH);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log('   ✓ File size:', fileSizeMB, 'MB');
console.log('');

// Read first 10 lines
console.log('2. Reading first 10 lines...');
const fileStream = fs.createReadStream(USCO_PATH, { encoding: 'utf8' });
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let lineNum = 0;
const linesToShow = 10;

(async () => {
  for await (const line of rl) {
    lineNum++;
    if (lineNum <= linesToShow) {
      console.log(`   Line ${lineNum}: ${line.substring(0, 120)}...`);
    } else {
      break;
    }
  }
  
  console.log('');
  console.log('3. Searching for PA0000236812...');
  
  // Reset file stream to search for specific record
  const searchStream = fs.createReadStream(USCO_PATH, { encoding: 'utf8' });
  const searchRl = readline.createInterface({ input: searchStream, crlfDelay: Infinity });
  
  let found = false;
  let totalLines = 0;
  const searchNumber = 'PA0000236812';
  
  for await (const line of searchRl) {
    totalLines++;
    
    if (totalLines % 100000 === 0) {
      console.log(`   Scanned ${totalLines.toLocaleString()} lines...`);
    }
    
    if (line.includes(searchNumber)) {
      console.log('');
      console.log('   ✓ FOUND IT!');
      console.log('   Line:', line);
      found = true;
      break;
    }
  }
  
  console.log('');
  console.log(`   Total lines scanned: ${totalLines.toLocaleString()}`);
  
  if (!found) {
    console.log('   ✗ PA0000236812 NOT FOUND in your CSV file');
    console.log('');
    console.log('   This means your CSV file does NOT contain this record.');
    console.log('   The USCO website has it, but your local copy doesn\'t.');
    console.log('');
    console.log('   SOLUTIONS:');
    console.log('   1. Get the complete USCO database CSV (it\'s HUGE - several GB)');
    console.log('   2. Use the USCO website API instead of local CSV');
    console.log('   3. Accept that some records won\'t be in your local database');
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
})();