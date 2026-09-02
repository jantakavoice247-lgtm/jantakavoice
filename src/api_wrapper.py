"""
API wrapper for the fake news detection model
Can be imported by a Flask/FastAPI service later
"""

import os
import pickle
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class FakeNewsDetector:
    """Wrapper class for the fake news detection model"""
    
    def __init__(self, model_type='baseline'):
        """
        Initialize the detector
        
        Args:
            model_type: 'baseline' or 'distilbert'
        """
        self.model_type = model_type
        self.model = None
        self.vectorizer = None
        self.tokenizer = None
        self.loaded = False
    
    def load(self):
        """Load the model and vectorizer"""
        if self.loaded:
            return True
        
        if self.model_type == 'baseline':
            model_path = os.path.join(PROJECT_ROOT, 'models', 'fake_news_baseline.pkl')
            vectorizer_path = os.path.join(PROJECT_ROOT, 'models', 'tfidf_vectorizer.pkl')
            
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                with open(vectorizer_path, 'rb') as f:
                    self.vectorizer = pickle.load(f)
                self.loaded = True
                return True
            except Exception as e:
                print(f"Error loading baseline model: {e}")
                return False
        
        elif self.model_type == 'distilbert':
            try:
                from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
                
                model_path = os.path.join(PROJECT_ROOT, 'models', 'distilbert_fake_news')
                self.tokenizer = DistilBertTokenizer.from_pretrained(model_path)
                self.model = DistilBertForSequenceClassification.from_pretrained(model_path)
                
                # Set to evaluation mode
                self.model.eval()
                self.loaded = True
                return True
            except Exception as e:
                print(f"Error loading DistilBERT model: {e}")
                return False
        
        else:
            print(f"Unknown model type: {self.model_type}")
            return False
    
    def predict(self, title, text):
        """
        Make a prediction
        
        Args:
            title: News headline/title
            text: News content/body
        
        Returns:
            dict: {prediction, confidence, probabilities}
        """
        if not self.loaded:
            if not self.load():
                return {'error': 'Model not loaded', 'success': False}
        
        try:
            if self.model_type == 'baseline':
                return self._predict_baseline(title, text)
            elif self.model_type == 'distilbert':
                return self._predict_distilbert(title, text)
            else:
                return {'error': 'Unknown model type', 'success': False}
        except Exception as e:
            return {'error': str(e), 'success': False}
    
    def _predict_baseline(self, title, text):
        """Make prediction using baseline model"""
        
        # Combine title and text
        combined_text = str(title) + " " + str(text)
        
        # Transform using TF-IDF
        X = self.vectorizer.transform([combined_text])
        
        # Get prediction
        prediction = self.model.predict(X)[0]
        
        # Get probabilities
        probabilities = self.model.predict_proba(X)[0]
        
        # Get class labels
        classes = self.model.classes_
        
        # Get confidence
        confidence = max(probabilities) * 100
        
        return {
            'prediction': prediction,
            'confidence': round(confidence, 2),
            'probabilities': {
                classes[0]: round(probabilities[0] * 100, 2),
                classes[1]: round(probabilities[1] * 100, 2)
            },
            'model': 'TF-IDF + Logistic Regression',
            'success': True
        }
    
    def _predict_distilbert(self, title, text):
        """Make prediction using DistilBERT model"""
        import torch
        
        # Combine title and text
        combined_text = str(title) + " " + str(text)
        
        # Tokenize
        inputs = self.tokenizer(
            combined_text,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors='pt'
        )
        
        # Make prediction
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            prediction = torch.argmax(logits, dim=1)
        
        # Convert to Python types
        pred_label = 'fake' if prediction.item() == 0 else 'real'
        confidence = probabilities[0][prediction.item()].item() * 100
        
        return {
            'prediction': pred_label,
            'confidence': round(confidence, 2),
            'probabilities': {
                'fake': round(probabilities[0][0].item() * 100, 2),
                'real': round(probabilities[0][1].item() * 100, 2)
            },
            'model': 'DistilBERT',
            'success': True
        }

# Example usage
if __name__ == "__main__":
    print("Testing API wrapper...")
    
    # Test baseline
    detector = FakeNewsDetector('baseline')
    detector.load()
    
    result = detector.predict(
        "Breaking: Scientists discover cure for cancer",
        "Scientists at a leading university have discovered a breakthrough cure for cancer."
    )
    print("\nBaseline Model Result:")
    print(json.dumps(result, indent=2))
    
    # Test DistilBERT if available
    try:
        detector2 = FakeNewsDetector('distilbert')
        if detector2.load():
            result2 = detector2.predict(
                "Breaking: Scientists discover cure for cancer",
                "Scientists at a leading university have discovered a breakthrough cure for cancer."
            )
            print("\nDistilBERT Model Result:")
            print(json.dumps(result2, indent=2))
    except:
        print("\nDistilBERT not available yet - train it first")