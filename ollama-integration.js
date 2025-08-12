const axios = require('axios');
const { FIELD_MAPPING, FIELD_ALIASES, OPERATOR_MAPPING } = require('./field-mapping');
const config = require('./config');

class OllamaIntegration {
  constructor(ollamaUrl = config.ollama.url) {
    this.ollamaUrl = ollamaUrl;
    this.model = config.ollama.model;
  }

  // Set the model to use
  setModel(modelName) {
    this.model = modelName;
  }

  // Check if Ollama is available
  async isAvailable() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: config.ollama.timeout
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Generate JSON rule using LLM with structured output
  async generateRule(naturalLanguageQuery) {
    const prompt = this.buildRuleGenerationPrompt(naturalLanguageQuery);
    
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for consistent output
          top_p: 0.9
        }
      }, {
        timeout: config.ollama.timeout
      });

      const generatedText = response.data.response;
      return this.parseJsonFromResponse(generatedText);
      
    } catch (error) {
      console.error('Ollama request failed:', error.message);
      return {
        success: false,
        error: `Ollama request failed: ${error.message}. Please ensure Ollama is running and the model '${this.model}' is available.`
      };
    }
  }

  // Generate natural language summary of results
  async generateResultSummary(originalQuery, matchedTransactions, totalTransactions, generatedRule) {
    const prompt = this.buildSummaryPrompt(originalQuery, matchedTransactions, totalTransactions, generatedRule);
    
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Slightly higher temperature for more natural language
          top_p: 0.9
        }
      }, {
        timeout: config.ollama.timeout
      });

      return {
        success: true,
        summary: response.data.response.trim()
      };
      
    } catch (error) {
      console.error('Summary generation failed:', error.message);
      return {
        success: false,
        error: `Summary generation failed: ${error.message}`,
        fallbackSummary: this.generateFallbackSummary(originalQuery, matchedTransactions, totalTransactions)
      };
    }
  }

  buildRuleGenerationPrompt(query) {
    const availableFields = Object.values(FIELD_MAPPING).map(field => 
      `${field.name} (${field.type}): ${field.description}`
    ).join('\n');

    return `You are a JSON rules engine generator for credit card transaction filtering. Your task is to convert natural language queries into precise JSON rules.

AVAILABLE FIELDS:
${availableFields}

SUPPORTED OPERATORS (use these EXACT names):
- lessThan (for <, "less than", "under", "below")
- greaterThan (for >, "greater than", "over", "above") 
- equal (for =, "equals", "is", "equal to") - NOT "equals"
- notEqual (for !=, "not equal", "not equals")
- lessThanInclusive (for <=, "less than or equal")
- greaterThanInclusive (for >=, "greater than or equal")
- contains (for text contains)
- in (for value in array)

CRITICAL RULES:
1. Use ONLY the field names from the available fields list above
2. Use ONLY the exact operator names listed above (e.g., "equal" NOT "equals")
3. The "amt" field represents transaction amount in dollars
4. For categories, use "equal" operator with exact string matching
5. Return ONLY valid JSON, no other text
6. Surround your JSON output with <result></result> tags

QUERY: "${query}"

Generate a JSON rule following this exact structure:
{
  "conditions": {
    "all": [
      {
        "fact": "field_name",
        "operator": "operator_name", 
        "value": value
      }
    ]
  },
  "event": {
    "type": "transaction-match",
    "params": {
      "message": "Clear description of what this rule matches"
    }
  }
}

<result>`;
  }

  buildSummaryPrompt(originalQuery, matchedTransactions, totalTransactions, generatedRule) {
    // Prepare transaction data for analysis
    const transactionSummary = matchedTransactions.slice(0, 10).map(t => ({
      amount: t.amt,
      merchant: t.merchant,
      category: t.category,
      date: t.timestamp,
      city: t.city,
      state: t.state
    }));

    // Calculate insights
    const amounts = matchedTransactions.map(t => t.amt);
    const lowestAmount = Math.min(...amounts);
    const highestAmount = Math.max(...amounts);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

    const lowestTransaction = matchedTransactions.find(t => t.amt === lowestAmount);
    const highestTransaction = matchedTransactions.find(t => t.amt === highestAmount);

    return `You are a financial data analyst providing insights on credit card transaction analysis results.

ORIGINAL QUERY: "${originalQuery}"

ANALYSIS RESULTS:
- Total transactions in dataset: ${totalTransactions}
- Transactions matching criteria: ${matchedTransactions.length}
- Match percentage: ${((matchedTransactions.length / totalTransactions) * 100).toFixed(1)}%

FINANCIAL INSIGHTS:
- Lowest matching amount: ${lowestAmount.toFixed(2)} at ${lowestTransaction?.merchant || 'Unknown'} on ${lowestTransaction?.timestamp || 'Unknown date'}
- Highest matching amount: ${highestAmount.toFixed(2)} at ${highestTransaction?.merchant || 'Unknown'} on ${highestTransaction?.timestamp || 'Unknown date'}
- Average amount: ${avgAmount.toFixed(2)}

SAMPLE MATCHING TRANSACTIONS:
${transactionSummary.map((t, i) => 
  `${i+1}. ${t.amount.toFixed(2)} at ${t.merchant} (${t.category}) in ${t.city}, ${t.state} on ${t.date}`
).join('\n')}

TASK: Generate a natural language summary that:
1. States how many transactions matched the criteria
2. Highlights the most notable findings (lowest, highest amounts)
3. Mentions interesting patterns in merchants, categories, or locations
4. Uses a professional but conversational tone
5. Keep it concise (2-3 sentences maximum)

Provide only the summary, no additional text:`;
  }

  parseJsonFromResponse(response) {
    try {
      // Try to extract JSON from <result></result> tags first
      const resultMatch = response.match(/<result>(.*?)<\/result>/s);
      let jsonText = resultMatch ? resultMatch[1].trim() : response;
      
      // Clean up common LLM response artifacts
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      
      // Try to find JSON object in the response
      const jsonMatch = jsonText.match(/\{.*\}/s);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      const parsedRule = JSON.parse(jsonText);
      
      // Validate the rule structure
      if (this.validateRule(parsedRule)) {
        return {
          success: true,
          rule: parsedRule,
          source: 'ollama'
        };
      } else {
        return {
          success: false,
          error: 'Generated rule does not match expected json-rules-engine format',
          rawResponse: response
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse JSON from LLM response: ${error.message}`,
        rawResponse: response
      };
    }
  }

  validateRule(rule) {
    // Basic validation of json-rules-engine format
    if (!rule.conditions || !rule.event) {
      return false;
    }
    
    if (!rule.conditions.all && !rule.conditions.any) {
      return false;
    }
    
    const conditions = rule.conditions.all || rule.conditions.any;
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return false;
    }
    
    // Check each condition has required fields
    for (const condition of conditions) {
      if (!condition.fact || !condition.operator || condition.value === undefined) {
        return false;
      }
    }
    
    return true;
  }

  // Generate a fallback summary when Ollama is unavailable
  generateFallbackSummary(originalQuery, matchedTransactions, totalTransactions) {
    const matchCount = matchedTransactions.length;
    const percentage = ((matchCount / totalTransactions) * 100).toFixed(1);
    
    if (matchCount === 0) {
      return `No transactions matched the criteria "${originalQuery}" out of ${totalTransactions} total transactions.`;
    }
    
    const amounts = matchedTransactions.map(t => t.amt);
    const lowestAmount = Math.min(...amounts);
    const highestAmount = Math.max(...amounts);
    const lowestTransaction = matchedTransactions.find(t => t.amt === lowestAmount);
    const highestTransaction = matchedTransactions.find(t => t.amt === highestAmount);
    
    return `Found ${matchCount} transactions (${percentage}% of total) matching "${originalQuery}". The lowest amount was ${lowestAmount.toFixed(2)} at ${lowestTransaction.merchant}, and the highest was ${highestAmount.toFixed(2)} at ${highestTransaction.merchant}.`;
  }

  // Get available models from Ollama
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: config.ollama.timeout
      });
      return response.data.models || [];
    } catch (error) {
      console.error('Failed to get Ollama models:', error.message);
      return [];
    }
  }

  // Test the integration with a simple query
  async test() {
    const testQuery = "show me transactions with amount less than 10";
    console.log('Testing Ollama integration...');
    console.log('Test query:', testQuery);
    
    const result = await this.generateRule(testQuery);
    console.log('Test result:', JSON.stringify(result, null, 2));
    
    return result;
  }
}

module.exports = OllamaIntegration; 