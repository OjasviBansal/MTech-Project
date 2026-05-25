var snic_2 = function(roi_boundary, filtered_raster) {

  var roi_geometry;
  if (roi_boundary instanceof ee.Feature) {
    roi_geometry = roi_boundary.geometry();
  } else if (roi_boundary instanceof ee.Geometry) {
    roi_geometry = roi_boundary;
  } else {
    throw new Error('roi_boundary must be ee.Feature or ee.Geometry');
  }

  function apply_snic(image) {
    var snic = ee.Algorithms.Image.Segmentation.SNIC({
      image: image,
      size: 80,
      compactness: 1,
      connectivity: 8
    });
    return snic.select('clusters');
  }

  function get_embedding_image(roi, start_date, end_date) {
    var embedding = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL")
      .filterDate(start_date, end_date)
      .filterBounds(roi)
      .mosaic();

    var all_bands = [];
    for (var i = 0; i < 64; i++) {
      all_bands.push('A' + (i < 10 ? '0' : '') + i);
    }
    return embedding.select(all_bands).clip(roi);
  }

  var startDate = '2024-01-01';
  var endDate = '2025-01-01';

  var roiBounds = roi_geometry.bounds();
  var grid = roiBounds.coveringGrid('EPSG:4326', 0.5); // 0.5 deg ~ 55km tiles

  var processTile = function(tileFeature) {
    var tileGeom = ee.Feature(tileFeature).geometry();

    var embedding_img = get_embedding_image(tileGeom, startDate, endDate);
    var clusters = apply_snic(embedding_img);
    var ts_clusters_fixed = clusters.reproject({crs: 'EPSG:4326', scale: 30});

    var ts_vectors = ts_clusters_fixed.reduceToVectors({
      geometry: tileGeom,
      scale: 30,
      geometryType: 'polygon',
      eightConnected: true,
      maxPixels: 1e9,
      bestEffort: true
    });

    var polygons = filtered_raster.selfMask().reduceToVectors({
      geometry: tileGeom,
      scale: 30,
      geometryType: 'polygon',
      eightConnected: true,
      maxPixels: 1e9,
      bestEffort: true
    });

    var intersecting_clusters = ts_vectors.filterBounds(polygons);

    var labels = intersecting_clusters.aggregate_array('label');
    var hasLabels = labels.size().gt(0);

    var intersecting_cluster_raster = ee.Image(
      ee.Algorithms.If(
        hasLabels,
        ts_clusters_fixed.updateMask(
          ts_clusters_fixed.remap(
            labels,
            ee.List.repeat(1, labels.size())
          )
        ),
        ee.Image(0).updateMask(ee.Image(0)) 
      )
    );

    return intersecting_cluster_raster;
  };

  var clusterImages = grid.map(function(tile) {
    return processTile(tile);
  });

  var mosaicClusters = ee.ImageCollection(clusterImages).mosaic();
  return mosaicClusters.clip(roi_geometry);
};

exports.apply = snic_2;
