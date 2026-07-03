### Steps to create Spatial Raster:
1. Run *s2_grid_computation.ipynb* file to generate s2_level13_india.csv
2. Run *generate_glc_tiles.ipynb* file to create 4 *.tif* glc layer tiles across pan-India for 2000-2022 years
3. Merge 4 *.tif files* to get glc raster for each year
4. Run *glc_fractions_computation.py* file to generate spatial_{year}.csv for each *year* from 2000-2022 that contains glc_fractions corresponding to each s2 grid across pan-India
5. Run *spatial_cluster_computation.ipynb* file to find optimal number of spatial clusters
6. Run *remap_to_cluster_cosine.py* file to remap all s2 grids across India for each year using K-means model stored in Model folder
7. Run *stability_check_spatial.ipynb* file to do stability check for spatial clusters generated. It also includes further refinement code for spatial layer.
8. Upload these spatial clusters genertaed for each year to Google Earth Engine and generate raster from them.