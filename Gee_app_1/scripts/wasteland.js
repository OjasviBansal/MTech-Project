var roi_boundary = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;
var activeMaps = [Map];
var checkboxes = [];

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.getLoadedImage = function() {
  return loadedImage;
};

var wastelandUtils = {
  layers: []
};

var wastelandClasses = [
  {name: 'Mining/ Industrial Wastelands', value: 1},
  {name: 'Scrub Land', value: 2},
  {name: 'Waterlogged Area', value: 3},
  {name: 'Degraded Land Under Plantation Crop', value: 4},
  {name: 'Sandy Area', value: 5},
  {name: 'Degraded Forest', value: 6},
  {name: 'Degraded Pastures/Grazing Land', value: 7},
  {name: 'Barren Rocky Area', value: 8},
  {name: 'Gullied and Ravinous Land', value: 9},
  {name: 'Salt Affected Area', value: 10},
  {name: 'Shifting Cultivation', value: 11},
  {name: 'Snow Covered/ Glacial Area', value: 12},
  {name: 'Not Wastelands / None of the Above', value: 0}
];

exports.getPanel = function() {
  var panel = ui.Panel();

  var sectionTitle = ui.Label({
    value: 'Low-AGB Ecosystems (Wasteland Atlas of India, GoI)',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  panel.add(ui.Label({
  value: 'Select classes that may help characterize the area. ',
  style: {'fontSize': '14px'}
  }));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);
  
  checkboxes = [];
  wastelandClasses.forEach(function(item) {
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
        if (layer.getName() && layer.getName().indexOf('Wastelands') === 0) {
          m.remove(layer);
        }
      });

    });
    wastelandUtils.layers = [];
    loadedImage = null;
  };

  var loadSelectedWastelands = function() {
    if (!roi_boundary) {
      ui.alert('Error', 'Please set ROI from the main panel first.');
      return;
    }

    clearMap();

    var wasteland = ee.Image("projects/ee-apoorvadewan13/assets/wasteland1516").clip(roi_boundary).unmask(0);

    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(wastelandClasses[index].value);
      }
    });
    var combinedMask = ee.Image(0);
    
    selectedValues.forEach(function(val) {
      var classMask;
      if (val === 0) {
        var validWasteland = wasteland.gt(0).and(wasteland.lte(12));
        classMask = validWasteland.not();
      } else {
        classMask = wasteland.eq(val);
      }
      combinedMask = combinedMask.or(classMask);
    });

    var vizParams = {min: 0, max: 1, palette: ['white', 'purple']};

    var displayImage = combinedMask.selfMask();
    loadedImage = displayImage;

    activeMaps.forEach(function(m) {
      m.addLayer(displayImage, vizParams, 'Wastelands');

      var makeRow = function(color, name) {
        var colorBox = ui.Label({
          style: {
            backgroundColor: color,
            padding: '8px',
            margin: '0 4px 0 0'
          }
        });
        var description = ui.Label({value: name, style: {margin: '0'}});
        return ui.Panel({widgets: [colorBox, description], layout: ui.Panel.Layout.flow('horizontal')});
      };

      if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
    });
  };

  loadButton.onClick(loadSelectedWastelands);
  clearButton.onClick(clearMap);

  return panel;
};

exports.getWastelandAtPoint = function(point) {

  var wastelandImg = ee.Image("projects/ee-apoorvadewan13/assets/wasteland1516");

  return wastelandImg.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30,
    bestEffort: true
  }).map(function(k, v) { return ee.Number(v); });
};

exports.tickCheckboxForValue = function(value) {
  if (!value) return;

  var match = null;
  for (var i = 0; i < wastelandClasses.length; i++) {
    if (wastelandClasses[i].value === value) {
      match = wastelandClasses[i];
      break;
    }
  }
  if (!match) return;

  for (var j = 0; j < checkboxes.length; j++) {
    if (checkboxes[j].getLabel() === match.name) {
      checkboxes[j].setValue(true);
      break;
    }
  }
};
exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(wastelandClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames; 
};


exports.setValues = function(selectedNames) {
  if (!selectedNames || !selectedNames.length) return;

  if (!roi_boundary) {
    print('Wasteland: ROI not set');
    return;
  }

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  selectedNames.forEach(function(name) {
    for (var i = 0; i < wastelandClasses.length; i++) {
      if (wastelandClasses[i].name === name) {
        checkboxes[i].setValue(true);
        break;
      }
    }
  });

  var wasteland = ee.Image("projects/ee-apoorvadewan13/assets/wasteland1516")
    .clip(roi_boundary)
    .unmask(0);

  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedValues.push(wastelandClasses[index].value);
    }
  });

  if (selectedValues.length === 0) {
    print('Wasteland: no valid classes selected');
    return;
  }

  var combinedMask = ee.Image(0);

  selectedValues.forEach(function(val) {
    var classMask;
    if (val === 0) {
      // Not Wasteland
      var validWasteland = wasteland.gt(0).and(wasteland.lte(12));
      classMask = validWasteland.not();
    } else {
      classMask = wasteland.eq(val);
    }
    combinedMask = combinedMask.or(classMask);
  });

  var displayImage = combinedMask.selfMask();
  loadedImage = displayImage;

  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Wastelands') === 0) {
        m.remove(layer);
      }
    });
  });

  var vizParams = { min: 0, max: 1, palette: ['white', 'purple'] };

  activeMaps.forEach(function(m) {
    m.addLayer(displayImage, vizParams, 'Wastelands');

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  });
};
