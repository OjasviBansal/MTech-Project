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

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.getLoadedImage = function() {
  if (!roi_boundary) return null;

  // Load full wasteland image
  var wasteland = ee.Image("projects/ee-apoorvadewan13/assets/wasteland1516").clip(roi_boundary);

  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) {
      selectedValues.push(wastelandClasses[index].value);
    }
  });

  if (selectedValues.length === 0) {
    loadedImage = null; 
    return null;
  }

  // Remap selected values to 1, others to 0
  loadedImage = wasteland.remap(
    selectedValues, 
    ee.List.repeat(1, selectedValues.length), 
    0
  ).selfMask();

  return loadedImage;
};


var wastelandUtils = {
  layers: [],
  legends: [] 
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
  {name: 'Snow Covered/ Glacial Area', value: 12}
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

      wastelandUtils.legends.forEach(function(legend) {
        m.widgets().remove(legend);
      });
    });
    wastelandUtils.layers = [];
    wastelandUtils.legends = [];
    loadedImage = null;
  };

  var loadSelectedWastelands = function() {
    if (!roi_boundary) {
      ui.alert('Error', 'Please set ROI from the main panel first.');
      return;
    }

    clearMap();

    var wasteland = ee.Image("projects/ee-apoorvadewan13/assets/wasteland1516").clip(roi_boundary);
    loadedImage = wasteland;

    var selectedValues = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(wastelandClasses[index].value);
      }
    });

    var vizParams = {min: 0, max: 1, palette: ['white', 'purple']};

    // Selected = 1 (purple), Others = 0 (white)
    var selectedMask = wasteland.remap(selectedValues, ee.List.repeat(1, selectedValues.length), 0);
    var displayImage = selectedMask.selfMask();

    activeMaps.forEach(function(m) {
      m.addLayer(displayImage, vizParams, 'Wastelands');

      var legend = ui.Panel({
        style: {
          position: 'bottom-left',
          padding: '8px',
          backgroundColor: 'rgba(255,255,255,0.8)'
        }
      });

      var legendTitle = ui.Label({
        value: 'Wastelands',
        style: {fontWeight: 'bold', margin: '0 0 4px 0'}
      });

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

      legend.add(legendTitle);
      legend.add(makeRow('purple', 'Selected Wastelands'));

      wastelandUtils.legends.push(legend);
    });
  };

  loadButton.onClick(loadSelectedWastelands);
  clearButton.onClick(clearMap);

  return panel;
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
      print("Wasteland checkbox ticked for:", match.name, "(value:", value, ")");
      break;
    }
  }
};

exports.setValues = function(values) {
  if (!Array.isArray(values)) return;

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  wastelandClasses.forEach(function(cls, index) {
    if (values.indexOf(cls.value) !== -1) {
      checkboxes[index].setValue(true);
    }
  });

  print("Wasteland checkboxes updated for values:", values);
};

function removeLegend() {
  wastelandUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.widgets === 'function') {
        m.widgets().remove(legend);
      }
    });
  });
  wastelandUtils.legends = [];
}

function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Wastelands') === 0) {
        m.remove(layer);
      }
    });
  });

  removeLegend();

  wastelandUtils.layers = [];
  loadedImage = null;
}

// ------------------- Export functions -------------------
exports.clearMap = clearMap;
exports.removeLegend = removeLegend;


exports.getRule = function() {
  if (!roi_boundary) return null;
  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(wastelandClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames; 
};


