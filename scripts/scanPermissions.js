const fs = require('fs');
const path = require('path');

/*
|--------------------------------------------------------------------------
| TARGET PATH (DEFAULT → modules/admin)
|--------------------------------------------------------------------------
| unaweza override:
| node scripts/scanPermissions.js modules/admin/analytics
*/

const inputPath = process.argv[2] || 'src/modules/admin';
const ROUTES_PATH = path.join(__dirname, '..', inputPath);

const issues = [];

/*
|--------------------------------------------------------------------------
| SCAN FILE
|--------------------------------------------------------------------------
*/

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');

  const matches = content.match(/requirePermission\(\{([\s\S]*?)\}\)/g);

  if (!matches) return;

  matches.forEach((block) => {
    // ❌ Missing scope
    if (!block.includes('scope')) {
      issues.push(`${filePath} → MISSING SCOPE`);
    }

    // ❌ lowercase module
    if (block.match(/module:\s*["'][a-z]/)) {
      issues.push(`${filePath} → module not uppercase`);
    }

    // ❌ lowercase action
    if (block.match(/action:\s*["'][a-z]/)) {
      issues.push(`${filePath} → action not uppercase`);
    }

    // ❌ lowercase scope
    if (block.match(/scope:\s*["'][a-z]/)) {
      issues.push(`${filePath} → scope not uppercase`);
    }

    // ❌ invalid scope usage (READ used as scope)
    if (block.match(/scope:\s*["']READ["']/)) {
      issues.push(`${filePath} → INVALID SCOPE VALUE (READ used as scope)`);
    }

    // ❌ invalid actions (view/edit/write)
    if (block.match(/action:\s*["'](view|edit|write)["']/i)) {
      issues.push(`${filePath} → INVALID ACTION NAME (use CREATE/READ/UPDATE)`);
    }

    // 🔥 admin routes must use SYSTEM scope
    if (filePath.includes('modules/admin')) {
      if (
        !block.includes('scope: SCOPES.SYSTEM') &&
        !block.includes('scope: "SYSTEM"')
      ) {
        issues.push(`${filePath} → ADMIN ROUTE MUST USE SYSTEM SCOPE`);
      }
    }
  });
};

/*
|--------------------------------------------------------------------------
| SCAN DIRECTORY RECURSIVELY
|--------------------------------------------------------------------------
*/

const scanDir = (dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`❌ Path not found: ${dir}`);
    return;
  }

  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.js')) {
      scanFile(fullPath);
    }
  });
};

/*
|--------------------------------------------------------------------------
| RUN
|--------------------------------------------------------------------------
*/

console.log(`\n🔍 Scanning: ${ROUTES_PATH}\n`);

scanDir(ROUTES_PATH);

console.log('=== PERMISSION ISSUES ===\n');

if (issues.length) {
  console.log(issues.join('\n'));
} else {
  console.log('No issues found ✅');
}

console.log('\n');
