var roi_boundary = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

var selectedYear = null; 
var activeMaps = [Map];
var checkboxes = [];  


var pendingLulcValues = null;


var lulcClasses = [
  {name: 'Built up', value: 1},
  {name: 'Kharif water', value: 2},
  {name: 'Kharif and rabi water', value: 3},
  {name: 'Kharif and rabi and zaid water', value: 4},
  {name: 'Trees', value: 6},
  {name: 'Barren lands', value: 7},
  {name: 'Single Kharif Cropping', value: 8},
  {name: 'Single Non-Kharif Cropping', value: 9},
  {name: 'Double Cropping', value: 10},
  {name: 'Triple Cropping', value: 11},
  {name: 'Shrubs_Scrubs', value: 12}
];

var lulcUtils = { layers: [], legends: [] };

exports.setROI = function(roi, mapInstance, year) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) activeMaps.push(mapInstance);
};


exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.setYears = function(startYear, endYear) {
  if (typeof endYear !== 'number') {
    print('Invalid LULC year');
    return;
  }

  selectedYear = endYear;
  print('LULC selectedYear set to:', selectedYear);
};

exports.getLoadedImage = function() {
  if (!roi_boundary || !selectedYear) return null;

  var img = ee.Image(
    "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_" 
    + selectedYear + "_" + (parseInt(selectedYear) + 1)
  ).select('predicted_label');

  img = img.clip(roi_boundary);

  var selectedValues = [];
  checkboxes.forEach(function(cb, index) {
    if (cb.getValue()) selectedValues.push(lulcClasses[index].value);
  });

  if (selectedValues.length === 0) {
    loadedImage = null; 
    return null;
  }

  loadedImage = img.remap(
    selectedValues, 
    ee.List.repeat(1, selectedValues.length), 
    0
  ).selfMask();

  return loadedImage;
};


exports.getPanel = function() {
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'LULC (IndiaSAT v3): Provide an LULC mask for the current year',
    style: {'fontSize': '16px', 'fontWeight':'bold', 'margin':'15px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Select classes where you feel restoration activities might be feasible.',
    style: {'fontSize': '14px'}
  }));

  var checkboxPanel = ui.Panel({style: {margin: '0 10px'}});
  panel.add(checkboxPanel);

  checkboxes = [];
  lulcClasses.forEach(function(cls) {
    var cb = ui.Checkbox(cls.name, false);
    checkboxes.push(cb);
    checkboxPanel.add(cb);
  });
  
  if (pendingLulcValues) {
    print("Applying cached LULC values:", pendingLulcValues);
    exports.setValues(pendingLulcValues);
    pendingLulcValues = null;
  }

  var buttonPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '10px 0', padding: '0 10px'}});
  var loadButton = ui.Button({label: 'Load', style: {margin: '0 5px 0 0', height: '30px'}});
  var clearButton = ui.Button({label: 'Clear Map', style: {margin: '0', height: '30px'}});
  buttonPanel.add(loadButton);
  buttonPanel.add(clearButton);
  panel.add(buttonPanel);
  
  var loadSelectedLULC = function() {

    if (!roi_boundary || !selectedYear) {
      ui.alert('Error', 'Please set ROI and year first.');
      return;
    }
  
    clearMap();
  
    var img = ee.Image(
      "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_" 
      + selectedYear + "_" + (parseInt(selectedYear)+1)
    ).select('predicted_label');
  
    img = img.clip(roi_boundary);
  
    var selectedValues = [];
    var selectedNames = [];
    checkboxes.forEach(function(cb, index) {
      if (cb.getValue()) {
        selectedValues.push(lulcClasses[index].value);
        selectedNames.push(lulcClasses[index].name);
      }
    });
    
    print(" Selected LULC classes:", selectedNames, selectedValues);

  
    if (selectedValues.length === 0) {
      ui.alert('Please select at least one LULC class.');
      loadedImage = null;
      return;
    }
  
    loadedImage = img.remap(
      selectedValues,
      ee.List.repeat(1, selectedValues.length),
      0
    ).selfMask();
  
    var vizParams = {palette:['white','#333333'], min:0, max:1};
  
    activeMaps.forEach(function(m) {
      m.addLayer(loadedImage, vizParams, 'LULC');
    });
  
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  
  };


  loadButton.onClick(loadSelectedLULC);
  clearButton.onClick(clearMap);

  return panel;
};

exports.tickCheckboxByName = function(name) {
  checkboxes.forEach(function(cb) {
    if (cb.getLabel() === name) cb.setValue(true);
  });
};



exports.setValues = function(values) {

  if (!Array.isArray(values)) return;

  if (checkboxes.length === 0) {
    pendingLulcValues = values;
    return;
  }

  checkboxes.forEach(function(cb) {
    cb.setValue(false);
  });

  lulcClasses.forEach(function(cls, index) {
    if (
      values.indexOf(cls.value) !== -1 ||  
      values.indexOf(cls.name) !== -1   
    ) {
      checkboxes[index].setValue(true);
    }
  });

  print('LULC checkboxes set from:', values);
};


function removeLegend() {
  lulcUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.widgets === 'function') {
        m.widgets().remove(legend);
      }
    });
  });
  lulcUtils.legends = [];
}

function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('LULC') === 0) {
        m.remove(layer);
      }
    });
  });

  removeLegend();

  lulcUtils.layers = [];
  loadedImage = null;
}

exports.clearMap = clearMap;
exports.removeLegend = removeLegend;


exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];
  checkboxes.forEach(function(cb, i) {
    if (cb.getValue()) selectedNames.push(lulcClasses[i].name);
  });

  if (selectedNames.length === 0) return null;

  return selectedNames;  
};
