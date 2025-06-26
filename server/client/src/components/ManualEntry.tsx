import React, { useState } from 'react';
import { Transaction } from '../App';

interface ManualEntryProps {
  onTransactionAdded: () => void;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ onTransactionAdded }) => {
  const [transaction, setTransaction] = useState<Omit<Transaction, 'id'>>({
    stock_symbol: '',
    stock_name: '',
    transaction_type: 'BUY',
    quantity: 0,
    price: 0,
    transaction_date: new Date().toISOString().split('T')[0]
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (field: keyof Omit<Transaction, 'id'>, value: string | number) => {
    setTransaction(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const validateTransaction = () => {
    if (!transaction.stock_symbol.trim()) {
      setError('Stock symbol is required');
      return false;
    }
    if (!transaction.stock_name.trim()) {
      setError('Stock name is required');
      return false;
    }
    if (transaction.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return false;
    }
    if (transaction.price <= 0) {
      setError('Price must be greater than 0');
      return false;
    }
    if (!transaction.transaction_date) {
      setError('Transaction date is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateTransaction()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5001/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions: [transaction] }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Transaction added successfully!');
        // Reset form
        setTransaction({
          stock_symbol: '',
          stock_name: '',
          transaction_type: 'BUY',
          quantity: 0,
          price: 0,
          transaction_date: new Date().toISOString().split('T')[0]
        });
        onTransactionAdded();
      } else {
        setError(result.error || 'Failed to add transaction');
      }
    } catch (err) {
      setError('Error adding transaction. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTransaction({
      stock_symbol: '',
      stock_name: '',
      transaction_type: 'BUY',
      quantity: 0,
      price: 0,
      transaction_date: new Date().toISOString().split('T')[0]
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="manual-entry">
      <h2>Add Transaction Manually</h2>
      <p>Enter stock transaction details manually without uploading a PDF.</p>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="success-message">
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="manual-entry-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stock_symbol">Stock Symbol *</label>
            <input
              type="text"
              id="stock_symbol"
              value={transaction.stock_symbol}
              onChange={(e) => handleInputChange('stock_symbol', e.target.value.toUpperCase())}
              placeholder="e.g., RELIANCE, TCS, INFY"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="stock_name">Stock Name *</label>
            <input
              type="text"
              id="stock_name"
              value={transaction.stock_name}
              onChange={(e) => handleInputChange('stock_name', e.target.value)}
              placeholder="e.g., Reliance Industries Ltd"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="transaction_type">Transaction Type *</label>
            <select
              id="transaction_type"
              value={transaction.transaction_type}
              onChange={(e) => handleInputChange('transaction_type', e.target.value as 'BUY' | 'SELL')}
              required
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="transaction_date">Transaction Date *</label>
            <input
              type="date"
              id="transaction_date"
              value={transaction.transaction_date}
              onChange={(e) => handleInputChange('transaction_date', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">Quantity *</label>
            <input
              type="number"
              id="quantity"
              value={transaction.quantity || ''}
              onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
              placeholder="Number of shares"
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">Price per Share (₹) *</label>
            <input
              type="number"
              id="price"
              step="0.01"
              value={transaction.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              placeholder="Price in INR"
              min="0.01"
              required
            />
          </div>
        </div>

        <div className="total-value">
          <strong>
            Total Value: ₹{(transaction.quantity * transaction.price).toLocaleString('en-IN', {maximumFractionDigits: 2})}
          </strong>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleReset} className="reset-btn">
            Reset Form
          </button>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Adding...' : 'Add Transaction'}
          </button>
        </div>
      </form>

      <div className="info-section">
        <h3>Tips:</h3>
        <ul>
          <li>Stock symbol should be the NSE/BSE trading symbol (e.g., RELIANCE, TCS)</li>
          <li>Enter the exact price per share as executed</li>
          <li>Use the transaction date when the trade was executed</li>
          <li>You can add multiple transactions one by one</li>
        </ul>
      </div>
    </div>
  );
};

export default ManualEntry;