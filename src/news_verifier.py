"""
Complete News Verification System
AI Model + NewsAPI Verification
"""

import os
import sys
import json
import requests
import re
from datetime import datetime
import pickle

# Get project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class NewsVerifier:
    """Complete news verification with AI + NewsAPI only"""
    
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.api_key = None
        self.loaded = False
        
    def _load_api_key(self):
        """Load NewsAPI key from config"""
        config_path = os.path.join(PROJECT_ROOT, 'config.json')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    self.api_key = config.get('api_keys', {}).get('newsapi', '')
                    return True
            except:
                pass
        
        # Try environment variable
        self.api_key = os.environ.get('NEWS_API_KEY', '')
        return bool(self.api_key)
    
    def load_model(self):
        """Load the trained AI model"""
        if self.loaded:
            return True
            
        model_path = os.path.join(PROJECT_ROOT, 'models', 'fake_news_baseline.pkl')
        vectorizer_path = os.path.join(PROJECT_ROOT, 'models', 'tfidf_vectorizer.pkl')
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            with open(vectorizer_path, 'rb') as f:
                self.vectorizer = pickle.load(f)
            self.loaded = True
            print("✅ AI Model loaded successfully")
            return True
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return False
    
    def predict_ai(self, title, text):
        """AI model prediction"""
        if not self.loaded:
            if not self.load_model():
                return {'error': 'Model not loaded'}
        
        combined_text = str(title) + " " + str(text)
        X = self.vectorizer.transform([combined_text])
        
        prediction = self.model.predict(X)[0]
        probabilities = self.model.predict_proba(X)[0]
        classes = self.model.classes_
        confidence = max(probabilities) * 100
        
        return {
            'prediction': prediction,
            'confidence': round(confidence, 2),
            'probabilities': {
                classes[0]: round(probabilities[0] * 100, 2),
                classes[1]: round(probabilities[1] * 100, 2)
            }
        }
    
    def search_news(self, query):
        """Search using NewsAPI only - Improved version with multiple query attempts"""
        if not self.api_key:
            self._load_api_key()
        
        if not self.api_key:
            print("⚠️ No NewsAPI key found. Using mock search.")
            return self._mock_search(query)
        
        url = "https://newsapi.org/v2/everything"
        
        # Extract important words from query
        words = query.split()
        skip_words = {'the', 'a', 'an', 'of', 'for', 'on', 'at', 'to', 'by', 'in', 'with', 'from', 'as', 'is', 'was', 'are', 'and', 'or', 'but', 'nor', 'yet', 'so', 'for', 'nor', 'but', 'or', 'yet', 'so'}
        
        # Keep important words (nouns, verbs, names)
        important_words = []
        for word in words:
            word_lower = word.lower()
            # Remove punctuation and keep words longer than 2 chars
            clean_word = re.sub(r'[^\w]', '', word_lower)
            if len(clean_word) > 2 and clean_word not in skip_words:
                important_words.append(clean_word)
        
        # If no important words found, use first 5 words
        if not important_words:
            important_words = [re.sub(r'[^\w]', '', w.lower()) for w in words[:5] if len(w) > 2]
        
        # Create different search queries to try
        queries_to_try = []
        
        # 1. Important words only (max 5)
        if important_words:
            queries_to_try.append(' '.join(important_words[:5]))
        
        # 2. First 5 words from original query
        first_words = [re.sub(r'[^\w]', '', w) for w in words[:5] if w]
        if first_words:
            queries_to_try.append(' '.join(first_words))
        
        # 3. Most important 3 words (if available)
        if len(important_words) >= 3:
            queries_to_try.append(' '.join(important_words[:3]))
        
        # 4. OR query with important words
        if len(important_words) >= 2:
            queries_to_try.append(' OR '.join(important_words[:3]))
        
        # Remove duplicates
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
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    total_results = data.get('totalResults', 0)
                    if total_results > 0:
                        print(f"   ✓ Found {total_results} results with query: '{search_query[:50]}...'")
                        for article in data.get('articles', []):
                            all_results.append({
                                'title': article.get('title', ''),
                                'description': article.get('description', ''),
                                'link': article.get('url', ''),
                                'source': article.get('source', {}).get('name', ''),
                                'date': article.get('publishedAt', ''),
                                'content': article.get('content', '')
                            })
                        # If we have enough results, stop searching
                        if len(all_results) >= 3:
                            break
                elif response.status_code == 429:
                    print("⚠️ NewsAPI rate limit exceeded. Try again later.")
                    break
                else:
                    pass
            except Exception as e:
                continue
        
        # If still no results, try a simpler approach with 'q=all' using important terms
        if not all_results and important_words:
            try:
                if len(important_words) >= 2:
                    and_query = ' AND '.join(important_words[:3])
                    params = {
                        'apiKey': self.api_key,
                        'q': and_query,
                        'language': 'en',
                        'sortBy': 'relevancy',
                        'pageSize': 3,
                    }
                    response = requests.get(url, params=params, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('totalResults', 0) > 0:
                            print(f"   ✓ Found {data.get('totalResults', 0)} results with AND query")
                            for article in data.get('articles', []):
                                all_results.append({
                                    'title': article.get('title', ''),
                                    'description': article.get('description', ''),
                                    'link': article.get('url', ''),
                                    'source': article.get('source', {}).get('name', ''),
                                    'date': article.get('publishedAt', ''),
                                    'content': article.get('content', '')
                                })
            except Exception as e:
                pass
        
        return all_results
    
    def _mock_search(self, query):
        """Mock search when no API key"""
        return [
            {
                'title': 'Related news found on this topic',
                'description': f'Search results for: {query[:100]}...',
                'link': 'https://example.com/news',
                'source': 'Example News',
                'date': datetime.now().isoformat(),
                'content': 'Please add NewsAPI key for real results.'
            }
        ]
    
    def analyze_results(self, results, title, ai_prediction, ai_confidence):
        """Analyze search results for verification"""
        
        if not results:
            return {
                'status': 'NO_SOURCES',
                'message': 'No matching sources found online.',
                'sources_count': 0,
                'confidence': 0,
                'details': 'This could be breaking news or fake news.',
                'top_results': []
            }
        
        # Clean title for comparison
        title_words = set(re.sub(r'[^\w\s]', '', title.lower()).split())
        stopwords = {'the', 'a', 'an', 'of', 'for', 'on', 'at', 'to', 'by', 'in', 'with', 'from', 'as', 'is', 'was', 'are'}
        title_words = title_words - stopwords
        
        # Score each result
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
        
        # Determine verification status
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
            'top_results': [r['result'] for r in related_results[:3]]
        }
    
    def get_final_verdict(self, ai_result, web_result):
        """Combine AI prediction and web verification - Improved"""
        ai_pred = ai_result['prediction']
        ai_conf = ai_result['confidence']
        web_status = web_result['status']
        sources_count = web_result['sources_count']
        
        # Case 1: Web VERIFIED with 3+ sources - Trust web more
        if web_status == 'VERIFIED' and sources_count >= 3:
            if ai_pred == 'real':
                verdict = 'REAL'
                confidence = min(ai_conf + 20, 98)
                reason = f"Multiple sources ({sources_count}) verify this news. AI agrees."
            else:
                # AI says fake but web says real - trust web more
                verdict = 'REAL (VERIFIED)'
                confidence = min(web_result['confidence'] + 10, 95)
                reason = f"Web sources confirm this news despite AI uncertainty."
        
        # Case 2: Web PARTIALLY_VERIFIED with 1-2 sources
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
        
        # Case 3: Web UNVERIFIED or NO_SOURCES
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
        
        # Case 4: Default - AI only
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
        """Complete news verification process"""
        if not self.loaded:
            if not self.load_model():
                return {'error': 'Model not loaded'}
        
        # Step 1: AI Prediction
        print("\n🤖 Running AI prediction...")
        ai_result = self.predict_ai(title, text)
        if 'error' in ai_result:
            return ai_result
        
        # Step 2: Web Search
        print("\n🌐 Searching web for verification...")
        search_query = title + " " + " ".join(text.split()[:10])
        web_results = self.search_news(search_query)
        print(f"   Found {len(web_results)} results")
        
        # Step 3: Analyze web results
        web_analysis = self.analyze_results(
            web_results, title, ai_result['prediction'], ai_result['confidence']
        )
        
        # Step 4: Final verdict
        final_verdict = self.get_final_verdict(ai_result, web_analysis)
        
        return {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'ai_prediction': ai_result,
            'web_verification': web_analysis,
            'final_verdict': final_verdict
        }

