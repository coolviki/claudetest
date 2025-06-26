import React, { useState, useEffect } from 'react';
import './App.css';
import PDFUpload from './components/PDFUpload';
import TransactionConfirmation from './components/TransactionConfirmation';
import Portfolio from './components/Portfolio';
import TransactionsList from './components/TransactionsList';
import ManualEntry from './components/ManualEntry';

export interface Transaction {
  id?: number;
  stock_symbol: string;
  stock_name: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  transaction_date: string;
}

export interface Holding {
  symbol: string;
  totalQuantity: number;
  totalInvestment: number;
  avgPrice: number;
  currentPrice?: number;
  unrealizedPnL?: number;
}

function App() {
  const [currentView, setCurrentView] = useState<'upload' | 'confirm' | 'portfolio' | 'transactions' | 'manual'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const handlePDFParsed = (transactions: Transaction[]) => {
    setParsedTransactions(transactions);
    setCurrentView('confirm');
  };

  const handleTransactionsConfirmed = () => {
    setCurrentView('portfolio');
    fetchTransactions();
  };

  const handleManualTransactionAdded = () => {
    fetchTransactions();
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/transactions');
      const transactions = await response.json();
      setAllTransactions(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Portfolio Tracker</h1>
        <nav>
          <button 
            onClick={() => setCurrentView('upload')}
            className={currentView === 'upload' ? 'active' : ''}
          >
            Upload PDF
          </button>
          <button 
            onClick={() => setCurrentView('manual')}
            className={currentView === 'manual' ? 'active' : ''}
          >
            Manual Entry
          </button>
          <button 
            onClick={() => setCurrentView('portfolio')}
            className={currentView === 'portfolio' ? 'active' : ''}
          >
            Portfolio
          </button>
          <button 
            onClick={() => setCurrentView('transactions')}
            className={currentView === 'transactions' ? 'active' : ''}
          >
            Transactions
          </button>
        </nav>
      </header>

      <main className="App-main">
        {currentView === 'upload' && (
          <PDFUpload onPDFParsed={handlePDFParsed} />
        )}

        {currentView === 'manual' && (
          <ManualEntry onTransactionAdded={handleManualTransactionAdded} />
        )}
        
        {currentView === 'confirm' && (
          <TransactionConfirmation 
            transactions={parsedTransactions}
            onConfirmed={handleTransactionsConfirmed}
          />
        )}
        
        {currentView === 'portfolio' && (
          <Portfolio />
        )}
        
        {currentView === 'transactions' && (
          <TransactionsList 
            transactions={allTransactions} 
            onTransactionUpdated={fetchTransactions}
          />
        )}
      </main>
    </div>
  );
}

export default App;
