# Stock Portfolio Tracker

A comprehensive web application for tracking realized and unrealized profits from Indian stock transactions. The app parses PDF contract notes, allows manual verification and editing of transactions, and provides detailed portfolio analysis.

## Features

- **PDF Upload & Parsing**: Upload password-protected PDF contract notes for automatic transaction extraction
- **Transaction Management**: Review, edit, and confirm parsed transactions before saving
- **Portfolio Dashboard**: View realized and unrealized profits with current market prices
- **Advanced Filtering**: Filter transactions by date range, stock symbol, and transaction type
- **Real-time Stock Prices**: Integration with stock price APIs for current Indian stock prices
- **Local Database**: All data stored locally using SQLite for privacy and security

## Tech Stack

### Backend
- Node.js with Express
- SQLite database
- PDF parsing with pdf-parse
- Stock price API integration
- File upload handling with Multer

### Frontend
- React with TypeScript
- Modern CSS with responsive design
- Axios for API calls
- Component-based architecture

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Step 1: Clone and Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd stock-portfolio-tracker

# Install root dependencies
npm install

# Install all dependencies (server + client)
npm run install-all
```

### Step 2: Environment Configuration
```bash
# Navigate to server directory
cd server

# Copy environment template
cp .env.example .env

# Edit the .env file (optional)
# Add your Alpha Vantage API key for real stock prices
# ALPHA_VANTAGE_API_KEY=your_api_key_here
```

**Note**: The app will work with mock prices if no API key is provided.

### Step 3: Start the Application

#### Development Mode (Recommended)
```bash
# From the root directory
npm run dev
```
This starts both the server (port 5000) and client (port 3000) concurrently.

#### Production Mode
```bash
# Build the client
npm run build

# Start the server
npm start
```

### Step 4: Access the Application
- **Development**: Open http://localhost:3000
- **Production**: Open http://localhost:5000

## Usage Guide

### 1. Upload PDF Contract Note
1. Navigate to the "Upload PDF" tab
2. Select your broker's contract note PDF file
3. Enter password if the PDF is protected
4. Click "Upload and Parse PDF"

### 2. Confirm Transactions
1. Review the automatically extracted transaction data
2. Edit any incorrect information (stock symbol, name, price, quantity, date)
3. Add or remove transactions as needed
4. Click "Save Transactions" to store in database

### 3. View Portfolio
1. Navigate to the "Portfolio" tab
2. View summary cards showing total investment, current value, and P&L
3. Review current holdings with unrealized profits/losses
4. Check realized P&L history from past transactions

### 4. Filter Transactions
1. Go to the "Transactions" tab
2. Use filters to narrow down by:
   - Date range
   - Stock symbol
   - Transaction type (BUY/SELL)
3. View transaction summary and detailed list

## API Integration

### Stock Price APIs
The app supports multiple stock price sources:

1. **Alpha Vantage** (Recommended)
   - Get free API key from https://www.alphavantage.co/
   - Add to `.env` file: `ALPHA_VANTAGE_API_KEY=your_key`
   - Supports BSE and NSE stocks

2. **Mock Prices** (Default)
   - Used when no API key is provided
   - Generates random prices for development/testing

### Adding Other APIs
To add support for other Indian stock APIs:

1. Modify `server/index.js`
2. Update the `/api/stock-price/:symbol` endpoint
3. Add new API configuration in `.env`

## PDF Parsing

The app includes a basic PDF parser for contract notes. You may need to customize the parsing logic based on your broker's PDF format:

1. Edit the `parsePDFTransactions` function in `server/index.js`
2. Update the regular expression patterns to match your broker's format
3. Test with sample PDFs from your broker

### Supported Brokers
The default parser works with common Indian broker formats. For specific brokers, customization may be needed.

## Database Schema

### Transactions Table
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_symbol TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  transaction_type TEXT NOT NULL,  -- 'BUY' or 'SELL'
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  transaction_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Development

### Project Structure
```
stock-portfolio-tracker/
├── server/                 # Backend API
│   ├── index.js           # Main server file
│   ├── package.json       # Server dependencies
│   ├── .env.example       # Environment template
│   └── portfolio.db       # SQLite database (created on first run)
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.tsx        # Main app component
│   │   └── App.css        # Styles
│   └── package.json       # Client dependencies
├── package.json           # Root package file
└── README.md              # This file
```

### Available Scripts

```bash
# Development
npm run dev          # Start both server and client
npm run server       # Start server only
npm run client       # Start client only

# Production
npm run build        # Build client for production
npm start           # Start production server

# Installation
npm run install-all  # Install all dependencies
```

### Adding New Features

1. **Backend Changes**: Modify `server/index.js`
2. **Frontend Changes**: Add/modify components in `client/src/components/`
3. **Styling**: Update `client/src/App.css`
4. **Database**: Add migration logic in the database initialization section

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 5000 is available
   - Verify all dependencies are installed
   - Check server logs for specific errors

2. **PDF parsing errors**
   - Ensure PDF is not corrupted
   - Check if password is correct for protected PDFs
   - Verify PDF contains readable text (not scanned images)

3. **Stock prices not loading**
   - Check internet connection
   - Verify API key in `.env` file
   - Check API rate limits

4. **Database errors**
   - Ensure write permissions in server directory
   - Check SQLite installation
   - Delete `portfolio.db` to reset database

### Performance Tips

1. **Large PDF files**: Break into smaller files or implement chunked processing
2. **Many transactions**: Add pagination to transaction lists
3. **Stock price updates**: Implement caching to reduce API calls

## Security Considerations

- All data stored locally (no cloud storage)
- PDF files are processed and deleted immediately
- No sensitive data logged or transmitted
- Environment variables for API keys
- Input validation on all forms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check this README first
2. Review common troubleshooting steps
3. Create an issue on GitHub with detailed error information