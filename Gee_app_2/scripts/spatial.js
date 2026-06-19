// =====================================================
// SPATIAL CLUSTER RASTER MODULE (TEMPORAL VERSION)
// =====================================================

var roi_boundary = null;
var activeMaps = [];
var keepRestorationMarkerOnTopFn = null;

var alertLabel = ui.Label({
  value: '',
  style: {color: 'red', fontWeight: 'bold', margin: '4px 0 0 0'}
});


var startChecks = {};
var endChecks = {};
var selectedStart = [];
var selectedEnd = [];
var layers = [];


var rasterBasePath = 'projects/ee-ojasvibansal/assets/spatial_clusters_cosine_raster/spatial_raster_';

var years = { 
  validation: { start: null, end: null }, 
  test: { start: null, end: null } 
};


var spatialClasses = [
  { name: 'Mostly trees', id: 0 },
  { name: 'Intensive croplands', id: 1 },
  { name: 'Mostly Shrublands', id: 2 },
  { name: 'Himalayan areas', id: 3 },
  { name: 'Mostly Wetland and riverine areas', id: 4 },
  { name: 'Agricultural and residential areas', id: 5 },
  { name: 'Crops and trees', id: 6 },
  { name: 'Bare and shrub areas', id: 7 },
  { name: 'Crops and shrubs', id: 8 },
  { name: 'Trees and shrubs', id: 9 }
];


function isMap(m) { return m && typeof m.addLayer === 'function' && typeof m.layers === 'function'; }

