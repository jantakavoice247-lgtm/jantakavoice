# app.py - Complete with proper config loading and NewsAPI integration

import os
import pickle
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import logging
import sys
import json
from datetime import datetime
import requests
import re

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
logger.info(f"Base directory: {BASE_DIR}")

# Find config.json
CONFIG_PATHS = [
    os.path.join(BASE_DIR, 'config.json'),
    os.path.join(os.path.dirname(BASE_DIR), 'config.json'),
    os.path.join(BASE_DIR, '..', 'config.json'),
]

CONFIG = {}
for path in CONFIG_PATHS:
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                CONFIG = json.load(f)
                logger.info(f"✅ Loaded config from: {path}")
                break
        except Exception as e:
            logger.warning(f"Could not load config from {path}: {e}")

if not CONFIG:
    logger.warning("⚠️ No config.json found. Web verification will be limited.")

# Get NewsAPI key from config or environment
NEWS_API_KEY = CONFIG.get('api_keys', {}).get('newsapi', '') or os.environ.get('NEWS_API_KEY', '')

if NEWS_API_KEY:
    logger.info(f"✅ NewsAPI key loaded: {NEWS_API_KEY[:8]}...")
else:
    logger.warning("⚠️ No NewsAPI key found. Web verification will be limited.")

# Models directory
MODELS_DIR = os.environ.get('AI_MODELS_DIR', '')
if not MODELS_DIR or not os.path.exists(MODELS_DIR):
    possible_paths = [
        os.path.join(BASE_DIR, 'AI_model', 'models'),
        os.path.join(BASE_DIR, 'models'),
        os.path.join(BASE_DIR, 'AI_model'),
        os.path.join(os.path.dirname(BASE_DIR), 'AI_model', 'models'),
        os.path.join(os.path.dirname(BASE_DIR), 'models'),
    ]
    for path in possible_paths:
        if os.path.exists(path):
            MODELS_DIR = path
            break
    if not MODELS_DIR:
        MODELS_DIR = os.path.join(BASE_DIR, 'AI_model', 'models')

logger.info(f"Models directory: {MODELS_DIR}")

# ============================================================
# MODELS
# ============================================================

class NewsRequest(BaseModel):
    title: str
    text: str

class NewsResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: dict
    model_type: str
    success: bool
    error: Optional[str] = None

    class Config:
        protected_namespaces = ()

class SourceInfo(BaseModel):
    title: str
    source: str
    link: str
    date: Optional[str] = None
    description: Optional[str] = None

class WebVerificationResponse(BaseModel):
    status: str
    message: str
    sources_count: int
    confidence: int
    details: str
    top_results: List[SourceInfo]

class FinalVerdictResponse(BaseModel):
    verdict: str
    confidence: float
    reason: str

class CompleteVerificationResponse(BaseModel):
    success: bool
    timestamp: str
    ai_prediction: NewsResponse
    web_verification: WebVerificationResponse
    final_verdict: FinalVerdictResponse
    error: Optional[str] = None

# ============================================================
# AI SERVICE
# ============================================================

