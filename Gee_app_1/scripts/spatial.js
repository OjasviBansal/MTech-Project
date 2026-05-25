var roi_boundary = null;
var loadedImage = null;
var selectedYear = null;
var mapInstance = null;
var keepRestorationMarkerOnTopFn = null;

var alertLabel = ui.Label({
  value: '',
  style: {color: 'red', fontWeight: 'bold', margin: '4px 0 0 0'}
});

var checkboxes = {}; 

var rasterBasePath = 'projects/ee-ojasvibansal/assets/spatial_cluster_raster/spatial_raster_';

var spatialClasses = [
  { name: 'Agricultural-residential areas', id: 1 },
  { name: 'Mostly Forests', id: 2 },
  { name: 'Mostly Scrublands', id: 3 },
  { name: 'Himalayan areas', id: 4 },
  { name: 'Intensive croplands', id: 5 },
  { name: 'Riverine & coastal system', id: 6 },
  { name: 'Mostly Wetland areas', id: 7 },
  { name: 'Bare and Shrub areas', id: 8 }
];

var spatialUtils = { 
  layer: null,
  legends: []
};

exports.setROI = function(roi, map, year) {
  roi_boundary = roi;
  mapInstance = map;  
  selectedYear = year;    
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.setYears = function(currentYear) {
  if (typeof currentYear !== 'number') {
    throw new Error('Spatial asset calculation target year must be a number');
  }
  selectedYear = currentYear;
};

exports.getLoadedImage = function() {
  return loadedImage; 
};

exports.getPanel = function() {
  var panel = ui.Panel();

  panel.add(ui.Label('Spatial Cluster Assets', {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '15px 0 5px 10px'
  }));

  panel.add(ui.Label('Select class profiles to mask matching environmental ecosystem targets.', {
    fontSize: '14px'
  }));

  var checkboxPanel = ui.Panel({ 
    layout: ui.Panel.Layout.flow('vertical'), 
    style: { margin: '5px 10px' } 
  });
  panel.add(checkboxPanel);
  panel.add(alertLabel);

  spatialClasses.forEach(function(item) {
    var cb = ui.Checkbox(item.name, false);
    checkboxes[item.name] = cb;
    checkboxPanel.add(cb);
  });

  var buttonPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { margin: '10px 0', padding: '0 10px' }
  });

  var loadButton = ui.Button({ label: 'Load', style: { margin: '5px 5px 5px 0', height: '30px' } });
  var clearButton = ui.Button({ label: 'Clear Map', style: { margin: '5px 0 5px 0', height: '30px' } });
  buttonPanel.add(loadButton).add(clearButton);
  panel.add(buttonPanel);

  var clearMap = function() {
    if (!mapInstance) return;
    
    if (spatialUtils.layer) { 
      mapInstance.layers().remove(spatialUtils.layer); 
      spatialUtils.layer = null; 
    }
    loadedImage = null;
  };

  var loadSpatial = function() {
    alertLabel.setValue('');
    if (!selectedYear) {
      alertLabel.setValue('Target timeline calculation year not initialized from step controls.');
      return;
    }
  
    if (!mapInstance) {
      print('️ Spatial: mapInstance target reference missing.');
      return;
    }
    
    clearMap();
    
    var targetYear = selectedYear;
    if (targetYear >= 2023) {
      print(' Target year clamped down to maximum available spatial asset layer (2022).');
      targetYear = 2022;
    } else if (targetYear < 2000) {
      print('️ Target year clamped up to earliest available spatial asset layer (2000).');
      targetYear = 2000;
    }

    var img = ee.Image(rasterBasePath + targetYear);
    if (roi_boundary) { 
      img = img.clip(roi_boundary); 
    }

    var maskList = [];
    spatialClasses.forEach(function(item) {
      if (checkboxes[item.name].getValue()) {
        maskList.push(img.eq(item.id));
      }
    });

    if (maskList.length === 0) return;

    var finalMask = ee.ImageCollection(maskList).max();
    loadedImage = finalMask;

    spatialUtils.layer = mapInstance.addLayer(
      finalMask.selfMask(), 
      { palette: ['#9c27b0'], min: 0, max: 1 }, 
      'Spatial'
    );

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadSpatial);
  clearButton.onClick(clearMap);

  return panel;
};


function removeLegend() {
  if (!mapInstance) return;
  spatialUtils.legends.forEach(function(legend) {
    mapInstance.widgets().remove(legend);
  });
  spatialUtils.legends = [];
}

exports.clearMap = function() {
  if (mapInstance && spatialUtils.layer) {
    mapInstance.layers().remove(spatialUtils.layer);
    spatialUtils.layer = null;
  }
  loadedImage = null;
  alertLabel.setValue('');
};

exports.getRule = function() {
  if (!roi_boundary) return null;

  var selected = [];
  Object.keys(checkboxes).forEach(function(name) {
    var cb = checkboxes[name];
    if (cb && cb.getValue()) {
      selected.push(name);
    }
  });

  if (selected.length === 0) return null;
  return selected; 
};


exports.setValues = function(spatialRules, map) {
  var mapToUse = map || mapInstance;
  
  if (!spatialRules || !spatialRules.length) return;

  if (!mapInstance) {
    print(' Spatial module: mapInstance missing workspace reference link context.');
    return;
  }

  if (!selectedYear) {
    print(' Spatial module: selectedYear context timeline property not set.');
    return;
  }

  Object.keys(checkboxes).forEach(function(name) {
    checkboxes[name].setValue(false);
  });

  spatialRules.forEach(function(nameOrId) {
    if (checkboxes[nameOrId]) {
      checkboxes[nameOrId].setValue(true);
    } else {
      spatialClasses.forEach(function(item) {
        if (item.id === nameOrId || item.id === parseInt(nameOrId)) {
          checkboxes[item.name].setValue(true);
        }
      });
    }
  });

  if (spatialUtils.layer) {
    mapInstance.layers().remove(spatialUtils.layer);
    spatialUtils.layer = null;
  }

  var targetYear = selectedYear;
  if (targetYear >= 2023) {
    targetYear = 2022;
  } else if (targetYear < 2000) {
    targetYear = 2000;
  }

  var img = ee.Image(rasterBasePath + targetYear);
  if (roi_boundary) {
    img = img.clip(roi_boundary);
  }

  var maskList = [];
  spatialClasses.forEach(function(item) {
    if (checkboxes[item.name].getValue()) {
      maskList.push(img.eq(item.id));
    }
  });

  if (maskList.length === 0) return;

  var finalMask = ee.ImageCollection(maskList).max().selfMask();
  loadedImage = finalMask;

  if (spatialUtils.layer) {
    mapToUse.layers().remove(spatialUtils.layer);
    spatialUtils.layer = null;
  }
  
  spatialUtils.layer = mapToUse.addLayer(
    finalMask,
    { palette: ['#9c27b0'], min: 0, max: 1 },
    'Spatial'
  );

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};