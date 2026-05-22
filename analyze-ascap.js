const fs = require('fs');
const readline = require('readline');
const path = require('path');

const ASCAP_PATH = path.join(__dirname, 'data', 'ascap', 'ascap_repertoire.csv');

console.log('Analyzing ASCAP CSV structure...\n');

const fileStream = fs.createReadStream(ASCAP_PATH, { encoding: 'utf8' });
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let lineCount = 0;
let headers = [];

rl.on('line', (line) => {
  lineCount++;
  
  if (lineCount === 1) {
    // Parse header row
    headers = line.split(',').map(h => h.trim());
    console.log('📋 COLUMN HEADERS:');
    headers.forEach((h, i) => {
      console.log(`   ${i}: ${h}`);
    });
    console.log('');
    
    // Check if ISWC is present
    const iswcIndex = headers.findIndex(h => 
      h.toLowerCase().includes('iswc') || 
      h.toLowerCase() === 'work_code' ||
      h.toLowerCase() === 'work code'
    );
    
    if (iswcIndex >= 0) {
      console.log(`✅ ISWC FOUND at column ${iswcIndex}: "${headers[iswcIndex]}"`);
    } else {
      console.log('⚠️  ISWC column not found in headers');
      console.log('   Searching for it in sample data...');
    }
    console.log('');
  }
  
  // Show first 5 data rows completely
  if (lineCount > 1 && lineCount <= 6) {
    const fields = line.split(',');
    console.log(`Row ${lineCount}:`);
    fields.forEach((field, i) => {
      if (i < headers.length) {
        console.log(`   ${headers[i]}: ${field.substring(0, 80)}`);
      }
    });
    console.log('');
  }
  
  if (lineCount === 6) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log('Analysis complete!');
});