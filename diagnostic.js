const fs = require('fs');
const path = require('path');

console.log('===========================================');
console.log('RIGHTSBACK DIAGNOSTIC');
console.log('===========================================\n');

// Check current directory
console.log('📁 Current directory:', __dirname);
console.log('');

// Check USCO CSV
const uscoPath = path.join(__dirname, 'data', 'usco', 'reg_musical_work.csv');
console.log('🔍 Checking USCO CSV...');
console.log('   Expected path:', uscoPath);

if (fs.existsSync(uscoPath)) {
  const stats = fs.statSync(uscoPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('   ✅ Found! Size:', sizeMB, 'MB');
  
  // Read first few lines
  const content = fs.readFileSync(uscoPath, 'utf8');
  const lines = content.split('\n').slice(0, 3);
  console.log('   First line (header):', lines[0].substring(0, 100) + '...');
  console.log('   Second line (data):', lines[1].substring(0, 100) + '...');
} else {
  console.log('   ❌ NOT FOUND!');
  console.log('   This is why search fails!');
}
console.log('');

// Check ASCAP CSV
const ascapPath = path.join(__dirname, 'data', 'ascap', 'ascap_repertoire.csv');
console.log('🔍 Checking ASCAP CSV...');
console.log('   Expected path:', ascapPath);

if (fs.existsSync(ascapPath)) {
  const stats = fs.statSync(ascapPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('   ✅ Found! Size:', sizeMB, 'MB');
  
  // Read first few lines
  const content = fs.readFileSync(ascapPath, 'utf8');
  const lines = content.split('\n').slice(0, 3);
  console.log('   First line (header):', lines[0]);
  console.log('   Second line (data):', lines[1]);
} else {
  console.log('   ❌ NOT FOUND!');
  console.log('   ASCAP search will be skipped');
}
console.log('');

// Check if database-search.js exists and has correct code
const dbSearchPath = path.join(__dirname, 'database-search.js');
console.log('🔍 Checking database-search.js...');

if (fs.existsSync(dbSearchPath)) {
  const content = fs.readFileSync(dbSearchPath, 'utf8');
  
  const hasUSCOPath = content.includes('USCO_PATH');
  const hasASCAPPath = content.includes('ASCAP_PATH');
  const hasInitialize = content.includes('initializeIndex');
  const hasLookupASCAP = content.includes('lookupASCAPByTitle');
  
  console.log('   USCO_PATH defined:', hasUSCOPath ? '✅' : '❌');
  console.log('   ASCAP_PATH defined:', hasASCAPPath ? '✅' : '❌');
  console.log('   initializeIndex function:', hasInitialize ? '✅' : '❌');
  console.log('   lookupASCAPByTitle function:', hasLookupASCAP ? '✅' : '❌');
} else {
  console.log('   ❌ database-search.js NOT FOUND!');
}
console.log('');

console.log('===========================================');
console.log('DIAGNOSIS COMPLETE');
console.log('===========================================');