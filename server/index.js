const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('./portfolio.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_symbol TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    transaction_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper function to parse PDF and extract transaction data
async function parsePDFTransactions(pdfBuffer, password = null) {
  try {
    // Basic validation
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }

    let text = '';
    
    try {
      // First, try with pdf-parse (works for most non-protected PDFs)
      const options = {};
      if (password) {
        options.password = password;
      }
      
      const data = await pdfParse(pdfBuffer, options);
      text = data.text;
    } catch (pdfParseError) {
      console.log('pdf-parse failed, trying pdf-lib:', pdfParseError.message);
      
      // If pdf-parse fails, try with pdf-lib (better password support)
      try {
        const pdfDoc = await PDFDocument.load(pdfBuffer, { 
          ignoreEncryption: !password,
          password: password || undefined
        });
        
        // pdf-lib doesn't extract text directly, so we'll create a simpler approach
        // For now, let's provide a helpful message and sample data
        text = 'PDF loaded successfully but text extraction requires additional setup. Please manually enter your transactions below.';
        
      } catch (pdfLibError) {
        console.log('pdf-lib also failed:', pdfLibError.message);
        
        if (pdfLibError.message.includes('password') || pdfLibError.message.includes('encrypted')) {
          throw new Error('This PDF is password-protected. Please enter the correct password.');
        } else if (pdfParseError.message.includes('password') || pdfParseError.message.includes('No password given')) {
          throw new Error('This PDF requires a password. Please enter the password and try again.');
        } else {
          throw new Error('Unable to read PDF. It might be corrupted, password-protected, or in an unsupported format.');
        }
      }
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('PDF contains no readable text. It might be a scanned document or require a password.');
    }
    
    console.log('PDF text sample:', text.substring(0, 500)); // Debug log
    
    // This is a basic parser - you'll need to adjust based on your broker's PDF format
    const transactions = [];
    const lines = text.split('\n');
    
    // Look for various transaction patterns (common formats)
    const patterns = [
      // Pattern 1: SYMBOL BUY/SELL QTY PRICE DATE
      /(\w+)\s+(BUY|SELL)\s+(\d+)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})/i,
      // Pattern 2: DATE SYMBOL BUY/SELL QTY PRICE
      /(\d{2}\/\d{2}\/\d{4})\s+(\w+)\s+(BUY|SELL)\s+(\d+)\s+(\d+\.?\d*)/i,
      // Pattern 3: BUY/SELL SYMBOL QTY @ PRICE DATE
      /(BUY|SELL)\s+(\w+)\s+(\d+)\s+@\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})/i
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let transaction;
          
          if (pattern === patterns[0]) {
            // Pattern 1
            transaction = {
              stock_symbol: match[1].toUpperCase(),
              stock_name: match[1].toUpperCase(),
              transaction_type: match[2].toUpperCase(),
              quantity: parseInt(match[3]),
              price: parseFloat(match[4]),
              transaction_date: match[5]
            };
          } else if (pattern === patterns[1]) {
            // Pattern 2
            transaction = {
              stock_symbol: match[2].toUpperCase(),
              stock_name: match[2].toUpperCase(),
              transaction_type: match[3].toUpperCase(),
              quantity: parseInt(match[4]),
              price: parseFloat(match[5]),
              transaction_date: match[1]
            };
          } else if (pattern === patterns[2]) {
            // Pattern 3
            transaction = {
              stock_symbol: match[2].toUpperCase(),
              stock_name: match[2].toUpperCase(),
              transaction_type: match[1].toUpperCase(),
              quantity: parseInt(match[3]),
              price: parseFloat(match[4]),
              transaction_date: match[5]
            };
          }
          
          if (transaction && transaction.quantity > 0 && transaction.price > 0) {
            transactions.push(transaction);
            break; // Found a match, no need to try other patterns for this line
          }
        }
      }
    }
    
    // If no transactions found with patterns, create a sample transaction for testing
    if (transactions.length === 0) {
      console.log('No transactions found with patterns. Creating sample data for testing.');
      transactions.push({
        stock_symbol: 'SAMPLE',
        stock_name: 'Sample Stock (Please Edit)',
        transaction_type: 'BUY',
        quantity: 1,
        price: 100.00,
        transaction_date: new Date().toISOString().split('T')[0]
      });
    }
    
    return transactions;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF: ' + error.message);
  }
}

// Routes

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running!', 
    timestamp: new Date().toISOString(),
    libraries: {
      'pdf-parse': 'Available',
      'pdf-lib': 'Available'
    }
  });
});

