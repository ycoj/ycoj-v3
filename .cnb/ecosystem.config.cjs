const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const runtime = parseEnv(
  readFileSync(path.resolve(__dirname, '../../shared/runtime.env'), 'utf8'),
);

module.exports = {
  apps: [
    {
      name: 'ycoj-ui',
      cwd: __dirname,
      script: path.join(__dirname, 'server.js'),
      interpreter: process.execPath,
      exec_mode: 'fork',
      instances: 1,
      env: {
        ...runtime,
        NODE_ENV: 'production',
        HOSTNAME: runtime.HOSTNAME || '127.0.0.1',
        PORT: runtime.PORT || '3000',
      },
    },
  ],
};
