// test-lookup.js - Test enhanced USCO/ISWC/Title lookup
require('dotenv').config();
const { lookupByUSCO, lookupByISWC, lookupBySongTitle } = require('./lookup');

async function testLookups() {
  console.log('🧪 Testing Enhanced Lookup Functions\n');

  // Test 1: USCO Lookup (from your screenshot)
  console.log('1️⃣ Testing USCO Lookup: PAU001714228');
  console.log('─────────────────────────────────────');
  try {
    const uscoResult = await lookupByUSCO('PAU001714228');
    console.log('✓ Result:', JSON.stringify(uscoResult, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n');

  // Test 2: Title Lookup with Claude Fallback
  console.log('2️⃣ Testing Title Lookup: "Joy to the World"');
  console.log('─────────────────────────────────────────────');
  try {
    const titleResult = await lookupBySongTitle('Joy to the World', 'Three Dog Night');
    console.log('✓ Result:', JSON.stringify(titleResult, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n');

  // Test 3: ISWC Lookup
  console.log('3️⃣ Testing ISWC Lookup: T-000.000.001-0');
  console.log('──────────────────────────────────────────');
  try {
    const iswcResult = await lookupByISWC('T-000.000.001-0');
    console.log('✓ Result:', JSON.stringify(iswcResult, null, 2));
  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n✅ Tests complete!\n');
}

// Run tests
testLookups().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});