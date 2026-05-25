var roi_boundary = null;
var activeMaps = [Map];
var loadedImage = null;
var keepRestorationMarkerOnTopFn = null;

var SOIL_CLASSES = {

  texture: {
    title: 'Topsoil Texture',
    band: 'Topsoil_Texture',
    values: {
      1: 'Clay (heavy)',
      2: 'Silt clay',
      3: 'Clay (light)',
      4: 'Silty clay loam',
      5: 'Clay loam',
      6: 'Silt',
      7: 'Silt loam',
      8: 'Sandy clay',
      9: 'Loam',
      10: 'Sandy clay loam',
      11: 'Sandy loam',
      12: 'Loamy sand',
      13: 'Sand'
    },
  },

  drainage: {
    title: 'Soil Drainage',
    band: 'Soil_Drainage',
    values: {
      1: 'Excessively drained',
      2: 'Somewhat excessively drained',
      3: 'Well drained',
      4: 'Moderately well drained',
      5: 'Imperfectly drained',
      6: 'Poorly drained'
    },
  },

  ph: {
    title: 'Topsoil pH',
    band: 'Topsoil_pH_Class',
    values: {
      1: 'Strongly Acidic',
      2: 'Moderately Acidic–Neutral',
      3: 'Slightly Alkaline',
      4: 'Moderately Alkaline'
    },
  }
};

var hwsdRaster = ee.Image('projects/ee-ojasvibansal/assets/hwsd_v1_2').select('b1');
var hwsd2Raster = ee.Image('projects/sat-io/open-datasets/FAO/HWSD_V2_SMU');
var hwsdData   = ee.FeatureCollection('projects/ee-ojasvibansal/assets/hwsd_data');
var textureTable = ee.FeatureCollection('projects/ee-ojasvibansal/assets/HWSD2_TEXTURE_USDA');
var drainageTable = ee.FeatureCollection('projects/ee-ojasvibansal/assets/HWSD2_DRAINAGE');

var soilUtils = {
  layers: [],
  checkboxes: {}
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

exports.getSoilAtPoint = function(point) {
  if (!point) return null;

  var soilStack = buildSoilStack();

  return soilStack.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 250,      
    maxPixels: 1e8
  });
};


exports.tickCheckboxForValue = function(category, value) {
  if (
    soilUtils.checkboxes[category] &&
    soilUtils.checkboxes[category][value]
  ) {
    soilUtils.checkboxes[category][value].setValue(true);
  }
};

function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(l) {
      if (l.getName() && l.getName().indexOf('Soil') === 0) {
        m.remove(l);
      }
    });
  });
  soilUtils.layers = [];
  loadedImage = null;
}
exports.clearMap = clearMap;

exports.getPanel = function() {

  var panel = ui.Panel();

  panel.add(ui.Label({
    value: 'Soil Constraints (HWSD)',
    style: {fontSize: '16px', fontWeight: 'bold'}
  }));

  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var cfg = SOIL_CLASSES[key];

    panel.add(ui.Label({
      value: cfg.title,
      style: {fontWeight: 'bold', margin: '8px 0 4px 0'}
    }));

    soilUtils.checkboxes[key] = {};

    Object.keys(cfg.values).forEach(function(v) {
      var cb = ui.Checkbox(cfg.values[v], false);
      soilUtils.checkboxes[key][v] = cb;
      panel.add(cb);
    });
  });

  var loadBtn  = ui.Button({
    label: 'Load',
    onClick: loadSoil,
    style: {stretch: 'horizontal'}
  });
  
  var clearBtn = ui.Button({
    label: 'Clear Map',
    onClick: clearMap,
    style: {stretch: 'horizontal'}
  });
  
  var btnRow = ui.Panel({
    widgets: [loadBtn, clearBtn],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'horizontal', margin: '8px 0'}
  });
  
  panel.add(btnRow);

  return panel;
};

