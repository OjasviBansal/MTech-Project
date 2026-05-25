// ==================== GLOBALS ====================
var roi_boundary = null;
var loadedImage = null;
var activeMaps = [];    // track maps where ROI + layers should appear

var keepRestorationMarkerOnTopFn = null;

var alertLabel = ui.Label({
  value: '',
  style: {color: 'red', fontWeight: 'bold', margin: '4px 0 0 0'}
});
// Store year ranges
var years = { validation: { start: null, end: null }, test: { start: null, end: null } };

// Module-level minFiresBox so it can be auto-set in Step 3a
var minFiresBox = ui.Textbox({ placeholder: 'Min fire occurrences', value: '0' });
exports.minFiresBox = minFiresBox;  // export it

// ==================== ROI registration ====================
exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) activeMaps.push(mapInstance);
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

// ==================== Set years ====================
exports.setYears = function(startYear, endYear, mode) {
  if (typeof startYear !== 'number' || typeof endYear !== 'number') throw new Error('Start and end years must be numbers.');
  if (mode !== 'validation' && mode !== 'test') throw new Error('Mode must be either "validation" or "test".');
  years[mode].start = startYear;
  years[mode].end = endYear;
};

// ==================== Count fire occurrences ====================
function count_fire_occurrences(image_collection) {
  return image_collection.map(function(image) {
    var fire_band = image.select('BurnDate');
    return fire_band.gt(0).rename('fireMask');  // 1 where fire occurred
  }).sum();
}

// ==================== Panel ====================
exports.getPanel = function(mode) {
  if (!mode) mode = 'validation';
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Fire Occurrences (MODIS MCD64A1)',
    style: {fontSize: '16px', fontWeight: 'bold', margin: '10px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Specify a lower bound for fire occurrences in the area during the selected period.',
    style: {fontSize: '14px'}
  }));

  panel.add(ui.Label('Minimum Fire Occurrences:'));
  panel.add(minFiresBox);  // use module-level box
  panel.add(alertLabel);

  var runButton = ui.Button('Show Fire Occurrences');
  var clearButton = ui.Button('Clear Map');
  panel.add(ui.Panel([runButton, clearButton], ui.Panel.Layout.flow('horizontal')));

  
  // ---- Run handler ----
  runButton.onClick(function() {
  alertLabel.setValue('');
  if (!roi_boundary) { print('Please set ROI first'); return; }

  var selectedYears = (mode === 'validation') ? years.validation : years.test;
  if (!selectedYears.start || !selectedYears.end) {
    alertLabel.setValue('Year range not set! '+ '. Please set the years first.');
    return;
  }

  var minFires = parseInt(minFiresBox.getValue());
  if (isNaN(minFires) || minFires < 1) { print('Enter valid min fires'); return; }

  var fireCollection = ee.ImageCollection("MODIS/061/MCD64A1")
    .filterDate(ee.Date.fromYMD(selectedYears.start, 1, 1),
                ee.Date.fromYMD(selectedYears.end, 12, 31))
    .map(function(img) { return img.clip(roi_boundary); });

  var fireCount = count_fire_occurrences(fireCollection).clip(roi_boundary);
  var fireFiltered = fireCount.gte(minFires).selfMask();

  loadedImage = fireFiltered;

  // Visualization parameters
  var vis = {palette: ['pink']};

  // Add the image to all active maps if it exists
  if (activeMaps.length > 0) {
    activeMaps.forEach(function(m) {
      if (fireFiltered) {
        m.addLayer(fireFiltered, vis, 'Fire Occurrences ' + selectedYears.start + '-' + selectedYears.end + ' (' + mode + ')');
        // m.centerObject(roi_boundary, 7);
      }

      // Always add the legend, even if fireFiltered is empty
      var legend = ui.Panel({
        style: {
          position: 'top-left',
          padding: '8px',
          backgroundColor: 'rgba(255,255,255,0.8)'
        }
      });
      
      legend.add(ui.Label({
        value: 'Fire Occurrences',
        style: {fontWeight: 'bold', margin: '0 0 4px 0'}
      }));

      // Color box and description
      var colorBox = ui.Label({
        style: {backgroundColor: '#ff69b4', padding: '8px', margin: '0 4px 0 0'}
      });
      var description = ui.Label({value: 'Fire occurrences', style: {margin: '0'}});

      legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.flow('horizontal')));
      // m.widgets().add(legend);
    });
  }
  
  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }

});


  clearButton.onClick(function() {
    activeMaps.forEach(function(m) {
      m.layers().forEach(function(layer) {
        if (layer.getName() && layer.getName().indexOf('Fire Occurrences') === 0) m.remove(layer);
      });
    });
    loadedImage = null;
  });

  return panel;
};

// ==================== Loaded image getter ====================
exports.getLoadedImage = function(mode) {
  if (mode !== 'validation' && mode !== 'test') {
    return loadedImage;  // return whatever was last loaded
  }

  // Otherwise, compute the image dynamically for the given mode
  var selectedYears = (mode === 'validation') ? years.validation : years.test;
  if (!roi_boundary || !selectedYears.start || !selectedYears.end) return null;

  var minFires = parseInt(minFiresBox.getValue());
  if (isNaN(minFires) || minFires < 1) return null;

  var fireCollection = ee.ImageCollection("MODIS/061/MCD64A1")
    .filterDate(ee.Date.fromYMD(selectedYears.start, 1, 1),
                ee.Date.fromYMD(selectedYears.end, 12, 31))
    .map(function(img) { return img.clip(roi_boundary); });

  var fireCount = count_fire_occurrences(fireCollection).clip(roi_boundary);
  return fireCount.gte(minFires).selfMask();
};


// ---------------- Set minimum fire occurrences programmatically ----------------
exports.setFireValue = function(value) {
  if (typeof value !== 'number' || value < 0) {
    throw new Error('Fire minimum value must be a non-negative number');
  }

  minFiresBox.setValue(value.toString());
  print('minimum fire occurrences set to:', value);
};



// ==================== Clear map ====================
exports.clearMap = function() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Fire Occurrences') === 0) {
        m.remove(layer);
      }
    });

    var widgets = m.widgets();
    var toRemove = [];
    widgets.forEach(function(w) {
      if (w instanceof ui.Panel) {
        var labels = w.widgets().filter(function(subw) {
          return subw instanceof ui.Label && subw.getValue && subw.getValue() === 'Fire Occurrences';
        });
        if (labels.length > 0) toRemove.push(w);
      }
    });
    toRemove.forEach(function(w) { widgets.remove(w); });
  });

  loadedImage = null;
  alertLabel.setValue('');

  print('Fire occurrences layers and legends cleared from all maps.');
};



exports.getRule = function(mode) {
  if (!roi_boundary) return null;

  var selectedYears = (mode === 'validation') ? years.validation : years.test;
  var minFires = parseInt(minFiresBox.getValue());

  if (isNaN(minFires) || minFires <= 0) return null;

  // Return simple JSON
  return minFires;  // just the number of fires
};

