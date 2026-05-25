// ==================== THEMATICS MASK PANEL (ONES) ====================

var roi_boundary = null;
var mapInstance = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

var checkboxes = {};   

var themeNames = [
    'Open Agriculture',               
    'Bare / Rocky / Sparsely Vegetated',
    'Built-Up',
    'Cultivated Trees',
    'Dune',
    'Trees',
    'Saline Flat',
    'Savanna Grassland',
    'Savanna Shrubland',
    'Savanna Woodland',
    'Water / Wetland'
  ];

var themeIndices = [1,2,3,4,5,6,7,8,9,10,11];

exports.setROI = function(roi, map) {
  roi_boundary = roi;
  mapInstance = map;
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

exports.getOneMap = function() {
  return loadedImage;
};

exports.getPanel = function() {
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Open Natural Ecosystems (ONEs)',
    style: {'fontSize':'16px','fontWeight':'bold','margin':'15px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'You can similarly use various classes for open natural ecosystems in addition to or instead of the above LULC layers. ',
    style: {'fontSize':'14px'}
  }));

  var listPanel = ui.Panel();
  themeNames.forEach(function(name){
    var cb = ui.Checkbox(name, false);
    checkboxes[name] = cb;
    listPanel.add(cb);
  });
  panel.add(listPanel);
  
  var loadBtn = ui.Button({label:'Load ONEs Mask', style:{margin:'5px 5px 5px 0', height:'30px'}});
  var clearBtn = ui.Button({label:'Clear', style:{margin:'5px 0 5px 0', height:'30px'}});
  panel.add(ui.Panel([loadBtn, clearBtn], ui.Panel.Layout.flow('horizontal')));

  var onesLayer = null;
  var thematicImg;

  function clear() {
    if (mapInstance && onesLayer) {
      mapInstance.layers().remove(onesLayer);
      onesLayer = null;
    }
  }

  function loadMask() {
    clear();

    if (!mapInstance) {
      print('Please select an ecoregion first — map not initialized.');
      return;
    }

    thematicImg = ee.Image(
      'projects/ee-open-natural-ecosystems/assets/publish/onesWith7Classes/landcover_hier'
).select('l2LabelNum');

    if (roi_boundary) thematicImg = thematicImg.clip(roi_boundary);

    var masks = [];
    themeNames.forEach(function(name, i) {
      if (checkboxes[name].getValue()) {
        masks.push(thematicImg.eq(themeIndices[i]));
      }
    });

    var finalMask = ee.Image(0);
    if (masks.length > 0) {
      finalMask = ee.ImageCollection(masks).max();
    }

    loadedImage = finalMask;

    onesLayer = mapInstance.addLayer(
      finalMask.selfMask(),
      {palette:['#00ffaa'], min:0, max:1},
      'Open Natural Ecosystems (ONEs)'
    );

    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }
  }

  loadBtn.onClick(loadMask);
  clearBtn.onClick(clear);

  return panel;
};


exports.getRule = function() {
  if (!roi_boundary) return null;

  var selectedNames = [];

  themeNames.forEach(function(name) {
    if (checkboxes[name] && checkboxes[name].getValue()) {
      selectedNames.push(name);
    }
  });

  if (selectedNames.length === 0) return null;

  return selectedNames; 
};


exports.setValues = function(ruleArray) {
  if (!ruleArray || !Array.isArray(ruleArray)) return;

  themeNames.forEach(function(name) {
    if (checkboxes[name]) {
      checkboxes[name].setValue(false);
    }
  });

  ruleArray.forEach(function(ruleName) {
    if (checkboxes[ruleName]) {
      checkboxes[ruleName].setValue(true);
    }
  });
};


