const express = require('express');
const EmailAnalysisService = require('../services/EmailAnalysisService');
const MockEmailGenerator = require('../services/MockEmailGenerator');
const { 
    validateEmailAnalysis, 
    validateLimit 
} = require('../middleware/validation');

const router = express.Router();

// Analyze email endpoint
router.post('/analyze', validateEmailAnalysis, async (req, res) => {
    try {
        const analysis = await EmailAnalysisService.analyzeEmail(req.body);
        res.json(analysis);
    } catch (error) {
        console.error('Error analyzing email:', error);
        res.status(500).json({ 
            error: 'Failed to analyze email',
            message: error.message 
        });
    }
});

// Get email analyses endpoint
router.get('/analyses', validateLimit, async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const analyses = await EmailAnalysisService.getRecentAnalyses(limit);
        res.json(analyses);
    } catch (error) {
        console.error('Error getting analyses:', error);
        res.status(500).json({ 
            error: 'Failed to get analyses',
            message: error.message 
        });
    }
});

// Demo endpoint - Updated to handle query parameter from frontend
router.post('/demo', async (req, res) => {
    try {
        // Frontend sends esp_type as query parameter, not body
        const espType = req.query.esp_type || req.body.esp_type || null;
        const analysis = await EmailAnalysisService.createDemoAnalysis(espType);
        res.json(analysis);
    } catch (error) {
        console.error('Error creating demo analysis:', error);
        res.status(500).json({ 
            error: 'Failed to create demo analysis',
            message: error.message 
        });
    }
});

// Clear analyses endpoint
router.delete('/analyses', async (req, res) => {
    try {
        const deletedCount = await EmailAnalysisService.clearAllAnalyses();
        res.json({ 
            message: `Cleared ${deletedCount} analyses`,
            deleted_count: deletedCount 
        });
    } catch (error) {
        console.error('Error clearing analyses:', error);
        res.status(500).json({ 
            error: 'Failed to clear analyses',
            message: error.message 
        });
    }
});

// Get available ESP types for demo
router.get('/demo/esp-types', (req, res) => {
    try {
        const espTypes = MockEmailGenerator.getAvailableESPTypes();
        res.json({ 
            available_esp_types: espTypes,
            total: espTypes.length 
        });
    } catch (error) {
        console.error('Error getting ESP types:', error);
        res.status(500).json({ 
            error: 'Failed to get ESP types',
            message: error.message 
        });
    }
});

module.exports = router;