import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

function App() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  useEffect(() => {
    fetchSystemStatus();
    fetchAnalyses();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get(`${API}/system/status`);
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const fetchAnalyses = async () => {
    try {
      const response = await axios.get(`${API}/emails/analyses`);
      setAnalyses(response.data);
      if (response.data.length > 0) {
        setSelectedAnalysis(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
    }
  };

  const createDemoAnalysis = async (espType = null) => {
    setLoading(true);
    try {
      const url = espType ? `${API}/emails/demo?esp_type=${espType}` : `${API}/emails/demo`;
      const response = await axios.post(url);
      setSelectedAnalysis(response.data);
      await fetchAnalyses();
    } catch (error) {
      console.error('Failed to create demo analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAnalyses = async () => {
    try {
      await axios.delete(`${API}/emails/analyses`);
      setAnalyses([]);
      setSelectedAnalysis(null);
    } catch (error) {
      console.error('Failed to clear analyses:', error);
    }
  };

  const getESPColor = (esp) => {
    const colors = {
      'Gmail': '#dc2626',
      'Outlook': '#2563eb',
      'Yahoo': '#7c3aed',
      'Amazon SES': '#ea580c',
      'SendGrid': '#16a34a',
      'Mailchimp': '#ca8a04',
      'Unknown': '#6b7280'
    };
    return colors[esp] || colors['Unknown'];
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>📧 Email Analysis System</h1>
          <p>IMAP Email Header Analysis & ESP Detection</p>
          {systemStatus && (
            <div className="status-badge">
              ✅ {systemStatus.imap_status}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {/* System Status */}
        {systemStatus && (
          <div className="card">
            <h2>🖥️ System Status</h2>
            <div className="status-grid">
              <div className="status-item">
                <strong>Email Address:</strong>
                <code>{systemStatus.email_address}</code>
              </div>
              <div className="status-item">
                <strong>Subject Line:</strong>
                <code>{systemStatus.subject_line}</code>
              </div>
              <div className="status-item">
                <strong>Emails Processed:</strong>
                <span className="count">{systemStatus.total_emails_processed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Demo Controls */}
        <div className="card">
          <h2>⚡ Demo Controls</h2>
          <p>Generate sample email analyses to see the system in action</p>
          <div className="demo-buttons">
            <button 
              onClick={() => createDemoAnalysis('gmail')}
              disabled={loading}
              className="btn btn-gmail"
            >
              Gmail Demo
            </button>
            <button 
              onClick={() => createDemoAnalysis('outlook')}
              disabled={loading}
              className="btn btn-outlook"
            >
              Outlook Demo
            </button>
            <button 
              onClick={() => createDemoAnalysis('sendgrid')}
              disabled={loading}
              className="btn btn-sendgrid"
            >
              SendGrid Demo
            </button>
            <button 
              onClick={() => createDemoAnalysis()}
              disabled={loading}
              className="btn btn-random"
            >
              {loading ? '🔄 Loading...' : 'Random ESP'}
            </button>
          </div>
          <div className="control-buttons">
            <button onClick={fetchAnalyses} className="btn-small">
              🔄 Refresh
            </button>
            <button onClick={clearAnalyses} className="btn-small btn-danger">
              🗑️ Clear All
            </button>
          </div>
        </div>

        {/* Analysis Results */}
        {selectedAnalysis ? (
          <div className="results-container">
            <div className="main-results">
              {/* ESP Detection */}
              <div className="card">
                <h2>🛡️ ESP Detection Results</h2>
                <div className="esp-result">
                  <div className="esp-info">
                    <span>Detected ESP:</span>
                    <span 
                      className="esp-badge"
                      style={{ backgroundColor: getESPColor(selectedAnalysis.esp_type) }}
                    >
                      {selectedAnalysis.esp_type}
                    </span>
                  </div>
                  <div className="confidence-info">
                    <span>Confidence:</span>
                    <span className="confidence-score">
                      {(selectedAnalysis.esp_confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="analysis-details">
                  <div>
                    <strong>Sender:</strong> {selectedAnalysis.sender_email}
                  </div>
                  <div>
                    <strong>Duration:</strong> {selectedAnalysis.analysis_duration_ms}ms
                  </div>
                </div>
              </div>

              {/* Receiving Chain */}
              <div className="card">
                <h2>🖥️ Email Receiving Chain</h2>
                <p>The path your email traveled through different servers</p>
                <div className="chain-container">
                  {selectedAnalysis.receiving_chain.map((hop, index) => (
                    <div key={index} className="hop-item">
                      <div className="hop-number">{hop.hop_number}</div>
                      <div className="hop-details">
                        <div className="hop-row">
                          <strong>From Server:</strong>
                          <code>{hop.from_server}</code>
                        </div>
                        <div className="hop-row">
                          <strong>By Server:</strong>
                          <code>{hop.by_server}</code>
                        </div>
                        <div className="hop-row">
                          <strong>Timestamp:</strong>
                          <code>{hop.timestamp}</code>
                        </div>
                      </div>
                      {index < selectedAnalysis.receiving_chain.length - 1 && (
                        <div className="hop-arrow">↓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="sidebar">
              {/* Recent Analyses */}
              <div className="card">
                <h3>🕒 Recent Analyses</h3>
                <div className="analyses-list">
                  {analyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className={`analysis-item ${selectedAnalysis?.id === analysis.id ? 'selected' : ''}`}
                      onClick={() => setSelectedAnalysis(analysis)}
                    >
                      <div className="analysis-header">
                        <span 
                          className="esp-tag"
                          style={{ backgroundColor: getESPColor(analysis.esp_type) }}
                        >
                          {analysis.esp_type}
                        </span>
                        <span className="analysis-time">
                          {new Date(analysis.processed_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="analysis-sender">
                        {analysis.sender_email}
                      </div>
                      <div className="analysis-hops">
                        {analysis.receiving_chain.length} hops
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Headers */}
              <div className="card">
                <h3>📋 Raw Email Headers</h3>
                <pre className="headers-display">
                  {JSON.stringify(selectedAnalysis.raw_headers, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-content">
              <h3>📧 No Email Analyses Yet</h3>
              <p>Click on one of the demo buttons above to see email header analysis in action</p>
              <button
                onClick={() => createDemoAnalysis()}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '🔄 Loading...' : 'Generate Demo Analysis'}
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card instructions">
          <h2>⚠️ How to Use Real IMAP</h2>
          <div className="alert">
            <strong>Demo Mode Active:</strong> This system is currently running in demo mode with mock data. 
            To use real IMAP functionality, you'll need to provide email credentials.
          </div>
          <div className="instructions-content">
            <strong>To enable real IMAP:</strong>
            <ol>
              <li>Set up a test email account (Gmail recommended)</li>
              <li>Enable IMAP in email settings</li>
              <li>Generate an app-specific password</li>
              <li>Add credentials to backend environment variables</li>
              <li>Send test emails to the configured address</li>
            </ol>
          </div>
          <div className="reference-links">
            <a href="https://toolbox.googleapps.com/apps/messageheader/" target="_blank" rel="noopener noreferrer">
              🔗 Google Header Analyzer
            </a>
            <a href="https://inboxdoctor.ai/" target="_blank" rel="noopener noreferrer">
              🔗 InboxDoctor Tests
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;