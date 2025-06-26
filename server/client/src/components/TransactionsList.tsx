import React, { useState } from 'react';
import { Transaction } from '../App';

interface TransactionsListProps {
  transactions: Transaction[];
  onTransactionUpdated: () => void;
}

const TransactionsList: React.FC<TransactionsListProps> = ({ transactions, onTransactionUpdated }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    stockSymbol: '',
    transactionType: ''
  });

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredTransactions = transactions.filter(transaction => {
    const matchesDate = (!filters.startDate || transaction.transaction_date >= filters.startDate) &&
                       (!filters.endDate || transaction.transaction_date <= filters.endDate);
    
    const matchesSymbol = !filters.stockSymbol || 
                         transaction.stock_symbol.toLowerCase().includes(filters.stockSymbol.toLowerCase());
    
    const matchesType = !filters.transactionType || 
                       transaction.transaction_type === filters.transactionType;

    return matchesDate && matchesSymbol && matchesType;
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      stockSymbol: '',
      transactionType: ''
    });
  };

  const totalBuyValue = filteredTransactions
    .filter(t => t.transaction_type === 'BUY')
    .reduce((sum, t) => sum + (t.quantity * t.price), 0);

  const totalSellValue = filteredTransactions
    .filter(t => t.transaction_type === 'SELL')
    .reduce((sum, t) => sum + (t.quantity * t.price), 0);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction({...transaction});
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setError('');
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:5001/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock_symbol: editingTransaction.stock_symbol,
          stock_name: editingTransaction.stock_name,
          transaction_type: editingTransaction.transaction_type,
          quantity: editingTransaction.quantity,
          price: editingTransaction.price,
          transaction_date: editingTransaction.transaction_date
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setEditingTransaction(null);
        onTransactionUpdated();
      } else {
        setError(result.error || 'Failed to update transaction');
      }
    } catch (err) {
      setError('Error updating transaction. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:5001/api/transactions/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        onTransactionUpdated();
      } else {
        setError(result.error || 'Failed to delete transaction');
      }
    } catch (err) {
      setError('Error deleting transaction. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInputChange = (field: keyof Transaction, value: string | number) => {
    if (!editingTransaction) return;
    setEditingTransaction(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="transactions-list">
      <h2>All Transactions ({filteredTransactions.length})</h2>

      {/* Filters */}
      <div className="filters">
        <h3>Filters</h3>
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Stock Symbol:</label>
            <input
              type="text"
              placeholder="e.g., RELIANCE"
              value={filters.stockSymbol}
              onChange={(e) => handleFilterChange('stockSymbol', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Transaction Type:</label>
            <select
              value={filters.transactionType}
              onChange={(e) => handleFilterChange('transactionType', e.target.value)}
            >
              <option value="">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="transaction-summary">
        <div className="summary-item">
          <span>Total Buy Value: </span>
          <span className="buy-value">₹{totalBuyValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
        </div>
        <div className="summary-item">
          <span>Total Sell Value: </span>
          <span className="sell-value">₹{totalSellValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit Transaction</h3>
            
            <div className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Stock Symbol</label>
                  <input
                    type="text"
                    value={editingTransaction.stock_symbol}
                    onChange={(e) => handleEditInputChange('stock_symbol', e.target.value.toUpperCase())}
                  />
                </div>
                <div className="form-group">
                  <label>Stock Name</label>
                  <input
                    type="text"
                    value={editingTransaction.stock_name}
                    onChange={(e) => handleEditInputChange('stock_name', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={editingTransaction.transaction_type}
                    onChange={(e) => handleEditInputChange('transaction_type', e.target.value)}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={editingTransaction.transaction_date}
                    onChange={(e) => handleEditInputChange('transaction_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    value={editingTransaction.quantity}
                    onChange={(e) => handleEditInputChange('quantity', parseInt(e.target.value) || 0)}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTransaction.price}
                    onChange={(e) => handleEditInputChange('price', parseFloat(e.target.value) || 0)}
                    min="0.01"
                  />
                </div>
              </div>

              <div className="total-value">
                <strong>
                  Total Value: ₹{(editingTransaction.quantity * editingTransaction.price).toLocaleString('en-IN', {maximumFractionDigits: 2})}
                </strong>
              </div>

              <div className="edit-actions">
                <button onClick={handleCancelEdit} className="cancel-btn">
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateTransaction} 
                  disabled={loading}
                  className="save-btn"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <p>No transactions found with the current filters.</p>
      ) : (
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Stock Symbol</th>
              <th>Stock Name</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction, index) => (
              <tr key={transaction.id || index}>
                <td>{transaction.transaction_date}</td>
                <td className="stock-symbol">{transaction.stock_symbol}</td>
                <td>{transaction.stock_name}</td>
                <td>
                  <span className={`transaction-type ${transaction.transaction_type.toLowerCase()}`}>
                    {transaction.transaction_type}
                  </span>
                </td>
                <td>{transaction.quantity}</td>
                <td>₹{transaction.price.toFixed(2)}</td>
                <td>₹{(transaction.quantity * transaction.price).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                <td className="actions-cell">
                  <button 
                    onClick={() => handleEdit(transaction)}
                    className="edit-btn"
                    disabled={loading}
                    title="Edit transaction"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDeleteTransaction(transaction.id!)}
                    className="delete-btn"
                    disabled={loading}
                    title="Delete transaction"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TransactionsList;