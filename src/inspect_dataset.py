"""
Dataset Inspection Script for Fake and Real News Dataset
This script inspects the actual CSV files and reports their structure.
"""

import pandas as pd
import os
import sys

# Get the project root directory (parent of src)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

def inspect_dataset():
    """Inspect the Fake and Real news datasets"""
    
    # Use absolute paths relative to project root
    fake_path = os.path.join(PROJECT_ROOT, 'data', 'raw', 'Fake.csv')
    true_path = os.path.join(PROJECT_ROOT, 'data', 'raw', 'True.csv')
    
    print("=" * 70)
    print("STEP 1: DATASET INSPECTION")
    print("=" * 70)
    print(f"\nProject Root: {PROJECT_ROOT}")
    
    # ============================================================
    # 1. Check file existence
    # ============================================================
    print("\n1. CHECKING FILE EXISTENCE")
    print("-" * 40)
    
    fake_exists = os.path.exists(fake_path)
    true_exists = os.path.exists(true_path)
    
    print(f"Looking for Fake.csv at: {fake_path}")
    print(f"Fake.csv exists: {fake_exists}")
    print(f"Looking for True.csv at: {true_path}")
    print(f"True.csv exists: {true_exists}")
    
    if not fake_exists or not true_exists:
        print("\nERROR: One or both files not found!")
        print("\nPlease make sure:")
        print("  1. Your CSV files are in: data/raw/")
        print("  2. Files are named exactly: Fake.csv and True.csv")
        print(f"\nCurrent directory contents:")
        try:
            print(f"  - {os.listdir(PROJECT_ROOT)}")
            if os.path.exists(os.path.join(PROJECT_ROOT, 'data')):
                print(f"  - data/: {os.listdir(os.path.join(PROJECT_ROOT, 'data'))}")
                if os.path.exists(os.path.join(PROJECT_ROOT, 'data', 'raw')):
                    print(f"  - data/raw/: {os.listdir(os.path.join(PROJECT_ROOT, 'data', 'raw'))}")
        except:
            pass
        return
    
    # ============================================================
    # 2. Load and inspect Fake.csv
    # ============================================================
    print("\n2. LOADING Fake.csv")
    print("-" * 40)
    
    try:
        fake_df = pd.read_csv(fake_path)
        print(f"✓ Successfully loaded Fake.csv")
        print(f"  - Number of rows: {len(fake_df):,}")
        print(f"  - Number of columns: {len(fake_df.columns)}")
        print(f"  - Column names: {list(fake_df.columns)}")
        print(f"  - Memory usage: {fake_df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    except Exception as e:
        print(f"✗ Error loading Fake.csv: {e}")
        return
    
    # ============================================================
    # 3. Load and inspect True.csv
    # ============================================================
    print("\n3. LOADING True.csv")
    print("-" * 40)
    
    try:
        true_df = pd.read_csv(true_path)
        print(f"✓ Successfully loaded True.csv")
        print(f"  - Number of rows: {len(true_df):,}")
        print(f"  - Number of columns: {len(true_df.columns)}")
        print(f"  - Column names: {list(true_df.columns)}")
        print(f"  - Memory usage: {true_df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    except Exception as e:
        print(f"✗ Error loading True.csv: {e}")
        return
    
    # ============================================================
    # 4. First 5 rows from each dataset
    # ============================================================
    print("\n4. FIRST 5 ROWS - Fake.csv")
    print("-" * 40)
    print(fake_df.head())
    
    print("\n4. FIRST 5 ROWS - True.csv")
    print("-" * 40)
    print(true_df.head())
    
    # ============================================================
    # 5. Data types
    # ============================================================
    print("\n5. DATA TYPES")
    print("-" * 40)
    print("\nFake.csv data types:")
    print(fake_df.dtypes)
    print("\nTrue.csv data types:")
    print(true_df.dtypes)
    
    # ============================================================
    # 6. Missing values
    # ============================================================
    print("\n6. MISSING VALUES")
    print("-" * 40)
    
    print("\nFake.csv missing values:")
    print(fake_df.isnull().sum())
    
    print("\nTrue.csv missing values:")
    print(true_df.isnull().sum())
    
    # ============================================================
    # 7. Duplicate rows
    # ============================================================
    print("\n7. DUPLICATE ROWS")
    print("-" * 40)
    
    # Check duplicate text if text column exists
    if 'text' in fake_df.columns:
        fake_duplicates = fake_df.duplicated(subset=['text']).sum()
        print(f"Fake.csv duplicate text rows: {fake_duplicates:,}")
    else:
        print("Fake.csv: No 'text' column found for duplicate check")
    
    if 'text' in true_df.columns:
        true_duplicates = true_df.duplicated(subset=['text']).sum()
        print(f"True.csv duplicate text rows: {true_duplicates:,}")
    else:
        print("True.csv: No 'text' column found for duplicate check")
    
    # ============================================================
    # 8. Empty/very short articles
    # ============================================================
    print("\n8. EMPTY OR VERY SHORT ARTICLES")
    print("-" * 40)
    
    if 'text' in fake_df.columns:
        fake_empty = fake_df['text'].isnull().sum()
        fake_short = (fake_df['text'].str.len() < 20).sum()
        print(f"Fake.csv - Empty text: {fake_empty:,}")
        print(f"Fake.csv - Very short text (<20 chars): {fake_short:,}")
    
    if 'text' in true_df.columns:
        true_empty = true_df['text'].isnull().sum()
        true_short = (true_df['text'].str.len() < 20).sum()
        print(f"True.csv - Empty text: {true_empty:,}")
        print(f"True.csv - Very short text (<20 chars): {true_short:,}")
    
    # ============================================================
    # 9. Class distribution (before combining)
    # ============================================================
    print("\n9. CLASS DISTRIBUTION")
    print("-" * 40)
    print(f"Fake articles: {len(fake_df):,}")
    print(f"Real articles: {len(true_df):,}")
    print(f"Total articles: {len(fake_df) + len(true_df):,}")
    
    total = len(fake_df) + len(true_df)
    print(f"\nFake: {len(fake_df)/total*100:.2f}%")
    print(f"Real: {len(true_df)/total*100:.2f}%")
    
    # ============================================================
    # 10. Summary statistics
    # ============================================================
    print("\n10. TEXT LENGTH STATISTICS")
    print("-" * 40)
    
    if 'text' in fake_df.columns:
        fake_text_lens = fake_df['text'].str.len()
        print("\nFake.csv text length stats:")
        print(f"  - Mean length: {fake_text_lens.mean():.0f} characters")
        print(f"  - Min length: {fake_text_lens.min():,} characters")
        print(f"  - Max length: {fake_text_lens.max():,} characters")
        print(f"  - Std deviation: {fake_text_lens.std():.0f}")
    
    if 'text' in true_df.columns:
        true_text_lens = true_df['text'].str.len()
        print("\nTrue.csv text length stats:")
        print(f"  - Mean length: {true_text_lens.mean():.0f} characters")
        print(f"  - Min length: {true_text_lens.min():,} characters")
        print(f"  - Max length: {true_text_lens.max():,} characters")
        print(f"  - Std deviation: {true_text_lens.std():.0f}")
    
    # ============================================================
    # 11. Column details
    # ============================================================
    print("\n11. COLUMN DETAILS")
    print("-" * 40)
    
    print("\nFake.csv columns:")
    for col in fake_df.columns:
        unique_values = fake_df[col].nunique()
        sample_values = fake_df[col].head(3).tolist()
        print(f"  - {col}: {unique_values:,} unique values")
        print(f"    Sample: {sample_values}")
    
    print("\nTrue.csv columns:")
    for col in true_df.columns:
        unique_values = true_df[col].nunique()
        sample_values = true_df[col].head(3).tolist()
        print(f"  - {col}: {unique_values:,} unique values")
        print(f"    Sample: {sample_values}")
    
    # ============================================================
    # 12. Save inspection results
    # ============================================================
    print("\n12. SAVING INSPECTION RESULTS")
    print("-" * 40)
    
    # Create data directory if it doesn't exist
    os.makedirs(os.path.join(PROJECT_ROOT, 'data'), exist_ok=True)
    
    # Save as a text file for reference
    report_path = os.path.join(PROJECT_ROOT, 'data', 'dataset_inspection.txt')
    with open(report_path, 'w') as f:
        f.write("=" * 70 + "\n")
        f.write("DATASET INSPECTION REPORT\n")
        f.write("=" * 70 + "\n\n")
        
        f.write(f"Fake.csv: {len(fake_df):,} rows\n")
        f.write(f"True.csv: {len(true_df):,} rows\n")
        f.write(f"Total: {len(fake_df) + len(true_df):,} rows\n\n")
        
        f.write("Columns:\n")
        f.write(f"  Fake.csv: {list(fake_df.columns)}\n")
        f.write(f"  True.csv: {list(true_df.columns)}\n\n")
        
        f.write("Missing values:\n")
        f.write(f"  Fake.csv: {fake_df.isnull().sum().to_dict()}\n")
        f.write(f"  True.csv: {true_df.isnull().sum().to_dict()}\n")
    
    print(f"✓ Inspection results saved to: {report_path}")
    
    # ============================================================
    # 13. Next steps
    # ============================================================
    print("\n" + "=" * 70)
    print("INSPECTION COMPLETE")
    print("=" * 70)
    print("\nNEXT STEPS:")
    print("1. Review the inspection results above")
    print("2. If everything looks correct, run the dataset preparation script")
    print("3. Command: python src/prepare_dataset.py")
    print("\nThe preparation script will:")
    print("  - Combine Fake and True datasets")
    print("  - Add labels (fake/real)")
    print("  - Clean the data")
    print("  - Remove duplicates")
    print("  - Split into train/validation/test")
    
    return fake_df, true_df

if __name__ == "__main__":
    inspect_dataset()