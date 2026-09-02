"""
Prediction script for Fake News Detection
Uses the trained baseline model (TF-IDF + Logistic Regression)
"""

import os
import pickle
import pandas as pd
import sys

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_model(model_type='baseline'):
    """
    Load the trained model and vectorizer
    
    Args:
        model_type: 'baseline' or 'distilbert'
    """
    
    if model_type == 'baseline':
        model_path = os.path.join(PROJECT_ROOT, 'models', 'fake_news_baseline.pkl')
        vectorizer_path = os.path.join(PROJECT_ROOT, 'models', 'tfidf_vectorizer.pkl')
        
        try:
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            with open(vectorizer_path, 'rb') as f:
                vectorizer = pickle.load(f)
            return model, vectorizer, 'baseline'
        except Exception as e:
            print(f"Error loading baseline model: {e}")
            return None, None, None
    
    elif model_type == 'distilbert':
        try:
            from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
            import torch
            
            model_path = os.path.join(PROJECT_ROOT, 'models', 'distilbert_fake_news')
            tokenizer = DistilBertTokenizer.from_pretrained(model_path)
            model = DistilBertForSequenceClassification.from_pretrained(model_path)
            
            # Set to evaluation mode
            model.eval()
            
            return model, tokenizer, 'distilbert'
        except Exception as e:
            print(f"Error loading DistilBERT model: {e}")
            return None, None, None
    
    else:
        print(f"Unknown model type: {model_type}")
        return None, None, None

def predict_baseline(title, text, model, vectorizer):
    """Make prediction using baseline model"""
    
    # Combine title and text
    combined_text = str(title) + " " + str(text)
    
    # Transform using TF-IDF
    X = vectorizer.transform([combined_text])
    
    # Get prediction
    prediction = model.predict(X)[0]
    
    # Get probabilities
    probabilities = model.predict_proba(X)[0]
    
    # Get class labels
    classes = model.classes_
    
    # Get confidence
    confidence = max(probabilities) * 100
    
    return {
        'prediction': prediction,
        'confidence': confidence,
        'probabilities': {
            classes[0]: probabilities[0] * 100,
            classes[1]: probabilities[1] * 100
        },
        'model': 'TF-IDF + Logistic Regression'
    }

def predict_distilbert(title, text, model, tokenizer):
    """Make prediction using DistilBERT model"""
    import torch
    
    # Combine title and text
    combined_text = str(title) + " " + str(text)
    
    # Tokenize
    inputs = tokenizer(
        combined_text,
        truncation=True,
        padding=True,
        max_length=512,
        return_tensors='pt'
    )
    
    # Make prediction
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.softmax(logits, dim=1)
        prediction = torch.argmax(logits, dim=1)
    
    # Convert to Python types
    pred_label = 'fake' if prediction.item() == 0 else 'real'
    confidence = probabilities[0][prediction.item()].item() * 100
    
    return {
        'prediction': pred_label,
        'confidence': confidence,
        'probabilities': {
            'fake': probabilities[0][0].item() * 100,
            'real': probabilities[0][1].item() * 100
        },
        'model': 'DistilBERT'
    }

def main():
    """Interactive prediction function"""
    
    print("=" * 70)
    print("FAKE NEWS DETECTION - PREDICTOR")
    print("=" * 70)
    
    # Ask which model to use
    print("\nWhich model would you like to use?")
    print("  1. Baseline (TF-IDF + Logistic Regression) - Fast, 99% accuracy")
    print("  2. DistilBERT - Slower, potentially higher accuracy")
    print("  3. Both (compare results)")
    
    choice = input("\nEnter choice (1, 2, or 3): ").strip()
    
    model = None
    vectorizer = None
    model_type = None
    
    if choice == '1':
        print("\nLoading baseline model...")
        model, vectorizer, model_type = load_model('baseline')
    elif choice == '2':
        print("\nLoading DistilBERT model...")
        model, vectorizer, model_type = load_model('distilbert')
    elif choice == '3':
        print("\nLoading both models...")
        model1, vectorizer1, _ = load_model('baseline')
        model2, tokenizer2, _ = load_model('distilbert')
        
        if model1 is None or model2 is None:
            print("Failed to load one or both models.")
            return
        
        print("✓ Both models loaded successfully\n")
        
        # Interactive loop for both models
        while True:
            print("-" * 70)
            title = input("\nEnter news title (or 'quit' to exit): ").strip()
            if title.lower() in ['quit', 'exit', 'q']:
                break
            
            text = input("Enter news content: ").strip()
            if text.lower() in ['quit', 'exit', 'q']:
                break
            
            if not title and not text:
                print("⚠️ Please enter at least a title or content.")
                continue
            
            print("\n" + "=" * 60)
            print("📊 PREDICTION RESULTS")
            print("=" * 60)
            
            # Baseline prediction
            try:
                result1 = predict_baseline(title, text, model1, vectorizer1)
                print(f"\n🔹 BASELINE (TF-IDF + LR):")
                print(f"   Prediction: {result1['prediction'].upper()}")
                print(f"   Confidence: {result1['confidence']:.2f}%")
            except Exception as e:
                print(f"⚠️ Baseline error: {e}")
            
            # DistilBERT prediction
            try:
                result2 = predict_distilbert(title, text, model2, tokenizer2)
                print(f"\n🔸 DISTILBERT:")
                print(f"   Prediction: {result2['prediction'].upper()}")
                print(f"   Confidence: {result2['confidence']:.2f}%")
            except Exception as e:
                print(f"⚠️ DistilBERT error: {e}")
            
            print("\n" + "=" * 60)
        return
    
    if model is None or vectorizer is None:
        print("Failed to load model. Please train the model first.")
        print("Run: python src/train_baseline.py")
        return
    
    print("✓ Model loaded successfully\n")
    
    # Interactive loop for single model
    while True:
        print("-" * 70)
        title = input("\nEnter news title (or 'quit' to exit): ").strip()
        if title.lower() in ['quit', 'exit', 'q']:
            print("\nGoodbye!")
            break
        
        text = input("Enter news content: ").strip()
        if text.lower() in ['quit', 'exit', 'q']:
            print("\nGoodbye!")
            break
        
        if not title and not text:
            print("⚠️ Please enter at least a title or content.")
            continue
        
        try:
            if model_type == 'baseline':
                result = predict_baseline(title, text, model, vectorizer)
            elif model_type == 'distilbert':
                result = predict_distilbert(title, text, model, vectorizer)
            else:
                print("Unknown model type")
                continue
            
            print("\n" + "=" * 50)
            print(f"📊 PREDICTION: {result['prediction'].upper()}")
            print(f"   Confidence: {result['confidence']:.2f}%")
            print(f"   Model: {result.get('model', 'Unknown')}")
            print("-" * 50)
            print("   Class Probabilities:")
            for label, prob in result['probabilities'].items():
                print(f"     - {label}: {prob:.2f}%")
            print("=" * 50)
            
        except Exception as e:
            print(f"❌ Error making prediction: {e}")

if __name__ == "__main__":
    main()