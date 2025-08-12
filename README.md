# Credit Card Transaction Rules Engine Demo

A natural language to JSON rules engine for filtering credit card transactions. This demo allows you to use plain English to generate rules that can be applied by [json-rules-engine](https://github.com/CacheControl/json-rules-engine) to filter transaction data.

## 🚀 Features

- **Natural Language Processing**: Convert queries like "show me transactions with amount less than 10" into JSON rules
- **Dual Processing Modes**: 
  - Basic regex-based parser for simple queries
  - LLM-powered processing using Ollama for complex queries
- **JSON Rules Engine Integration**: Generated rules work directly with json-rules-engine
- **CSV Data Processing**: Loads and processes credit card transaction data
- **Interactive CLI**: Test queries in real-time
- **Web API**: HTTP API for programmatic access
- **Comprehensive Field Mapping**: Maps CSV columns to meaningful field names
- **Configurable**: Customize behavior through environment variables

## 📋 Requirements

- Node.js 14+ 
- npm or yarn
- [Ollama](https://ollama.ai/) with Llama model for enhanced NLP (optional)

## 🛠️ Installation

1. Clone or create the project directory:
```bash
mkdir credit-card-rules-demo
cd credit-card-rules-demo
```

2. Install dependencies:
```bash
npm install
```

3. Install and set up Ollama (optional but recommended):
```bash
# Install Ollama (visit https://ollama.ai/ for instructions)
# Pull a model (e.g., Llama 3.2)
ollama pull llama3.2
```

## ⚙️ Configuration

The application can be configured through environment variables or by modifying `config.js`:

| Environment Variable | Default Value | Description |
|---------------------|---------------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2:3b-instruct-fp16` | Model to use for processing |
| `OLLAMA_TIMEOUT` | `30000` | Request timeout in milliseconds |
| `CSV_FILE_PATH` | `./data.csv` | Path to transaction data file |
| `REQUIRE_OLLAMA` | `false` | Whether to require Ollama for initialization |
| `FALLBACK_TO_REGEX` | `true` | Whether to fallback to regex parser if Ollama is unavailable |
| `MAX_TRANSACTIONS` | `10000` | Maximum number of transactions to process |
| `SHOW_METRICS` | `true` | Whether to display performance metrics |
| `DEBUG` | `false` | Enable debug logging |
| `PORT` | `3000` | Port for web API server |

Example:
```bash
OLLAMA_MODEL=llama3.2:3b-instruct-fp16 PORT=8080 node web-server.js
```

## 📊 Data Format

The system expects CSV data with the following structure (your `data.csv`):
- **Column 0**: Transaction ID
- **Column 1**: Timestamp
- **Column 2**: Card Number
- **Column 3**: Merchant
- **Column 4**: Category
- **Column 5**: Amount (amt) - The main field for filtering
- **Column 6**: First Name
- **Column 7**: Last Name
- And more... (see `field-mapping.js` for complete mapping)

## 🚀 Usage

### CLI Mode

```bash
node index.js
```

This will:
1. Load your transaction data
2. Run example queries
3. Enter interactive mode for testing

### Web API Mode

```bash
node web-server.js
```

Or with custom port:
```bash
PORT=8080 node web-server.js
```

The web API will be available at `http://localhost:3000` (or your specified port).

### Example Queries

The system supports various natural language formats:

```javascript
// Simple comparisons
"show me transactions with amount less than 10"
"amt > 100"
"amount >= 50"

// Category filtering  
"transactions where category is food_dining"
"category equals travel"

// Fraud detection
"fraud transactions"
"fraudulent transactions"

// Location-based
"show me transactions with state is CA"
"transactions where city is New York"
```

### Programmatic Usage

```javascript
const RuleEngineService = require('./rule-engine-service');

async function example() {
  const service = new RuleEngineService('./data.csv');
  await service.initialize();
  
  const result = await service.processQuery("amount less than 10");
  
  if (result.success) {
    console.log('Generated Rule:', result.generatedRule);
    console.log('Matches:', result.results.matchCount);
  }
}
```

## 🌐 Web API Endpoints

### `GET /health`

Health check endpoint.

Response:
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### `GET /api/initialize`

Initialize the rule engine service.

Response:
```json
{
  "success": true,
  "message": "Rule engine service initialized successfully",
  "ollamaAvailable": true,
  "transactionCount": 1234
}
```

### `POST /api/query`

Process a natural language query.

Request:
```json
{
  "query": "show me transactions with amount less than 10"
}
```

Response:
```json
{
  "success": true,
  "query": "show me transactions with amount less than 10",
  "generatedRule": { /* JSON rule */ },
  "matchedTransactions": [ /* matched transactions */ ],
  "results": {
    "matchCount": 42,
    "totalTransactions": 1234,
    "matchPercentage": "3.4"
  },
  "summary": "Found 42 transactions matching your query...",
  "source": "ollama",
  "performance": {
    "totalTime": 1200,
    "ruleGenerationTime": 1100,
    "filterTime": 50,
    "summaryTime": 50
  }
}
```

### `GET /api/stats`

Get dataset statistics.

Response:
```json
{
  "totalTransactions": 1234,
  "amountStats": {
    "min": 1.23,
    "max": 1234.56,
    "average": 45.67
  },
  "uniqueCategories": 15,
  "categories": ["food_dining", "travel", ...],
  "uniqueMerchants": 842,
  "merchants": ["Starbucks", "Walmart", ...],
  "fraudCount": 23,
  "ollamaRequired": false,
  "naturalLanguageInputOutput": true
}
```

### `GET /api/examples`

Get example queries.

Response:
```json
{
  "examples": [
    "show me transactions with amount less than 10",
    "find transactions where category is food_dining",
    // ...
  ]
}
```

### `POST /api/validate`

Validate a JSON rule.

Request:
```json
{
  "rule": { /* JSON rule to validate */ }
}
```

Response:
```json
{
  "valid": true
}
```

## 🏗️ Architecture

### Components

1. **`field-mapping.js`**: Maps CSV columns to field names and handles aliases
2. **`natural-language-parser.js`**: Basic regex-based query parser
3. **`ollama-integration.js`**: LLM-powered rule generation using Ollama
4. **`csv-processor.js`**: Loads and processes transaction data
5. **`rule-engine-service.js`**: Main service coordinating all components
6. **`index.js`**: CLI interface and demo runner
7. **`web-api.js`**: Web API server
8. **`config.js`**: Configuration settings

### Processing Flow

```
Natural Language Query
         ↓
    [Try Ollama LLM]
         ↓
  [Fallback to Regex Parser]
         ↓
    JSON Rule Generated
         ↓
   Applied to Transactions
         ↓
    Filtered Results
```

## 📝 Generated JSON Rules

The system generates rules compatible with json-rules-engine:

```json
{
  "conditions": {
    "all": [
      {
        "fact": "amt",
        "operator": "lessThan",
        "value": 10
      }
    ]
  },
  "event": {
    "type": "transaction-match",
    "params": {
      "message": "Transaction matches criteria: amt lessThan 10"
    }
  }
}
```

## 🔧 Configuration

### Field Aliases

The system recognizes common aliases:
- `amount`, `price`, `cost` → `amt`
- `store`, `shop`, `business` → `merchant`
- `fraud`, `fraudulent` → `isFraud`

### Operators

Supported operators:
- `less than`, `<`, `lt` → `lessThan`
- `greater than`, `>`, `gt` → `greaterThan`
- `equal to`, `equals`, `is`, `=` → `equal`
- `not equal`, `!=` → `notEqual`
- And more...

### Ollama Configuration

To use different models or endpoints:

```javascript
const ollama = new OllamaIntegration('http://localhost:11434');
ollama.setModel('llama3.2'); // or your preferred model
```

## 🧪 Testing

Run the built-in tests:

```javascript
const service = new RuleEngineService('./data.csv');
await service.initialize();
const testResults = await service.runTests();
```

Or run unit tests:
```bash
npm test
```

## 📚 API Reference

### RuleEngineService

#### `initialize()`
Loads CSV data and checks Ollama availability.

#### `processQuery(query, useOllama = true)`
Processes a natural language query and returns filtered results.

#### `getStatistics()`
Returns dataset statistics and available fields.

#### `validateRule(jsonRule)`
Validates a JSON rule format.

### NaturalLanguageParser

#### `parseQuery(query)`
Parses natural language using regex patterns.

#### `getExampleQueries()`
Returns list of supported query formats.

### OllamaIntegration

#### `generateRule(query)`
Uses LLM to generate JSON rules from natural language.

#### `isAvailable()`
Checks if Ollama service is running.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [json-rules-engine](https://github.com/CacheControl/json-rules-engine) - The underlying rules engine
- [Ollama](https://ollama.ai/) - Local LLM runtime
- [json-rule-editor](https://github.com/vinzdeveloper/json-rule-editor) - Visual rule editor

## 🐛 Troubleshooting

### Common Issues

1. **CSV Loading Errors**: Ensure your CSV file matches the expected format
2. **Ollama Connection**: Check if Ollama is running on `http://localhost:11434`
3. **Rule Generation Failures**: Try simpler query formats or check example queries

### Debug Mode

Enable debug logging:
```bash
DEBUG=* node index.js
```

## 📈 Performance

- Basic parser: ~1ms per query
- Ollama integration: ~500-2000ms per query (depending on model)
- Rule application: ~10-50ms per 1000 transactions

For production use, consider caching generated rules and using the basic parser for simple queries. 
