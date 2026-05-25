var roi_boundary = null;
var loadedImage = null;
var activeMaps = [Map];
var keepRestorationMarkerOnTopFn = null;
var checkboxes = [];

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.getLoadedImage = function() {
  return loadedImage;
};
exports.reloadAndGetImage = function() {
  if (!roi_boundary) return null;

  var terrain = ee.Image("projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem").clip(roi_boundary);
  
  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) selectedValues.push(terrainClasses[index].value);
  });
  
  if (selectedValues.length === 0) return null;
  
  var mask = terrain.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0).selfMask();
  loadedImage = mask;
  return mask;
};


var terrainClasses = [
  {name: 'V-shape river valleys, Deep narrow canyons', value: 1},
  {name: 'Lateral midslope incised drainages, Local valleys in plains', value: 2},
  {name: 'Upland incised drainages, Stream headwaters', value: 3},
  {name: 'U-shape valleys', value: 4},
  {name: 'Broad Flat Areas', value: 5},
  {name: 'Broad open slopes', value: 6},
  {name: 'Mesa tops', value: 7},
  {name: 'Upper Slopes', value: 8},
  {name: 'Local ridge/hilltops within broad valleys', value: 9},
  {name: 'Lateral midslope drainage divides, Local ridges in plains', value: 10},
  {name: 'Mountain tops, high ridges', value: 11}
];

exports.setClassesAtPoint = function(point) {
  var terrain = ee.Image("projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem");

  terrain.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30,
    bestEffort: true,
    maxPixels: 1e13
  }).evaluate(function(result) {
    if (!result) return;

    var keys = Object.keys(result);
    if (keys.length === 0) return;

    var val = result[keys[0]]; 

    for (var i = 0; i < terrainClasses.length; i++) {
      checkboxes[i].setValue(terrainClasses[i].value === val);
    }

    for (var j = 0; j < terrainClasses.length; j++) {
      if (terrainClasses[j].value === val) {
        print('Auto-selected terrain class: ' + terrainClasses[j].name + ' (value: ' + val + ')');
        break;
      }
    }
  });
};

exports.getPanel = function() {
  var panel = ui.Panel();
  panel.add(ui.Label('Terrain (CoRE stack)', {fontSize: '16px', fontWeight: 'bold', margin: '15px 0 5px 10px'}));
  panel.add(ui.Label('Select terrain classes that may help characterize the area.', {fontSize: '14px'}));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  checkboxes = [];
  terrainClasses.forEach(function(item) {
    var cb = ui.Checkbox(item.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });

  var buttonPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '10px 0', padding: '0 10px'}});
  var loadButton = ui.Button({label: 'Load', style: {margin: '0 5px 0 0', height: '30px'}});
  var clearButton = ui.Button({label: 'Clear Map', style: {margin: '0', height: '30px'}});
  buttonPanel.add(loadButton);
  buttonPanel.add(clearButton);
  panel.add(buttonPanel);

  var clearMap = function() {
    activeMaps.forEach(function(m) {
      m.layers().forEach(function(layer) {
        if (layer.getName() && layer.getName().indexOf('Terrain') === 0) m.remove(layer);
      });
    });
    loadedImage = null;
  };

  loadButton.onClick(function() {
    if (!roi_boundary) { ui.alert('Error', 'Please set ROI first.'); return; }
    clearMap();

    var terrain = ee.Image("projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem").clip(roi_boundary);
    loadedImage = mask;

    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) selectedValues.push(terrainClasses[index].value);
    });

    if (selectedValues.length === 0) return;  // nothing selected

    var mask = terrain.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0).selfMask();

    activeMaps.forEach(function(m) {
      m.addLayer(mask, {min: 0, max: 1, palette: ['white','green']}, 'Terrain');

      if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
    });
  });

  clearButton.onClick(clearMap);

  return panel;
};
exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(terrainClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames; 
};


exports.setValues = function(terrainRules) {
  if (!terrainRules || !terrainRules.length) return;

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  terrainRules.forEach(function(ruleName) {

    for (var i = 0; i < terrainClasses.length; i++) {
      if (terrainClasses[i].name === ruleName) {
        checkboxes[i].setValue(true);
        break;
      }
    }

  });

  if (!roi_boundary) return;

  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Terrain') === 0) {
        m.remove(layer);
      }
    });
  });

  var terrain = ee.Image(
    "projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem"
  ).clip(roi_boundary);

  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedValues.push(terrainClasses[index].value);
    }
  });

  if (selectedValues.length === 0) return;

  var mask = terrain
    .remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0)
    .selfMask();

  loadedImage = mask;

  activeMaps.forEach(function(m) {
    m.addLayer(
      mask,
      {min: 0, max: 1, palette: ['white', 'green']},
      'Terrain (Selected=Green)'
    );

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });
};
