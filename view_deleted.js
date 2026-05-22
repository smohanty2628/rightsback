const fs = require('fs');
const path = require('path');

const archiveRoot = path.join(__dirname, 'deleted_records');
const submissionsArchive = path.join(archiveRoot, 'submissions');
const CSV_PATH = path.join(__dirname, 'submissions.csv');

console.log('\n==============================================');
console.log('   RIGHTSBACK — DELETED RECORDS');
console.log('==============================================\n');

if (!fs.existsSync(archiveRoot)) {
  console.log('❌ No deleted_records folder found. Nothing has been deleted yet.\n');
  process.exit(0);
}

// Read archive files
const archiveFiles = fs.existsSync(submissionsArchive)
  ? fs.readdirSync(submissionsArchive).filter(f => f.endsWith('.csv')).sort().reverse()
  : [];

if (archiveFiles.length === 0) {
  console.log('✅ No deleted records found. Archive is empty.\n');
  process.exit(0);
}

console.log('📂 Deleted Submissions Archive:\n');

const allFiles = [];
archiveFiles.forEach((file, idx) => {
  const stat = fs.statSync(path.join(submissionsArchive, file));
  const date = new Date(stat.mtime).toLocaleString();
  console.log(`   ${idx + 1}. ${file}`);
  console.log(`      Deleted: ${date}`);
  allFiles.push({ file, path: path.join(submissionsArchive, file) });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Options:');
console.log('  - Type a number to VIEW contents');
console.log('  - Type "restore X" to RESTORE file #X back to submissions.csv');
console.log('  - Type "delete X" to PERMANENTLY DELETE archive file #X');
console.log('  - Type "exit" to quit\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

function parseCSV(content) {
  const lines = content.split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    
    const obj = {};
    headers.forEach((h, i) => obj[h] = fields[i] || '');
    return obj;
  });
  return { headers, rows };
}

function saveCSV(headers, rows) {
  const escapeCSV = val => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  return headers.join(',') + '\n' + rows.map(r => 
    headers.map(h => escapeCSV(r[h])).join(',')
  ).join('\n') + '\n';
}

function prompt() {
  readline.question('Enter command: ', (cmd) => {
    cmd = cmd.trim().toLowerCase();

    if (cmd === 'exit') {
      console.log('\n✅ Goodbye!\n');
      readline.close();
      return;
    }

    // View file
    if (!isNaN(cmd)) {
      const num = parseInt(cmd);
      if (num < 1 || num > allFiles.length) {
        console.log('\n❌ Invalid file number.\n');
        prompt();
        return;
      }

      const file = allFiles[num - 1];
      const content = fs.readFileSync(file.path, 'utf8');
      const { rows } = parseCSV(content);

      console.log(`\n📄 Contents of ${file.file}:\n`);
      rows.forEach((r, i) => {
        console.log(`   ${i + 1}. Name: ${r.name}`);
        console.log(`      Email: ${r.email}`);
        console.log(`      Phone: ${r.phone}`);
        console.log(`      Song: ${r.song_title}`);
        console.log(`      Submitted: ${r.submitted_at?.split('T')[0] || 'Unknown'}`);
        console.log('');
      });
      prompt();
      return;
    }

    // Restore file
    if (cmd.startsWith('restore ')) {
      const num = parseInt(cmd.split(' ')[1]);
      if (isNaN(num) || num < 1 || num > allFiles.length) {
        console.log('\n❌ Invalid file number.\n');
        prompt();
        return;
      }

      const file = allFiles[num - 1];
      const content = fs.readFileSync(file.path, 'utf8');
      const { headers, rows } = parseCSV(content);

      console.log(`\n⚠️  Restore ${rows.length} submission(s) from ${file.file}?`);
      readline.question('Type "yes" to confirm: ', (confirm) => {
        if (confirm.toLowerCase() !== 'yes') {
          console.log('\n❌ Cancelled.\n');
          prompt();
          return;
        }

        // Read current CSV
        let currentHeaders = headers;
        let currentRows = [];

        if (fs.existsSync(CSV_PATH)) {
          const currentContent = fs.readFileSync(CSV_PATH, 'utf8');
          const parsed = parseCSV(currentContent);
          currentHeaders = parsed.headers;
          currentRows = parsed.rows;
        }

        // Append restored rows
        const restoredRows = [...currentRows, ...rows];
        const newContent = saveCSV(currentHeaders, restoredRows);

        // Backup if exists
        if (fs.existsSync(CSV_PATH)) {
          fs.copyFileSync(CSV_PATH, CSV_PATH + '.backup');
        }

        // Save
        fs.writeFileSync(CSV_PATH, newContent, 'utf8');

        console.log(`\n✅ Restored ${rows.length} submission(s) back to submissions.csv!\n`);
        prompt();
      });
      return;
    }

    // Delete archive file
    if (cmd.startsWith('delete ')) {
      const num = parseInt(cmd.split(' ')[1]);
      if (isNaN(num) || num < 1 || num > allFiles.length) {
        console.log('\n❌ Invalid file number.\n');
        prompt();
        return;
      }

      const file = allFiles[num - 1];
      console.log(`\n⚠️  PERMANENTLY delete ${file.file}?`);
      console.log('⚠️  This cannot be undone!\n');
      readline.question('Type "yes" to confirm: ', (confirm) => {
        if (confirm.toLowerCase() !== 'yes') {
          console.log('\n❌ Cancelled.\n');
          prompt();
          return;
        }

        fs.unlinkSync(file.path);
        console.log(`\n✅ Permanently deleted ${file.file}\n`);
        
        // Restart to refresh list
        console.log('Refreshing list...\n');
        readline.close();
        require('child_process').spawn(process.argv[0], process.argv.slice(1), {
          cwd: process.cwd(),
          detached: false,
          stdio: 'inherit'
        });
      });
      return;
    }

    console.log('\n❌ Invalid command. Try a number, "restore X", "delete X", or "exit".\n');
    prompt();
  });
}

prompt();