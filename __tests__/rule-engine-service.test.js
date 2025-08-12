const RuleEngineService = require('../rule-engine-service');
const path = require('path');

// Mock Ollama integration for testing
jest.mock('../ollama-integration', () => {
  return jest.fn().mockImplementation(() => {
    return {
      isAvailable: jest.fn().mockResolvedValue(true),
      generateRule: jest.fn().mockResolvedValue({
        success: true,
        rule: {
          conditions: {
            all: [
              {
                fact: 'amt',
                operator: 'lessThan',
                value: 10
              }
            ]
          },
          event: {
            type: 'transaction-match',
            params: {
              message: 'Transaction matches criteria: amt lessThan 10'
            }
          }
        }
      }),
      generateResultSummary: jest.fn().mockResolvedValue({
        success: true,
        summary: 'Found 5 transactions matching your query.'
      })
    };
  });
});

describe('RuleEngineService', () => {
  let service;
  const csvPath = path.join(__dirname, '../data.csv');

  beforeEach(() => {
    service = new RuleEngineService(csvPath);
  });

  describe('processQuery', () => {
    it('should process a query successfully', async () => {
      // Mock CSV processor
      service.csvProcessor.loadTransactions = jest.fn().mockResolvedValue([]);
      service.csvProcessor.getTransactions = jest.fn().mockReturnValue([
        { amt: 5, merchant: 'Starbucks' },
        { amt: 15, merchant: 'Walmart' }
      ]);
      
      const result = await service.processQuery('show me transactions with amount less than 10');
      
      expect(result.success).toBe(true);
      expect(result.query).toBe('show me transactions with amount less than 10');
      expect(result.matchedTransactions).toHaveLength(1);
    });

    it('should fallback to regex parser when Ollama is unavailable', async () => {
      // Mock Ollama to fail
      service.ollama.generateRule = jest.fn().mockResolvedValue({
        success: false,
        error: 'Ollama not available'
      });
      
      // Mock CSV processor
      service.csvProcessor.loadTransactions = jest.fn().mockResolvedValue([]);
      service.csvProcessor.getTransactions = jest.fn().mockReturnValue([
        { amt: 5, merchant: 'Starbucks' },
        { amt: 15, merchant: 'Walmart' }
      ]);
      
      const result = await service.processQuery('amt < 10');
      
      expect(result.success).toBe(true);
      expect(result.source).toBe('regex');
    });
  });
});