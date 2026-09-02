"""
Baseline Model Training: TF-IDF + Logistic Regression
Trains a simple but effective fake news classifier
"""

import pandas as pd
import numpy as np
import os
import joblib
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.utils.class_weight import compute_class_weight
import re
import sys

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def combine_title_text(row):
    """Combine title and text for feature extraction"""
    title = str(row['title']) if pd.notna(row['title']) else ''
    text = str(row['text']) if pd.notna(row['text']) else ''
    return title + " " + text

def train_baseline():
    """Train a TF-IDF + Logistic Regression baseline model"""
    
    print("=" * 70)
    print("PHASE 1: TRAINING BASELINE MODEL (TF-IDF + Logistic Regression)")
    print("=" * 70)
    
    # ============================================================
    # 1. Load datasets
    # ============================================================
    print("\n1. LOADING DATASETS")
    print("-" * 40)
    
    train_path = os.path.join(PROJECT_ROOT, 'data', 'processed', 'train.csv')
    val_path = os.path.join(PROJECT_ROOT, 'data', 'processed', 'validation.csv')
    test_path = os.path.join(PROJECT_ROOT, 'data', 'processed', 'test.csv')
    
    try:
        train_df = pd.read_csv(train_path)
        val_df = pd.read_csv(val_path)
        test_df = pd.read_csv(test_path)
        print(f"✓ Loaded training set: {len(train_df):,} rows")
        print(f"✓ Loaded validation set: {len(val_df):,} rows")
        print(f"✓ Loaded test set: {len(test_df):,} rows")
    except Exception as e:
        print(f"✗ Error loading files: {e}")
        return
    
    # ============================================================
    # 2. Prepare features
    # ============================================================
    print("\n2. PREPARING FEATURES")
    print("-" * 40)
    
    # Combine title and text
    X_train = train_df.apply(combine_title_text, axis=1)
    y_train = train_df['label']
    
    X_val = val_df.apply(combine_title_text, axis=1)
    y_val = val_df['label']
    
    X_test = test_df.apply(combine_title_text, axis=1)
    y_test = test_df['label']
    
    print(f"✓ Training features: {len(X_train):,}")
    print(f"✓ Validation features: {len(X_val):,}")
    print(f"✓ Test features: {len(X_test):,}")
    
    # ============================================================
    # 3. Create TF-IDF Vectorizer
    # ============================================================
    print("\n3. CREATING TF-IDF VECTORIZER")
    print("-" * 40)
    
    vectorizer = TfidfVectorizer(
        max_features=20000,          # Use top 20,000 features
        ngram_range=(1, 2),          # Unigrams and bigrams
        stop_words='english',         # Remove common English words
        min_df=2,                    # Ignore terms that appear in less than 2 docs
        max_df=0.8,                  # Ignore terms that appear in more than 80% of docs
        sublinear_tf=True,           # Use sublinear term frequency scaling
    )
    
    print("✓ TF-IDF vectorizer created")
    
    # Fit and transform training data
    print("   Fitting TF-IDF on training data...")
    X_train_tfidf = vectorizer.fit_transform(X_train)
    print(f"   Training TF-IDF shape: {X_train_tfidf.shape}")
    
    # Transform validation and test data
    X_val_tfidf = vectorizer.transform(X_val)
    X_test_tfidf = vectorizer.transform(X_test)
    print(f"   Validation TF-IDF shape: {X_val_tfidf.shape}")
    print(f"   Test TF-IDF shape: {X_test_tfidf.shape}")
    
    # ============================================================
    # 4. Calculate class weights (for imbalance)
    # ============================================================
    print("\n4. CALCULATING CLASS WEIGHTS")
    print("-" * 40)
    
    # Get unique labels
    unique_labels = np.unique(y_train)
    class_weights = compute_class_weight('balanced', classes=unique_labels, y=y_train)
    class_weight_dict = dict(zip(unique_labels, class_weights))
    
    print(f"Class weights: {class_weight_dict}")
    
    # ============================================================
    # 5. Train Logistic Regression
    # ============================================================
    print("\n5. TRAINING LOGISTIC REGRESSION")
    print("-" * 40)
    
    # Create and train the model
    model = LogisticRegression(
        class_weight=class_weight_dict,
        C=1.0,                       # Regularization strength
        max_iter=1000,
        random_state=42,
        solver='liblinear'           # Good for smaller datasets
    )
    
    print("   Training model...")
    model.fit(X_train_tfidf, y_train)
    print("✓ Model training complete")
    
    # ============================================================
    # 6. Evaluate on validation set
    # ============================================================
    print("\n6. VALIDATION SET EVALUATION")
    print("-" * 40)
    
    y_val_pred = model.predict(X_val_tfidf)
    val_accuracy = accuracy_score(y_val, y_val_pred)
    print(f"Validation Accuracy: {val_accuracy:.4f} ({val_accuracy*100:.2f}%)")
    
    print("\nValidation Classification Report:")
    print(classification_report(y_val, y_val_pred))
    
    # ============================================================
    # 7. Evaluate on test set
    # ============================================================
    print("\n7. TEST SET EVALUATION")
    print("-" * 40)
    
    y_test_pred = model.predict(X_test_tfidf)
    test_accuracy = accuracy_score(y_test, y_test_pred)
    print(f"Test Accuracy: {test_accuracy:.4f} ({test_accuracy*100:.2f}%)")
    
    print("\nTest Classification Report:")
    print(classification_report(y_test, y_test_pred))
    
    print("\nTest Confusion Matrix:")
    print(confusion_matrix(y_test, y_test_pred))
    
    # ============================================================
    # 8. Save model and vectorizer
    # ============================================================
    print("\n8. SAVING MODEL AND VECTORIZER")
    print("-" * 40)
    
    # Create models directory if it doesn't exist
    os.makedirs(os.path.join(PROJECT_ROOT, 'models'), exist_ok=True)
    
    # Save the model
    model_path = os.path.join(PROJECT_ROOT, 'models', 'fake_news_baseline.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"✓ Model saved to: {model_path}")
    
    # Save the vectorizer
    vectorizer_path = os.path.join(PROJECT_ROOT, 'models', 'tfidf_vectorizer.pkl')
    with open(vectorizer_path, 'wb') as f:
        pickle.dump(vectorizer, f)
    print(f"✓ Vectorizer saved to: {vectorizer_path}")
    
    # ============================================================
    # 9. Save evaluation results
    # ============================================================
    print("\n9. SAVING EVALUATION RESULTS")
    print("-" * 40)
    
    results = {
        'model': 'TF-IDF + Logistic Regression',
        'test_accuracy': test_accuracy,
        'validation_accuracy': val_accuracy,
        'class_weights': class_weight_dict,
        'tfidf_features': X_train_tfidf.shape[1],
        'test_confusion_matrix': confusion_matrix(y_test, y_test_pred).tolist(),
    }
    
    results_path = os.path.join(PROJECT_ROOT, 'models', 'baseline_results.pkl')
    with open(results_path, 'wb') as f:
        pickle.dump(results, f)
    print(f"✓ Results saved to: {results_path}")
    
    # ============================================================
    # 10. Summary
    # ============================================================
    print("\n" + "=" * 70)
    print("BASELINE MODEL TRAINING COMPLETE")
    print("=" * 70)
    
    print(f"\n📊 FINAL TEST RESULTS:")
    print(f"   Accuracy:  {test_accuracy:.4f} ({test_accuracy*100:.2f}%)")
    
    print("\n📁 SAVED FILES:")
    print(f"   - models/fake_news_baseline.pkl (model)")
    print(f"   - models/tfidf_vectorizer.pkl (vectorizer)")
    print(f"   - models/baseline_results.pkl (evaluation results)")
    
    print("\nNEXT STEP: Evaluate the model in detail")
    print("   Command: python src/evaluate_baseline.py")
    
    return model, vectorizer

if __name__ == "__main__":
    train_baseline()