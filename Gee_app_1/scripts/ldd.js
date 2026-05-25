var roi_boundary = null;
var loadedImage = null;

var activeMaps = [Map];
var checkboxes = []; 
var keepRestorationMarkerOnTopFn = null;
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

var lddUtils = {
  layers: []
};

exports.getLoadedImage = function() {
  return loadedImage;
};

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
  {name: 'Non Degraded Land / None of the Above', value: 0}
];

exports.getPanel = function() {
  var panel = ui.Panel();
  
  var sectionTitle = ui.Label({
    value: 'Degradation types (India WRIS)',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  panel.add(ui.Label({
    value: 'And likewise for type of degradation. ',
    style: {'fontSize': '14px'}
  }));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  checkboxes = [];
  lddClasses.forEach(function(item) {
    var cb = ui.Checkbox(item.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });
  var selectAllButton = ui.Button({
    label: 'Select All',
    style: {
      margin: '10px 0',
      height: '28px',
      width: '100%'
    },
    onClick: function() {
      checkboxes.forEach(function(cb) {
        cb.setValue(true);
      });
    }
  });
  checkboxPanel.add(selectAllButton);

  var buttonPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '10px 0', padding: '0 10px'}
  });

  var loadButton = ui.Button({label: 'Load', style: {margin: '0 5px 0 0', height: '30px'}});
  var clearButton = ui.Button({label: 'Clear Map', style: {margin: '0', height: '30px'}});

  buttonPanel.add(loadButton);
  buttonPanel.add(clearButton);
  panel.add(buttonPanel);

  var clearMap = function() {
    activeMaps.forEach(function(m) {
      m.layers().forEach(function(layer) {
        if (layer.getName() && layer.getName().indexOf('Land Degradation') === 0) {
          m.remove(layer);
        }
      });
    });
    lddUtils.layers = [];
    loadedImage = null;
  };

  var loadSelectedLDD = function() {
    if (!roi_boundary) {
      ui.alert('Error', 'Please set ROI from the main panel first.');
      return;
    }

    clearMap();

    var ldd_image = ee.Image("projects/ee-apoorvadewan13/assets/ldd1516").clip(roi_boundary).unmask(0);
    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(lddClasses[index].value);
      }
    });
    var combinedMask = ee.Image(0);

    selectedValues.forEach(function(val) {
      var classMask;
      if (val === 0) {
        var validDeg = ldd_image.gt(0).and(ldd_image.lte(35));
        classMask = validDeg.not();
      } else {
        classMask = ldd_image.eq(val);
      }
      combinedMask = combinedMask.or(classMask);
    });
    var vizParams = {min: 0, max: 1, palette: ['white', 'orange']};
    var displayImage = combinedMask.selfMask();
    loadedImage = displayImage;

    activeMaps.forEach(function(m) {
      m.addLayer(displayImage, vizParams, 'Land Degradation');

      var colorBox = ui.Label({
        style: {
          backgroundColor: 'orange',
          padding: '8px',
          margin: '0 4px 0 0'
        }
      });
      var description = ui.Label({value: 'Selected Degraded Land', style: {margin: '0'}});
      var row = ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.flow('horizontal')
      });

      if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
    });
  };

  loadButton.onClick(loadSelectedLDD);
  clearButton.onClick(clearMap);

  return panel;
};

exports.getLddAtPoint = function(point) {

  var ldd_image = ee.Image("projects/ee-apoorvadewan13/assets/ldd1516");
  return ldd_image.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30,
    bestEffort: true
  }).map(function(k, v) { return ee.Number(v); });
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
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];
  checkboxes.forEach(function(cb, idx) {
    if (cb.getValue()) selectedNames.push(lddClasses[idx].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames; 
};



exports.setValues = function(ruleArray) {
  if (!ruleArray || !Array.isArray(ruleArray)) return;

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  for (var i = 0; i < ruleArray.length; i++) {
    var ruleName = ruleArray[i];

    for (var j = 0; j < lddClasses.length; j++) {
      if (lddClasses[j].name === ruleName) {
        if (checkboxes[j]) {
          checkboxes[j].setValue(true);
        }
        break;
      }
    }
  }
};


exports.applyFromJSON = function() {
  if (!roi_boundary) {
    print('LDD: ROI not set');
    return;
  }

  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedValues.push(lddClasses[index].value);
    }
  });

  if (selectedValues.length === 0) {
    print('LDD: No degradation classes selected');
    return;
  }

  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() &&
          layer.getName().indexOf('Land Degradation') === 0) {
        m.remove(layer);
      }
    });
  });

  lddUtils.layers = [];
  loadedImage = null;

  var ldd_image = ee.Image(
    'projects/ee-apoorvadewan13/assets/ldd1516'
  ).clip(roi_boundary).unmask(0);

  var combinedMask = ee.Image(0);

  selectedValues.forEach(function(val) {
    var classMask;
    if (val === 0) {
      var validDeg = ldd_image.gt(0).and(ldd_image.lte(35));
      classMask = validDeg.not();
    } else {
      classMask = ldd_image.eq(val);
    }
    combinedMask = combinedMask.or(classMask);
  });

  var displayImage = combinedMask.selfMask();
  loadedImage = displayImage;

  var vizParams = {
    min: 0,
    max: 1,
    palette: ['white', 'orange']
  };

  activeMaps.forEach(function(m) {
    m.addLayer(displayImage, vizParams, 'Land Degradation');
  });

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};
