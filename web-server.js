#!/usr/bin/env node

const WebApi = require('./web-api');
const path = require('path');
const config = require('./config');

async function main() {
  try {
    const csvPath = path.join(__dirname, config.app.csvFilePath);
    const api = new WebApi(csvPath);
    
    await api.start();
  } catch (error) {
    console.error('Failed to start web API:', error);
    process.exit(1);
  }
}

main();