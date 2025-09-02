from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import asyncio
import random


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Email Analysis System", description="Email header analysis and ESP detection")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Pydantic Models
class EmailAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email_address: str
    subject_line: str
    sender_email: str
    receiving_chain: List[Dict[str, Any]]
    esp_type: str
    esp_confidence: float
    raw_headers: Dict[str, Any]
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    analysis_duration_ms: Optional[int] = None

class EmailAnalysisCreate(BaseModel):
    sender_email: str
    raw_headers: Dict[str, Any]

class SystemStatus(BaseModel):
    email_address: str
    subject_line: str
    imap_status: str
    last_check: datetime
    total_emails_processed: int


# ESP Detection Logic
class ESPDetector:
    ESP_PATTERNS = {
        'Gmail': [
            r'smtp\\.gmail\\.com',
            r'mail-.*\\.google\\.com',
            r'by mail\\.gmail\\.com',
            r'received.*gmail\\.com'
        ],
        'Outlook': [
            r'smtp.*\\.outlook\\.com',
            r'.*\\.outlook\\.com',
            r'by.*outlook\\.com',
            r'protection\\.outlook\\.com'
        ],
        'Yahoo': [
            r'smtp.*\\.mail\\.yahoo\\.com',
            r'mta.*\\.mail\\.yahoo\\.com',
            r'by.*yahoo\\.com'
        ],
        'Amazon SES': [
            r'amazonaws\\.com',
            r'email-smtp.*\\.amazonaws\\.com',
            r'ses.*\\.amazonaws\\.com'
        ],
        'SendGrid': [
            r'sendgrid\\.net',
            r'smtp\\.sendgrid\\.net',
            r'by.*sendgrid'
        ],
        'Mailchimp': [
            r'mailchimp\\.com',
            r'mcsv\\.net',
            r'by.*mailchimp'
        ],
        'Mailgun': [
            r'mailgun\\.org',
            r'smtp.*\\.mailgun\\.org'
        ],
        'Postmark': [
            r'postmarkapp\\.com',
            r'smtp\\.postmarkapp\\.com'
        ]
    }
    
    @classmethod
    def detect_esp(cls, headers_text: str) -> tuple[str, float]:
        """Detect ESP from email headers with confidence score"""
        headers_lower = headers_text.lower()
        
        esp_scores = {}
        
        for esp, patterns in cls.ESP_PATTERNS.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, headers_lower))
                score += matches
            
            if score > 0:
                esp_scores[esp] = score
        
        if not esp_scores:
            return "Unknown", 0.0
        
        # Get ESP with highest score
        best_esp = max(esp_scores, key=esp_scores.get)
        max_score = esp_scores[best_esp]
        
        # Calculate confidence (normalize to 0-1)
        confidence = min(max_score / 3.0, 1.0)  # 3+ matches = 100% confidence
        
        return best_esp, confidence


class ReceivingChainAnalyzer:
    @classmethod
    def extract_receiving_chain(cls, headers: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract the receiving chain from email headers"""
        received_headers = []
        
        # Handle different header formats
        if 'received' in headers:
            if isinstance(headers['received'], list):
                received_headers = headers['received']
            else:
                received_headers = [headers['received']]
        elif 'Received' in headers:
            if isinstance(headers['Received'], list):
                received_headers = headers['Received']
            else:
                received_headers = [headers['Received']]
        
        chain = []
        
        for i, received in enumerate(received_headers):
            if isinstance(received, str):
                # Parse received header
                server_info = cls._parse_received_header(received)
                server_info['hop_number'] = i + 1
                chain.append(server_info)
        
        # If no received headers, create mock chain for demo
        if not chain:
            chain = cls._create_mock_receiving_chain()
        
        return chain
    
    @classmethod
    def _parse_received_header(cls, received: str) -> Dict[str, Any]:
        """Parse a single Received header"""
        # Extract server information using regex
        from_match = re.search(r'from\\s+([^\\s\\(]+)', received, re.IGNORECASE)
        by_match = re.search(r'by\\s+([^\\s\\(]+)', received, re.IGNORECASE)
        date_match = re.search(r';\\s*(.+)$', received)
        
        return {
            'from_server': from_match.group(1) if from_match else 'unknown',
            'by_server': by_match.group(1) if by_match else 'unknown',
            'timestamp': date_match.group(1).strip() if date_match else 'unknown',
            'raw_header': received
        }
    
    @classmethod
    def _create_mock_receiving_chain(cls) -> List[Dict[str, Any]]:
        """Create mock receiving chain for demo purposes"""
        return [
            {
                'hop_number': 1,
                'from_server': 'mail.example.com',
                'by_server': 'mx1.gmail.com',
                'timestamp': 'Mon, 1 Jan 2024 10:00:00 +0000',
                'raw_header': 'Received: from mail.example.com by mx1.gmail.com'
            },
            {
                'hop_number': 2,
                'from_server': 'smtp.sender.com',
                'by_server': 'mail.example.com',
                'timestamp': 'Mon, 1 Jan 2024 09:59:58 +0000',
                'raw_header': 'Received: from smtp.sender.com by mail.example.com'
            }
        ]


# Mock Email Generator for Demo
class MockEmailGenerator:
    SAMPLE_HEADERS = {
        'gmail': {
            'received': [
                'from mail-oi1-f44.google.com (mail-oi1-f44.google.com. [209.85.167.44]) by mx.example.com with ESMTPS id abc123 for <test@example.com>; Mon, 1 Jan 2024 10:00:00 +0000',
                'by mail.gmail.com with SMTP id xyz789; Mon, 1 Jan 2024 09:59:58 +0000'
            ],
            'from': 'sender@gmail.com',
            'subject': 'EMAIL_ANALYSIS_TEST_' + str(random.randint(1000, 9999))
        },
        'outlook': {
            'received': [
                'from NAM02-DM3-obe.outbound.protection.outlook.com by mx.example.com; Mon, 1 Jan 2024 10:00:00 +0000',
                'by DM6PR0402MB3245.outlook.com; Mon, 1 Jan 2024 09:59:58 +0000'
            ],
            'from': 'sender@outlook.com',
            'subject': 'EMAIL_ANALYSIS_TEST_' + str(random.randint(1000, 9999))
        },
        'sendgrid': {
            'received': [
                'from o1.email.sendgrid.net by mx.example.com; Mon, 1 Jan 2024 10:00:00 +0000',
                'by smtp.sendgrid.net; Mon, 1 Jan 2024 09:59:58 +0000'
            ],
            'from': 'noreply@company.com',
            'subject': 'EMAIL_ANALYSIS_TEST_' + str(random.randint(1000, 9999))
        }
    }
    
    @classmethod
    def generate_sample_email(cls, esp_type: str = None) -> Dict[str, Any]:
        """Generate sample email headers for demo"""
        if not esp_type:
            esp_type = random.choice(list(cls.SAMPLE_HEADERS.keys()))
        
        return cls.SAMPLE_HEADERS.get(esp_type, cls.SAMPLE_HEADERS['gmail'])


# API Routes
@api_router.get("/", tags=["System"])
async def root():
    return {"message": "Email Analysis System API"}

@api_router.get("/system/status", response_model=SystemStatus, tags=["System"])
async def get_system_status():
    """Get current system status"""
    # Count total processed emails
    total_count = await db.email_analyses.count_documents({})
    
    return SystemStatus(
        email_address="test-email-analysis@demo.com",
        subject_line="EMAIL_ANALYSIS_TEST",
        imap_status="Demo Mode - Ready",
        last_check=datetime.now(timezone.utc),
        total_emails_processed=total_count
    )

@api_router.post("/emails/analyze", response_model=EmailAnalysis, tags=["Email Analysis"])
async def analyze_email(email_data: EmailAnalysisCreate):
    """Analyze email headers and detect ESP"""
    start_time = datetime.now()
    
    # Convert headers to string for ESP detection
    headers_text = json.dumps(email_data.raw_headers)
    
    # Detect ESP
    esp_type, confidence = ESPDetector.detect_esp(headers_text)
    
    # Extract receiving chain
    receiving_chain = ReceivingChainAnalyzer.extract_receiving_chain(email_data.raw_headers)
    
    # Create analysis object
    analysis = EmailAnalysis(
        email_address="test-email-analysis@demo.com",
        subject_line=email_data.raw_headers.get('subject', 'EMAIL_ANALYSIS_TEST'),
        sender_email=email_data.sender_email,
        receiving_chain=receiving_chain,
        esp_type=esp_type,
        esp_confidence=confidence,
        raw_headers=email_data.raw_headers,
        analysis_duration_ms=int((datetime.now() - start_time).total_seconds() * 1000)
    )
    
    # Store in database
    await db.email_analyses.insert_one(analysis.dict())
    
    return analysis

@api_router.get("/emails/analyses", response_model=List[EmailAnalysis], tags=["Email Analysis"])
async def get_email_analyses(limit: int = 10):
    """Get recent email analyses"""
    analyses = await db.email_analyses.find().sort("processed_at", -1).limit(limit).to_list(limit)
    return [EmailAnalysis(**analysis) for analysis in analyses]

@api_router.post("/emails/demo", response_model=EmailAnalysis, tags=["Demo"])
async def create_demo_analysis(esp_type: Optional[str] = None):
    """Create a demo email analysis with sample data"""
    # Generate sample email headers
    sample_headers = MockEmailGenerator.generate_sample_email(esp_type)
    
    # Create analysis request
    email_data = EmailAnalysisCreate(
        sender_email=sample_headers['from'],
        raw_headers=sample_headers
    )
    
    return await analyze_email(email_data)

@api_router.delete("/emails/analyses", tags=["Email Analysis"])
async def clear_analyses():
    """Clear all email analyses (for demo purposes)"""
    result = await db.email_analyses.delete_many({})
    return {"message": f"Cleared {result.deleted_count} analyses"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()