function buildSoilStack() {

  var IDS = ee.List(hwsdData.aggregate_array('ID'));
  
  function fcToDict(fc, keyField, valueField) {
    var keys = ee.List(fc.aggregate_array(keyField));    // server-side list
    var values = ee.List(fc.aggregate_array(valueField)); // server-side list
    return ee.Dictionary.fromLists(keys, values);
  }
  
  var textureDict = fcToDict(textureTable, 'VALUE', 'CODE');
  var drainageDict = fcToDict(drainageTable, 'VALUE', 'CODE');
  
  var texture = hwsd2Raster
                .select('TEXTURE_USDA')
                .rename('Topsoil_Texture');
  
  var drainage = hwsd2Raster
                  .select('DRAINAGE')
                  .rename('Soil_Drainage');
  
  var phClasses = hwsdData.map(function (f) {

    var p = f.get('T_PH_H2O');

    var cls = ee.Algorithms.If(
      p,
      ee.Algorithms.If(
        ee.Number(p).gte(4.6).and(ee.Number(p).lt(5.5)), 1,
        ee.Algorithms.If(
          ee.Number(p).gte(5.5).and(ee.Number(p).lt(7.2)), 2,
          ee.Algorithms.If(
            ee.Number(p).gte(7.2).and(ee.Number(p).lt(7.4)), 3,
            ee.Algorithms.If(
              ee.Number(p).gte(7.4).and(ee.Number(p).lte(7.6)), 4,
              0
            )
          )
        )
      ),
      0
    );

    return ee.Feature(null, {cls: cls});
  }).aggregate_array('cls');

  var ph = hwsdRaster
    .remap(IDS, phClasses, 0)
    .rename('Topsoil_pH_Class');

  return ee.Image.cat([texture, drainage, ph]);
}

function loadSoil() {
  if (!roi_boundary) { 
    print('Set ROI first'); 
    return; 
  }

  clearMap();
  var soilStack = buildSoilStack().clip(roi_boundary);
  var masks = [];

  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var cfg = SOIL_CLASSES[key];
    var selected = [];

    Object.keys(soilUtils.checkboxes[key]).forEach(function(v) {
      if (soilUtils.checkboxes[key][v].getValue()) selected.push(parseInt(v, 10));
    });

    if (selected.length > 0) {
      var band = soilStack.select(cfg.band);
      if (band) {
        var mask = ee.ImageCollection(
              ee.List(selected)
                .map(function(v){
                  return band.eq(ee.Number(v));
                })
            )
            .reduce(ee.Reducer.anyNonZero())
            .selfMask();
            
        if (mask) masks.push(mask);
      }
    }
  });

  if (masks.length > 0) {
    loadedImage = masks.reduce(function(a,b){ return a.and(b); });
    if (loadedImage) {
      activeMaps.forEach(function(m){
        m.addLayer(loadedImage.selfMask(), {palette:['#6D4C41']}, 'Soil');
      });
    } else {
      print('No mask could be created for selected soil properties.');
    }
  } else {
    print('No soil checkboxes selected or bands are null.');
  }
}

exports.getLoadedImage = function() {
  return loadedImage;
};

exports.getRule = function() {
  var rule = {};
  Object.keys(SOIL_CLASSES).forEach(function(key) {
    var selected = [];
    Object.keys(soilUtils.checkboxes[key]).forEach(function(v) {
      if (soilUtils.checkboxes[key][v].getValue()) selected.push(SOIL_CLASSES[key].values[v]);
    });
    if (selected.length > 0) rule[SOIL_CLASSES[key].title] = selected;
  });
  return Object.keys(rule).length ? rule : null;
};

exports.setValues = function(soilRules) {
  if (!soilRules) return;

  Object.keys(soilUtils.checkboxes).forEach(function(cat) {
    Object.keys(soilUtils.checkboxes[cat]).forEach(function(v) {
      soilUtils.checkboxes[cat][v].setValue(false);
    });
  });

  Object.keys(soilRules).forEach(function(title) {

    var classKey = null;

    Object.keys(SOIL_CLASSES).forEach(function(k) {
      if (SOIL_CLASSES[k].title === title) {
        classKey = k;
      }
    });

    if (!classKey) {
      print('Unknown soil rule title:', title);
      return;
    }

    var valuesToTick = soilRules[title]; 

    Object.keys(SOIL_CLASSES[classKey].values).forEach(function(code) {
      var label = SOIL_CLASSES[classKey].values[code];
      if (valuesToTick.indexOf(label) !== -1) {
        soilUtils.checkboxes[classKey][code].setValue(true);
      }
    });
  });

  loadSoil();
};
