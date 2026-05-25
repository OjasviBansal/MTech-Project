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
  var safeYear = Math.min(year, 2022);
  if (safeYear === 1985) return five_year.select('b1').rename('lulc').toInt();
  if (safeYear === 1990) return five_year.select('b2').rename('lulc').toInt();
  if (safeYear === 1995) return five_year.select('b3').rename('lulc').toInt();
  if (safeYear >= 2000 && safeYear <= 2022) {
    var band_index = 'b' + (safeYear - 1999);
    return annual.select([band_index]).rename('lulc').toInt();
  }
  throw new Error('Year not available: ' + safeYear);
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
  return transition_mask.selfMask();
}

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

exports.getPanel = function() {
  var panel = ui.Panel();
  panel.add(ui.Label({
    value: 'Change Detection (GLC-FCS30D)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));
  panel.add(ui.Label({
    value: 'Select classes that may help characterize the area during the base year. ',
    style: {'fontSize': '14px'}
  }));

  var keys = Object.keys(lulc_mapping);

  var startLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  
  keys.forEach(function(k) {
    var cb = ui.Checkbox({label: k, value: false});
    startChecks[k] = cb;
    startLayerPanel.add(cb);
    cb.onChange(function() {
      selectedStart = keys.filter(function(key){ return startChecks[key].getValue(); });
    });
  });
  panel.add(startLayerPanel);

  var endLayerPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  
  keys.forEach(function(k) {
    var cb = ui.Checkbox({label: k, value: false});
    endChecks[k] = cb;
    endLayerPanel.add(cb);
    cb.onChange(function() {
      selectedEnd = keys.filter(function(key){ return endChecks[key].getValue(); });
    });
  });
  panel.add(ui.Label('Select classes that may help characterize the area during the restoration start year. '));
  panel.add(endLayerPanel);

  var runBtn = ui.Button('Load change detection');
  var clearBtn = ui.Button('Clear Map');
  panel.add(ui.Panel([runBtn, clearBtn], ui.Panel.Layout.flow('horizontal')));

  function clearPreview() {
    if (!activeMaps.length) return;
    var m = activeMaps[0];
    var layersList = m.layers();
    for (var i = layersList.length() - 1; i >= 0; i--) {
      var lyr = layersList.get(i);
      if (lyr.getName() === 'Change (validation)') {
        layersList.remove(lyr);
      }
    }
  }

  runBtn.onClick(function() {
    if (!roi_boundary) { print('Set ROI from main panel first.'); return; }
    if (!years.validation.start || !years.validation.end) { print('Validation years not set.'); return; }
    if (selectedStart.length === 0 || selectedEnd.length === 0) { print('Select at least one Start and End class.'); return; }
    if (activeMaps.length === 0) { print('No map registered.'); return; }

    clearPreview();
    var trainImg = exports.getTrainingImage();
    if (!trainImg) return;

    var vis = {palette: ['black', 'red'], min: 0, max: 1};
    var mTrain = activeMaps[0];
    var layerTrain = mTrain.addLayer(trainImg, vis, 'Change (validation)');
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

  var vis = {palette: ['black', 'red'], min: 0, max: 1};
  var layerInf = mapInstance.addLayer(infImg, vis, 'Change (test)');
   if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
  return layerInf;
};

exports.setKeepMarkerOnTop = function(fn) {
    keepRestorationMarkerOnTopFn = fn;
  };
  
exports.getRule = function(mode) {
  if (!selectedStart || !selectedEnd || selectedStart.length === 0 && selectedEnd.length === 0) {
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
    if (startChecks[cls]) {
      startChecks[cls].setValue(true);
      selectedStart.push(cls);
    }
  }

  selectedEnd = [];
  for (var j = 0; j < to.length; j++) {
    var cls2 = to[j];
    if (endChecks[cls2]) {
      endChecks[cls2].setValue(true);
      selectedEnd.push(cls2);
    }
  }
};

exports.applyFromJSON = function(trainingMap, inferenceMap) {
  if (!roi_boundary) return;
  if (!selectedStart.length || !selectedEnd.length) return;

  var vis = { palette: ['black', 'red'], min: 0, max: 1 };

  // ---------- TRAINING ----------
  if (trainingMap &&
      years.validation.start &&
      years.validation.end) {

    if (trainingLayer) {
      trainingMap.layers().remove(trainingLayer);
      trainingLayer = null;
    }

    var trainImg = exports.getTrainingImage();
    if (trainImg) {
      trainingLayer = trainingMap.addLayer(
        trainImg,
        vis,
        'Change (validation)'
      );
      loadedImage = trainImg;
    }
  }

  // ---------- INFERENCE ----------
  if (inferenceMap &&
      years.test.start &&
      years.test.end) {

    if (inferenceLayer) {
      inferenceMap.layers().remove(inferenceLayer);
      inferenceLayer = null;
    }

    var infImg = exports.getInferenceImage();
    if (infImg) {
      inferenceLayer = inferenceMap.addLayer(
        infImg,
        vis,
        'Change (test)'
      );
    }
  }

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};
