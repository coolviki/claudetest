const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
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
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    // This is a basic parser - you'll need to adjust based on your broker's PDF format
    const transactions = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for transaction patterns (adjust regex based on your PDF format)
      const transactionMatch = line.match(/(\w+)\s+(BUY|SELL)\s+(\d+)\s+(\d+\.?\d*)\s+(\d{2}\/\d{2}\/\d{4})/i);
      
      if (transactionMatch) {
        transactions.push({
          stock_symbol: transactionMatch[1],
          stock_name: transactionMatch[1], // Will be updated with full name
          transaction_type: transactionMatch[2].toUpperCase(),
          quantity: parseInt(transactionMatch[3]),
          price: parseFloat(transactionMatch[4]),
          transaction_date: transactionMatch[5]
        });
      }
    }
    
    return transactions;
  } catch (error) {
    throw new Error('Failed to parse PDF: ' + error.message);
  }
}

// Routes

// Upload and parse PDF
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const transactions = await parsePDFTransactions(pdfBuffer, req.body.password);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      transactions: transactions,
      message: `Found ${transactions.length} transactions`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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