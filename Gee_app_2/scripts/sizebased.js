exports.apply = function(combinedCondition, roi_boundary, mapPanel, area_threshold_km2) {

  area_threshold_km2 = area_threshold_km2 || 0.0005;

  var roi_geometry = ee.Feature(roi_boundary).geometry();

  var inputImg = ee.Image(combinedCondition);

  var polygon_vector = inputImg.selfMask().reduceToVectors({
    geometry: roi_geometry,
    scale: 30,
    geometryType: 'polygon',
    eightConnected: true,
    maxPixels: 1e9,
    bestEffort: true
  });

  var area_vector = polygon_vector.map(function(feature) {
    return feature.set('area', feature.geometry().area(1).divide(1000 * 1000));
  });

  var filtered_vector = area_vector.filter(ee.Filter.gte('area', area_threshold_km2));
  
  mapPanel.layers().forEach(function(layer, i) {
    if (layer && layer.getName && layer.getName() === 'Size Filtered Polygons') {
      mapPanel.layers().remove(layer);
    }
  });
  
  var fill = ee.Image().byte().paint({
    featureCollection: filtered_vector,
    color: 1
  });
  
  var border = ee.Image().byte().paint({
    featureCollection: filtered_vector,
    color: 1,
    width: 2  
  });
  
  var filled = fill.blend(border);
  
  mapPanel.addLayer(filled, {
    palette: ['#ffeb3b'], 
    opacity: 0.8
  }, 'Size Filtered Polygons');


  return filtered_vector;
};
