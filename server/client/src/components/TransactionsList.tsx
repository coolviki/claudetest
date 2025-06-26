import React, { useState } from 'react';
import { Transaction } from '../App';

interface TransactionsListProps {
  transactions: Transaction[];
}

const TransactionsList: React.FC<TransactionsListProps> = ({ transactions }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    stockSymbol: '',
    transactionType: ''
  });

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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TransactionsList;