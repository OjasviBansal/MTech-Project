import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import normalize

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model_path = os.path.join(BASE_DIR, "kmeans_cosine_k11_model.joblib")
print("Loading saved Cosine KMeans model...")
kmeans_cosine = joblib.load(model_path)

centroids = kmeans_cosine.cluster_centers_

feature_cols = [
    "crop_frac",
    "tree_frac",
    "shrub_frac",
    "bare_frac",
    "water_frac",
    "built_frac",
    "wetland_frac",
    "snow_frac",
]

output_dir = os.path.join(BASE_DIR, "spatial_clusters_cosine_similarity")
os.makedirs(output_dir, exist_ok=True)

for year in range(2000, 2023):
    print(f"Processing year: {year}...")

    input_csv = os.path.join(BASE_DIR, "glc_fractions", f"glc_{year}.csv")
    output_csv = os.path.join(output_dir, f"spatial_{year}.csv")

    if not os.path.exists(input_csv):
        print(f"Warning: File not found for {year}, skipping.")
        continue

    print(f"Loading data from: {input_csv}")
    df = pd.read_csv(input_csv)

    X = df[feature_cols].values

    print("Applying row-wise L2 normalization...")
    X_normalized = normalize(X, norm="l2")

    print("Mapping grids to cosine clusters...")
    df["cluster"] = kmeans_cosine.predict(X_normalized)

    df.to_csv(output_csv, index=False)
    print(f"Cosine similarity clustering done for {year}!")
    print(f"Saved at: {output_csv}")

    print(f"\nCluster breakdown for {year}:")
    print(df["cluster"].value_counts().sort_index())

print("\nAll years successfully processed!")