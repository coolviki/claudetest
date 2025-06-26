import React, { useState } from 'react';
import { Transaction } from '../App';

interface PDFUploadProps {
  onPDFParsed: (transactions: Transaction[]) => void;
}

const PDFUpload: React.FC<PDFUploadProps> = ({ onPDFParsed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);
    if (password) {
      formData.append('password', password);
    }

    try {
      const response = await fetch('http://localhost:5001/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        onPDFParsed(result.transactions);
      } else {
        setError(result.error || 'Failed to parse PDF');
      }
    } catch (err) {
      setError('Error uploading file. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-upload">
      <h2>Upload Contract Note PDF</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="pdf-file">Select PDF File:</label>
          <input
            type="file"
            id="pdf-file"
            accept=".pdf"
            onChange={handleFileChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password (if required):</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter PDF password if protected"
          />
        </div>

        <button type="submit" disabled={loading || !file}>
          {loading ? 'Processing...' : 'Upload and Parse PDF'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="info-section">
        <h3>Instructions:</h3>
        <ul>
          <li>Upload your digital contract note PDF from your broker</li>
          <li>If the PDF is password protected, enter the password</li>
          <li>The system will extract stock transactions automatically</li>
          <li>You'll be able to review and edit the extracted data before saving</li>
        </ul>
      </div>
    </div>
  );
};

export default PDFUpload;