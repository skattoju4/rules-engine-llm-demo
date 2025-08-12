// Configuration file for the Rules Engine Demo
module.exports = {
  // Ollama configuration
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b-instruct-fp16',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000 // 30 seconds
  },
  
  // Application settings
  app: {
    csvFilePath: process.env.CSV_FILE_PATH || './data.csv',
    // Whether to require Ollama for initialization
    requireOllama: process.env.REQUIRE_OLLAMA === 'true' || false,
    // Default to regex parser if Ollama is unavailable
    fallbackToRegex: process.env.FALLBACK_TO_REGEX !== 'false'
  },
  
  // Performance settings
  performance: {
    // Maximum number of transactions to process
    maxTransactions: parseInt(process.env.MAX_TRANSACTIONS) || 10000,
    // Whether to show performance metrics
    showMetrics: process.env.SHOW_METRICS === 'true' || true
  },
  
  // Logging settings
  logging: {
    // Enable debug logging
    debug: process.env.DEBUG === 'true' || false,
    // Log file path (if logging to file)
    logFilePath: process.env.LOG_FILE_PATH || './app.log'
  }
};