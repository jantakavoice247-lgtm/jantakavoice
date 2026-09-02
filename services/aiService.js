// backend/services/aiService.js - Complete

const axios = require('axios');

// Get AI service URL from environment
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || '15000');

/**
 * Call the AI service for basic prediction (legacy)
 * @param {string} title - News title
 * @param {string} text - News content
 * @returns {Promise<{success: boolean, prediction: string, confidence: number, error?: string}>}
 */
async function predictNews(title, text) {
    try {
        // Validate input
        if (!title && !text) {
            return {
                success: false,
                error: 'Title and text cannot both be empty'
            };
        }

        // Clean input
        const cleanTitle = (title || '').trim();
        const cleanText = (text || '').trim();

        console.log(`📤 Sending to AI service (predict):`);
        console.log(`   Title: "${cleanTitle.substring(0, 100)}${cleanTitle.length > 100 ? '...' : ''}"`);
        console.log(`   Text length: ${cleanText.length} characters`);

        // Call AI service
        const response = await axios.post(
            `${AI_SERVICE_URL}/predict`,
            {
                title: cleanTitle,
                text: cleanText
            },
            {
                timeout: AI_SERVICE_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📥 AI Service Response received');

        // Check response
        if (response.data && response.data.success) {
            return {
                success: true,
                prediction: response.data.prediction,
                confidence: response.data.confidence / 100,
                probabilities: response.data.probabilities,
                model_type: response.data.model_type,
                raw: response.data
            };
        } else {
            return {
                success: false,
                error: response.data?.error || 'Unknown AI service error'
            };
        }

    } catch (error) {
        console.error('❌ AI Service Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            return {
                success: false,
                error: 'AI service is not running. Please start the AI service.',
                service_unavailable: true
            };
        }
        
        if (error.code === 'ETIMEDOUT') {
            return {
                success: false,
                error: 'AI service timed out. The service may be overloaded.',
                timeout: true
            };
        }

        if (error.response) {
            return {
                success: false,
                error: `AI service error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`,
                status: error.response.status
            };
        }

        return {
            success: false,
            error: error.message || 'Failed to get AI prediction'
        };
    }
}

/**
 * Call the AI service for COMPLETE verification
 * This returns AI prediction + web sources + final verdict
 * @param {string} title - News title
 * @param {string} text - News content
 * @returns {Promise<{success: boolean, ai_prediction: object, web_verification: object, final_verdict: object, error?: string}>}
 */
async function completeVerification(title, text) {
    try {
        // Validate input
        if (!title && !text) {
            return {
                success: false,
                error: 'Title and text cannot both be empty'
            };
        }

        // Clean input
        const cleanTitle = (title || '').trim();
        const cleanText = (text || '').trim();

        console.log(`🔍 Sending to AI service (complete verification):`);
        console.log(`   Title: "${cleanTitle.substring(0, 100)}${cleanTitle.length > 100 ? '...' : ''}"`);
        console.log(`   Text length: ${cleanText.length} characters`);

        // Call AI service
        const response = await axios.post(
            `${AI_SERVICE_URL}/verify`,
            {
                title: cleanTitle,
                text: cleanText
            },
            {
                timeout: AI_SERVICE_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📥 Complete verification response received');

        // Check response
        if (response.data && response.data.success) {
            return {
                success: true,
                timestamp: response.data.timestamp,
                ai_prediction: {
                    prediction: response.data.ai_prediction?.prediction || 'unknown',
                    confidence: response.data.ai_prediction?.confidence / 100 || 0,
                    probabilities: response.data.ai_prediction?.probabilities || {},
                    model_type: response.data.ai_prediction?.model_type || 'unknown'
                },
                web_verification: {
                    status: response.data.web_verification?.status || 'UNAVAILABLE',
                    message: response.data.web_verification?.message || 'No web verification available',
                    sources_count: response.data.web_verification?.sources_count || 0,
                    confidence: response.data.web_verification?.confidence || 0,
                    details: response.data.web_verification?.details || '',
                    top_results: response.data.web_verification?.top_results || []
                },
                final_verdict: {
                    verdict: response.data.final_verdict?.verdict || 'UNCERTAIN',
                    confidence: response.data.final_verdict?.confidence || 0,
                    reason: response.data.final_verdict?.reason || 'Insufficient information'
                },
                raw: response.data
            };
        } else {
            return {
                success: false,
                error: response.data?.error || 'Unknown verification service error'
            };
        }

    } catch (error) {
        console.error('❌ Complete Verification Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            return {
                success: false,
                error: 'AI service is not running. Please start the AI service.',
                service_unavailable: true
            };
        }
        
        if (error.code === 'ETIMEDOUT') {
            return {
                success: false,
                error: 'AI service timed out. The service may be overloaded.',
                timeout: true
            };
        }

        if (error.response) {
            return {
                success: false,
                error: `AI service error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`,
                status: error.response.status
            };
        }

        return {
            success: false,
            error: error.message || 'Failed to complete verification'
        };
    }
}

/**
 * Check if AI service is healthy
 * @returns {Promise<{healthy: boolean, model_loaded: boolean, model_type: string}>}
 */
async function checkAIServiceHealth() {
    try {
        const response = await axios.get(`${AI_SERVICE_URL}/health`, {
            timeout: 5000
        });
        
        return {
            healthy: true,
            model_loaded: response.data?.model_loaded || false,
            model_type: response.data?.model_type || 'unknown'
        };
    } catch (error) {
        return {
            healthy: false,
            model_loaded: false,
            model_type: 'unknown',
            error: error.message
        };
    }
}

module.exports = {
    predictNews,
    completeVerification,
    checkAIServiceHealth
};