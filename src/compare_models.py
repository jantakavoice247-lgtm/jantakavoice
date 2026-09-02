"""
Compare Baseline and DistilBERT models
"""

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def compare_models():
    """Compare the baseline and DistilBERT models"""
    
    print("=" * 70)
    print("COMPARING MODELS")
    print("=" * 70)
    
    # ============================================================
    # 1. Load results
    # ============================================================
    print("\n1. LOADING MODEL RESULTS")
    print("-" * 40)
    
    baseline_results_path = os.path.join(PROJECT_ROOT, 'models', 'baseline_results.pkl')
    distilbert_results_path = os.path.join(PROJECT_ROOT, 'models', 'distilbert_results.pkl')
    
    try:
        with open(baseline_results_path, 'rb') as f:
            baseline_results = pickle.load(f)
        print("✓ Baseline results loaded")
        baseline_acc = baseline_results.get('test_accuracy', 0)
    except:
        print("⚠️ Baseline results not found")
        baseline_acc = 0
    
    try:
        with open(distilbert_results_path, 'rb') as f:
            distilbert_results = pickle.load(f)
        print("✓ DistilBERT results loaded")
        distilbert_acc = distilbert_results.get('test_accuracy', 0)
    except:
        print("⚠️ DistilBERT results not found")
        distilbert_acc = 0
    
    # ============================================================
    # 2. Display comparison
    # ============================================================
    print("\n2. MODEL COMPARISON")
    print("-" * 40)
    
    print("\n" + "=" * 60)
    print(f"{'Metric':<30} {'TF-IDF + LR':<20} {'DistilBERT':<20}")
    print("=" * 60)
    print(f"{'Test Accuracy':<30} {baseline_acc:.4f} {distilbert_acc:.4f}")
    print("=" * 60)
    
    # ============================================================
    # 3. Recommendation
    # ============================================================
    print("\n3. RECOMMENDATION")
    print("-" * 40)
    
    if distilbert_acc > baseline_acc:
        improvement = (distilbert_acc - baseline_acc) * 100
        print(f"✅ DistilBERT performs better")
        print(f"   Improvement: {improvement:.2f}%")
        print("   Recommended for production use if you need maximum accuracy")
        print("   ⚠️ Note: DistilBERT requires more resources and is slower")
    elif baseline_acc > distilbert_acc:
        improvement = (baseline_acc - distilbert_acc) * 100
        print(f"✅ TF-IDF + Logistic Regression performs better")
        print(f"   Improvement: {improvement:.2f}%")
        print("   Recommended for production use (faster, simpler, more efficient)")
    else:
        print("⚠️ Both models perform similarly")
        print("   Recommended: Use TF-IDF + LR for simplicity and speed")
    
    print("\n" + "=" * 70)
    print("COMPARISON COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    compare_models()