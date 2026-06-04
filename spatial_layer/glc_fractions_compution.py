import pandas as pd
import numpy as np
import rasterio
from rasterio.features import geometry_mask, geometry_window
from shapely.geometry import mapping, Polygon
from s2sphere import CellId, Cell, LatLng
from multiprocessing import Pool, cpu_count, freeze_support
import os


def s2cell_to_polygon(cell_id_str):
    # Strip the "id_" prefix and convert the remaining digits to an integer
    clean_id = int(cell_id_str.replace("id_", ""))
    cell = Cell(CellId(clean_id))
    
    coords = []
    for i in range(4):
        ll = LatLng.from_point(cell.get_vertex(i))
        coords.append((ll.lng().degrees, ll.lat().degrees))
    coords.append(coords[0])
    return Polygon(coords)


def compute_fractions(args):
    row, tif_path = args

    try:
        dataset = rasterio.open(tif_path)

        poly = s2cell_to_polygon(row["s2_id"])

        window = geometry_window(dataset, [mapping(poly)])
        transform = dataset.window_transform(window)

        arr = dataset.read(1, window=window)

        mask_arr = geometry_mask(
            [mapping(poly)],
            transform=transform,
            invert=True,
            out_shape=arr.shape
        )

        arr = arr[mask_arr]

        if dataset.nodata is not None:
            arr = arr[arr != dataset.nodata]

        arr = arr[arr > 0]

        if arr.size == 0:
            fracs = [0]*8
        else:
            counts = np.bincount(arr, minlength=9)
            fracs = (counts[1:9] / arr.size).tolist()

        return {
            "s2_id": row["s2_id"],
            "crop_frac":    fracs[0],
            "tree_frac":    fracs[1],
            "shrub_frac":   fracs[2],
            "bare_frac":    fracs[3],
            "water_frac":   fracs[4],
            "built_frac":   fracs[5],
            "wetland_frac": fracs[6],
            "snow_frac":    fracs[7],
        }

    except:
        return {
            "s2_id": row["s2_id"],
            "crop_frac": 0, "tree_frac": 0, "shrub_frac": 0,
            "bare_frac": 0, "water_frac": 0, "built_frac": 0,
            "wetland_frac": 0, "snow_frac": 0,
        }


if __name__ == "__main__":

    freeze_support()

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(BASE_DIR, "s2_level13_india.csv")

    df = pd.read_csv(csv_path, dtype={"s2_id": "str"})

    num_workers = cpu_count() - 1
    print("Using workers:", num_workers)

    BATCH_SIZE = 20000

    for year in range(2000, 2015):

        print(f"\n Processing YEAR: {year}")

        tif_path = os.path.join(BASE_DIR, "merged_glc_layers", f"glc_{year}.tif")
        output_csv = os.path.join(BASE_DIR, "glc_fractions", f"glc_{year}.csv")

        first_write = True

        for start in range(0, len(df), BATCH_SIZE):

            end = min(start + BATCH_SIZE, len(df))
            print(f"Year {year}: {start} → {end}")

            batch = df.iloc[start:end]

            with Pool(num_workers) as pool:
                results = list(pool.imap(
                    compute_fractions,
                    [(row, tif_path) for _, row in batch.iterrows()],
                    chunksize=200
                ))

            out_df = pd.DataFrame(results)

            if first_write:
                out_df.to_csv(output_csv, index=False)
                first_write = False
            else:
                out_df.to_csv(output_csv, mode="a", header=False, index=False)

        print(f" Finished YEAR {year}")

    print(" ALL YEARS DONE")