function initializeCheckboxes() {
  spatialClasses.forEach(function(item) {
    var name = item.name;
    
    startChecks[name] = ui.Checkbox({label: name, value: false});
    startChecks[name].onChange(function() {
      selectedStart = spatialClasses
        .filter(function(c) { return startChecks[c.name].getValue(); })
        .map(function(c) { return c.id; });
    });
    
    endChecks[name] = ui.Checkbox({label: name, value: false});
    endChecks[name].onChange(function() {
      selectedEnd = spatialClasses
        .filter(function(c) { return endChecks[c.name].getValue(); })
        .map(function(c) { return c.id; });
    });
  });
}

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (isMap(mapInstance) && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.setYears = function(startYear, endYear, mode) {
  if (typeof startYear !== 'number' || typeof endYear !== 'number') {
    throw new Error('Start and end years must be numeric values.');
  }
  if (mode !== 'validation' && mode !== 'test') {
    throw new Error('Mode configuration must be "validation" or "test".');
  }
  years[mode].start = startYear;
  years[mode].end = endYear;
};

function computeTransition(startYear, endYear, startIds, endIds, roi) {
  if (startYear >= 2023) startYear = 2022;
  if (endYear >= 2023) endYear = 2022;
  
  if (startYear < 2000) startYear = 2000;
  if (endYear < 2000) endYear = 2000;

  var startImg = ee.Image(rasterBasePath + startYear).clip(roi);
  var endImg = ee.Image(rasterBasePath + endYear).clip(roi);

  var startMask = ee.Image(0);
  startIds.forEach(function(id) {
    startMask = startMask.or(startImg.eq(id));
  });

  var endMask = ee.Image(0);
  endIds.forEach(function(id) {
    endMask = endMask.or(endImg.eq(id));
  });

  var transitionMask = startMask.and(endMask);
  return transitionMask.selfMask();
}

exports.getTrainingImage = function() {
  if (!roi_boundary || !years.validation.start || !years.validation.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeTransition(years.validation.start, years.validation.end, selectedStart, selectedEnd, roi_boundary);
};

exports.getInferenceImage = function() {
  if (!roi_boundary || !years.test.start || !years.test.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeTransition(years.test.start, years.test.end, selectedStart, selectedEnd, roi_boundary);
};

exports.getLoadedImage = function(mode) {
  if (mode === 'validation') return exports.getTrainingImage();
  return exports.getInferenceImage();
};

exports.getPanel = function(mode) {
  if (!mode) mode = 'test';
  
  if (Object.keys(startChecks).length === 0) {
    initializeCheckboxes();
  }
  
  var panel = ui.Panel();

  panel.add(ui.Label('Spatial Cluster Changes', {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '15px 0 5px 10px'
  }));

  panel.add(ui.Label('Select class profiles characterizing the pre-degradation state:', {
    fontSize: '14px', fontWeight: 'bold'
  }));
  var startLayerPanel = ui.Panel({ style: { margin: '5px 10px' } });
  spatialClasses.forEach(function(item) {
    startLayerPanel.add(startChecks[item.name]);
  });
  panel.add(startLayerPanel);

  panel.add(ui.Label('Select class profiles characterizing the restoration state:', {
    fontSize: '14px', fontWeight: 'bold', margin: '10px 0 5px 10px'
  }));
  var endLayerPanel = ui.Panel({ style: { margin: '5px 10px' } });
  spatialClasses.forEach(function(item) {
    endLayerPanel.add(endChecks[item.name]);
  });
  panel.add(endLayerPanel);
  panel.add(alertLabel);

  var buttonPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { margin: '10px 0', padding: '0 10px' }
  });

  var runButton = ui.Button('Load Spatial Transitions');
  var clearButton = ui.Button('Clear Map');
  buttonPanel.add(runButton).add(clearButton);
  panel.add(buttonPanel);

  runButton.onClick(function() {
    alertLabel.setValue('');
    if (!roi_boundary) {
      ui.alert('Error', 'Please set a region location profile first.');
      return;
    }

    var selectedPeriod = (mode === 'validation') ? years.validation : years.test;
    if (!selectedPeriod.start || !selectedPeriod.end) {
      alertLabel.setValue('Target timeline window not initialized.');
      return;
    }

    if (selectedStart.length === 0 || selectedEnd.length === 0) {
      alertLabel.setValue('Select at least one Baseline and Target class profile.');
      return;
    }

    var spatialLayer = (mode === 'validation') ? exports.getTrainingImage() : exports.getInferenceImage();
    if (!spatialLayer) {
      alertLabel.setValue('No spatial change metrics found.');
      return;
    }

    exports.clearPreview(); 
    
    activeMaps.forEach(function(m) {
      if (!isMap(m)) return;
      
      var vis = { palette: ['#9c27b0'], min: 0, max: 1 };
      var layer = m.addLayer(spatialLayer, vis, 'Spatial');
      layers.push({ map: m, layer: layer });
    });

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });

  clearButton.onClick(exports.clearMap);

  return panel;
};

exports.setValues = function(spatialTransitionValues) {
  if (!Array.isArray(spatialTransitionValues) || spatialTransitionValues.length < 2) return;
  
  var startVals = spatialTransitionValues[0]; 
  var endVals = spatialTransitionValues[1]; 

  if (Object.keys(startChecks).length === 0) {
    initializeCheckboxes();
  }

  spatialClasses.forEach(function(item) {
    startChecks[item.name].setValue(false);
    endChecks[item.name].setValue(false);
  });

  if (Array.isArray(startVals)) {
    spatialClasses.forEach(function(item) {
      if (startVals.indexOf(item.id) !== -1 || startVals.indexOf(item.name) !== -1) {
        startChecks[item.name].setValue(true);
      }
    });
  }

  if (Array.isArray(endVals)) {
    spatialClasses.forEach(function(item) {
      if (endVals.indexOf(item.id) !== -1 || endVals.indexOf(item.name) !== -1) {
        endChecks[item.name].setValue(true);
      }
    });
  }

  selectedStart = spatialClasses.filter(function(c) { return startChecks[c.name].getValue(); }).map(function(c) { return c.id; });
  selectedEnd = spatialClasses.filter(function(c) { return endChecks[c.name].getValue(); }).map(function(c) { return c.id; });
};

exports.applyInferenceMap = function(mapInstance) {
  if (!roi_boundary || !selectedStart.length || !selectedEnd.length || !isMap(mapInstance)) return null;
  
  var infImg = exports.getInferenceImage();
  if (!infImg) return null;
  
  var vis = { palette: ['#9c27b0'], min: 0, max: 1 };
  var layerInf = mapInstance.addLayer(infImg, vis, 'Spatial');
  
  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
  
  return layerInf;
};


function clearPreview() {
  layers.forEach(function(ent) {
    if (isMap(ent.map)) ent.map.remove(ent.layer);
  });
  layers = [];
}

exports.clearPreview = clearPreview;

exports.clearMap = function() {
  clearPreview();
  
  selectedStart = [];
  selectedEnd = [];
  
  spatialClasses.forEach(function(item) {
    if (startChecks[item.name]) startChecks[item.name].setValue(false);
    if (endChecks[item.name]) endChecks[item.name].setValue(false);
  });
  
  alertLabel.setValue('');
};

exports.getRule = function(mode) {
  if (!selectedStart.length && !selectedEnd.length) return null;

  var fromNames = spatialClasses.filter(function(c) { return selectedStart.indexOf(c.id) !== -1; }).map(function(c) { return c.name; });
  var toNames = spatialClasses.filter(function(c) { return selectedEnd.indexOf(c.id) !== -1; }).map(function(c) { return c.name; });

  return {
    "from": fromNames,
    "to": toNames
  }; 
};
