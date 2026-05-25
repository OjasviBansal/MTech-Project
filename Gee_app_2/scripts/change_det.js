// ==================== GLOBALS ====================
var roi_boundary = null;
var activeMaps = []; // only ui.Map instances
var loadedPreviewLayer = null; // last preview layer (training)
var legends = []; // [{map, legend}]
var layers = []; // layers added for preview
var selectedStart = [];
var selectedEnd = [];
var years = {
  validation: { start: null, end: null },
  test: { start: null, end: null }
};
var startChecks = {}; // module-level
var endChecks = {}; // module-level

var keepRestorationMarkerOnTopFn = null;

function isMap(m) { return m && typeof m.addLayer === 'function' && typeof m.layers === 'function'; }

// Initialize checkboxes
function initializeCheckboxes() {
  var keys = Object.keys(lulc_mapping);
  keys.forEach(function(k) {
    startChecks[k] = ui.Checkbox({label: k, value: false});
    startChecks[k].onChange(function() {
      selectedStart = keys.filter(function(key) { return startChecks[key].getValue(); });
    });
    endChecks[k] = ui.Checkbox({label: k, value: false});
    endChecks[k].onChange(function() {
      selectedEnd = keys.filter(function(key) { return endChecks[key].getValue(); });
    });
  });
}

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// ==================== ROI / REGISTRATION ====================
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (isMap(mapInstance) && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

// ==================== PUBLIC: set years ====================
exports.setYears = function(startYear, endYear, mode) {
  // mode = 'validation' (Step 3) or 'test' (Step 6)
  if (typeof startYear !== 'number' || typeof endYear !== 'number') {
    throw new Error('Years must be numbers');
  }
  if (mode === 'validation') {
    years.validation.start = startYear;
    years.validation.end = endYear;
  } else if (mode === 'test') {
    years.test.start = startYear;
    years.test.end = endYear;
  } else {
    throw new Error('Mode must be "validation" or "test".');
  }
};

// ==================== LULC mapping & datasets ====================
var lulc_mapping = {
  "croplands":[10,11,12,20],"trees":[51,52,61,62,71,72,81,82,91,92,101,102,111,112],
  "shrubs_scrubs":[120,121,122,130,140],"grasslands":[150,160,170],
  "wetlands":[180,190,200,210,220,230],"mangroves":[240],"builtup":[250],
  "barren":[260,261,262],"water":[270,280]
};
var five_year_dataset = ee.ImageCollection('projects/sat-io/open-datasets/GLC-FCS30D/five-years-map');
var five_year = five_year_dataset.mosaic().toInt();
var annual = ee.ImageCollection('projects/sat-io/open-datasets/GLC-FCS30D/annual').mosaic().toInt();
function getImageForYear(year) {
  if (year > 2022) {
    year = 2022;
  }
  if (year === 1985) return five_year.select('b1').rename('lulc').toInt();
  if (year === 1990) return five_year.select('b2').rename('lulc').toInt();
  if (year === 1995) return five_year.select('b3').rename('lulc').toInt();
  if (year >= 2000 && year <= 2022) {
    var band_index = 'b' + (year - 1999);
    return annual.select([band_index]).rename('lulc').toInt();
  }
  throw new Error('Year not available: ' + year);
}
function getLayerMask(image, layerNames) {
  if (!Array.isArray(layerNames)) layerNames = [layerNames];
  var masks = layerNames.map(function(layerName) {
    var class_ids = lulc_mapping[layerName] || [];
    var layerMasks = class_ids.map(function(cid) { return image.eq(cid); });
    return ee.ImageCollection(layerMasks).max();
  });
  return ee.ImageCollection(masks).max();
}
function computeChange(startYear, endYear, startClasses, endClasses, roi) {
  var start_img = getImageForYear(startYear);
  var end_img = getImageForYear(endYear);
  var start_mask = getLayerMask(start_img, startClasses);
  var end_mask = getLayerMask(end_img, endClasses);
  var transition_mask = start_mask.and(end_mask).clip(roi);
  // return transition_mask.unmask(0);
  return transition_mask.selfMask();
}

// ==================== PUBLIC: training & inference images ====================
exports.getTrainingImage = function() {
  if (!roi_boundary || !years.validation.start || !years.validation.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeChange(years.validation.start, years.validation.end, selectedStart, selectedEnd, roi_boundary);
};
exports.getInferenceImage = function() {
  if (!roi_boundary || !years.test.start || !years.test.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeChange(years.test.start, years.test.end, selectedStart, selectedEnd, roi_boundary);
};

// ==================== UI: panel with checkboxes & preview ====================
exports.getPanel = function() {
  if (Object.keys(startChecks).length === 0) {
    initializeCheckboxes(); // Ensure checkboxes are initialized only once
  }
  var panel = ui.Panel();
  panel.add(ui.Label({
    value: 'Change Detection (GLC-FCS30D)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));
  panel.add(ui.Label({
    value: 'Select classes that may help characterize the area during the pre-degradation year. ',
    style: {'fontSize': '14px'}
  }));
  var startLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  Object.keys(startChecks).forEach(function(k) {
    startLayerPanel.add(startChecks[k]);
  });
  panel.add(startLayerPanel);
  // End Layer checkboxes
  var endLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  panel.add(ui.Label('Select classes that may help characterize the area during the restoration initiation year. '));
  Object.keys(endChecks).forEach(function(k) {
    endLayerPanel.add(endChecks[k]);
  });
  panel.add(endLayerPanel);
  // Buttons
  var runBtn = ui.Button('Load change detection');
  var clearBtn = ui.Button('Clear Map');
  panel.add(ui.Panel([runBtn, clearBtn], ui.Panel.Layout.flow('horizontal')));
  function clearPreview() {
    layers.forEach(function(ent) { if (isMap(ent.map)) ent.map.remove(ent.layer); });
    legends.forEach(function(ent) { if (isMap(ent.map)) ent.map.remove(ent.legend); });
    layers = [];
    legends = [];
    loadedPreviewLayer = null;
  }
  
  runBtn.onClick(function () {
    if (!roi_boundary) { print('Set ROI from main panel first.'); return; }
    if (!years.validation.start || !years.validation.end) { print('Validation years not set.'); return; }
    if (selectedStart.length === 0 || selectedEnd.length === 0) { 
      print('Select at least one Start and End class.'); 
      return; 
    }
    if (activeMaps.length === 0) { print('No map registered.'); return; }
  
    var m = activeMaps[0];
  
    // REMOVE OLD Change Detection layers (important)
    var mapLayers = m.layers();
    for (var i = mapLayers.length() - 1; i >= 0; i--) {
      if (mapLayers.get(i).getName() === 'Change Detection') {
        mapLayers.remove(mapLayers.get(i));
      }
    }
  
    // Recompute training image
    var trainImg = exports.getTrainingImage();
    if (!trainImg) return;
  
    // Add exactly ONE preview layer
    var vis = { palette: ['red'], min: 0, max: 1 };
    var layer = m.addLayer(trainImg, vis, 'Change Detection');
  
    // Track for clearing later
    layers = [{ map: m, layer: layer }];
    loadedPreviewLayer = trainImg;
    
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  
    print('Change Detection preview updated');
  });

  clearBtn.onClick(clearPreview);
  return panel;
};

// ---- External helper for Step 8 (after LULC + rules applied) ----
exports.applyInferenceMap = function(mapInstance) {
  if (!roi_boundary || !selectedStart.length || !selectedEnd.length) return null;
  var infImg = exports.getInferenceImage();
  if (!infImg) return null;
  var vis = {palette: ['black', 'red'], min: 0, max: 1};
  var layerInf = mapInstance.addLayer(infImg, vis, 'Change (test)');
  var legendInf = ui.Panel({style: {position: 'bottom-right', padding: '8px 15px', backgroundColor: 'white'}});
  legendInf.add(ui.Label('Change Detection (Test)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0'}));
  var rowInf = ui.Panel({
    widgets: [
      ui.Label({style:{backgroundColor: 'red', padding:'8px', margin:'0 0 4px 0', border:'1px solid black'}}),
      ui.Label({value:'Changed pixels', style:{margin:'0 0 4px 6px'}})
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  });
  legendInf.add(rowInf);
  
  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
  
  // mapInstance.add(legendInf);
  return layerInf;
};

// ==================== Set values programmatically ====================
exports.setValues = function(changeDetectionValues) {
  print("setValues function is running");
  if (!Array.isArray(changeDetectionValues)) return;
  if (changeDetectionValues.length < 2) return;
  var startVals = changeDetectionValues[0]; // previous classes
  var endVals = changeDetectionValues[1]; // next classes
  print("startVals:", startVals);
  print("endVals:", endVals);
  var keys = Object.keys(lulc_mapping);
  // Clear all checkboxes first
  keys.forEach(function(k) {
    if (startChecks && startChecks[k]) startChecks[k].setValue(false);
    if (endChecks && endChecks[k]) endChecks[k].setValue(false);
  });
  // Tick start layer checkboxes
  if (Array.isArray(startVals)) {
    startVals.forEach(function(idx) {
      var key = keys[idx - 1]; // 1-based input
      if (key && startChecks[key]) startChecks[key].setValue(true);
    });
    selectedStart = keys.filter(function(key) { return startChecks[key].getValue(); });
  }
  // Tick end layer checkboxes
  if (Array.isArray(endVals)) {
    endVals.forEach(function(idx) {
      var key = keys[idx - 1]; // 1-based input
      if (key && endChecks[key]) endChecks[key].setValue(true);
    });
    selectedEnd = keys.filter(function(key) { return endChecks[key].getValue(); });
  }
  print("Change Detection checkboxes updated for start:", selectedStart, "end:", selectedEnd);
};

// ------------------- Clear Map Function -------------------
function clearMap() {
  // Remove all change detection layers
  layers.forEach(function(ent) {
    if (isMap(ent.map)) ent.map.remove(ent.layer);
  });
  layers = [];
  loadedPreviewLayer = null;

  // Remove all legends
  legends.forEach(function(ent) {
    if (isMap(ent.map)) ent.map.remove(ent.legend);
  });
  legends = [];

  // Reset selected state
  selectedStart = [];
  selectedEnd = [];

  // Optionally clear checkboxes (so that UI resets too)
  Object.keys(startChecks).forEach(function(k) {
    if (startChecks[k]) startChecks[k].setValue(false);
  });
  Object.keys(endChecks).forEach(function(k) {
    if (endChecks[k]) endChecks[k].setValue(false);
  });
}

// ------------------- Clear all preview layers + legends -------------------
function clearPreview() {
  layers.forEach(function(ent) {
    if (isMap(ent.map)) ent.map.remove(ent.layer);
  });
  layers = [];
  loadedPreviewLayer = null;

  // Remove legends using the new function
  removeLegend();
}

// ------------------- Export Functions -------------------
exports.clearMap = clearMap;

// Keep existing exports
exports.clearPreview = clearMap; // alias for backward compatibility

exports.getRule = function(mode) {
  // Check if any classes are selected
  if (!selectedStart || !selectedEnd || selectedStart.length === 0 && selectedEnd.length === 0) {
    return null; // nothing selected
  }

  return {
      "from": selectedStart,
      "to": selectedEnd
  };
};

