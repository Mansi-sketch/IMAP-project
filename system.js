const express = require('express');
const { SystemStatus } = require('../models/EmailAnalysis');
const EmailAnalysisService = require('../services/EmailAnalysisService');

const router = express.Router();

// Root endpoint
router.get('/', (req, res) => {
    res.json({ 
        message: "Email Analysis System API",
        version: "1.0.0",
        endpoints: {
            system_status: "/api/system/status",
            analyze_email: "/api/emails/analyze",
            get_analyses: "/api/emails/analyses",
            demo: "/api/emails/demo",
            clear_analyses: "/api/emails/analyses"
        }
    });
});

// System status endpoint
router.get('/system/status', async (req, res) => {
    try {
        const totalCount = await EmailAnalysisService.getTotalAnalysesCount();
        const status = new SystemStatus(totalCount);
        res.json(status);
    } catch (error) {
        console.error('Error getting system status:', error);
        res.status(500).json({ 
            error: 'Failed to get system status',
            message: error.message 
        });
    }
});

module.exports = router;