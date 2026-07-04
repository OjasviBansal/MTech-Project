var roi_boundary = null;
var activeMaps = [];               
var loadedPreviewLayer = null;      
var layers = [];                    
var selectedStart = [];
var selectedEnd = [];
var keepRestorationMarkerOnTopFn = null;
var years = {
  validation: { start: null, end: null },
  test:       { start: null, end: null }
};
var loadedImage = null;

function isMap(m) { return m && typeof m.addLayer === 'function' && typeof m.layers === 'function'; }

var startChecks = {};
var endChecks = {};

var trainingLayer = null;
var inferenceLayer = null;

var rasterBasePath = 'projects/ee-ojasvibansal/assets/spatial_clusters_cosine_raster/spatial_raster_';

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

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (isMap(mapInstance) && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setYears = function(startYear, endYear, mode) {
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

function getImageForYear(year) {
  var safeYear = Math.min(year, 2022);
  if (safeYear < 2000) safeYear = 2000; 
  return ee.Image(rasterBasePath + safeYear);
}

function getLayerMask(image, classNames) {
  if (!Array.isArray(classNames)) classNames = [classNames];
  var masks = classNames.map(function(className) {
    var match = spatialClasses.filter(function(c) { return c.name === className; })[0];
    var cid = match ? match.id : -1;
    return image.eq(cid);
  });
  return ee.ImageCollection(masks).max();
}

function computeSpatialChange(startYear, endYear, startClasses, endClasses, roi) {
  var start_img = getImageForYear(startYear);
  var end_img = getImageForYear(endYear);
  var start_mask = getLayerMask(start_img, startClasses);
  var end_mask = getLayerMask(end_img, endClasses);
  var transition_mask = start_mask.and(end_mask);
  
  if (roi) {
    transition_mask = transition_mask.clip(roi);
  }
  return transition_mask.selfMask();
}

exports.getTrainingImage = function() {
  if (!roi_boundary || !years.validation.start || !years.validation.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeSpatialChange(years.validation.start, years.validation.end, selectedStart, selectedEnd, roi_boundary);
};

exports.getInferenceImage = function() {
  if (!roi_boundary || !years.test.start || !years.test.end ||
      selectedStart.length === 0 || selectedEnd.length === 0) return null;
  return computeSpatialChange(years.test.start, years.test.end, selectedStart, selectedEnd, roi_boundary);
};

exports.getPanel = function() {
  var panel = ui.Panel();
  panel.add(ui.Label({
    value: 'Spatial Clusters : Land-use distribution (Core Stack)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));
  panel.add(ui.Label({
    value: 'Select class profiles characterizing the pre-degradation state:',
    style: {'fontSize': '14px'}
  }));

  var startLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  spatialClasses.forEach(function(item) {
    var cb = ui.Checkbox({label: item.name, value: false});
    startChecks[item.name] = cb;
    startLayerPanel.add(cb);
    cb.onChange(function() {
      selectedStart = spatialClasses
        .map(function(c) { return c.name; })
        .filter(function(name){ return startChecks[name].getValue(); });
    });
  });
  panel.add(startLayerPanel);

  var endLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  spatialClasses.forEach(function(item) {
    var cb = ui.Checkbox({label: item.name, value: false});
    endChecks[item.name] = cb;
    endLayerPanel.add(cb);
    cb.onChange(function() {
      selectedEnd = spatialClasses
        .map(function(c) { return c.name; })
        .filter(function(name){ return endChecks[name].getValue(); });
    });
  });
  panel.add(ui.Label('Select class profiles characterizing the restoration state:'));
  panel.add(endLayerPanel);

  var runBtn = ui.Button('Load spatial assets');
  var clearBtn = ui.Button('Clear Map');
  panel.add(ui.Panel([runBtn, clearBtn], ui.Panel.Layout.flow('horizontal')));

  function clearPreview() {
    if (!activeMaps.length) return;
    var m = activeMaps[0];
    var layersList = m.layers();
    for (var i = layersList.length() - 1; i >= 0; i--) {
      var lyr = layersList.get(i);
      if (lyr.getName() === 'Spatial (validation)') {
        layersList.remove(lyr);
      }
    }
  }

  runBtn.onClick(function() {
    if (!roi_boundary) { print('Set ROI from main panel first.'); return; }
    if (!years.validation.start || !years.validation.end) { print('Validation years not set.'); return; }
    if (selectedStart.length === 0 || selectedEnd.length === 0) { print('Select at least one Start and End class profile.'); return; }
    if (activeMaps.length === 0) { print('No map registered.'); return; }

    clearPreview();
    var trainImg = exports.getTrainingImage();
    if (!trainImg) return;

    var vis = {palette: ['#9c27b0'], min: 0, max: 1};
    var mTrain = activeMaps[0];
    var layerTrain = mTrain.addLayer(trainImg, vis, 'Spatial (validation)');
    layers.push({map: mTrain, layer: layerTrain});
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });

  clearBtn.onClick(clearPreview);
  return panel;
};

exports.applyInferenceMap = function(mapInstance) {
  if (!roi_boundary || !selectedStart.length || !selectedEnd.length) return null;
  var infImg = exports.getInferenceImage();
  if (!infImg) return null;

  var vis = {palette: ['#9c27b0'], min: 0, max: 1};
  var layerInf = mapInstance.addLayer(infImg, vis, 'Spatial (test)');
  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
  return layerInf;
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.getRule = function(mode) {
  if (!selectedStart || !selectedEnd || (selectedStart.length === 0 && selectedEnd.length === 0)) {
    return null; 
  }
  return {
    "from": selectedStart,
    "to": selectedEnd
  };
};

exports.setValues = function(ruleObj) {
  if (!ruleObj || typeof ruleObj !== 'object') return;

  var from = ruleObj.from || [];
  var to   = ruleObj.to   || [];

  Object.keys(startChecks).forEach(function(k) {
    startChecks[k].setValue(false);
  });
  Object.keys(endChecks).forEach(function(k) {
    endChecks[k].setValue(false);
  });

  selectedStart = [];
  for (var i = 0; i < from.length; i++) {
    var cls = from[i];
    var matchedName = null;
    if (startChecks[cls]) {
      matchedName = cls;
    } else {
      var match = spatialClasses.filter(function(c) { return c.id === cls || c.id === parseInt(cls); })[0];
      if (match) matchedName = match.name;
    }

    if (matchedName && startChecks[matchedName]) {
      startChecks[matchedName].setValue(true);
      if (selectedStart.indexOf(matchedName) === -1) {
        selectedStart.push(matchedName);
      }
    }
  }

  selectedEnd = [];
  for (var j = 0; j < to.length; j++) {
    var cls2 = to[j];
    var matchedName2 = null;
    if (endChecks[cls2]) {
      matchedName2 = cls2;
    } else {
      var match2 = spatialClasses.filter(function(c) { return c.id === cls2 || c.id === parseInt(cls2); })[0];
      if (match2) matchedName2 = match2.name;
    }

    if (matchedName2 && endChecks[matchedName2]) {
      endChecks[matchedName2].setValue(true);
      if (selectedEnd.indexOf(matchedName2) === -1) {
        selectedEnd.push(matchedName2);
      }
    }
  }
};

exports.applyFromJSON = function(trainingMap, inferenceMap) {
  if (!roi_boundary) return;
  if (!selectedStart.length || !selectedEnd.length) return;

  var vis = { palette: ['#9c27b0'], min: 0, max: 1 };

  if (trainingMap && years.validation.start && years.validation.end) {
    if (trainingLayer) {
      trainingMap.layers().remove(trainingLayer);
      trainingLayer = null;
    }

    var trainImg = exports.getTrainingImage();
    if (trainImg) {
      trainingLayer = trainingMap.addLayer(
        trainImg,
        vis,
        'Spatial (validation)'
      );
      loadedImage = trainImg;
    }
  }

  if (inferenceMap && years.test.start && years.test.end) {
    if (inferenceLayer) {
      inferenceMap.layers().remove(inferenceLayer);
      inferenceLayer = null;
    }

    var infImg = exports.getInferenceImage();
    if (infImg) {
      inferenceLayer = inferenceMap.addLayer(
        infImg,
        vis,
        'Spatial (test)'
      );
    }
  }

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};
