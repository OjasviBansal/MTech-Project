var roi_boundary = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

var activeMaps = [Map];
var checkboxes = []; // global checkboxes

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

var lddUtils = {
  layers: [],
  legends: []
};

// ==================== Loaded image getter ====================
exports.getLoadedImage = function() {
  if (!roi_boundary || checkboxes.length === 0) return null;

  var ldd_image = ee.Image("projects/ee-apoorvadewan13/assets/ldd1516").clip(roi_boundary);

  // Collect selected LDD values
  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) selectedValues.push(lddClasses[index].value);
  });

  if (selectedValues.length === 0) return null; // nothing selected

  // Remap to 1 for selected, 0 otherwise, and mask
  var mask = ldd_image.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0).selfMask();

  return mask;
};

// ================== LDD CLASSES ==================
var lddClasses = [
  {name: 'Others - Riverine Sands / Sea Ingress etc', value: 1},
  {name: 'Water Erosion - Sheet erosion - Slight', value: 2},
  {name: 'Anthropogenic - Mining and dump areas', value: 3},
  {name: 'Water Erosion - Sheet erosion - Moderate', value: 4},
  {name: 'Salinisation / Alkalisation - Sodic - Moderate', value: 5},
  {name: 'Wind Erosion - Sheet erosion - Slight', value: 6},
  {name: 'Water Erosion - Sheet erosion - Severe', value: 7},
  {name: 'Wind Erosion - Partially Stablized Dunes', value: 8},
  {name: 'Salinisation / Alkalisation - Sodic - Slight', value: 9},
  {name: 'Wind Erosion - Un-Stablized Dunes', value: 10},
  {name: 'Salinisation / Alkalisation - Saline - Slight', value: 11},
  {name: 'Water logging - Surface ponding - Permanent', value: 12},
  {name: 'Others - Barren rocky / Stony waste', value: 13},
  {name: 'Acidification - Acidic - Moderate', value: 14},
  {name: 'Acidification - Acidic - Severe', value: 15},
  {name: 'Anthropogenic - Industrial effluent affected areas', value: 16},
  {name: 'Water Erosion - Gullies', value: 17},
  {name: 'Salinisation / Alkalisation - Saline - Moderate', value: 18},
  {name: 'Salinisation / Alkalisation - Saline Sodic - Severe', value: 19},
  {name: 'Salinisation / Alkalisation - Saline Sodic - Slight', value: 20},
  {name: 'Salinisation / Alkalisation - Saline Sodic - Moderate', value: 21},
  {name: 'Water Erosion - Rills', value: 22},
  {name: 'Water logging - Surface ponding - Seasonal', value: 23},
  {name: 'Anthropogenic - Brick kiln', value: 24},
  {name: 'Others - Mass movement / mass wastage', value: 25},
  {name: 'Water logging - Subsurface waterlogged', value: 26},
  {name: 'Salinisation / Alkalisation - Sodic - Severe', value: 27},
  {name: 'Water Erosion - Ravines - Shallow', value: 28},
  {name: 'Salinisation / Alkalisation - Saline - Severe', value: 29},
  {name: 'Wind Erosion - Sheet erosion - Moderate', value: 30},
  {name: 'Wind Erosion - Sheet erosion - Severe', value: 31},
  {name: 'Salinisation / Alkalisation - Rann', value: 32},
  {name: 'Glacial - Frost Shattering', value: 33},
  {name: 'Water Erosion - Ravines - Deep', value: 34},
  {name: 'Glacial - Frost heaving', value: 35},
];

