const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const PDFParser = require('pdf2json');
const ExcelJS = require('exceljs');
const jsPDF = require('jspdf').jsPDF;
require('jspdf-autotable');
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

    console.log('Attempting to parse PDF with password:', password ? 'Yes' : 'No');

    let text = '';
    let parseMethod = 'unknown';
    
    // Method 1: Try pdf-parse first (simple and fast)
    try {
      const options = {};
      if (password && password.trim()) {
        options.password = password.trim();
        console.log('Using password with pdf-parse');
      }
      
      const data = await pdfParse(pdfBuffer, options);
      text = data.text;
      parseMethod = 'pdf-parse';
      console.log('Successfully parsed with pdf-parse');
    } catch (pdfParseError) {
      console.log('pdf-parse failed:', pdfParseError.message);
      
      // Method 2: Try pdf2json (better for some PDFs)
      try {
        const pdfParser = new PDFParser();
        
        const pdf2jsonResult = await new Promise((resolve, reject) => {
          pdfParser.on('pdfParser_dataError', reject);
          pdfParser.on('pdfParser_dataReady', resolve);
          
          // pdf2json doesn't support passwords directly, so this will fail for password-protected PDFs
          pdfParser.parseBuffer(pdfBuffer);
        });
        
        // Extract text from pdf2json result
        if (pdf2jsonResult && pdf2jsonResult.Pages) {
          text = pdf2jsonResult.Pages.map(page => 
            page.Texts.map(textItem => 
              decodeURIComponent(textItem.R[0].T)
            ).join(' ')
          ).join('\n');
          parseMethod = 'pdf2json';
          console.log('Successfully parsed with pdf2json');
        }
      } catch (pdf2jsonError) {
        console.log('pdf2json failed:', pdf2jsonError.message);
        
        // Method 3: Try pdf-lib to validate if password is correct
        try {
          if (password && password.trim()) {
            // If password is provided, try to load with it
            const pdfDoc = await PDFDocument.load(pdfBuffer, { 
              ignoreEncryption: false,
              password: password.trim()
            });
            
            console.log('PDF loaded with pdf-lib using password, but cannot extract text directly');
            // If we get here, the password is correct but we can't extract text
            text = 'PDF_LOADED_BUT_NO_TEXT_EXTRACTION';
            parseMethod = 'pdf-lib';
          } else {
            // No password provided, check if PDF is encrypted
            try {
              const pdfDoc = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true
              });
              console.log('PDF loaded with ignoreEncryption, but this means it was encrypted');
              throw new Error('This PDF is password-protected. Please enter the password and try again.');
            } catch (ignoreError) {
              throw new Error('Unable to read PDF. It might be corrupted or in an unsupported format.');
            }
          }
        } catch (pdfLibError) {
          console.log('pdf-lib failed:', pdfLibError.message);
          
          // More specific error handling
          if (pdfLibError.message.includes('encrypted')) {
            if (!password || password.trim() === '') {
              throw new Error('This PDF is password-protected. Please enter the password and try again.');
            } else {
              throw new Error('Incorrect password. Please check your password and try again.');
            }
          } else if (pdfLibError.message.includes('password') || 
                     pdfLibError.message.includes('decrypt')) {
            throw new Error('Incorrect password. Please check your password and try again.');
          } else if (pdfParseError.message.includes('password') || 
                     pdfParseError.message.includes('No password given')) {
            throw new Error('This PDF requires a password. Please enter the password and try again.');
          } else {
            throw new Error('Unable to read PDF. It might be corrupted or in an unsupported format.');
          }
        }
      }
    }
    
    // Check if we got any text
    if (!text || text.trim().length === 0 || text === 'PDF_LOADED_BUT_NO_TEXT_EXTRACTION') {
      if (text === 'PDF_LOADED_BUT_NO_TEXT_EXTRACTION') {
        console.log('PDF was loaded successfully but text extraction is not available. Creating sample transaction.');
        // Password was correct, but we can't extract text - provide sample transaction
        text = 'PDF loaded successfully with correct password. Please manually verify and enter your transaction details below.';
      } else {
        throw new Error('PDF contains no readable text. It might be a scanned document, image-based PDF, or require a password.');
      }
    }
    
    console.log(`PDF parsing method used: ${parseMethod}`);
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
      if (text.includes('PDF loaded successfully')) {
        console.log('Password-protected PDF loaded but no text patterns found. Creating placeholder transaction.');
        transactions.push({
          stock_symbol: 'EDIT_ME',
          stock_name: 'Edit this transaction with your actual data',
          transaction_type: 'BUY',
          quantity: 1,
          price: 1.00,
          transaction_date: new Date().toISOString().split('T')[0]
        });
      } else {
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

// Export transactions to Excel
app.get('/api/export/excel', async (req, res) => {
  try {
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
    
    db.all(query, params, async (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Transactions');
      
      // Add headers
      worksheet.columns = [
        { header: 'Date', key: 'transaction_date', width: 12 },
        { header: 'Stock Symbol', key: 'stock_symbol', width: 15 },
        { header: 'Stock Name', key: 'stock_name', width: 25 },
        { header: 'Type', key: 'transaction_type', width: 8 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Price (₹)', key: 'price', width: 12 },
        { header: 'Total Value (₹)', key: 'total_value', width: 15 }
      ];
      
      // Add data
      transactions.forEach(transaction => {
        worksheet.addRow({
          transaction_date: transaction.transaction_date,
          stock_symbol: transaction.stock_symbol,
          stock_name: transaction.stock_name,
          transaction_type: transaction.transaction_type,
          quantity: transaction.quantity,
          price: transaction.price,
          total_value: transaction.quantity * transaction.price
        });
      });
      
      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
      
      // Send the Excel file
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export transactions to PDF
app.get('/api/export/pdf', (req, res) => {
  try {
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
    
    db.all(query, params, (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Create PDF
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Stock Portfolio Transactions', 20, 20);
      
      // Subtitle with filters
      doc.setFontSize(12);
      let subtitle = 'Generated on: ' + new Date().toLocaleDateString();
      if (startDate || endDate || stockSymbol) {
        subtitle += ' | Filters: ';
        if (startDate) subtitle += `From: ${startDate} `;
        if (endDate) subtitle += `To: ${endDate} `;
        if (stockSymbol) subtitle += `Stock: ${stockSymbol}`;
      }
      doc.text(subtitle, 20, 30);
      
      // Prepare table data
      const tableData = transactions.map(transaction => [
        transaction.transaction_date,
        transaction.stock_symbol,
        transaction.stock_name,
        transaction.transaction_type,
        transaction.quantity.toString(),
        `₹${transaction.price.toFixed(2)}`,
        `₹${(transaction.quantity * transaction.price).toLocaleString('en-IN', {maximumFractionDigits: 2})}`
      ]);
      
      // Add table
      doc.autoTable({
        head: [['Date', 'Symbol', 'Stock Name', 'Type', 'Qty', 'Price', 'Total Value']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [128, 128, 128] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
      
      // Calculate totals
      const totalBuyValue = transactions
        .filter(t => t.transaction_type === 'BUY')
        .reduce((sum, t) => sum + (t.quantity * t.price), 0);
      
      const totalSellValue = transactions
        .filter(t => t.transaction_type === 'SELL')
        .reduce((sum, t) => sum + (t.quantity * t.price), 0);
      
      // Add summary
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.text(`Total Buy Value: ₹${totalBuyValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}`, 20, finalY);
      doc.text(`Total Sell Value: ₹${totalSellValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}`, 20, finalY + 10);
      doc.text(`Total Transactions: ${transactions.length}`, 20, finalY + 20);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');
      
      // Send PDF
      const pdfOutput = doc.output();
      res.end(Buffer.from(pdfOutput, 'binary'));
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