import React, { useState } from 'react';
import { Transaction } from '../App';

interface TransactionConfirmationProps {
  transactions: Transaction[];
  onConfirmed: () => void;
}

const TransactionConfirmation: React.FC<TransactionConfirmationProps> = ({ 
  transactions, 
  onConfirmed 
}) => {
  const [editedTransactions, setEditedTransactions] = useState<Transaction[]>(transactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransactionChange = (index: number, field: keyof Transaction, value: string | number) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTransactions(updated);
  };

  const removeTransaction = (index: number) => {
    const updated = editedTransactions.filter((_, i) => i !== index);
    setEditedTransactions(updated);
  };

  const addTransaction = () => {
    const newTransaction: Transaction = {
      stock_symbol: '',
      stock_name: '',
      transaction_type: 'BUY',
      quantity: 0,
      price: 0,
      transaction_date: new Date().toISOString().split('T')[0]
    };
    setEditedTransactions([...editedTransactions, newTransaction]);
  };

  const handleSave = async () => {
    if (editedTransactions.some(t => !t.stock_symbol || !t.stock_name || t.quantity <= 0 || t.price <= 0)) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions: editedTransactions }),
      });

      const result = await response.json();

      if (response.ok) {
        onConfirmed();
      } else {
        setError(result.error || 'Failed to save transactions');
      }
    } catch (err) {
      setError('Error saving transactions. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transaction-confirmation">
      <h2>Confirm Transactions ({editedTransactions.length} found)</h2>
      <p>Please review and edit the extracted transaction data:</p>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="transactions-table">
        {editedTransactions.map((transaction, index) => (
          <div key={index} className="transaction-row">
            <div className="form-group">
              <label>Stock Symbol:</label>
              <input
                type="text"
                value={transaction.stock_symbol}
                onChange={(e) => handleTransactionChange(index, 'stock_symbol', e.target.value)}
                placeholder="e.g., RELIANCE"
              />
            </div>

            <div className="form-group">
              <label>Stock Name:</label>
              <input
                type="text"
                value={transaction.stock_name}
                onChange={(e) => handleTransactionChange(index, 'stock_name', e.target.value)}
                placeholder="e.g., Reliance Industries Ltd"
              />
            </div>

            <div className="form-group">
              <label>Type:</label>
              <select
                value={transaction.transaction_type}
                onChange={(e) => handleTransactionChange(index, 'transaction_type', e.target.value as 'BUY' | 'SELL')}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div className="form-group">
              <label>Quantity:</label>
              <input
                type="number"
                value={transaction.quantity}
                onChange={(e) => handleTransactionChange(index, 'quantity', parseInt(e.target.value) || 0)}
                min="1"
              />
            </div>

            <div className="form-group">
              <label>Price (₹):</label>
              <input
                type="number"
                step="0.01"
                value={transaction.price}
                onChange={(e) => handleTransactionChange(index, 'price', parseFloat(e.target.value) || 0)}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Date:</label>
              <input
                type="date"
                value={transaction.transaction_date}
                onChange={(e) => handleTransactionChange(index, 'transaction_date', e.target.value)}
              />
            </div>

            <button 
              type="button" 
              className="remove-btn"
              onClick={() => removeTransaction(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="actions">
        <button type="button" onClick={addTransaction} className="add-btn">
          Add Transaction
        </button>
        
        <button 
          type="button" 
          onClick={handleSave} 
          disabled={loading || editedTransactions.length === 0}
          className="save-btn"
        >
          {loading ? 'Saving...' : 'Save Transactions'}
        </button>
      </div>
    </div>
  );
};

export default TransactionConfirmation;