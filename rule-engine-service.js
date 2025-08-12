const { Engine } = require('json-rules-engine');
const OllamaIntegration = require('./ollama-integration');
const CSVProcessor = require('./csv-processor');

class RuleEngineService {
  constructor(csvFilePath) {
    this.csvProcessor = new CSVProcessor(csvFilePath);
    this.ollama = new OllamaIntegration();
    this.engine = new Engine();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Load CSV data
      await this.csvProcessor.loadTransactions();
      
      // Check if Ollama is available (optional now)
      const ollamaAvailable = await this.ollama.isAvailable();
      console.log('Ollama available:', ollamaAvailable);
      
      this.isInitialized = true;
      return {
        success: true,
        message: 'Rule engine service initialized successfully',
        ollamaAvailable,
        transactionCount: this.csvProcessor.getTransactions().length
      };
    } catch (error) {
      console.error('Failed to initialize service:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processQuery(naturalLanguageQuery) {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Service not initialized. Call initialize() first.'
      };
    }

    console.log('\n=== Processing Natural Language Query ===');
    console.log('Query:', naturalLanguageQuery);
    
    const startTime = Date.now();

    // Step 1: Try to generate JSON rule using Ollama first
    console.log('🤖 Generating JSON rule using Ollama...');
    let ruleResult = await this.ollama.generateRule(naturalLanguageQuery);

    // If Ollama fails, fallback to regex parser
    if (!ruleResult.success) {
      console.log('⚠️  Ollama not available, falling back to regex parser...');
      const NaturalLanguageParser = require('./natural-language-parser');
      const parser = new NaturalLanguageParser();
      ruleResult = parser.parseQuery(naturalLanguageQuery);
      
      if (!ruleResult.success) {
        return {
          success: false,
          error: ruleResult.error || 'Failed to generate rule with both Ollama and regex parser',
          helpMessage: 'Please ensure Ollama is running or try simpler query formats like: "amount < 10" or "category is food_dining"'
        };
      }
      ruleResult.source = 'regex';
    } else {
      ruleResult.source = 'ollama';
    }

    const ruleGenerationTime = Date.now() - startTime;
    console.log(`✅ JSON rule generated successfully (source: ${ruleResult.source}, time: ${ruleGenerationTime}ms)`);

    // Step 2: Apply the rule to filter transactions
    console.log('🔍 Applying rule to transaction data...');
    const filterStartTime = Date.now();
    const filteredTransactions = await this.applyRule(ruleResult.rule);
    const filterTime = Date.now() - filterStartTime;

    // Step 3: Generate natural language summary
    let finalSummary = 'Summary generation failed.';
    let summaryTime = 0;
    if (ruleResult.source === 'ollama') {
      console.log('📝 Generating natural language summary...');
      const summaryStartTime = Date.now();
      const summaryResult = await this.ollama.generateResultSummary(
        naturalLanguageQuery, 
        filteredTransactions, 
        this.csvProcessor.getTransactions().length,
        ruleResult.rule
      );
      summaryTime = Date.now() - summaryStartTime;
      
      finalSummary = summaryResult.success 
        ? summaryResult.summary 
        : summaryResult.fallbackSummary || 'Summary generation failed.';
    } else {
      // Generate simple fallback summary
      const matchCount = filteredTransactions.length;
      const totalTransactions = this.csvProcessor.getTransactions().length;
      const percentage = ((matchCount / totalTransactions) * 100).toFixed(1);
      finalSummary = `Found ${matchCount} transactions (${percentage}% of total) matching your query.`;
    }

    const totalTime = Date.now() - startTime;

