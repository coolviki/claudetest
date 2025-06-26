# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stock Portfolio Tracker web application for tracking realized and unrealized profits from Indian stock transactions. It consists of:

- **Backend**: Node.js/Express server with SQLite database
- **Frontend**: React TypeScript application
- **Features**: PDF parsing, transaction management, portfolio analysis, stock price integration

## Development Commands

### Installation
```bash
npm run install-all    # Install all dependencies (root, server, client)
```

### Development
```bash
npm run dev           # Start both server (5000) and client (3000) concurrently
npm run server        # Start server only
npm run client        # Start client only
```

### Production
```bash
npm run build         # Build client for production
npm start            # Start production server
```

## Architecture

### Backend (server/)
- **Main file**: `server/index.js` - Express server with all API endpoints
- **Database**: SQLite (`portfolio.db`) with transactions table
- **Key features**:
  - PDF parsing with `pdf-parse` library
  - File uploads using `multer`
  - Stock price API integration (Alpha Vantage + mock fallback)
  - Portfolio calculation logic for realized/unrealized P&L

### Frontend (server/client/)
- **Main app**: `client/src/App.tsx` - Navigation and state management
- **Components**:
  - `PDFUpload.tsx` - File upload and parsing
  - `TransactionConfirmation.tsx` - Edit extracted transactions
  - `Portfolio.tsx` - Dashboard with P&L analysis
  - `TransactionsList.tsx` - Filterable transaction history
- **Styling**: Single CSS file `App.css` with responsive design

### Database Schema
```sql
transactions (
  id, stock_symbol, stock_name, transaction_type,
  quantity, price, transaction_date, created_at
)
```

## Key APIs

- `POST /api/upload-pdf` - Parse PDF contract notes
- `POST /api/transactions` - Save confirmed transactions
- `GET /api/transactions` - Fetch with optional filters
- `GET /api/stock-price/:symbol` - Current stock prices
- `GET /api/portfolio-summary` - Portfolio analysis with P&L

## Development Notes

- Server runs on port 5000, client on 3000 in development
- PDF parsing regex may need customization per broker format
- Stock prices use Alpha Vantage API (configurable via .env)
- All data stored locally in SQLite for privacy
- Responsive design works on mobile/desktop