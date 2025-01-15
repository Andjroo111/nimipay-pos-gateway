const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green 
    : type === 'warning' ? colors.yellow 
    : type === 'error' ? colors.red 
    : '';
  console.log(`${color}${message}${colors.reset}`);
}

try {
  // Clean dist directory
  log('Cleaning dist directory...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  fs.mkdirSync('dist');

  // Run TypeScript compiler
  log('Compiling TypeScript...');
  execSync('tsc', { stdio: 'inherit' });

  // Copy package.json and update for distribution
  log('Preparing package.json...');
  const pkg = require('../package.json');
  const distPkg = {
    ...pkg,
    scripts: {
      test: 'jest'
    },
    devDependencies: undefined,
    files: ['**/*.js', '**/*.d.ts', '!**/__tests__/**']
  };
  fs.writeFileSync(
    path.join('dist', 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );

  // Copy README and LICENSE
  log('Copying documentation...');
  fs.copyFileSync('docs/README.md', 'dist/README.md');
  if (fs.existsSync('LICENSE')) {
    fs.copyFileSync('LICENSE', 'dist/LICENSE');
  }

  // Create types directory and copy type definitions
  log('Copying type definitions...');
  fs.mkdirSync(path.join('dist', 'types'), { recursive: true });
  fs.copyFileSync('src/types.ts', path.join('dist', 'types', 'index.d.ts'));

  // Run tests
  log('Running tests...');
  execSync('npm test', { stdio: 'inherit' });

  log('Build completed successfully! 🎉', 'success');
  log('\nTo publish the package:');
  log('1. cd dist');
  log('2. npm publish');

} catch (error) {
  log(`Build failed: ${error.message}`, 'error');
  process.exit(1);
}