    return {
      success: true,
      query: naturalLanguageQuery,
      generatedRule: ruleResult.rule,
      matchedTransactions: filteredTransactions,
      results: {
        matchCount: filteredTransactions.length,
        totalTransactions: this.csvProcessor.getTransactions().length,
        matchPercentage: ((filteredTransactions.length / this.csvProcessor.getTransactions().length) * 100).toFixed(1)
      },
      summary: finalSummary,
      source: ruleResult.source,
      performance: {
        totalTime: totalTime,
        ruleGenerationTime: ruleGenerationTime,
        filterTime: filterTime,
        summaryTime: summaryTime
      }
    };
  }

  async applyRule(jsonRule) {
    const engine = new Engine();
    engine.addRule(jsonRule);

    const transactions = this.csvProcessor.getTransactions();
    const matchedTransactions = [];

    console.log(`Applying rule to ${transactions.length} transactions...`);

    for (const transaction of transactions) {
      try {
        const { events } = await engine.run(transaction);
        if (events.length > 0) {
          matchedTransactions.push({
            ...transaction,
            _matchedEvents: events
          });
        }
      } catch (error) {
        console.error('Error applying rule to transaction:', error.message);
        // Continue with other transactions
      }
    }

    console.log(`Found ${matchedTransactions.length} matching transactions`);
    return matchedTransactions;
  }

  // Enhanced display of results
  displayResults(result) {
    if (!result.success) {
      console.log('❌ Query failed:', result.error);
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 QUERY RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📋 Original Query: "${result.query}"`);
    
    console.log(`\n🔧 Generated JSON Rule (${result.source}):`);
    console.log(JSON.stringify(result.generatedRule, null, 2));
    
    console.log(`\n📊 Results Summary:`);
    console.log(`- Matched Transactions: ${result.results.matchCount}`);
    console.log(`- Total Transactions: ${result.results.totalTransactions}`);
    console.log(`- Match Percentage: ${result.results.matchPercentage}%`);
    
    // Show performance metrics if available
    if (result.performance) {
      console.log(`\n⚡ Performance:`);
      console.log(`- Total Time: ${result.performance.totalTime}ms`);
      console.log(`- Rule Generation: ${result.performance.ruleGenerationTime}ms`);
      console.log(`- Filtering: ${result.performance.filterTime}ms`);
      if (result.performance.summaryTime) {
        console.log(`- Summary Generation: ${result.performance.summaryTime}ms`);
      }
    }
    
    if (result.matchedTransactions.length > 0) {
      console.log('\n💳 Matched Transactions:');
      result.matchedTransactions.forEach((transaction, index) => {
        console.log(`\n${index + 1}. Transaction ID: ${transaction.transactionId}`);
        console.log(`   Amount: ${transaction.amt.toFixed(2)}`);
        console.log(`   Merchant: ${transaction.merchant}`);
        console.log(`   Category: ${transaction.category}`);
        console.log(`   Date: ${transaction.timestamp}`);
        console.log(`   Location: ${transaction.city}, ${transaction.state}`);
        if (transaction.isFraud === 1) {
          console.log('   ⚠️  FRAUD ALERT');
        }
      });
    } else {
      console.log('\n❌ No transactions matched the criteria.');
    }
    
    console.log('\n🤖 Natural Language Summary:');
    console.log('─'.repeat(50));
    console.log(result.summary);
    console.log('─'.repeat(50));
  }

  // Test the service with example queries
  async runTests() {
    console.log('\n=== Running Enhanced Natural Language Tests ===');
    
    const testQueries = [
      "show me transactions with amount less than 10 dollars",
      "find transactions where category is food_dining", 
      "transactions over 100 dollars",
      "show me fraud transactions"
    ];

    const results = [];

    for (const query of testQueries) {
      console.log(`\n\nTesting: "${query}"`);
      console.log('─'.repeat(60));
      
      const result = await this.processQuery(query);
      results.push({
        query,
        success: result.success,
        matchCount: result.success ? result.results.matchCount : 0,
        error: result.error
      });
      
      if (result.success) {
        this.displayResults(result);
      } else {
        console.log(`❌ Error: ${result.error}`);
      }
    }

    return results;
  }

  // Get service statistics
  getStatistics() {
    if (!this.isInitialized) {
      return { error: 'Service not initialized' };
    }

    return {
      ...this.csvProcessor.getStatistics(),
      ollamaRequired: true,
      naturalLanguageInputOutput: true
    };
  }

  // Validate a JSON rule
  validateRule(jsonRule) {
    try {
      const engine = new Engine();
      engine.addRule(jsonRule);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  // Get example queries for help
  getExampleQueries() {
    return [
      "show me transactions with amount less than 10 dollars",
      "find transactions where category is food_dining",
      "transactions over 100 dollars",
      "show me transactions in California",
      "find fraud transactions",
      "show me transactions at Starbucks",
      "transactions between 50 and 100 dollars",
      "show me travel category transactions"
    ];
  }
}

module.exports = RuleEngineService; 