const express = require('express');
const cors = require('cors');
const RuleEngineService = require('./rule-engine-service');
const path = require('path');
const config = require('./config');

class WebApi {
  constructor(csvFilePath) {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.service = new RuleEngineService(csvFilePath);
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }
  
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Initialize the service
    this.app.get('/api/initialize', async (req, res) => {
      try {
        const result = await this.service.initialize();
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Process a natural language query
    this.app.post('/api/query', async (req, res) => {
      try {
        const { query } = req.body;
        
        if (!query) {
          return res.status(400).json({ 
            success: false, 
            error: 'Query parameter is required' 
          });
        }
        
        const result = await this.service.processQuery(query);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Get dataset statistics
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = this.service.getStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Get example queries
    this.app.get('/api/examples', (req, res) => {
      try {
        const examples = this.service.getExampleQueries();
        res.json({ examples });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Validate a JSON rule
    this.app.post('/api/validate', (req, res) => {
      try {
        const { rule } = req.body;
        
        if (!rule) {
          return res.status(400).json({ 
            success: false, 
            error: 'Rule parameter is required' 
          });
        }
        
        const validation = this.service.validateRule(rule);
        res.json(validation);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }
  
  async start() {
    // Initialize the service on startup
    console.log('Initializing rule engine service...');
    const initResult = await this.service.initialize();
    
    if (!initResult.success) {
      console.error('Failed to initialize service:', initResult.error);
      throw new Error('Service initialization failed');
    }
    
    this.app.listen(this.port, () => {
      console.log(`🚀 Web API server running on http://localhost:${this.port}`);
      console.log(`📊 Loaded ${initResult.transactionCount} transactions`);
      console.log(`🤖 Ollama integration: ${initResult.ollamaAvailable ? 'Active' : 'Unavailable (using regex fallback)'}`);
    });
  }
}

module.exports = WebApi;