// ================== PANEL ==================
exports.getPanel = function() {
  var panel = ui.Panel();
  
  var sectionTitle = ui.Label({
    value: 'Degradation types (India WRIS)',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  panel.add(ui.Label({
    value: 'Select classes that may help characterize the area. ',
    style: {'fontSize': '14px'}
  }));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  // reset and fill global checkboxes
  checkboxes = [];
  lddClasses.forEach(function(item) {
    var cb = ui.Checkbox(item.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });

  var buttonPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '10px 0', padding: '0 10px'}
  });

  var loadButton = ui.Button({label: 'Load', style: {margin: '0 5px 0 0', height: '30px'}});
  var clearButton = ui.Button({label: 'Clear Map', style: {margin: '0', height: '30px'}});

  buttonPanel.add(loadButton);
  buttonPanel.add(clearButton);
  panel.add(buttonPanel);

  // --- Clear ---
  var clearMap = function() {
    activeMaps.forEach(function(m) {
      m.layers().forEach(function(layer) {
        if (layer.getName() && layer.getName().indexOf('Land Degradation') === 0) {
          m.remove(layer);
        }
      });
      lddUtils.legends.forEach(function(legend) {
        m.widgets().remove(legend);
      });
    });
    lddUtils.layers = [];
    lddUtils.legends = [];
    loadedImage = null;
  };

  // --- Load ---
  var loadSelectedLDD = function() {
    if (!roi_boundary) {
      ui.alert('Error', 'Please set ROI from the main panel first.');
      return;
    }

    clearMap();

    var ldd_image = ee.Image("projects/ee-apoorvadewan13/assets/ldd1516").clip(roi_boundary);
    loadedImage = ldd_image;

    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(lddClasses[index].value);
      }
    });

    var selectedMask = ldd_image.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0);
    var vizParams = {min: 0, max: 1, palette: ['white', 'orange']};
    var displayImage = selectedMask.selfMask();

    activeMaps.forEach(function(m) {
      m.addLayer(displayImage, vizParams, 'Land Degradation');
      // m.centerObject(roi_boundary, 6);

      var legend = ui.Panel({
        style: {
          position: 'bottom-left',
          padding: '8px',
          backgroundColor: 'rgba(255,255,255,0.8)'
        }
      });

      var legendTitle = ui.Label({
        value: 'Land Degradation',
        style: {fontWeight: 'bold', margin: '0 0 4px 0'}
      });

      var colorBox = ui.Label({
        style: {
          backgroundColor: 'gray',
          padding: '8px',
          margin: '0 4px 0 0'
        }
      });
      var description = ui.Label({value: 'Selected Degraded Land', style: {margin: '0'}});
      var row = ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.flow('horizontal')
      });

      legend.add(legendTitle);
      legend.add(row);

      // m.add(legend);
      lddUtils.legends.push(legend);
    });
    
    // KEEP ROI Boundary & ROI Center ON TOP
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }

  };

  loadButton.onClick(loadSelectedLDD);
  clearButton.onClick(clearMap);

  return panel;
};

exports.tickCheckboxForValue = function(value) {
  var match = null;
  for (var i = 0; i < lddClasses.length; i++) {
    if (lddClasses[i].value === value) {
      match = lddClasses[i];
      break;
    }
  }
  if (!match) return;

  var idx = lddClasses.indexOf(match);
  if (checkboxes[idx]) {
    checkboxes[idx].setValue(true);
    print("LDD checkbox ticked for:", match.name, "(value:", value, ")");
  }
};

// ---------------- Set multiple LDD classes programmatically ----------------
exports.setValues = function(values) {
  if (!Array.isArray(values)) return;

  // Uncheck all checkboxes first
  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  // Tick checkboxes for the specified values
  lddClasses.forEach(function(cls, index) {
    if (values.indexOf(cls.value) !== -1) {
      checkboxes[index].setValue(true);
    }
  });

  print("LDD checkboxes updated for values:", values);
};


var clearMap = function() {
  // Remove all LDD layers
  lddUtils.layers.forEach(function(ent) {
    if (activeMaps.indexOf(ent.map) !== -1) {
      ent.map.remove(ent.layer);
    }
  });
  lddUtils.layers = [];

  lddUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      m.widgets().remove(legend);
    });
  });
  lddUtils.legends = [];
  loadedImage = null;

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  print("LDD map layers and legends cleared.");
};

// ------------------- Export Clear Map -------------------
exports.clearMap = clearMap;


exports.getRule = function() {
  if (!roi_boundary) return null;

  // Collect selected class names
  var selectedNames = [];
  checkboxes.forEach(function(cb, idx) {
    if (cb.getValue()) selectedNames.push(lddClasses[idx].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames;  // just the selected class labels
};