// Upload and parse PDF
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Check file size
    if (req.file.size === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    // Check if it's actually a PDF
    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File must be a PDF' });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    
    // Check if buffer has data
    if (!pdfBuffer || pdfBuffer.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'PDF file appears to be corrupted or empty' });
    }

    const transactions = await parsePDFTransactions(pdfBuffer, req.body.password);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      transactions: transactions,
      message: `Found ${transactions.length} transactions`
    });
  } catch (error) {
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    let errorMessage = error.message;
    if (errorMessage.includes('stream must have data')) {
      errorMessage = 'PDF file appears to be corrupted, empty, or password-protected. Please check the file and try again.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Save confirmed transactions
app.post('/api/transactions', (req, res) => {
  const { transactions } = req.body;
  
  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Invalid transactions data' });
  }
  
  const stmt = db.prepare(`INSERT INTO transactions 
    (stock_symbol, stock_name, transaction_type, quantity, price, transaction_date) 
    VALUES (?, ?, ?, ?, ?, ?)`);
  
  transactions.forEach(transaction => {
    stmt.run([
      transaction.stock_symbol,
      transaction.stock_name,
      transaction.transaction_type,
      transaction.quantity,
      transaction.price,
      transaction.transaction_date
    ]);
  });
  
  stmt.finalize();
  res.json({ success: true, message: 'Transactions saved successfully' });
});

// Update a specific transaction
app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const { stock_symbol, stock_name, transaction_type, quantity, price, transaction_date } = req.body;
  
  if (!stock_symbol || !stock_name || !transaction_type || !quantity || !price || !transaction_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const query = `UPDATE transactions 
                 SET stock_symbol = ?, stock_name = ?, transaction_type = ?, 
                     quantity = ?, price = ?, transaction_date = ?
                 WHERE id = ?`;
  
  db.run(query, [stock_symbol, stock_name, transaction_type, quantity, price, transaction_date, id], 
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Transaction not found' });
      } else {
        res.json({ success: true, message: 'Transaction updated successfully' });
      }
    });
});

// Delete a specific transaction
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM transactions WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      res.json({ success: true, message: 'Transaction deleted successfully' });
    }
  });
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
  const { startDate, endDate, stockSymbol } = req.query;
  
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];
  
  if (startDate) {
    query += ' AND transaction_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND transaction_date <= ?';
    params.push(endDate);
  }
  
  if (stockSymbol) {
    query += ' AND stock_symbol = ?';
    params.push(stockSymbol);
  }
  
  query += ' ORDER BY transaction_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Get current stock price from Indian stock API
app.get('/api/stock-price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Using Alpha Vantage API (free tier available)
    // You can also use Yahoo Finance API or other Indian stock APIs
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!apiKey) {
      // Fallback to a mock price for development
      const mockPrice = Math.random() * 1000 + 100;
      return res.json({
        symbol: symbol,
        price: mockPrice.toFixed(2),
        source: 'mock'
      });
    }
    
    const response = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol + '.BSE', // For BSE stocks
        apikey: apiKey
      }
    });
    
    const quote = response.data['Global Quote'];
    if (quote && quote['05. price']) {
      res.json({
        symbol: symbol,
        price: parseFloat(quote['05. price']),
        source: 'alphavantage'
      });
    } else {
      throw new Error('Stock not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio summary with realized/unrealized profits
app.get('/api/portfolio-summary', async (req, res) => {
  try {
    db.all('SELECT * FROM transactions ORDER BY transaction_date', async (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const holdings = {};
      const realizedPnL = [];
      
      // Process transactions to calculate holdings and realized P&L
      transactions.forEach(transaction => {
        const { stock_symbol, transaction_type, quantity, price, transaction_date } = transaction;
        
        if (!holdings[stock_symbol]) {
          holdings[stock_symbol] = {
            symbol: stock_symbol,
            totalQuantity: 0,
            totalInvestment: 0,
            avgPrice: 0,
            transactions: []
          };
        }
        
        holdings[stock_symbol].transactions.push(transaction);
        
        if (transaction_type === 'BUY') {
          holdings[stock_symbol].totalQuantity += quantity;
          holdings[stock_symbol].totalInvestment += quantity * price;
        } else if (transaction_type === 'SELL') {
          // Calculate realized P&L
          const sellValue = quantity * price;
          const avgBuyPrice = holdings[stock_symbol].totalInvestment / holdings[stock_symbol].totalQuantity;
          const realizedProfit = sellValue - (quantity * avgBuyPrice);
          
          realizedPnL.push({
            stock_symbol,
            quantity,
            sellPrice: price,
            avgBuyPrice,
            realizedProfit,
            date: transaction_date
          });
          
          holdings[stock_symbol].totalQuantity -= quantity;
          holdings[stock_symbol].totalInvestment -= quantity * avgBuyPrice;
        }
        
        // Update average price
        if (holdings[stock_symbol].totalQuantity > 0) {
          holdings[stock_symbol].avgPrice = holdings[stock_symbol].totalInvestment / holdings[stock_symbol].totalQuantity;
        }
      });
      
      // Calculate unrealized P&L (would need current prices)
      const currentHoldings = Object.values(holdings).filter(holding => holding.totalQuantity > 0);
      
      res.json({
        currentHoldings,
        realizedPnL,
        totalRealizedProfit: realizedPnL.reduce((sum, pnl) => sum + pnl.realizedProfit, 0)
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;