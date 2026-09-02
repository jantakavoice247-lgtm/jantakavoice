"""
Evaluate the baseline model in detail with visualizations
"""

import pandas as pd
import numpy as np
import os
import pickle
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, roc_auc_score, roc_curve
from sklearn.feature_extraction.text import TfidfVectorizer

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def evaluate_baseline():
    """Evaluate the trained baseline model"""
    
    print("=" * 70)
    print("EVALUATING BASELINE MODEL")
    print("=" * 70)
    
    # ============================================================
    # 1. Load model and vectorizer
    # ============================================================
    print("\n1. LOADING MODEL AND VECTORIZER")
    print("-" * 40)
    
    model_path = os.path.join(PROJECT_ROOT, 'models', 'fake_news_baseline.pkl')
    vectorizer_path = os.path.join(PROJECT_ROOT, 'models', 'tfidf_vectorizer.pkl')
    
    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print("✓ Model loaded")
        
        with open(vectorizer_path, 'rb') as f:
            vectorizer = pickle.load(f)
        print("✓ Vectorizer loaded")
    except Exception as e:
        print(f"✗ Error loading files: {e}")
        return
    
    # ============================================================
    # 2. Load test data
    # ============================================================
    print("\n2. LOADING TEST DATA")
    print("-" * 40)
    
    test_path = os.path.join(PROJECT_ROOT, 'data', 'processed', 'test.csv')
    
    try:
        test_df = pd.read_csv(test_path)
        print(f"✓ Loaded test set: {len(test_df):,} rows")
    except Exception as e:
        print(f"✗ Error loading test data: {e}")
        return
    
    # ============================================================
    # 3. Prepare features
    # ============================================================
    print("\n3. PREPARING FEATURES")
    print("-" * 40)
    
    def combine_title_text(row):
        title = str(row['title']) if pd.notna(row['title']) else ''
        text = str(row['text']) if pd.notna(row['text']) else ''
        return title + " " + text
    
    X_test = test_df.apply(combine_title_text, axis=1)
    y_test = test_df['label']
    
    X_test_tfidf = vectorizer.transform(X_test)
    print(f"✓ Test features shape: {X_test_tfidf.shape}")
    
    # ============================================================
    # 4. Make predictions
    # ============================================================
    print("\n4. MAKING PREDICTIONS")
    print("-" * 40)
    
    y_pred = model.predict(X_test_tfidf)
    y_pred_proba = model.predict_proba(X_test_tfidf)[:, 1]  # Probability of being fake
    
    # ============================================================
    # 5. Calculate metrics
    # ============================================================
    print("\n5. CALCULATING METRICS")
    print("-" * 40)
    
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    
    # AUC-ROC
    y_test_numeric = (y_test == 'fake').astype(int)
    auc = roc_auc_score(y_test_numeric, y_pred_proba)
    print(f"AUC-ROC: {auc:.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # ============================================================
    # 6. Confusion Matrix
    # ============================================================
    print("\n6. CONFUSION MATRIX")
    print("-" * 40)
    
    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(cm)
    
    # Save confusion matrix as image
    try:
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    xticklabels=['Real', 'Fake'],
                    yticklabels=['Real', 'Fake'])
        plt.title('Confusion Matrix - Baseline Model (TF-IDF + Logistic Regression)')
        plt.ylabel('Actual')
        plt.xlabel('Predicted')
        
        # Save plot
        plot_path = os.path.join(PROJECT_ROOT, 'models', 'baseline_confusion_matrix.png')
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        print(f"✓ Confusion matrix saved to: {plot_path}")
        plt.close()
    except Exception as e:
        print(f"Warning: Could not save confusion matrix plot: {e}")
    
    # ============================================================
    # 7. ROC Curve
    # ============================================================
    print("\n7. ROC CURVE")
    print("-" * 40)
    
    try:
        fpr, tpr, thresholds = roc_curve(y_test_numeric, y_pred_proba)
        
        plt.figure(figsize=(8, 6))
        plt.plot(fpr, tpr, label=f'ROC Curve (AUC = {auc:.4f})')
        plt.plot([0, 1], [0, 1], 'k--', label='Random Classifier')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('ROC Curve - Baseline Model')
        plt.legend(loc="lower right")
        plt.grid(True, alpha=0.3)
        
        # Save plot
        plot_path = os.path.join(PROJECT_ROOT, 'models', 'baseline_roc_curve.png')
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        print(f"✓ ROC curve saved to: {plot_path}")
        plt.close()
    except Exception as e:
        print(f"Warning: Could not save ROC curve: {e}")
    
    # ============================================================
    # 8. Feature importance (top 20)
    # ============================================================
    print("\n8. TOP FEATURES BY WEIGHT")
    print("-" * 40)
    
    try:
        # Get feature names and coefficients
        feature_names = vectorizer.get_feature_names_out()
        coefficients = model.coef_[0]
        
        # Get top features for each class
        # Positive coefficients indicate 'fake' class
        top_fake_idx = np.argsort(coefficients)[-10:][::-1]
        top_real_idx = np.argsort(coefficients)[:10]
        
        print("\nTop 10 features indicating FAKE:")
        for idx in top_fake_idx:
            print(f"  - {feature_names[idx]}: {coefficients[idx]:.4f}")
        
        print("\nTop 10 features indicating REAL:")
        for idx in top_real_idx:
            print(f"  - {feature_names[idx]}: {coefficients[idx]:.4f}")
        
    except Exception as e:
        print(f"Warning: Could not extract feature importance: {e}")
    
    # ============================================================
    # 9. Summary
    # ============================================================
    print("\n" + "=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)
    
    print(f"\n📊 BASELINE MODEL PERFORMANCE:")
    print(f"   Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"   AUC-ROC:   {auc:.4f}")
    
    print("\n📁 SAVED FILES:")
    print(f"   - models/baseline_confusion_matrix.png")
    print(f"   - models/baseline_roc_curve.png")
    
    print("\nNEXT STEP: Train DistilBERT model")
    print("   Command: python src/train_distilbert.py")

if __name__ == "__main__":
    evaluate_baseline()