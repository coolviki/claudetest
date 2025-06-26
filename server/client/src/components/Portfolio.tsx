import React, { useState, useEffect } from 'react';
import { Holding } from '../App';

interface PortfolioSummary {
  currentHoldings: Holding[];
  realizedPnL: Array<{
    stock_symbol: string;
    quantity: number;
    sellPrice: number;
    avgBuyPrice: number;
    realizedProfit: number;
    date: string;
  }>;
  totalRealizedProfit: number;
}

const Portfolio: React.FC = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary | null>(null);
  const [currentPrices, setCurrentPrices] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/portfolio-summary');
      const data = await response.json();
      
      if (response.ok) {
        setPortfolioData(data);
        // Fetch current prices for holdings
        fetchCurrentPrices(data.currentHoldings);
      } else {
        setError(data.error || 'Failed to fetch portfolio data');
      }
    } catch (err) {
      setError('Error fetching portfolio data. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPrices = async (holdings: Holding[]) => {
    const prices: {[key: string]: number} = {};
    
    for (const holding of holdings) {
      try {
        const response = await fetch(`http://localhost:5000/api/stock-price/${holding.symbol}`);
        const data = await response.json();
        
        if (response.ok) {
          prices[holding.symbol] = parseFloat(data.price);
        }
      } catch (err) {
        console.error(`Error fetching price for ${holding.symbol}:`, err);
      }
    }
    
    setCurrentPrices(prices);
  };

  const calculateUnrealizedPnL = (holding: Holding): number => {
    const currentPrice = currentPrices[holding.symbol];
    if (!currentPrice) return 0;
    
    const currentValue = holding.totalQuantity * currentPrice;
    return currentValue - holding.totalInvestment;
  };

  const calculateUnrealizedPnLPercentage = (holding: Holding): number => {
    const unrealizedPnL = calculateUnrealizedPnL(holding);
    return (unrealizedPnL / holding.totalInvestment) * 100;
  };

  if (loading) {
    return <div className="loading">Loading portfolio data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!portfolioData) {
    return <div className="no-data">No portfolio data available</div>;
  }

  const totalUnrealizedPnL = portfolioData.currentHoldings.reduce(
    (sum, holding) => sum + calculateUnrealizedPnL(holding), 
    0
  );

  const totalInvestment = portfolioData.currentHoldings.reduce(
    (sum, holding) => sum + holding.totalInvestment, 
    0
  );

  const totalCurrentValue = portfolioData.currentHoldings.reduce(
    (sum, holding) => sum + (holding.totalQuantity * (currentPrices[holding.symbol] || holding.avgPrice)), 
    0
  );

  return (
    <div className="portfolio">
      <h2>Portfolio Dashboard</h2>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Investment</h3>
          <p className="amount">₹{totalInvestment.toLocaleString('en-IN', {maximumFractionDigits: 2})}</p>
        </div>
        
        <div className="summary-card">
          <h3>Current Value</h3>
          <p className="amount">₹{totalCurrentValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}</p>
        </div>
        
        <div className="summary-card">
          <h3>Unrealized P&L</h3>
          <p className={`amount ${totalUnrealizedPnL >= 0 ? 'profit' : 'loss'}`}>
            ₹{totalUnrealizedPnL.toLocaleString('en-IN', {maximumFractionDigits: 2})}
          </p>
        </div>
        
        <div className="summary-card">
          <h3>Realized P&L</h3>
          <p className={`amount ${portfolioData.totalRealizedProfit >= 0 ? 'profit' : 'loss'}`}>
            ₹{portfolioData.totalRealizedProfit.toLocaleString('en-IN', {maximumFractionDigits: 2})}
          </p>
        </div>
      </div>

      {/* Current Holdings */}
      <div className="section">
        <h3>Current Holdings</h3>
        {portfolioData.currentHoldings.length === 0 ? (
          <p>No current holdings</p>
        ) : (
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Quantity</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>Investment</th>
                <th>Current Value</th>
                <th>Unrealized P&L</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              {portfolioData.currentHoldings.map((holding, index) => {
                const currentPrice = currentPrices[holding.symbol] || 0;
                const currentValue = holding.totalQuantity * currentPrice;
                const unrealizedPnL = calculateUnrealizedPnL(holding);
                const returnPercentage = calculateUnrealizedPnLPercentage(holding);
                
                return (
                  <tr key={index}>
                    <td>{holding.symbol}</td>
                    <td>{holding.totalQuantity}</td>
                    <td>₹{holding.avgPrice.toFixed(2)}</td>
                    <td>{currentPrice ? `₹${currentPrice.toFixed(2)}` : 'Loading...'}</td>
                    <td>₹{holding.totalInvestment.toLocaleString('en-IN')}</td>
                    <td>₹{currentValue.toLocaleString('en-IN')}</td>
                    <td className={unrealizedPnL >= 0 ? 'profit' : 'loss'}>
                      ₹{unrealizedPnL.toLocaleString('en-IN', {maximumFractionDigits: 2})}
                    </td>
                    <td className={returnPercentage >= 0 ? 'profit' : 'loss'}>
                      {returnPercentage.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Realized P&L */}
      <div className="section">
        <h3>Realized P&L History</h3>
        {portfolioData.realizedPnL.length === 0 ? (
          <p>No realized profits/losses yet</p>
        ) : (
          <table className="realized-pnl-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Quantity</th>
                <th>Avg Buy Price</th>
                <th>Sell Price</th>
                <th>Realized P&L</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {portfolioData.realizedPnL.map((pnl, index) => (
                <tr key={index}>
                  <td>{pnl.stock_symbol}</td>
                  <td>{pnl.quantity}</td>
                  <td>₹{pnl.avgBuyPrice.toFixed(2)}</td>
                  <td>₹{pnl.sellPrice.toFixed(2)}</td>
                  <td className={pnl.realizedProfit >= 0 ? 'profit' : 'loss'}>
                    ₹{pnl.realizedProfit.toLocaleString('en-IN', {maximumFractionDigits: 2})}
                  </td>
                  <td>{pnl.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Portfolio;