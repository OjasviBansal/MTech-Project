// =====================================================
// SPATIAL CLUSTER RASTER MODULE
// =====================================================

var roi_boundary = null;
var loadedImage = null;
var activeMaps = [];
var keepRestorationMarkerOnTopFn = null;

var alertLabel = ui.Label({
  value: '',
  style: {color: 'red', fontWeight: 'bold', margin: '4px 0 0 0'}
});

var checkboxes = [];

// Base raster path configuration
var rasterBasePath = 'projects/ee-ojasvibansal/assets/spatial_cluster_raster/spatial_raster_';

var years = { 
  validation: { start: null, end: null }, 
  test: { start: null, end: null } 
};

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
  legends: []
};

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// Synchronized workflow hooks from Master script
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

exports.getLoadedImage = function(mode) {
  if (!roi_boundary) return null;
  
  // Default fallback sequence if global master context is omitted
  if (mode !== 'validation' && mode !== 'test') {
    mode = 'test'; 
  }

  var selectedPeriod = years[mode];
  if (!selectedPeriod.start || !selectedPeriod.end) return null;

  // Extract activated target IDs
  var selectedIds = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedIds.push(spatialClasses[index].id);
    }
  });

  if (selectedIds.length === 0) return null;

  // Target ONLY the start year directly
  var targetYear = selectedPeriod.end;
  
  if (targetYear >= 2023) {
    print('Spatial layer target year (' + targetYear + ') is >= 2023. Automatically defaulting to 2022 asset.');
    targetYear = 2022;
  }

  // Fetch the single target year image directly—no collection or .max() reduction needed!
  var spatialComposite = ee.Image(rasterBasePath + targetYear).clip(roi_boundary);
  
  // Generate conditional visibility mask matching the selected IDs
  var binaryMask = ee.Image(0);
  selectedIds.forEach(function(id) {
    binaryMask = binaryMask.or(spatialComposite.eq(id));
  });

  return binaryMask.selfMask();
};

exports.setValues = function(values) {
  if (!Array.isArray(values)) return;

  // Uncheck all active boxes
  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  // Toggle active selections matching by Name or ID
  spatialClasses.forEach(function(item, index) {
    if (values.indexOf(item.id) !== -1 || values.indexOf(item.name) !== -1) {
      checkboxes[index].setValue(true);
    }
  });
};

exports.getPanel = function(mode) {
  if (!mode) mode = 'test'; // Match inference step defaults
  
  var panel = ui.Panel();

  panel.add(ui.Label('Spatial Cluster Assets', {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '15px 0 5px 10px'
  }));

  panel.add(ui.Label('Select class profiles to mask matching environmental ecosystem targets.', {
    fontSize: '14px'
  }));

  var checkboxPanel = ui.Panel({ style: { margin: '5px 10px' } });
  panel.add(checkboxPanel);
  panel.add(alertLabel);

  checkboxes = [];
  spatialClasses.forEach(function(item) {
    var cb = ui.Checkbox(item.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });

  var buttonPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { margin: '10px 0', padding: '0 10px' }
  });

  var runButton = ui.Button('Show Spatial Assets');
  var clearButton = ui.Button('Clear Map');
  buttonPanel.add(runButton).add(clearButton);
  panel.add(buttonPanel);

  // ---- Interaction Execution Handlers ----
  runButton.onClick(function() {
    alertLabel.setValue('');
    if (!roi_boundary) {
      ui.alert('Error', 'Please set a region location profile first.');
      return;
    }

    var selectedPeriod = (mode === 'validation') ? years.validation : years.test;
    if (!selectedPeriod.start || !selectedPeriod.end) {
      alertLabel.setValue('Target calculation timeline window not initialized.');
      return;
    }

    var spatialLayer = exports.getLoadedImage(mode);
    if (!spatialLayer) {
      alertLabel.setValue('No spatial asset targets selected or found.');
      return;
    }

    loadedImage = spatialLayer;
    clearMapOnly(); // Clear previous iterations safely before rendering

    activeMaps.forEach(function(m) {
      m.addLayer(spatialLayer, { palette: ['#9c27b0'] }, 'Spatial');

      // Create contextual status indicator legend components
      var legend = ui.Panel({
        style: {
          position: 'bottom-left',
          padding: '8px',
          backgroundColor: 'rgba(255,255,255,0.8)'
        }
      });

      legend.add(ui.Label('Spatial Assets', { fontWeight: 'bold', margin: '0 0 4px 0' }));
      legend.add(ui.Panel([
        ui.Label('', { backgroundColor: '#9c27b0', padding: '8px', margin: '0 4px 0 0' }),
        ui.Label('Selected Zones', { margin: '0' })
      ], ui.Panel.Layout.flow('horizontal')));

      spatialUtils.legends.push(legend);
    });

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });

  clearButton.onClick(exports.clearMap);

  return panel;
};

function removeLegend() {
  spatialUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.widgets === 'function') {
        m.widgets().remove(legend);
      }
    });
  });
  spatialUtils.legends = [];
}

function clearMapOnly() {

  activeMaps.forEach(function(m) {

    var layers = m.layers();

    for (var i = layers.length() - 1; i >= 0; i--) {

      var layer = layers.get(i);

      if (layer.getName() === 'Spatial') {
        layers.remove(layer);
      }
    }
  });
}

exports.clearMap = function() {
  clearMapOnly();
  removeLegend();
  loadedImage = null;
  alertLabel.setValue('');
};

exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedClassNames = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedClassNames.push(spatialClasses[index].name);
    }
  });

  if (selectedClassNames.length === 0) return null;
  return selectedClassNames; 
};
