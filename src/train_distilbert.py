"""
DistilBERT Model Training for Fake News Detection
Fine-tunes a pre-trained DistilBERT model for binary classification
"""

import pandas as pd
import numpy as np
import os
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    DistilBertTokenizer, 
    DistilBertForSequenceClassification,
    AdamW,
    get_linear_schedule_with_warmup
)
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, roc_auc_score
from tqdm import tqdm
import pickle
import warnings
warnings.filterwarnings('ignore')

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class FakeNewsDataset(Dataset):
    """PyTorch Dataset for fake news classification"""
    
    def __init__(self, texts, labels, tokenizer, max_length=256):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(1 if label == 'fake' else 0, dtype=torch.long)
        }

def train_distilbert():
    """Train DistilBERT for fake news classification"""
    
    print("=" * 70)
    print("PHASE 2: TRAINING DISTILBERT MODEL")
    print("=" * 70)
    
    # ============================================================
    # 1. Check GPU availability
    # ============================================================
    print("\n1. CHECKING GPU AVAILABILITY")
    print("-" * 40)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"✓ Using device: {device}")
    if torch.cuda.is_available():
        print(f"  GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("  ⚠️ GPU not available, using CPU (will be slower)")
    
    # ============================================================
    # 2. Load datasets
    # ============================================================
    print("\n2. LOADING DATASETS")
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
    # 3. Prepare data
    # ============================================================
    print("\n3. PREPARING DATA")
    print("-" * 40)
    
    # Combine title and text
    def combine_text(row):
        title = str(row['title']) if pd.notna(row['title']) else ''
        text = str(row['text']) if pd.notna(row['text']) else ''
        return title + " " + text
    
    # For faster training, use a subset of data
    # You can adjust this based on your system
    use_subset = False
    subset_size = 5000
    
    train_texts = train_df.apply(combine_text, axis=1).tolist()
    train_labels = train_df['label'].tolist()
    
    val_texts = val_df.apply(combine_text, axis=1).tolist()
    val_labels = val_df['label'].tolist()
    
    test_texts = test_df.apply(combine_text, axis=1).tolist()
    test_labels = test_df['label'].tolist()
    
    if use_subset:
        train_texts = train_texts[:subset_size]
        train_labels = train_labels[:subset_size]
        print(f"⚠️ Using subset of training data: {subset_size:,} samples")
    
    print(f"✓ Training samples: {len(train_texts):,}")
    print(f"✓ Validation samples: {len(val_texts):,}")
    print(f"✓ Test samples: {len(test_texts):,}")
    
    # ============================================================
    # 4. Load tokenizer
    # ============================================================
    print("\n4. LOADING DISTILBERT TOKENIZER")
    print("-" * 40)
    
    tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
    print("✓ Tokenizer loaded")
    
    # ============================================================
    # 5. Create datasets
    # ============================================================
    print("\n5. CREATING DATASETS")
    print("-" * 40)
    
    train_dataset = FakeNewsDataset(train_texts, train_labels, tokenizer)
    val_dataset = FakeNewsDataset(val_texts, val_labels, tokenizer)
    test_dataset = FakeNewsDataset(test_texts, test_labels, tokenizer)
    
    print(f"✓ Training dataset size: {len(train_dataset):,}")
    print(f"✓ Validation dataset size: {len(val_dataset):,}")
    print(f"✓ Test dataset size: {len(test_dataset):,}")
    
    # ============================================================
    # 6. Create dataloaders
    # ============================================================
    print("\n6. CREATING DATALOADERS")
    print("-" * 40)
    
    batch_size = 8  # Reduce if you get out of memory errors
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    print(f"✓ Batch size: {batch_size}")
    print(f"✓ Training batches: {len(train_loader):,}")
    print(f"✓ Validation batches: {len(val_loader):,}")
    print(f"✓ Test batches: {len(test_loader):,}")
    
    # ============================================================
    # 7. Load model
    # ============================================================
    print("\n7. LOADING DISTILBERT MODEL")
    print("-" * 40)
    
    model = DistilBertForSequenceClassification.from_pretrained(
        'distilbert-base-uncased',
        num_labels=2  # Binary classification: fake/real
    )
    model.to(device)
    print("✓ Model loaded and moved to device")
    
    # ============================================================
    # 8. Setup optimizer and scheduler
    # ============================================================
    print("\n8. SETTING UP OPTIMIZER")
    print("-" * 40)
    
    optimizer = AdamW(model.parameters(), lr=2e-5)
    
    # Scheduler
    epochs = 3
    total_steps = len(train_loader) * epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=0,
        num_training_steps=total_steps
    )
    
    print(f"✓ Epochs: {epochs}")
    print(f"✓ Total training steps: {total_steps:,}")
    
    # ============================================================
    # 9. Training loop
    # ============================================================
    print("\n9. TRAINING MODEL")
    print("=" * 50)
    
    best_val_accuracy = 0
    best_model_state = None
    
    for epoch in range(epochs):
        print(f"\nEpoch {epoch + 1}/{epochs}")
        print("-" * 40)
        
        # Training
        model.train()
        total_train_loss = 0
        
        progress_bar = tqdm(train_loader, desc="Training")
        for batch in progress_bar:
            # Move batch to device
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            # Forward pass
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            
            loss = outputs.loss
            total_train_loss += loss.item()
            
            # Backward pass
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            
            # Update progress bar
            progress_bar.set_postfix({
                'loss': f'{loss.item():.4f}'
            })
        
        avg_train_loss = total_train_loss / len(train_loader)
        print(f"Average training loss: {avg_train_loss:.4f}")
        
        # Validation
        model.eval()
        val_predictions = []
        val_true_labels = []
        total_val_loss = 0
        
        with torch.no_grad():
            for batch in tqdm(val_loader, desc="Validating"):
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels = batch['labels'].to(device)
                
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )
                
                loss = outputs.loss
                total_val_loss += loss.item()
                
                # Get predictions
                logits = outputs.logits
                predictions = torch.argmax(logits, dim=-1)
                
                val_predictions.extend(predictions.cpu().numpy())
                val_true_labels.extend(labels.cpu().numpy())
        
        avg_val_loss = total_val_loss / len(val_loader)
        val_accuracy = accuracy_score(val_true_labels, val_predictions)
        
        print(f"Validation loss: {avg_val_loss:.4f}")
        print(f"Validation accuracy: {val_accuracy:.4f} ({val_accuracy*100:.2f}%)")
        
        # Save best model
        if val_accuracy > best_val_accuracy:
            best_val_accuracy = val_accuracy
            best_model_state = model.state_dict().copy()
            print(f"✓ New best model saved (accuracy: {val_accuracy:.4f})")
    
    # ============================================================
    # 10. Load best model for test evaluation
    # ============================================================
    print("\n10. LOADING BEST MODEL")
    print("-" * 40)
    
    if best_model_state is not None:
        model.load_state_dict(best_model_state)
        print("✓ Best model loaded")
    
    # ============================================================
    # 11. Evaluate on test set
    # ============================================================
    print("\n11. EVALUATING ON TEST SET")
    print("-" * 40)
    
    model.eval()
    test_predictions = []
    test_true_labels = []
    test_probs = []
    
    with torch.no_grad():
        for batch in tqdm(test_loader, desc="Testing"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask
            )
            
            logits = outputs.logits
            probs = torch.softmax(logits, dim=1)
            predictions = torch.argmax(logits, dim=-1)
            
            test_predictions.extend(predictions.cpu().numpy())
            test_true_labels.extend(labels.cpu().numpy())
            test_probs.extend(probs.cpu().numpy())
    
    # Convert labels back to strings for classification report
    label_map = {0: 'fake', 1: 'real'}
    pred_labels = [label_map[p] for p in test_predictions]
    true_labels = [label_map[l] for l in test_true_labels]
    
    test_accuracy = accuracy_score(test_true_labels, test_predictions)
    print(f"Test Accuracy: {test_accuracy:.4f} ({test_accuracy*100:.2f}%)")
    
    # Calculate AUC
    try:
        test_probs_fake = [p[0] for p in test_probs]  # Probability of being fake
        auc = roc_auc_score(test_true_labels, test_probs_fake)
        print(f"AUC-ROC: {auc:.4f}")
    except:
        print("AUC-ROC: Could not calculate")
    
    print("\nTest Classification Report:")
    print(classification_report(true_labels, pred_labels))
    
    print("\nTest Confusion Matrix:")
    cm = confusion_matrix(true_labels, pred_labels, labels=['fake', 'real'])
    print(cm)
    
    # ============================================================
    # 12. Save model
    # ============================================================
    print("\n12. SAVING MODEL")
    print("-" * 40)
    
    # Create models directory if it doesn't exist
    os.makedirs(os.path.join(PROJECT_ROOT, 'models'), exist_ok=True)
    
    # Save the model
    model_path = os.path.join(PROJECT_ROOT, 'models', 'distilbert_fake_news')
    model.save_pretrained(model_path)
    tokenizer.save_pretrained(model_path)
    print(f"✓ Model saved to: {model_path}")
    
    # Save evaluation results
    results = {
        'model': 'DistilBERT',
        'test_accuracy': test_accuracy,
        'best_val_accuracy': best_val_accuracy,
        'num_epochs': epochs,
        'batch_size': batch_size,
        'learning_rate': 2e-5,
        'confusion_matrix': cm.tolist(),
    }
    
    results_path = os.path.join(PROJECT_ROOT, 'models', 'distilbert_results.pkl')
    with open(results_path, 'wb') as f:
        pickle.dump(results, f)
    print(f"✓ Results saved to: {results_path}")
    
    # ============================================================
    # 13. Summary
    # ============================================================
    print("\n" + "=" * 70)
    print("DISTILBERT TRAINING COMPLETE")
    print("=" * 70)
    
    print(f"\n📊 TEST RESULTS:")
    print(f"   Accuracy:  {test_accuracy:.4f} ({test_accuracy*100:.2f}%)")
    print(f"   Best Val:  {best_val_accuracy:.4f} ({best_val_accuracy*100:.2f}%)")
    
    print("\n📁 SAVED FILES:")
    print(f"   - models/distilbert_fake_news/ (model and tokenizer)")
    print(f"   - models/distilbert_results.pkl (evaluation results)")
    
    print("\nNEXT STEP: Compare models")
    print("   Command: python src/compare_models.py")

if __name__ == "__main__":
    train_distilbert()