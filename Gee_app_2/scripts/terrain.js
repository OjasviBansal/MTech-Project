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

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// ----------------- Updated getLoadedImage -----------------
exports.getLoadedImage = function() {
  if (!roi_boundary) return null;

  // Load terrain raster
  var terrain = ee.Image("projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem").clip(roi_boundary);
  
  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) selectedValues.push(terrainClasses[index].value);
  });

  if (selectedValues.length === 0) {
    loadedImage = null; 
    return null;
  }

  // Remap selected values to 1, others to 0 and mask
  loadedImage = terrain.remap(
    selectedValues,
    ee.List.repeat(1, selectedValues.length),
    0
  ).selfMask();
  
  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }

  return loadedImage;
};


var terrainUtils = { legends: [] };

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

// ---------------- Set terrain class values programmatically ----------------
exports.setValues = function(values) {
  if (!Array.isArray(values)) return;

  // Uncheck all first
  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  // Tick the checkboxes whose terrain values match
  terrainClasses.forEach(function(tc, index) {
    if (values.indexOf(tc.value) !== -1) {
      checkboxes[index].setValue(true);
    }
  });
  
  var img = exports.getLoadedImage();
  if (img) {
    activeMaps.forEach(function(m) {
      m.addLayer(img, {min:0, max:1, palette:['white','green']}, 'Terrain');
    });

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  }

};

// ---------------- UI Panel ----------------
exports.getPanel = function() {
  var panel = ui.Panel();
  panel.add(ui.Label('Terrain (CoRE stack)', {fontSize: '16px', fontWeight: 'bold', margin: '15px 0 5px 10px'}));
  panel.add(ui.Label('Select terrain classes that may help characterize the area.', {fontSize: '14px'}));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  // Create checkboxes and assign to module-level variable
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

  loadButton.onClick(function() {
    if (!roi_boundary) { ui.alert('Error', 'Please set ROI first.'); return; }
    clearMap();

    var terrain = ee.Image("projects/corestack-datasets/assets/datasets/terrain/pan_india_terrain_raster_fabdem").clip(roi_boundary);
    loadedImage = terrain;

    // Collect selected values
    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) selectedValues.push(terrainClasses[index].value);
    });

    if (selectedValues.length === 0) return;  // nothing selected

    var mask = terrain.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0).selfMask();

    activeMaps.forEach(function(m) {
      m.addLayer(mask, {min: 0, max: 1, palette: ['white','green']}, 'Terrain');
      // m.centerObject(roi_boundary, 6);

      // Simple legend
      var legend = ui.Panel({
        style: {position: 'bottom-left', padding: '8px', backgroundColor: 'rgba(255,255,255,0.8)'}
      });

      legend.add(ui.Label({value: 'Terrain Classes', style: {fontWeight: 'bold', margin: '0 0 4px 0'}}));
      legend.add(ui.Panel([
        ui.Label({style: {backgroundColor: 'orange', padding: '8px', margin: '0 4px 0 0'}}),
        ui.Label({value: 'Selected Terrain Classes', style: {margin: '0'}})
      ], ui.Panel.Layout.flow('horizontal')));

      // m.add(legend);
      terrainUtils.legends.push(legend);
    });
    
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }

  });

  clearButton.onClick(clearMap);

  return panel;
};

// ------------------- Remove legend function -------------------
function removeLegend() {
  terrainUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.widgets === 'function') m.widgets().remove(legend);
    });
  });
  terrainUtils.legends = [];
}

function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Terrain') === 0) {
        m.remove(layer);
      }
    });
  });

  removeLegend();

  loadedImage = null;
}

exports.clearMap = clearMap;
exports.removeLegend = removeLegend;


exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(terrainClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames;  
};