class FakeNewsService:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.loaded = False
        self.model_type = None
        self.model_path = None
        
    def find_model_files(self):
        required_files = ['fake_news_baseline.pkl', 'tfidf_vectorizer.pkl']
        found_paths = []
        
        for file in required_files:
            file_path = os.path.join(MODELS_DIR, file)
            if os.path.exists(file_path):
                found_paths.append(file_path)
        
        for file in required_files:
            file_path = os.path.join(BASE_DIR, file)
            if os.path.exists(file_path) and file_path not in found_paths:
                found_paths.append(file_path)
                logger.info(f"Found model in current directory: {file_path}")
        
        parent_dir = os.path.dirname(BASE_DIR)
        for file in required_files:
            file_path = os.path.join(parent_dir, file)
            if os.path.exists(file_path) and file_path not in found_paths:
                found_paths.append(file_path)
                logger.info(f"Found model in parent directory: {file_path}")
        
        has_model = any('fake_news_baseline.pkl' in p for p in found_paths)
        has_vectorizer = any('tfidf_vectorizer.pkl' in p for p in found_paths)
        
        if has_model and has_vectorizer:
            for path in found_paths:
                dir_path = os.path.dirname(path)
                model_path = os.path.join(dir_path, 'fake_news_baseline.pkl')
                vectorizer_path = os.path.join(dir_path, 'tfidf_vectorizer.pkl')
                if os.path.exists(model_path) and os.path.exists(vectorizer_path):
                    return dir_path
        return None
        
    def load_model(self):
        if self.loaded:
            return True
        
        model_path = os.path.join(MODELS_DIR, 'fake_news_baseline.pkl')
        vectorizer_path = os.path.join(MODELS_DIR, 'tfidf_vectorizer.pkl')
        
        if not os.path.exists(model_path) or not os.path.exists(vectorizer_path):
            found_dir = self.find_model_files()
            if found_dir:
                model_path = os.path.join(found_dir, 'fake_news_baseline.pkl')
                vectorizer_path = os.path.join(found_dir, 'tfidf_vectorizer.pkl')
                logger.info(f"Found model files in: {found_dir}")
            else:
                logger.error("Model files not found in any location")
                return False
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            with open(vectorizer_path, 'rb') as f:
                self.vectorizer = pickle.load(f)
            
            self.model_type = 'baseline'
            self.loaded = True
            self.model_path = os.path.dirname(model_path)
            
            logger.info("✅ Baseline model loaded successfully")
            if hasattr(self.model, 'classes_'):
                logger.info(f"   Classes: {self.model.classes_}")
            
            return True
        except Exception as e:
            logger.error(f"❌ Error loading model: {e}")
            return False
    
    def predict(self, title: str, text: str) -> dict:
        if not self.loaded:
            if not self.load_model():
                return {'success': False, 'error': 'Model not loaded'}
        
        try:
            combined_text = str(title) + " " + str(text)
            X = self.vectorizer.transform([combined_text])
            
            prediction = self.model.predict(X)[0]
            probabilities = self.model.predict_proba(X)[0]
            classes = self.model.classes_
            confidence = max(probabilities) * 100
            
            if isinstance(prediction, (list, tuple)):
                prediction = prediction[0]
            
            prob_dict = {}
            for i, cls in enumerate(classes):
                prob_dict[cls] = round(probabilities[i] * 100, 2)
            
            return {
                'success': True,
                'prediction': str(prediction),
                'confidence': round(confidence, 2),
                'probabilities': prob_dict,
                'model_type': 'TF-IDF + Logistic Regression'
            }
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return {'success': False, 'error': str(e)}

# ============================================================
# WEB VERIFICATION SERVICE - FIXED WITH CONFIG
# ============================================================

