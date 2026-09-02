"""
Dataset Preparation Script for Fake News Detection
Combines Fake and Real datasets, cleans data, and splits into train/validation/test
"""

import pandas as pd
import numpy as np
import os
import re
from sklearn.model_selection import train_test_split
from sklearn.utils import shuffle

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def clean_text(text):
    """Basic text cleaning without removing important information"""
    if not isinstance(text, str):
        return ""
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def prepare_dataset():
    """Main dataset preparation function"""
    
    print("=" * 70)
    print("STEP 2: DATASET PREPARATION")
    print("=" * 70)
    
    # ============================================================
    # 1. Load datasets
    # ============================================================
    print("\n1. LOADING DATASETS")
    print("-" * 40)
    
    fake_path = os.path.join(PROJECT_ROOT, 'data', 'raw', 'Fake.csv')
    true_path = os.path.join(PROJECT_ROOT, 'data', 'raw', 'True.csv')
    
    try:
        fake_df = pd.read_csv(fake_path)
        true_df = pd.read_csv(true_path)
        print(f"✓ Loaded Fake.csv: {len(fake_df):,} rows")
        print(f"✓ Loaded True.csv: {len(true_df):,} rows")
    except Exception as e:
        print(f"✗ Error loading files: {e}")
        return None, None, None, None
    
    # ============================================================
    # 2. Add labels
    # ============================================================
    print("\n2. ADDING LABELS")
    print("-" * 40)
    
    fake_df['label'] = 'fake'
    true_df['label'] = 'real'
    
    print(f"✓ Added 'fake' label to {len(fake_df):,} rows")
    print(f"✓ Added 'real' label to {len(true_df):,} rows")
    
    # ============================================================
    # 3. Combine datasets
    # ============================================================
    print("\n3. COMBINING DATASETS")
    print("-" * 40)
    
    # Combine
    combined_df = pd.concat([fake_df, true_df], ignore_index=True)
    print(f"✓ Combined dataset: {len(combined_df):,} rows")
    
    # Shuffle
    combined_df = shuffle(combined_df, random_state=42).reset_index(drop=True)
    print(f"✓ Shuffled dataset")
    
    # ============================================================
    # 4. Clean data
    # ============================================================
    print("\n4. CLEANING DATA")
    print("-" * 40)
    
    initial_rows = len(combined_df)
    print(f"Initial rows: {initial_rows:,}")
    
    # Remove rows with missing title or text
    before = len(combined_df)
    combined_df = combined_df.dropna(subset=['title', 'text'])
    after = len(combined_df)
    removed_nan = before - after
    print(f"✓ Removed {removed_nan:,} rows with missing title or text")
    
    # Clean text (basic cleaning)
    combined_df['cleaned_title'] = combined_df['title'].apply(clean_text)
    combined_df['cleaned_text'] = combined_df['text'].apply(clean_text)
    
    # Remove rows with empty text after cleaning
    before = len(combined_df)
    combined_df = combined_df[(combined_df['cleaned_title'].str.len() > 0) & 
                              (combined_df['cleaned_text'].str.len() > 20)]
    after = len(combined_df)
    removed_empty = before - after
    print(f"✓ Removed {removed_empty:,} rows with empty or very short content")
    
    # Remove exact duplicates based on text
    before = len(combined_df)
    combined_df = combined_df.drop_duplicates(subset=['cleaned_text'], keep='first')
    after = len(combined_df)
    removed_duplicates = before - after
    print(f"✓ Removed {removed_duplicates:,} duplicate articles based on text")
    
    # ============================================================
    # 5. Create final dataset
    # ============================================================
    print("\n5. CREATING FINAL DATASET")
    print("-" * 40)
    
    # Create final dataframe with required columns
    final_df = pd.DataFrame({
        'title': combined_df['cleaned_title'],
        'text': combined_df['cleaned_text'],
        'label': combined_df['label']
    })
    
    # Add optional columns if they exist
    if 'subject' in combined_df.columns:
        final_df['subject'] = combined_df['subject']
    if 'date' in combined_df.columns:
        final_df['date'] = combined_df['date']
    
    print(f"✓ Final dataset: {len(final_df):,} rows")
    
    # ============================================================
    # 6. Class distribution
    # ============================================================
    print("\n6. CLASS DISTRIBUTION")
    print("-" * 40)
    
    label_counts = final_df['label'].value_counts()
    print(label_counts)
    
    print(f"\nFake: {label_counts.get('fake', 0):,} ({label_counts.get('fake', 0)/len(final_df)*100:.2f}%)")
    print(f"Real: {label_counts.get('real', 0):,} ({label_counts.get('real', 0)/len(final_df)*100:.2f}%)")
    
    # ============================================================
    # 7. Split dataset
    # ============================================================
    print("\n7. SPLITTING DATASET")
    print("-" * 40)
    
    # First split: 90% train+val, 10% test
    train_val_df, test_df = train_test_split(
        final_df, 
        test_size=0.1, 
        random_state=42, 
        stratify=final_df['label']
    )
    
    # Second split: 88.9% train, 11.1% val (to get 80/10/10 overall)
    train_df, val_df = train_test_split(
        train_val_df, 
        test_size=0.1111,  # 10/90 = 0.1111
        random_state=42, 
        stratify=train_val_df['label']
    )
    
    print(f"Training: {len(train_df):,} rows ({len(train_df)/len(final_df)*100:.1f}%)")
    print(f"Validation: {len(val_df):,} rows ({len(val_df)/len(final_df)*100:.1f}%)")
    print(f"Testing: {len(test_df):,} rows ({len(test_df)/len(final_df)*100:.1f}%)")
    
    # ============================================================
    # 8. Save datasets
    # ============================================================
    print("\n8. SAVING DATASETS")
    print("-" * 40)
    
    # Create processed directory if it doesn't exist
    os.makedirs(os.path.join(PROJECT_ROOT, 'data', 'processed'), exist_ok=True)
    
    # Save files
    final_df.to_csv(os.path.join(PROJECT_ROOT, 'data', 'processed', 'news_dataset.csv'), index=False)
    train_df.to_csv(os.path.join(PROJECT_ROOT, 'data', 'processed', 'train.csv'), index=False)
    val_df.to_csv(os.path.join(PROJECT_ROOT, 'data', 'processed', 'validation.csv'), index=False)
    test_df.to_csv(os.path.join(PROJECT_ROOT, 'data', 'processed', 'test.csv'), index=False)
    
    print("✓ Saved news_dataset.csv (final combined dataset)")
    print("✓ Saved train.csv")
    print("✓ Saved validation.csv")
    print("✓ Saved test.csv")
    
    # ============================================================
    # 9. Final report
    # ============================================================
    print("\n" + "=" * 70)
    print("DATASET PREPARATION COMPLETE")
    print("=" * 70)
    
    print("\n📊 DATASET STATISTICS")
    print("-" * 40)
    print(f"Original Fake records:  {len(fake_df):,}")
    print(f"Original Real records:  {len(true_df):,}")
    print(f"Original Total:         {len(fake_df) + len(true_df):,}")
    print()
    print(f"Removed invalid records: {removed_nan + removed_empty:,}")
    print(f"Removed duplicates:      {removed_duplicates:,}")
    print()
    print(f"Final Fake records:     {label_counts.get('fake', 0):,}")
    print(f"Final Real records:     {label_counts.get('real', 0):,}")
    print(f"Final Total:            {len(final_df):,}")
    print()
    print(f"Training records:       {len(train_df):,}")
    print(f"Validation records:     {len(val_df):,}")
    print(f"Testing records:        {len(test_df):,}")
    print()
    print(f"Training label distribution:")
    train_labels = train_df['label'].value_counts()
    print(f"  - Fake: {train_labels.get('fake', 0):,}")
    print(f"  - Real: {train_labels.get('real', 0):,}")
    print(f"Validation label distribution:")
    val_labels = val_df['label'].value_counts()
    print(f"  - Fake: {val_labels.get('fake', 0):,}")
    print(f"  - Real: {val_labels.get('real', 0):,}")
    print(f"Test label distribution:")
    test_labels = test_df['label'].value_counts()
    print(f"  - Fake: {test_labels.get('fake', 0):,}")
    print(f"  - Real: {test_labels.get('real', 0):,}")
    
    # ============================================================
    # 10. Save report
    # ============================================================
    print("\n10. SAVING REPORT")
    print("-" * 40)
    
    report_path = os.path.join(PROJECT_ROOT, 'data', 'dataset_preparation_report.txt')
    with open(report_path, 'w') as f:
        f.write("=" * 70 + "\n")
        f.write("DATASET PREPARATION REPORT\n")
        f.write("=" * 70 + "\n\n")
        
        f.write(f"Original Fake records:  {len(fake_df):,}\n")
        f.write(f"Original Real records:  {len(true_df):,}\n")
        f.write(f"Original Total:         {len(fake_df) + len(true_df):,}\n\n")
        
        f.write(f"Removed invalid records: {removed_nan + removed_empty:,}\n")
        f.write(f"Removed duplicates:      {removed_duplicates:,}\n\n")
        
        f.write(f"Final Fake records:     {label_counts.get('fake', 0):,}\n")
        f.write(f"Final Real records:     {label_counts.get('real', 0):,}\n")
        f.write(f"Final Total:            {len(final_df):,}\n\n")
        
        f.write(f"Training records:       {len(train_df):,}\n")
        f.write(f"Validation records:     {len(val_df):,}\n")
        f.write(f"Testing records:        {len(test_df):,}\n")
    
    print(f"✓ Report saved to: {report_path}")
    
    # ============================================================
    # 11. Next steps
    # ============================================================
    print("\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print("\nDataset preparation is complete!")
    print("\nNext, you can proceed with model training.")
    print("\nCommands for next steps:")
    print("  1. Train baseline model:    python src/train_baseline.py")
    print("  2. Evaluate baseline model: python src/evaluate_baseline.py")
    print("  3. Train DistilBERT:        python src/train_distilbert.py")
    print("  4. Evaluate DistilBERT:     python src/evaluate_distilbert.py")
    print("  5. Make predictions:        python src/predict.py")
    
    return final_df, train_df, val_df, test_df

if __name__ == "__main__":
    prepare_dataset()