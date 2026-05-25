// ==================== THEMATICS MASK PANEL (ONES) ====================
var roi_boundary = null;
var mapInstance = null;
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;
var selectedThemeValues = [];
var checkboxes = {};
var onesLayer = null;
var loadMask = null;

// ==================== THEMATIC DEFINITIONS ====================

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

var themeNameToIndex = {};
themeNames.forEach(function(name, i) {
  themeNameToIndex[name] = themeIndices[i];
});

exports.setROI = function(roi, map) {
  roi_boundary = roi;
  mapInstance = map;
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

function removeLayerByName(name) {
  var layers = mapInstance.layers();
  for (var i = layers.length() - 1; i >= 0; i--) {
    var layer = layers.get(i);
    if (layer.getName() === name) {
      layers.remove(layer);
    }
  }
}

exports.getOneMap = function() {

  if (!roi_boundary) return null;

  var thematicImg = ee.Image(
    'projects/ee-open-natural-ecosystems/assets/publish/onesWith7Classes/landcover_hier'
  ).select('l2LabelNum').clip(roi_boundary);

  var selectedIndices = [];

  if (checkboxes && Object.keys(checkboxes).length > 0) {

    themeNames.forEach(function(name, i) {
      if (checkboxes[name] && checkboxes[name].getValue()) {
        selectedIndices.push(themeIndices[i]);
      }
    });
  }

  if (selectedIndices.length === 0 && selectedThemeValues && selectedThemeValues.length > 0) {

    selectedThemeValues.forEach(function(v) {

      // If it's already a number (class ID)
      if (typeof v === 'number') {
        if (themeIndices.indexOf(v) !== -1) {
          selectedIndices.push(v);
        }
      }

      // If it's a string name
      if (typeof v === 'string') {
        if (themeNameToIndex.hasOwnProperty(v)) {
          selectedIndices.push(themeNameToIndex[v]);
        }
      }
    });
  }

  if (selectedIndices.length === 0) {
    loadedImage = null;
    return null;
  }

  // Remove duplicates
  selectedIndices = selectedIndices.filter(function(v, i, arr) {
    return arr.indexOf(v) === i;
  });

  loadedImage = thematicImg.remap(
    selectedIndices,
    ee.List.repeat(1, selectedIndices.length),
    0
  ).selfMask();

  return loadedImage;
};

// ==================== PANEL UI ====================

exports.getPanel = function() {
  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Open Natural Ecosystems (ONEs)',
    style: {'fontSize':'16px','fontWeight':'bold','margin':'15px 0 5px 10px'}
  }));

  panel.add(ui.Label({
    value: 'Select thematic classes to display as a mask',
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

  var thematicImg;

  function clear() {
    if (mapInstance && onesLayer) {
      mapInstance.layers().remove(onesLayer);
      onesLayer = null;
    }
  }

  loadMask = function() {
    
    removeLayerByName('Open Natural Ecosystems (ONEs)');

    if (!mapInstance) {
      print('Please select an ecoregion first — map not initialized.');
      return;
    }

    thematicImg = ee.Image(
      'projects/ee-open-natural-ecosystems/assets/publish/onesWith7Classes/landcover_hier'
).select('l2LabelNum');

    if (roi_boundary) thematicImg = thematicImg.clip(roi_boundary);

    selectedThemeValues = [];
    var masks = [];
    
    themeNames.forEach(function(name, i) {
      if (checkboxes[name].getValue()) {
        selectedThemeValues.push(name);
        masks.push(thematicImg.eq(themeIndices[i]));
      }
    });
    
    //  Apply stored values if any
    if (selectedThemeValues && selectedThemeValues.length > 0) {
      themeNames.forEach(function(name) {
        if (checkboxes[name]) {
          checkboxes[name].setValue(
            selectedThemeValues.indexOf(name) !== -1
          );
        }
      });
    }

    
    if (masks.length === 0) {
      loadedImage = null;
      print('No ONEs classes selected — layer not added.');
      return;
    }

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
  if (!selectedThemeValues || selectedThemeValues.length === 0) {
    return null;
  }
  return selectedThemeValues; // array of NAMES
};

exports.setValues = function(values) {
  if (!Array.isArray(values)) return;

  selectedThemeValues = [];

  values.forEach(function(v) {
    if (typeof v === 'number') {
      var name = themeNames[themeIndices.indexOf(v)];
      if (name) selectedThemeValues.push(name);
    } else if (typeof v === 'string' && themeNameToIndex.hasOwnProperty(v)) {
      selectedThemeValues.push(v);
    }
  });

  if (!checkboxes || Object.keys(checkboxes).length === 0) {
    return;
  }

  themeNames.forEach(function(name) {
    if (checkboxes[name]) {
      checkboxes[name].setValue(selectedThemeValues.indexOf(name) !== -1);
    }
  });

};