def main():
    """Interactive news verification system"""
    
    print("=" * 80)
    print("📰 COMPLETE NEWS VERIFICATION SYSTEM")
    print("   AI Model + NewsAPI Verification")
    print("=" * 80)
    
    verifier = NewsVerifier()
    
    # Check API key
    if not verifier._load_api_key():
        print("\n⚠️ No NewsAPI key found. Web search will be limited.")
        print("   Get free API key from: https://newsapi.org/")
        print("   Create config.json in project root:")
        print('   {')
        print('     "api_keys": {')
        print('       "newsapi": "YOUR_API_KEY"')
        print('     }')
        print('   }')
    else:
        print("\n✅ NewsAPI key found!")
    
    print("\n🔧 Loading AI model...")
    if not verifier.load_model():
        print("❌ Failed to load model. Please train the model first.")
        return
    
    print("\n✅ System ready!\n")
    
    while True:
        print("-" * 80)
        title = input("\n📰 Enter news title (or 'quit' to exit): ").strip()
        if title.lower() in ['quit', 'exit', 'q']:
            print("\n👋 Goodbye!")
            break
        
        text = input("📝 Enter news content: ").strip()
        if text.lower() in ['quit', 'exit', 'q']:
            print("\n👋 Goodbye!")
            break
        
        if not title or not text:
            print("⚠️ Please enter both title and content.")
            continue
        
        result = verifier.verify_news(title, text)
        
        if 'error' in result:
            print(f"\n❌ Error: {result['error']}")
            continue
        
        # Display results
        print("\n" + "=" * 80)
        print("📊 VERIFICATION RESULTS")
        print("=" * 80)
        
        print(f"\n🤖 AI PREDICTION:")
        print(f"   Prediction: {result['ai_prediction']['prediction'].upper()}")
        print(f"   Confidence: {result['ai_prediction']['confidence']:.2f}%")
        
        print(f"\n🌐 WEB VERIFICATION:")
        web = result['web_verification']
        status_emoji = {
            'VERIFIED': '✅',
            'PARTIALLY_VERIFIED': '🟡',
            'UNVERIFIED': '⚠️',
            'NO_SOURCES': '❌'
        }
        print(f"   Status: {status_emoji.get(web['status'], '❓')} {web['status']}")
        print(f"   {web['message']}")
        print(f"   Sources Found: {web['sources_count']}")
        
        if web['top_results']:
            print("\n   📑 Related Sources:")
            for i, r in enumerate(web['top_results'][:3], 1):
                print(f"   {i}. {r.get('title', 'N/A')[:70]}")
                print(f"      Source: {r.get('source', 'Unknown')}")
        else:
            print("\n   📑 No related sources found.")
        
        verdict = result['final_verdict']
        verdict_emoji = {
            'REAL': '✅',
            'FAKE': '❌',
            'UNCERTAIN': '⚠️',
            'REAL (VERIFIED)': '✅',
            'REAL (BREAKING)': '🔄',
            'FAKE (AI ONLY)': '🤖'
        }
        
        print(f"\n⚖️ FINAL VERDICT:")
        print(f"   {verdict_emoji.get(verdict['verdict'], '❓')} {verdict['verdict']}")
        print(f"   Confidence: {verdict['confidence']:.1f}%")
        print(f"   Reason: {verdict['reason']}")
        
        print("\n" + "=" * 80)

if __name__ == "__main__":
    main()