class WebVerificationService:
    def __init__(self):
        self.api_key = NEWS_API_KEY
        if self.api_key:
            logger.info(f"✅ WebVerificationService initialized with API key")
        else:
            logger.warning("⚠️ WebVerificationService: No API key available")
    
    def search_news(self, query):
        """Search for news using NewsAPI"""
        if not self.api_key:
            logger.warning("⚠️ No NewsAPI key, returning empty results")
            return []
        
        url = "https://newsapi.org/v2/everything"
        words = query.split()
        skip_words = {'the', 'a', 'an', 'of', 'for', 'on', 'at', 'to', 'by', 'in', 'with', 'from', 'as', 'is', 'was', 'are', 'and', 'or', 'but', 'nor', 'yet', 'so'}
        
        important_words = []
        for word in words:
            word_lower = word.lower()
            clean_word = re.sub(r'[^\w]', '', word_lower)
            if len(clean_word) > 2 and clean_word not in skip_words:
                important_words.append(clean_word)
        
        if not important_words:
            important_words = [re.sub(r'[^\w]', '', w.lower()) for w in words[:5] if len(w) > 2]
        
        queries_to_try = []
        if important_words:
            queries_to_try.append(' '.join(important_words[:5]))
        
        first_words = [re.sub(r'[^\w]', '', w) for w in words[:5] if w]
        if first_words:
            queries_to_try.append(' '.join(first_words))
        
        if len(important_words) >= 3:
            queries_to_try.append(' '.join(important_words[:3]))
        
        if len(important_words) >= 2:
            queries_to_try.append(' OR '.join(important_words[:3]))
        
        queries_to_try = list(dict.fromkeys(queries_to_try))
        
        all_results = []
        tried_queries = []
        
        for search_query in queries_to_try:
            if not search_query or search_query in tried_queries:
                continue
            tried_queries.append(search_query)
            
            params = {
                'apiKey': self.api_key,
                'q': search_query,
                'language': 'en',
                'sortBy': 'relevancy',
                'pageSize': 5,
                'searchIn': 'title,description'
            }
            
            try:
                logger.info(f"🔍 Searching NewsAPI with query: {search_query[:50]}...")
                response = requests.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    total_results = data.get('totalResults', 0)
                    logger.info(f"   Found {total_results} results")
                    
                    if total_results > 0:
                        for article in data.get('articles', []):
                            all_results.append({
                                'title': article.get('title', ''),
                                'description': article.get('description', ''),
                                'link': article.get('url', ''),
                                'source': article.get('source', {}).get('name', ''),
                                'date': article.get('publishedAt', ''),
                                'content': article.get('content', '')
                            })
                        if len(all_results) >= 3:
                            break
                elif response.status_code == 429:
                    logger.warning("⚠️ NewsAPI rate limit exceeded")
                    break
                elif response.status_code == 401:
                    logger.error("❌ NewsAPI invalid API key")
                    break
                else:
                    logger.warning(f"⚠️ NewsAPI returned status {response.status_code}")
            except Exception as e:
                logger.warning(f"NewsAPI search error: {e}")
                continue
        
        logger.info(f"📊 Total results from NewsAPI: {len(all_results)}")
        return all_results

    def analyze_results(self, results, title, ai_prediction, ai_confidence):
        if not results:
            return {
                'status': 'NO_SOURCES',
                'message': 'No matching sources found online.',
                'sources_count': 0,
                'confidence': 0,
                'details': 'This could be breaking news or fake news.',
                'top_results': []
            }
        
        title_words = set(re.sub(r'[^\w\s]', '', title.lower()).split())
        stopwords = {'the', 'a', 'an', 'of', 'for', 'on', 'at', 'to', 'by', 'in', 'with', 'from', 'as', 'is', 'was', 'are'}
        title_words = title_words - stopwords
        
        related_results = []
        for result in results:
            result_text = (result.get('title', '') + ' ' + result.get('description', '')).lower()
            result_words = set(re.sub(r'[^\w\s]', '', result_text).split())
            result_words = result_words - stopwords
            
            common_words = title_words.intersection(result_words)
            match_score = len(common_words) / max(len(title_words), 1) if title_words else 0
            
            if match_score > 0.1:
                related_results.append({
                    'result': result,
                    'match_score': round(match_score * 100, 1)
                })
        
        if len(related_results) >= 3:
            status = 'VERIFIED'
            message = f'Found {len(related_results)} related sources online.'
            confidence = min(90 + len(related_results) * 2, 98)
            details = 'Multiple sources confirm this news.'
        elif len(related_results) >= 1:
            status = 'PARTIALLY_VERIFIED'
            message = f'Found {len(related_results)} related source(s) online.'
            confidence = 60 + len(related_results) * 10
            details = 'Limited sources available. Consider manual verification.'
        else:
            status = 'UNVERIFIED'
            message = 'No matching sources found online.'
            confidence = 30
            details = 'Could not find supporting sources. May be fake or breaking news.'
        
        return {
            'status': status,
            'message': message,
            'sources_count': len(related_results),
            'confidence': confidence,
            'details': details,
            'top_results': [r['result'] for r in related_results[:5]]
        }

    def get_final_verdict(self, ai_result, web_result):
        ai_pred = ai_result['prediction']
        ai_conf = ai_result['confidence']
        web_status = web_result['status']
        sources_count = web_result['sources_count']
        
        if web_status == 'VERIFIED' and sources_count >= 3:
            if ai_pred == 'real':
                verdict = 'REAL'
                confidence = min(ai_conf + 20, 98)
                reason = f"Multiple sources ({sources_count}) verify this news. AI agrees."
            else:
                verdict = 'REAL (VERIFIED)'
                confidence = min(web_result['confidence'] + 10, 95)
                reason = f"Web sources confirm this news despite AI uncertainty."
        elif web_status == 'PARTIALLY_VERIFIED':
            if ai_pred == 'real' and ai_conf > 60:
                verdict = 'REAL'
                confidence = ai_conf
                reason = f"Limited sources ({sources_count}) support AI's REAL prediction."
            elif ai_pred == 'fake' and ai_conf > 80:
                verdict = 'FAKE'
                confidence = ai_conf
                reason = f"AI strongly predicts FAKE with limited web sources."
            else:
                verdict = 'UNCERTAIN'
                confidence = min((ai_conf + web_result['confidence']) / 2, 80)
                reason = f"Conflicting signals. AI ({ai_conf:.1f}%) vs Web ({sources_count} sources)."
        elif web_status in ['UNVERIFIED', 'NO_SOURCES']:
            if ai_conf > 85:
                verdict = ai_pred.upper()
                confidence = ai_conf
                reason = f"AI predicts {ai_pred} with high confidence. No web sources found."
            elif ai_pred == 'real' and ai_conf < 65:
                verdict = 'UNCERTAIN'
                confidence = ai_conf
                reason = f"AI uncertain ({ai_conf:.1f}%) and no web sources. Manual review needed."
            else:
                verdict = ai_pred.upper()
                confidence = ai_conf
                reason = f"AI predicts {ai_pred} with {ai_conf:.1f}% confidence. No web sources."
        else:
            verdict = ai_pred.upper()
            confidence = ai_conf
            reason = f"AI predicts {ai_pred} with {ai_conf:.1f}% confidence."
        
        return {
            'verdict': verdict,
            'confidence': round(confidence, 1),
            'reason': reason
        }

    def verify_news(self, title, text):
        if not title and not text:
            return {
                'success': False,
                'error': 'Title and text cannot both be empty'
            }
        
        logger.info(f"📊 Starting verification for: {title[:50]}...")
        
        # Step 1: AI Prediction
        ai_service = FakeNewsService()
        ai_result = ai_service.predict(title, text)
        
        if not ai_result.get('success'):
            return {
                'success': False,
                'error': ai_result.get('error', 'AI prediction failed')
            }
        
        logger.info(f"🤖 AI Prediction: {ai_result['prediction']} ({ai_result['confidence']}%)")
        
        # Step 2: Web Search
        search_query = title + " " + " ".join(text.split()[:10])
        web_results = self.search_news(search_query)
        
        logger.info(f"🌐 Web search returned {len(web_results)} results")
        
        # Step 3: Analyze web results
        web_analysis = self.analyze_results(
            web_results, title, ai_result['prediction'], ai_result['confidence']
        )
        
        logger.info(f"📊 Web Analysis: {web_analysis['status']} - {web_analysis['sources_count']} sources")
        
        # Step 4: Final verdict
        final_verdict = self.get_final_verdict(ai_result, web_analysis)
        
        logger.info(f"⚖️ Final Verdict: {final_verdict['verdict']} ({final_verdict['confidence']}%)")
        
        return {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'ai_prediction': ai_result,
            'web_verification': web_analysis,
            'final_verdict': final_verdict
        }

