// sizebased.js - Size-based filtering module
exports.apply = function(combinedCondition, roi_boundary, mapPanel, area_threshold_km2) {
  // Default area threshold (km^2)
  area_threshold_km2 = area_threshold_km2 || 0.0005;

  // Ensure geometry is a Geometry object
  var roi_geometry = ee.Feature(roi_boundary).geometry();

  // Ensure input is an ee.Image
  var inputImg = ee.Image(combinedCondition);

  // Vectorize mask -> polygons
  var polygon_vector = inputImg.selfMask().reduceToVectors({
    geometry: roi_geometry,
    scale: 30,
    geometryType: 'polygon',
    eightConnected: true,
    maxPixels: 1e9,
    bestEffort: true
  });

  // Compute area in km^2 and filter
  var area_vector = polygon_vector.map(function(feature) {
    return feature.set('area', feature.geometry().area(1).divide(1000 * 1000));
  });

  var filtered_vector = area_vector.filter(ee.Filter.gte('area', area_threshold_km2));
  
  mapPanel.layers().forEach(function(layer, i) {
    if (layer && layer.getName && layer.getName() === 'Size Filtered Polygons') {
      mapPanel.layers().remove(layer);
    }
  });
  
  // Paint filled interior first (no width argument means fill)
  var fill = ee.Image().byte().paint({
    featureCollection: filtered_vector,
    color: 1
  });
  
  // Paint border on top
  var border = ee.Image().byte().paint({
    featureCollection: filtered_vector,
    color: 1,
    width: 2   // Border thickness
  });
  
  // Combine fill + border into one image
  var filled = fill.blend(border);
  
  // Add to map
  mapPanel.addLayer(filled, {
    palette: ['#ffeb3b'],  // Light yellow fill + same border color
    opacity: 0.8
  }, 'Size Filtered Polygons');


  return filtered_vector;
};
