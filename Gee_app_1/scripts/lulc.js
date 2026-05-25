var roi_boundary = null;
var loadedImage = null;
var selectedYear = null; 
var mapInstance = null; 
var keepRestorationMarkerOnTopFn = null;
exports.setROI = function(roi, map, year) {
  roi_boundary = roi;
  mapInstance = map;    
  selectedYear = year;   
};


var lulc_names = [
  'Built up',                // 1
  'Kharif water',            // 2
  'Kharif and rabi water',   // 3
  'Kharif and rabi and zaid water', // 4
  'Trees',            // 6
  'Barren lands',            // 7
  'Single Kharif Cropping',  // 8
  'Single Non-Kharif Cropping', // 9
  'Double Cropping',         // 10
  'Triple Cropping',         // 11
  'Shrubs_Scrubs'            // 12
];
  var lulc_indices = [1,2,3,4,6,7,8,9,10,11,12];


exports.setYears = function(currentYear) {
  if (typeof currentYear !== 'number') {
    throw new Error('LULC year must be a number');
  }
  selectedYear = currentYear;
};

exports.getLoadedImage = function() {
  return loadedImage;
};

var lulcUtils = { layer: null};
var checkboxes = []; 

exports.getPanel = function() {
  var panel = ui.Panel();
  var errorLabel = ui.Label({
      value: '',
      style: {color: 'red', fontWeight: 'bold', fontSize: '13px', margin: '4px 0'}
    });
  var sectionTitle = ui.Label({
    value: 'Step 7: Apply masking layers',
    style: {'fontSize': '16px','fontWeight':'bold','margin':'15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  panel.add(ui.Label({
    value: 'LULC (IndiaSAT v3): Provide an LULC mask for the current year',
    style: {'fontSize': '16px','fontWeight':'bold','margin':'15px 0 5px 10px'}
  }));
  panel.add(ui.Label({
    value: 'Select classes where you feel restoration activities might be feasible to undertake. This layer will show all pixels which fall under the selected LULC classes in the current year',
    style: {'fontSize': '14px'}
  }));

  var categoryPanel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
  
  lulc_names.forEach(function(name){
    var cb = ui.Checkbox(name, false);
    checkboxes[name] = cb;
    categoryPanel.add(cb);
  });
  panel.add(ui.Label('Select categories:'));
  panel.add(categoryPanel);

  var loadButton = ui.Button({label:'Load', style:{margin:'5px 5px 5px 0', height:'30px'}});
  var clearButton = ui.Button({label:'Clear Map', style:{margin:'5px 0 5px 0', height:'30px'}});
  panel.add(ui.Panel([loadButton, clearButton], ui.Panel.Layout.flow('horizontal')));
  panel.add(errorLabel);
  var clearMap = function(){
    if(!mapInstance) return;
    if(lulcUtils.layer){ mapInstance.layers().remove(lulcUtils.layer); lulcUtils.layer = null; }
    loadedImage = null;
  };

  var loadLULC = function(){
    errorLabel.setValue('');
    if (!selectedYear) {
      errorLabel.setValue('Current year not set. Please set the year in Step 6 before loading LULC.');
      print('Current year not set from Step 6');
      return;
    }
  
    if (!mapInstance) {
      print('Map instance not set');
      return;
    }
    clearMap();
    var nextYear = selectedYear + 1;
    var assetPath =
      "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/" +
      "pan_india_lulc_v3_" +
      selectedYear + "_" + nextYear;
    var img = ee.Image(assetPath).select('predicted_label');
    if(roi_boundary){ img = img.clip(roi_boundary); }

    var maskList = [];
    lulc_names.forEach(function(name, i){
    if(checkboxes[name].getValue()){
      maskList.push(img.eq(lulc_indices[i]));
    }
  });

    var finalMask = ee.Image(0);
    if(maskList.length > 0){
      finalMask = ee.ImageCollection(maskList).max(); 
    }

    loadedImage = finalMask;

    lulcUtils.layer = mapInstance.addLayer(
      finalMask.selfMask(), {palette:['333333'], min:0, max:1}, 'Selected LULC categories'
    );

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  };

  loadButton.onClick(loadLULC);
  clearButton.onClick(clearMap);

  return panel;
};

var makeRow = function(color,name){
  return ui.Panel({
    widgets:[
      ui.Label({style:{backgroundColor:'#'+color, padding:'8px', margin:'0 0 4px 0', border:'1px solid #CCCCCC'}}),
      ui.Label({value:name, style:{margin:'0 0 4px 6px'}})
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};
exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};


exports.getRule = function () {
  if (!roi_boundary) return null;

  var selected = [];

  Object.keys(checkboxes).forEach(function (name) {
    var cb = checkboxes[name];
    if (cb && cb.getValue()) {
      selected.push(name);
    }
  });

  if (selected.length === 0) return null;

  return selected;
};


exports.setValues = function(lulcRules, map) {
  var mapToUse = map || mapInstance;
  
  if (!lulcRules || !lulcRules.length) return;

  if (!mapInstance) {
    print('LULC: mapInstance not set');
    return;
  }

  if (!selectedYear) {
    print('LULC: selectedYear not set');
    return;
  }

  Object.keys(checkboxes).forEach(function(name) {
    checkboxes[name].setValue(false);
  });

  lulcRules.forEach(function(name) {
    if (checkboxes[name]) {
      checkboxes[name].setValue(true);
    } else {
      print('Unknown LULC class in JSON:', name);
    }
  });

  if (lulcUtils.layer) {
    mapInstance.layers().remove(lulcUtils.layer);
    lulcUtils.layer = null;
  }

  var img = ee.Image(
    "projects/corestack-datasets/assets/datasets/LULC_v3_river_basin/pan_india_lulc_v3_2023_2024"
  ).select('predicted_label');

  if (roi_boundary) {
    img = img.clip(roi_boundary);
  }

  var maskList = [];

  lulc_names.forEach(function(name, i) {
    if (checkboxes[name].getValue()) {
      maskList.push(img.eq(lulc_indices[i]));
    }
  });

  if (maskList.length === 0) return;

  var finalMask = ee.ImageCollection(maskList).max().selfMask();
  loadedImage = finalMask;
  
  if (lulcUtils.layer) {
    mapToUse.layers().remove(lulcUtils.layer);
    lulcUtils.layer = null;
  }
  
  lulcUtils.layer = mapToUse.addLayer(
    finalMask.selfMask(),
    {palette: ['333333'], min: 0, max: 1},
    'Selected LULC categories'
  );

  if (keepRestorationMarkerOnTopFn) {
    ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
  }
};