# ============================================================
# CREATE FASTAPI APP
# ============================================================

app = FastAPI(
    title="People's Press AI Service",
    description="Fake News Detection API with Web Verification",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_service = FakeNewsService()
web_service = WebVerificationService()

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting AI Service...")
    success = ai_service.load_model()
    if success:
        logger.info("✅ Model loaded successfully!")
    else:
        logger.warning("⚠️ No model loaded. Predictions will fail.")

@app.get("/")
async def root():
    return {
        "service": "People's Press AI Service",
        "status": "running",
        "model_loaded": ai_service.loaded,
        "model_type": ai_service.model_type,
        "model_path": ai_service.model_path,
        "newsapi_key_loaded": bool(NEWS_API_KEY)
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy" if ai_service.loaded else "degraded",
        "model_loaded": ai_service.loaded,
        "model_type": ai_service.model_type,
        "model_path": ai_service.model_path,
        "newsapi_key_loaded": bool(NEWS_API_KEY)
    }

@app.post("/predict", response_model=NewsResponse)
async def predict(request: NewsRequest):
    if not request.title and not request.text:
        raise HTTPException(status_code=400, detail="Title or text is required")
    
    result = ai_service.predict(request.title, request.text)
    
    if not result.get('success'):
        raise HTTPException(status_code=500, detail=result.get('error', 'Prediction failed'))
    
    return NewsResponse(
        prediction=result['prediction'],
        confidence=result['confidence'],
        probabilities=result['probabilities'],
        model_type=result['model_type'],
        success=True,
        error=None
    )

@app.post("/verify", response_model=CompleteVerificationResponse)
async def complete_verify(request: NewsRequest):
    if not request.title and not request.text:
        raise HTTPException(status_code=400, detail="Title or text is required")
    
    logger.info(f"📊 Complete verification requested for: {request.title[:50]}...")
    
    result = web_service.verify_news(request.title, request.text)
    
    if not result.get('success'):
        raise HTTPException(status_code=500, detail=result.get('error', 'Verification failed'))
    
    ai_pred = result['ai_prediction']
    web_ver = result['web_verification']
    final_v = result['final_verdict']
    
    sources = []
    for src in web_ver.get('top_results', []):
        sources.append(SourceInfo(
            title=src.get('title', ''),
            source=src.get('source', ''),
            link=src.get('link', ''),
            date=src.get('date', ''),
            description=src.get('description', '')[:200] if src.get('description') else ''
        ))
    
    return CompleteVerificationResponse(
        success=True,
        timestamp=result['timestamp'],
        ai_prediction=NewsResponse(
            prediction=ai_pred['prediction'],
            confidence=ai_pred['confidence'],
            probabilities=ai_pred['probabilities'],
            model_type=ai_pred.get('model_type', 'TF-IDF + Logistic Regression'),
            success=True,
            error=None
        ),
        web_verification=WebVerificationResponse(
            status=web_ver['status'],
            message=web_ver['message'],
            sources_count=web_ver['sources_count'],
            confidence=web_ver['confidence'],
            details=web_ver['details'],
            top_results=sources
        ),
        final_verdict=FinalVerdictResponse(
            verdict=final_v['verdict'],
            confidence=final_v['confidence'],
            reason=final_v['reason']
        ),
        error=None
    )

if __name__ == "__main__":
    port = int(os.environ.get('AI_PORT', 8000))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )