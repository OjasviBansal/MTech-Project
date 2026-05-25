var lulcAnalysis = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/lulc');
var rainfall = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/bioclim');
var elevation = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/elevation');
var ldd = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/ldd');
var changeDetection = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/change_det');
var fire = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/fire');
var sizeFilter = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/sizebased');
var snicFilter = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/snic');
var terrain = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/terrain');
var one_map = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/ONE_map');
var soil = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/soil');
var naturalForests = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/natural_forests');
var temp = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/temp');
var spatial = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app/spatial');
// ================= GLOBAL VARIABLES =================
var roi_boundary = null;
var trainYears = {base: null, restoration: null}; // Step 3 years
var inferYears = {base: null, current: null};     // Step 6 years
var currentAndImage = null;
var step5ValidationMask = null;

// ================= CREATE TWO MAPS =================
var trainingMap = ui.Map();
var inferenceMap = ui.Map();
trainingMap.setCenter(78.06, 23.04, 5);
inferenceMap.setCenter(78.06, 23.04, 5);
var linker = ui.Map.Linker([trainingMap, inferenceMap]);
var inferenceActive = false;

// ================= CONTROL PANEL =================
var controlPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '400px', padding: '8px'}
});
controlPanel.add(ui.Label('Ecotype Identification', {
  fontSize: '24px',
  fontWeight: 'bold'
}));

controlPanel.add(ui.Label({
  value:
    'This is an experimental app under development and the results and methodology have yet to be validated. Use the app to create rules that can identify prospective restoration locations similar to a given reference site, or the other way that for a candidate restoration site how to identify potential reference sites that can be visited. Please share any feedback to and let us know if you are able to use this app to develop rules for your site. We would like to publish it on an accompanying app.',
  style: {'fontSize': '14px'}
}));
controlPanel.add(ui.Label({
  value: '[Accompanying app of example restoration sites]',
  targetUrl: 'https://ee-apoorvadewan13.projects.earthengine.app/view/ecotype-identification-sites--app2',
  style: {
    'fontSize': '14px',
    'color': 'blue',
    'textDecoration': 'underline'}
}));
controlPanel.add(ui.Label({
  value: '[contact@core-stack.org]',
  targetUrl: 'mailto:contact@core-stack.org',
  style: {
    'fontSize': '14px',
    'color': 'blue',
    'textDecoration': 'underline'}
}));



function computeCurrentAndImage() {
  if (!roi_boundary) return null;

  var masks = [];

  var r  = rainfall.getLoadedImage ? rainfall.getLoadedImage() : null;
  var t  = temp.getLoadedImage ? temp.getLoadedImage() : null;
  var e  = elevation.getLoadedImage ? elevation.getLoadedImage() : null;
  var s  = soil.getLoadedImage ? soil.getLoadedImage() : null;
  var tr = terrain.getLoadedImage ? terrain.getLoadedImage() : null;
  var f  = fire.getLoadedImage ? fire.getLoadedImage(inferYears.base, inferYears.current) : null;
  var cd = changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null;
  var lulc = lulcAnalysis.getLoadedImage ? lulcAnalysis.getLoadedImage() : null;
  var sp = spatial.getLoadedImage ? spatial.getLoadedImage() : null;
  var lddImg = ldd.getLoadedImage ? ldd.getLoadedImage() : null;
  var nfImg = naturalForests.getLoadedImage ? naturalForests.getLoadedImage() : null;
  var onesImg = one_map.getOneMap ? one_map.getOneMap() : null;

  [
    r, t, e, s, tr, f, cd,
    lulc, sp, lddImg, nfImg, onesImg
  ].forEach(function(img) {
    if (img) masks.push(img);
  });

  if (masks.length === 0) return null;

  var andImage = masks.reduce(function(acc, img) {
    return acc.and(img.gt(0));
  }, ee.Image(1));

  return andImage.clip(roi_boundary).selfMask();
}

// ================= STEP 1: ECOREGION SELECTION =================
var ecoRegions = ee.FeatureCollection('RESOLVE/ECOREGIONS/2017');
var countries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level0");
var india = countries.filter(ee.Filter.eq('ADM0_NAME', 'India')).first();
var india_ecoregions = ecoRegions.filterBounds(india.geometry());
var ecotype_list = india_ecoregions.aggregate_array('ECO_NAME').distinct().getInfo();

controlPanel.add(ui.Label('Step 1: Select an Ecoregion by Clicking on the Map', {
  fontWeight: 'bold', fontSize: '16px'
}));
controlPanel.add(ui.Label({
  value: '* Please zoom into your desired location and then proceed to the next step. This will help make the app more responsive since the layers and computation would take longer if the visualizations are done on a large area.',
  style: {'fontSize': '14px'}
}));
var step1LoadingLabel = ui.Label({
  value: '',
  style: {fontSize: '14px', color: 'blue', margin: '6px 0'}
});
controlPanel.add(step1LoadingLabel);

var ecoPalette = [
  '#f1c40f','#e67e22','#16a085','#2980b9',
  '#8e44ad','#2c3e50','#27ae60','#d35400','#7f8c8d'
];

var ecoWithRand = india_ecoregions.map(function(f) {
  var centroid = f.geometry().centroid(10);
  var lon = ee.Number(centroid.coordinates().get(0));
  var lat = ee.Number(centroid.coordinates().get(1));
  var rand = lon.multiply(12.9898).add(lat.multiply(78.233))
    .sin().multiply(43758.5453).abs().mod(1);
  return f.set('rand', rand);
});

var ecoWithColorIndex = ecoWithRand.map(function(f) {
  var idx = ee.Number(f.get('rand')).multiply(ecoPalette.length).floor();
  return f.set('colorIndex', idx);
});

var ecoImage = ee.Image().byte().paint({
  featureCollection: ecoWithColorIndex,
  color: 'colorIndex'
});

trainingMap.addLayer(
  ecoImage.visualize({min: 0, max: ecoPalette.length - 1, palette: ecoPalette}),
  {},
  'All Ecoregions'
);

var roi_set = false;
var selectedEcoFeature = null;

function replaceLayer(map, layerName, layerObj) {
  var layers = map.layers();
  for (var i = layers.length() - 1; i >= 0; i--) {
    if (layers.get(i).getName() === layerName) {
      layers.remove(layers.get(i));
    }
  }
  var newLayer;
  if (layerObj instanceof ui.Map.Layer) {
    newLayer = ui.Map.Layer(
      layerObj.getEeObject(),
      layerObj.getVisParams(),
      layerObj.getName(),
      layerObj.getShown()
    );
  } else {
    newLayer = layerObj;
  }
  map.layers().add(newLayer);
}

var ecoClickHandler = function(coords) {
  if (roi_set) {
    print('ROI already set. Clear location to start again.');
    return;
  }
  step1LoadingLabel.setValue('Setting ecoregion...');

  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  var clickedEco = ecoWithColorIndex.filterBounds(point).first();

  clickedEco.evaluate(function(f) {
    if (!f) {
      print('Clicked point is outside India ecoregions.');
      return;
    }

    var ecoName = f.properties.ECO_NAME;
    print('Selected ecoregion: ' + ecoName);

    selectedEcoFeature = ee.Feature(f);
    roi_boundary = selectedEcoFeature.geometry().intersection(india.geometry(), ee.ErrorMargin(1));

    trainingMap.layers().reset();
    inferenceMap.layers().reset();

    var roiOutline = ee.Image().byte().paint({
      featureCollection: ee.FeatureCollection([selectedEcoFeature]),
      color: 1,
      width: 2
    });

    replaceLayer(trainingMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));
    replaceLayer(inferenceMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));

    trainingMap.centerObject(selectedEcoFeature, 6);
    inferenceMap.centerObject(selectedEcoFeature, 6);

    lulcAnalysis.setROI(roi_boundary, inferenceMap);
    naturalForests.setROI(roi_boundary, inferenceMap);
    rainfall.setROI(roi_boundary, trainingMap);
    temp.setROI(roi_boundary, trainingMap);
    elevation.setROI(roi_boundary, trainingMap);
    soil.setROI(roi_boundary, trainingMap);
    terrain.setROI(roi_boundary, trainingMap);
    ldd.setROI(roi_boundary, inferenceMap);
    changeDetection.setROI(roi_boundary, trainingMap);
    fire.setROI(roi_boundary, trainingMap);
    one_map.setROI(roi_boundary, inferenceMap);
    spatial.setROI(roi_boundary, inferenceMap);

    roi_set = true;
    step1LoadingLabel.setValue('Ecoregion set as: ' + ecoName);
  });
};

trainingMap.onClick(ecoClickHandler);
inferenceMap.onClick(ecoClickHandler);

var loadingLabel = ui.Label({
  value: '',
  style: {fontSize: '14px', color: 'blue', margin: '6px 0'}
});

var ecoDropdown = ui.Select({
  items: ecotype_list,
  placeholder: 'Select an Ecoregion',
  style: {stretch: 'horizontal'}
});

// Year input textboxes for Step 3 (rule development)
var restorationStartBox = ui.Textbox({placeholder: 'Restoration start year', value: '2010'});
var preDegBox = ui.Textbox({placeholder: 'Base year', value: '1985'});

// Year input textboxes for Step 6 (inference)
var currentYearBox = ui.Textbox({placeholder: 'Current year', value: '2024'});
var preDegAppBox = ui.Textbox({placeholder: 'Pre-degradation year', value: '1985'});

// Panel for Step 3 years
var yearPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {margin: '6px 0'}
});

yearPanel.add(ui.Label('Restoration start:'));
yearPanel.add(restorationStartBox);

yearPanel.add(ui.Label('Base year:'));
yearPanel.add(preDegBox);

// Panel for Step 6 years
var yearPanelApp = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {margin: '6px 0'}
});
yearPanelApp.add(ui.Label('Current year:'));
yearPanelApp.add(currentYearBox);

var setEcoLocationBtn = ui.Button({
  label: 'Set Location',
  onClick: function() {
    var selectedEco = ecoDropdown.getValue();
    if (!selectedEco) {
      print('Please select an ecoregion');
      return;
    }
    var selectedFeature = india_ecoregions.filter(ee.Filter.eq('ECO_NAME', selectedEco));
    roi_boundary = selectedFeature.geometry().intersection(india.geometry(), ee.ErrorMargin(1));

    lulcAnalysis.setROI(roi_boundary, inferenceMap);
    rainfall.setROI(roi_boundary, trainingMap);
    temp.setROI(roi_boundary, trainingMap);
    elevation.setROI(roi_boundary, trainingMap);
    soil.setROI(roi_boundary, trainingMap);
    terrain.setROI(roi_boundary, trainingMap);
    ldd.setROI(roi_boundary, inferenceMap);
    changeDetection.setROI(roi_boundary, trainingMap);
    fire.setROI(roi_boundary, trainingMap);
    one_map.setROI(roi_boundary, inferenceMap);
    spatial.setROI(roi_boundary, inferenceMap);

    var roiOutline = ee.Image().byte().paint({
    featureCollection: selectedFeature,
    color: 1,
    width: 2  
  });
  
    replaceLayer(trainingMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));
    replaceLayer(inferenceMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));

    print('ROI set for: ' + selectedEco);
    roi_set = true;
  }
});

var clearEcoLocationBtn = ui.Button({
  label: 'Clear Location',
  onClick: function() {
    ecoDropdown.setValue(null);
    roi_boundary = null;
    roi_set = false;

    [trainingMap, inferenceMap].forEach(function(m) {
      m.layers().reset(); 
    });

    [trainingMap, inferenceMap].forEach(function(m) {
      
      var widgetsToRemove = [];
      m.widgets().forEach(function(w) {
        widgetsToRemove.push(w);
      });
      widgetsToRemove.forEach(function(w) {
        m.widgets().remove(w);
      });
    });

    if (typeof rainfall !== 'undefined' && rainfall.legends) rainfall.legends = [];
    if (typeof temp !== 'undefined' && temp.legends) temp.legends = [];
    if (typeof elevation !== 'undefined' && elevation.legends) elevation.legends = [];
    if (typeof fire !== 'undefined' && fire.legends) fire.legends = [];
    if (typeof changeDetection !== 'undefined' && changeDetection.legends) changeDetection.legends = [];

    if (lastValidationLayer) {
      trainingMap.remove(lastValidationLayer);
      lastValidationLayer = null;
    }
    if (lastValidationLegend) {
      trainingMap.widgets().remove(lastValidationLegend);
      lastValidationLegend = null;
    }
    print('Cleared location, layers, and legends. You can now start afresh from Step 1.');
  }
});

// ================= STEP 2: Locate Restoration Site =================
controlPanel.add(ui.Label('Step 2: Locate Restoration Site', {
  fontWeight: 'bold', fontSize: '16px'
}));
controlPanel.add(ui.Label({
  value: 'After selecting your ecoregion (Step 1), zoom into your restoration site area within the boundary. ' +
         'Then click on the map to mark the restoration site location. Please set it once you are done',
  style: {'fontSize': '14px'}
}));
controlPanel.add(ui.Label({
  value: '*A red coloured boundary will appear around the clicked point',
  style: {'fontSize': '14px'}
}));
controlPanel.add(loadingLabel);

var buttonRow = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '10px 0', padding: '0 10px'}
});

var legendPanel = null;
function show_legend_on_map() {
  if (!roi_boundary) return;
  var layers = [
    {image: lulcAnalysis.getLoadedImage ? lulcAnalysis.getLoadedImage() : null, name: 'LULC'},
    {image: spatial.getLoadedImage ? spatial.getLoadedImage() : null, name: 'Spatial'},
    {image: rainfall.getLoadedImage ? rainfall.getLoadedImage() : null, name: 'Rainfall'},
    {image: temp.getLoadedImage ? temp.getLoadedImage() : null, name: 'Temperature'},
    {image: elevation.getLoadedImage ? elevation.getLoadedImage() : null, name: 'Elevation'},
    {image: soil.getLoadedImage ? soil.getLoadedImage() : null, name: 'Soil'},
    {image: ldd.getLoadedImage ? ldd.getLoadedImage() : null, name: 'Land Degradation'},
    {image: changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null, name: 'Change Detection'},
    {image: fire.getLoadedImage ? fire.getLoadedImage(inferYears.base, inferYears.current) : null, name: 'Fire'},
    {image: terrain.getLoadedImage ? terrain.getLoadedImage() : null, name: 'Terrain'},
    {image: naturalForests.getLoadedImage ? naturalForests.getLoadedImage() : null, name: 'Natural Forests'},
    {image: one_map.getOneMap ? one_map.getOneMap() : null, name: 'Open Natural Ecosystems (ONEs)'}, 
    {image: step5ValidationMask || null, name: 'Validation pixels'}
  ];
  
  var layerPalettes = {
    'LULC': ['#333333'],
    'Rainfall': ['blue'],
    'Temperature': ['#ff00ff'],
    'Elevation': ['brown'],
    'Soil': ['#8D6E63'],
    'Land Degradation': ['orange'],
    'Change Detection': ['red'],
    'Fire': ['pink'],
    'Terrain': ['green'],
    'Spatial': ['#9c27b0'],
    'ONEs': ['#00ffaa'],
    'Natural Forests': ['teal'],
    'Validation pixels': ['#FFFF00']};

  function addLegendToMap(mapObj) {
    var legendPanel = ui.Panel({
      style: {
        position: 'bottom-left',
        padding: '8px 15px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid #ccc'
      }
    });
    
    legendPanel.add(ui.Label('Legend', {fontWeight: 'bold', fontSize: '15px'}));
    
    Object.keys(layerPalettes).forEach(function(name) {
      var colorBox = ui.Label('', {
        backgroundColor: layerPalettes[name],
        padding: '8px',
        margin: '0 0 4px 0',
        border: '1px solid black'
      });
      var label = ui.Label(name, {margin: '0 0 4px 6px'});
      var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
      legendPanel.add(row);
    });
    mapObj.widgets().forEach(function(widget) {
      if (widget instanceof ui.Panel && widget.style().get('position') === 'bottom-left') {
        mapObj.remove(widget);}
    });
    mapObj.add(legendPanel);
  }
  addLegendToMap(trainingMap);
  print('Legend displayed on both maps (bottom-left).');
}

var setRestorationBtn = ui.Button({
  label: 'Set Restoration Location',
  style: {margin: '0 5px 0 0'},
  onClick: function() {
    if (!restorationPoint) {
      print('Click on the map to select a restoration site first.');
      return;
    }
    trainingMap.setCenter(
      restorationPoint.coordinates().get(0).getInfo(),
      restorationPoint.coordinates().get(1).getInfo(),
      restorationZoom
    );
    inferenceMap.setCenter(
      restorationPoint.coordinates().get(0).getInfo(),
      restorationPoint.coordinates().get(1).getInfo(),
      restorationZoom
    );
    restorationSet = true;
    show_legend_on_map();
    print('Restoration site finalized at point: ' +
          restorationPoint.coordinates().getInfo() +
          ' Zoom: ' + restorationZoom);
  }
});
var clearAndSetAgainButton = ui.Button({
  label: 'Clear & Set Again',
  style: {margin: '0 5px 0 0'},
  onClick: function() {
    clearRestorationSelection();}
});

buttonRow.add(setRestorationBtn);
buttonRow.add(clearAndSetAgainButton);
controlPanel.add(buttonRow);

var restorationPoint = null;
var restorationZoom = null;
var restorationSet = false;
var restorationLayerObj = null;

function clearRestorationSelection() {
  print('Clearing restoration site and resetting selection...');

  trainingMap.layers().forEach(function(layer) {
    if (layer.getName() === 'Restoration Site') {
      trainingMap.remove(layer);
    }
  });
  inferenceMap.layers().forEach(function(layer) {
    if (layer.getName() === 'Restoration Site') {
      inferenceMap.remove(layer);
    }
  });
  restorationPoint = null;
  restorationZoom = null;
  restorationSet = false;
  loadingLabel.setValue('Click on the map to select a new point.');

  if (roi_boundary && roi_set) {
    trainingMap.onClick(restorationClickHandler);
    print('You can now click again on the map to set a new restoration site.');
  } else {
    print('No ecoregion selected. Please complete Step 1 first.');
  }
}
  
var restorationClickHandler = function(coords) {
  if (!roi_set || !roi_boundary) {
    print('Please select an ecoregion first (Step 1).');
    return;
  }
  if (restorationPoint) {
    print("Restoration site already set. Use 'Clear & Set Again' to choose a new point.");
    return;
  }
  loadingLabel.setValue('Loading layers at clicked point...');
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  var withinROI = roi_boundary.contains(point, ee.ErrorMargin(10)).getInfo();
  var markerImage = ee.Image().paint(point.buffer(100), 1).visualize({palette: ['#ff0000'], opacity: 0.6});
  restorationLayerObj = markerImage; 
  replaceLayer(trainingMap, 'Restoration Site',
    ui.Map.Layer(markerImage, {}, 'Restoration Site'));
  
  if (inferenceActive) {
    replaceLayer(inferenceMap, 'Restoration Site',
      ui.Map.Layer(markerImage, {}, 'Restoration Site'));
  }
  restorationPoint = point;
  restorationZoom = trainingMap.getZoom();
  point.evaluate(function() {
    loadingLabel.setValue('Loaded layers at clicked point.');
  });

  var clickedEco = india_ecoregions.filterBounds(point).first();
  clickedEco.evaluate(function(f) {
    if (!f) {
      restorationStatus.setValue('Clicked point is outside India ecoregions.');
      return;
    }
    var ecoName = f.properties.ECO_NAME;
    print("Ecoregion auto-detected: " + ecoName);
    ecoDropdown.setValue(ecoName, true);

    roi_boundary = ee.Feature(f).geometry().intersection(india.geometry(), ee.ErrorMargin(1));

    lulcAnalysis.setROI(roi_boundary, inferenceMap);
    rainfall.setROI(roi_boundary, trainingMap);
    temp.setROI(roi_boundary, trainingMap);
    elevation.setROI(roi_boundary, trainingMap);
    soil.setROI(roi_boundary, trainingMap);
    terrain.setROI(roi_boundary, trainingMap);
    ldd.setROI(roi_boundary, inferenceMap);
    changeDetection.setROI(roi_boundary, trainingMap);
    fire.setROI(roi_boundary, trainingMap);
    spatial.setROI(roi_boundary, inferenceMap);

    var roiOutline = ee.Image().byte().paint({
      featureCollection: ee.FeatureCollection([f]),
      color: 1,
      width: 2
    });
    replaceLayer(trainingMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));
    replaceLayer(inferenceMap, 'ROI Boundary', ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary'));
  });

  var bio12 = ee.Image('WORLDCLIM/V1/BIO').select('bio12');
  var rainfallVal = bio12.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 1000
  }).get('bio12');
  rainfallVal.evaluate(function(val) {
    rainfall.setRange(val, val);
    print('Rainfall at clicked point: ' + val + ' mm');
  });
  
  var bio01 = ee.Image('WORLDCLIM/V1/BIO').select('bio01').multiply(0.1);
  var tempVal = bio01.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 1000
  }).get('bio01');
  tempVal.evaluate(function(val) {
    temp.setRange(val, val);  
    print('Temperature at clicked point: ' + val + ' °C');
  });

  var elevationImg = ee.Image('USGS/SRTMGL1_003');
  var elevVal = elevationImg.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30
  }).get('elevation');
  elevVal.evaluate(function(val) {
    elevation.setRange(val, val);
    print('Elevation at clicked point: ' + val + ' m');
  });
  
  var soilSample = soil.getSoilAtPoint(point);
  
  if (soilSample !== null) {
    soilSample.evaluate(function(res) {
      if (!res) return;
  
      if (res.Topsoil_Texture) {
        soil.tickCheckboxForValue('texture', Number(res.Topsoil_Texture));
      }
  
      if (res.Soil_Drainage) {
        soil.tickCheckboxForValue('drainage', Number(res.Soil_Drainage));
      }
  
      if (res.Topsoil_pH_Class) {
        soil.tickCheckboxForValue('ph', Number(res.Topsoil_pH_Class));
      }
  
      print('Soil at clicked point:', res);
    });
  }

  var fireVal = fire.getFireAtPoint(point);
  if (fireVal) {
    fireVal.evaluate(function(val) {
      if (val !== null) {
        fire.minFiresBox.setValue(String(val));
        print('Fire occurrences at clicked point: ' + val);
      } else {
        fire.minFiresBox.setValue('undefined');
        print('No fire data available for this pixel.');
      }
    });
  } else {
    fire.minFiresBox.setValue('undefined');
    print('Fire function returned null.');
  }

  terrain.setClassesAtPoint(point);

  var lddSample = ldd.getLddAtPoint(point);
  lddSample.evaluate(function(res) {
    if (!res) return;
    var value = Number(res[Object.keys(res)[0]]);
    if (!isNaN(value)) ldd.tickCheckboxForValue(value);
  });

};

trainingMap.onClick(restorationClickHandler);

function keepRestorationMarkerOnTop() {
  if (!restorationLayerObj) return;
  [trainingMap, inferenceMap].forEach(function(m) {
    var layers = m.layers();
    for (var i = layers.length() - 1; i >= 0; i--) {
      if (layers.get(i).getName() === 'Restoration Site') {
        m.layers().remove(layers.get(i));
      }
    }
    var freshMarkerLayer = ui.Map.Layer(restorationLayerObj, {}, 'Restoration Site');
    m.layers().add(freshMarkerLayer); 
  });
}

rainfall.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
temp.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
elevation.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
soil.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
fire.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
ldd.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
terrain.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
changeDetection.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
lulcAnalysis.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
one_map.setKeepMarkerOnTop(keepRestorationMarkerOnTop);
spatial.setKeepMarkerOnTop(keepRestorationMarkerOnTop);


// ================= Upload / Paste Rules JSON =================
controlPanel.add(ui.Label('Load rules from JSON', {
  fontWeight: 'bold',
  fontSize: '15px'
}));

controlPanel.add(ui.Label({
  value: 'In case you saved JSON rules from a previous session, you can paste the rules here to re-initialize all the layers.',
  style: {fontSize: '13px'}
}));

var rulesJsonTextbox = ui.Textbox({
  placeholder: '',
  style: {
    stretch: 'horizontal',
    height: '32px',
    fontFamily: 'monospace'
  },
});

function getRulesFromTextbox() {
  var jsonText = rulesJsonTextbox.getValue();
  if (!jsonText || jsonText.trim().length === 0) {
    print('Please paste valid rules JSON first.');
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    print('Invalid JSON:', e);
    return null;
  }
}

var loadRulesBtn = ui.Button({
  label: 'Load (Training)',
  style: { stretch: 'horizontal' },

  onClick: function () {
    var rules = getRulesFromTextbox();
    if (!rules) return;
    
    if (rules.metadata) {
    
      if (rules.metadata.project_name) {
        projectNameBox.setValue(rules.metadata.project_name);
        projectName = rules.metadata.project_name;
      }
    
      if (rules.metadata.description) {
        projectDescBox.setValue(rules.metadata.description);
        projectDescription = rules.metadata.description;
      }
    
      if (rules.metadata.contact) {
        contactBox.setValue(rules.metadata.contact);
        projectContact = rules.metadata.contact;
      }
    
      if (rules.metadata.use_case) {
        useCaseDropdown.setValue(rules.metadata.use_case);
        projectUseCase = rules.metadata.use_case;
      }
    
      print('Project metadata loaded from JSON');
    }

    if (rules.years && rules.years.train) {
      trainYears.base = rules.years.train.base;
      trainYears.restoration = rules.years.train.restoration;
    }

    if (rules.rainfall) {
      rainfall.setROI(roi_boundary, trainingMap);
      rainfall.applyFromJSON(rules.rainfall.min, rules.rainfall.max);
    }
    
    if (rules.temp) {
      temp.setROI(roi_boundary, trainingMap);
      temp.applyFromJSON(rules.temp.min, rules.temp.max);
    }

    if (rules.elevation) {
      elevation.setROI(roi_boundary, trainingMap);
      elevation.applyFromJSON(rules.elevation.min, rules.elevation.max);
    }

    if (rules.soil) {
      soil.setROI(roi_boundary, trainingMap);
      soil.setValues(rules.soil);
    }

    if (rules.terrain) {
      terrain.setROI(roi_boundary, trainingMap);
      terrain.setValues(rules.terrain);
    }

    if (rules.fire) {
      fire.setROI(roi_boundary, trainingMap);
      fire.setValues(rules.fire);
    }

    if (rules.change_detection && rules.years && rules.years.train) {
      changeDetection.setROI(roi_boundary, trainingMap);
      changeDetection.setYears(
        rules.years.train.base,
        rules.years.train.restoration,
        'validation'
      );
      changeDetection.setValues(rules.change_detection);
      changeDetection.applyFromJSON(trainingMap, null);
    }
    
    var masks = [];
    
    var r = rainfall.getLoadedImage ? rainfall.getLoadedImage() : null;
    var t = temp.getLoadedImage ? temp.getLoadedImage() : null;
    var e = elevation.getLoadedImage ? elevation.getLoadedImage() : null;
    var s = soil.getLoadedImage ? soil.getLoadedImage() : null;
    var tr = terrain.getLoadedImage ? terrain.getLoadedImage() : null;
    var f = fire.getLoadedImage ? fire.getLoadedImage() : null;
    var c = changeDetection.getTrainingImage ? changeDetection.getTrainingImage() : null;
    
    [r, t, e, s, tr, f, c].forEach(function(img){
      if (img) masks.push(img);
    });
    
    if (masks.length > 0) {
    
      step5ValidationMask = masks
        .reduce(function(acc, img){
          return acc.and(img);
        });
    
      var vis = {palette:['yellow'], min:0, max:1};
    
      replaceLayer(
        trainingMap,
        'Validation pixels',
        ui.Map.Layer(step5ValidationMask.selfMask(), vis, 'Validation pixels')
      );
    
      print('Validation pixels computed');
    }

    print('Training map rules loaded');
  }
});

var applyRulesBtn = ui.Button({
  label: 'Apply (Inference)',
  style: { stretch: 'horizontal' },

  onClick: function () {
    var rules = getRulesFromTextbox();
    if (!rules) return;

    // ================= YEARS (INFERENCE ONLY) =================
    if (rules.years && rules.years.infer) {
      inferYears.base = rules.years.infer.base;
      inferYears.current = rules.years.infer.current;
    }

    // ================= INFERENCE-ONLY MODULES =================
    if (rules.change_detection && rules.years && rules.years.infer) {
      changeDetection.setROI(roi_boundary, inferenceMap);
      changeDetection.setYears(
        rules.years.infer.base,
        rules.years.infer.current,
        'test'
      );
      changeDetection.setValues(rules.change_detection);
      changeDetection.applyFromJSON(null, inferenceMap);
    }

    if (rules.lulc) {
      lulcAnalysis.setROI(roi_boundary, inferenceMap, inferYears.current);
      lulcAnalysis.setValues(rules.lulc, inferenceMap);
    }
    
    if (rules.spatial) {
      spatial.setROI(roi_boundary, inferenceMap, inferYears.current);
      spatial.setValues(rules.spatial, inferenceMap);
    }

    if (rules.land_degradation) {
      ldd.setROI(roi_boundary, inferenceMap);
      ldd.setValues(rules.land_degradation);
      ldd.applyFromJSON();
    }

    if (rules.ones) {
      one_map.setROI(roi_boundary, inferenceMap);
      one_map.setValues(rules.ones);
    }
    
    // ================= FINAL INFERENCE AND PIXELS =================
    var masks = [];
    
    var r  = rainfall.getLoadedImage ? rainfall.getLoadedImage() : null;
    var t  = temp.getLoadedImage ? temp.getLoadedImage() : null;
    var e  = elevation.getLoadedImage ? elevation.getLoadedImage() : null;
    var s  = soil.getLoadedImage ? soil.getLoadedImage() : null;
    var tr = terrain.getLoadedImage ? terrain.getLoadedImage() : null;
    var f  = fire.getLoadedImage ? fire.getLoadedImage(inferYears.base, inferYears.current) : null;
    var cd = changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null;
    
    [r, t, e, s, tr, f, cd].forEach(function(img){
      if (img) masks.push(img);
    });
    
    if (masks.length > 0) {
    
      var inferenceMask = masks.reduce(function(acc, img){
        return acc.and(img);
      });
    
      var vis = {palette:['yellow'], min:0, max:1};
      
      var layers = inferenceMap.layers();
      
      for (var i = layers.length() - 1; i >= 0; i--) {
        var layer = layers.get(i);
        if (layer.getName() === 'Computed pixels') {
          inferenceMap.layers().remove(layer);
        }
      }
    
      replaceLayer(
        inferenceMap,
        'Inference pixels',
        ui.Map.Layer(inferenceMask.selfMask(), vis, 'Computed pixels')
      );
    
      print('Inference AND pixels computed');
    }

    print('Inference map rules applied');
    currentAndImage = computeCurrentAndImage();
  }
});

var buttonRow = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: { stretch: 'horizontal' }
});

buttonRow.add(loadRulesBtn);
buttonRow.add(applyRulesBtn);

controlPanel.add(rulesJsonTextbox);
controlPanel.add(buttonRow);


var applyRulesBtn = ui.Button({
  label: 'Apply Rules from JSON',
  style: { stretch: 'horizontal' },

  onClick: function () {

    var jsonText = rulesJsonTextbox.getValue();
    if (!jsonText || jsonText.trim().length === 0) {
      print('Please paste valid rules JSON first.');
      return;
    }

    var rules;
    try {
      rules = JSON.parse(jsonText);
    } catch (e) {
      print('Invalid JSON:', e);
      return;
    }

    if (rules.years) {

      // ---- Training map years (Step 3) ----
      if (rules.years.train) {
        trainYears.base = rules.years.train.base;
        trainYears.restoration = rules.years.train.restoration;
      }

      // ---- Inference map years (Step 6) ----
      if (rules.years.infer) {
        inferYears.base = rules.years.infer.base;
        inferYears.current = rules.years.infer.current;
      }
    }

    // ---------- SHARED MODULES (BOTH MAPS) ----------
    if (rules.rainfall) {
      rainfall.setROI(roi_boundary, trainingMap);
      rainfall.applyFromJSON(
        rules.rainfall.min,
        rules.rainfall.max
      );
    }
    
    if (rules.temp) {
      temp.setROI(roi_boundary, trainingMap);
      temp.applyFromJSON(
        rules.temp.min,
        rules.temp.max
      );
    }

    if (rules.elevation) {
      elevation.setROI(roi_boundary, trainingMap);
      elevation.applyFromJSON(
        rules.elevation.min,
        rules.elevation.max
      );
    }

    if (rules.soil) {
      soil.setROI(roi_boundary, trainingMap);
      soil.setValues(rules.soil);
    }

    if (rules.terrain) {
      terrain.setROI(roi_boundary, trainingMap);
      terrain.setValues(rules.terrain);
    }
    
    if (rules.fire) {
      fire.setROI(roi_boundary, trainingMap);
      fire.setValues(rules.fire);
    }
    
    if (rules.change_detection) {
      changeDetection.setROI(roi_boundary, trainingMap);
      changeDetection.setROI(roi_boundary, inferenceMap);
      changeDetection.setYears(
        rules.years.train.base,
        rules.years.train.restoration,
        'validation'
      );
      changeDetection.setYears(
        rules.years.infer.base,
        rules.years.infer.current,
        'test'
      );
      changeDetection.setValues(rules.change_detection);
      changeDetection.applyFromJSON(null, inferenceMap);
    }

    // ---------- INFERENCE-ONLY MODULES ----------
    if (rules.lulc) {
      lulcAnalysis.setROI(roi_boundary, inferenceMap, inferYears.current);
      lulcAnalysis.setValues(rules.lulc, inferenceMap);
    }
    
    if (rules.spatial) {
      spatial.setROI(roi_boundary, inferenceMap, inferYears.current);
      spatial.setValues(rules.spatial, inferenceMap);
    }

    if (rules.land_degradation) {
      ldd.setROI(roi_boundary, inferenceMap);
      ldd.setValues(rules.land_degradation);
      ldd.applyFromJSON();
    }
    
    if (rules.ones) {
      one_map.setROI(roi_boundary, inferenceMap);
      one_map.setValues(rules.ones);
    }

    print('Rules + years applied correctly to both maps');
  }
});


// ================= PROJECT META INPUTS =================
var projectName = null;
var projectDescription = null;
var projectContact = null;
var projectUseCase = null;

controlPanel.add(ui.Label('Project Metadata', {fontWeight:'bold', fontSize:'16px'}));

var projectNameBox = ui.Textbox({
  placeholder: 'Project Name',
  style: {stretch:'horizontal'}
});

var projectDescBox = ui.Textbox({
  placeholder: 'Description',
  style: {stretch:'horizontal'}
});

var contactBox = ui.Textbox({
  placeholder: 'Contact Email / Person',
  style: {stretch:'horizontal'}
});

var useCaseDropdown = ui.Select({
  items: [
    'Finding reference sites',
    'Scaling up successful restoration',
    'Identifying habitat corridors'
  ],
  placeholder: 'Select Use Case',
  style: {stretch: 'horizontal'}
});

controlPanel.add(projectNameBox);
controlPanel.add(projectDescBox);
controlPanel.add(contactBox);
controlPanel.add(useCaseDropdown);

var saveMetadataBtn = ui.Button({
  label: 'Save Project Metadata',
  style: {stretch: 'horizontal'},
  onClick: function () {

    projectName = projectNameBox.getValue();
    projectDescription = projectDescBox.getValue();
    projectContact = contactBox.getValue();
    projectUseCase = useCaseDropdown.getValue();

    print('Project Metadata Saved');
    print('Project Name:', projectName);
    print('Description:', projectDescription);
    print('Contact:', projectContact);
    print('Use Case:', projectUseCase);
  }
});

controlPanel.add(saveMetadataBtn);


// ================= STEP 3 =================
controlPanel.add(ui.Label('Step 3: Select Environment Layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'Find the best combination of these inputs that helps you isolate the reference site from surrounding areas. ',
  style: {'fontSize': '14px'}
}));

controlPanel.add(ui.Label({
  value: '* To re-load any layer please click on Clear Map and then load again ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(rainfall.getPanel());
controlPanel.add(temp.getPanel());
controlPanel.add(elevation.getPanel());
controlPanel.add(soil.getPanel());
controlPanel.add(terrain.getPanel());

function createGoToLocationButton(map, labelText) {
  return ui.Button({
    label: labelText,
    style: {stretch: 'horizontal'},
    onClick: function() {
      if (!restorationPoint || !restorationZoom) {
        print('Please select a restoration site first using "Set Restoration Location".');
        return;
      }
      var lon = restorationPoint.coordinates().get(0).getInfo();
      var lat = restorationPoint.coordinates().get(1).getInfo();
      map.setCenter(lon, lat, restorationZoom);
      print('Moved map to restoration site at (' + lon.toFixed(4) + ', ' + lat.toFixed(4) + ')');
    }
  });
}

// ================= STEP 4 =================
controlPanel.add(ui.Label('Step 4: Select temporal range to filter on time-based layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'We have provided added functionality to isolate reference sites based on two temporal layers – fire incidence and change detection – but you can skip this if you are using the tool for the first time. For advanced users, for case-1 when you have a reference site and want to find other candidate sites that can be similarly restored, set the restoration start year as when you initiated restoration at your site and the base year as 1985. For case-2 when you have a candidate site and want to find similar reference sites, set the restoration start year as something recent like 2024 and the base year as when restoration started at the reference site or 1985 in case the reference sites you seek are pristine and have gone unchanged. ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(yearPanel);
controlPanel.add(ui.Label({
  value: '',
  style: {'fontSize': '14px'}
}));

var legendPanel = null;
function showAndOnMap() {
  if (!roi_boundary) return;

  var layers = [
    {image: lulcAnalysis.getLoadedImage ? lulcAnalysis.getLoadedImage() : null, name: 'LULC'},
    {image: spatial.getLoadedImage ? spatial.getLoadedImage() : null, name: 'Spatial'},
    {image: rainfall.getLoadedImage ? rainfall.getLoadedImage() : null, name: 'Rainfall'},
    {image: temp.getLoadedImage ? temp.getLoadedImage() : null, name: 'Temperature'},
    {image: elevation.getLoadedImage ? elevation.getLoadedImage() : null, name: 'Elevation'},
    {image: soil.getLoadedImage ? soil.getLoadedImage() : null, name: 'Soil'},
    {image: ldd.getLoadedImage ? ldd.getLoadedImage() : null, name: 'Land Degradation'},
    {image: changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null, name: 'Change Detection'},
    {image: fire.getLoadedImage ? fire.getLoadedImage(inferYears.base, inferYears.current) : null, name: 'Fire'},
    {image: terrain.getLoadedImage ? terrain.getLoadedImage() : null, name: 'Terrain'},
    {image: one_map.getOneMap ? one_map.getOneMap() : null, name: 'Open Natural Ecosystems (ONEs)'}, 
    {image: step5ValidationMask || null, name: 'Validation pixels'}
  ];
  
  var layerPalettes = {
    'LULC': ['#333333'],
    'Rainfall': ['blue'],
    'Temperature': ['#ff00ff'],
    'Elevation': ['brown'],
    'Soil': ['#8D6E63'],
    'Land Degradation': ['orange'],
    'Change Detection': ['red'],
    'Fire': ['pink'],
    'Terrain': ['green'],
    'Spatial': ['#9c27b0'],
    'Open Natural Ecosystems (ONEs)': ['#00ffaa'],
    'Validation pixels': ['#FFFF00']
  };
  
  var desiredOrder = ['Rainfall','Temperature','Elevation','Soil','Terrain','Land Degradation','Fire','Change Detection','LULC','Spatial', 'Validation pixels'];


  function addLegendToMap(mapObj) {
    var legendPanel = ui.Panel({
      style: {
        position: 'bottom-left',
        padding: '8px 15px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid #ccc'
      }
    });
    
    legendPanel.add(ui.Label('Legend', {fontWeight: 'bold', fontSize: '15px'}));
    
    Object.keys(layerPalettes).forEach(function(name) {
      var colorBox = ui.Label('', {
        backgroundColor: layerPalettes[name],
        padding: '8px',
        margin: '0 0 4px 0',
        border: '1px solid black'
      });
      var label = ui.Label(name, {margin: '0 0 4px 6px'});
      var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
      legendPanel.add(row);
    });
    
    mapObj.widgets().forEach(function(widget) {
      if (widget instanceof ui.Panel && widget.style().get('position') === 'bottom-left') {
        mapObj.remove(widget);}
    });
    mapObj.add(legendPanel);
  }

  addLegendToMap(trainingMap);
  print('Legend displayed on both maps (bottom-left).');
}


var enterStep3YearsBtn = ui.Button({
  label: 'Set Years',
  onClick: function() {
    var valStart = parseInt(preDegBox.getValue());
    var valEnd = parseInt(restorationStartBox.getValue());
    if (isNaN(valStart) || isNaN(valEnd)) {
      print('Please enter valid numeric years for Step 4.');
      return;
    }
    trainYears.base = valStart;
    trainYears.restoration = valEnd;
    changeDetection.setYears(valStart, valEnd, 'validation');
    fire.setYears(valStart, valEnd, 'validation');
    print('Step 4 years saved:');
  }
});
controlPanel.add(ui.Panel([enterStep3YearsBtn], ui.Panel.Layout.flow('horizontal')));
controlPanel.add(fire.getPanel());
controlPanel.add(changeDetection.getPanel());

// ================= STEP 5 =================
controlPanel.add(ui.Label('Step 5: Evaluate rules', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'Iteratively evaluate the quality of your rules to see if they help identify the reference site(s). ',
  style: {'fontSize': '14px'}
}));

var lastValidationLayer = null;
var lastValidationLegend = null;
var step5MaskNoChangeDet = null;
var step5UsedChangeDet = false;
var runValidationBtn = ui.Button({
  label: 'Run step 5',
  onClick: function() {
    if (!inferenceActive) {
    inferenceActive = true;
    rainfall.setROI(roi_boundary, inferenceMap);
    temp.setROI(roi_boundary, inferenceMap);
    elevation.setROI(roi_boundary, inferenceMap);
    soil.setROI(roi_boundary, inferenceMap);
    terrain.setROI(roi_boundary, inferenceMap);
    fire.setROI(roi_boundary, inferenceMap);
    changeDetection.setROI(roi_boundary, inferenceMap);
    ldd.setROI(roi_boundary, inferenceMap);
    one_map.setROI(roi_boundary, inferenceMap);
  
    var roiOutline = ee.Image().byte().paint({
      featureCollection: ee.FeatureCollection([selectedEcoFeature]),
      color: 1,
      width: 2
    });
    replaceLayer(
      inferenceMap,
      'ROI Boundary',
      ui.Map.Layer(roiOutline, {palette: ['black']}, 'ROI Boundary')
    );
  
    ui.Map.Linker([trainingMap, inferenceMap]);
    print('Inference map activated at Step 5');
   }

    if (!roi_boundary) {
      print('Please set ROI first.');
      return;
    }
    var roi = roi_boundary;
    var valStart = trainYears.base || null;
    var valEnd = trainYears.restoration || null;
    var changeDetImg = null;
    var fireImg = null;
    if (valStart && valEnd) {
      changeDetImg = changeDetection.getTrainingImage ?
          changeDetection.getTrainingImage(valStart, valEnd) : null;
      fireImg = fire.getLoadedImage ?
          fire.getLoadedImage(valStart, valEnd) : null;
    } else {
      print('Step 4 years not set — skipping change detection & fire.');
    }
  var rainfallImg   = rainfall.getLoadedImage && rainfall.getLoadedImage() ? rainfall.getLoadedImage() : null;
  var tempImg   = temp.getLoadedImage && temp.getLoadedImage() ? temp.getLoadedImage() : null;
  var elevationImg  = elevation.getLoadedImage && elevation.getLoadedImage() ? elevation.getLoadedImage() : null;
  var soilImg = soil.getLoadedImage && soil.getLoadedImage() ? soil.getLoadedImage() : null;
  var terrainImg    = terrain.getLoadedImage && terrain.getLoadedImage() ? terrain.getLoadedImage() : null;
  var lddImg        = ldd.getLoadedImage && ldd.getLoadedImage() ? ldd.getLoadedImage() : null;
  changeDetImg  = changeDetection.getTrainingImage ? changeDetection.getTrainingImage(valStart, valEnd) : null;
  fireImg       = fire.getLoadedImage && fire.getLoadedImage(valStart, valEnd) ? fire.getLoadedImage(valStart, valEnd) : null;

  var baseLayers = [rainfallImg, tempImg, elevationImg, soilImg, terrainImg, fireImg]
      .filter(function(img) { return img !== null && img !== undefined; });

    var baseMask = (baseLayers.length > 0)
      ? baseLayers.map(function(i){ return i.gt(0).selfMask(); })
          .reduce(function(a,b){ return a.and(b); })
      : ee.Image(1);

    if (changeDetImg) {
      step5UsedChangeDet = true;
      step5MaskNoChangeDet = baseMask;
      step5ValidationMask = baseMask.and(changeDetImg.gt(0).selfMask()).clip(roi).selfMask();
    } else {
      step5UsedChangeDet = false;
      step5MaskNoChangeDet = baseMask;
      step5ValidationMask = baseMask.clip(roi).selfMask();
      print('No change detection used in Step 5.');
    }
    
    trainingMap.layers().forEach(function(layer) {
    var name = layer.getName ? layer.getName() : '';
    if (name && name.toLowerCase().indexOf('lulc') !== -1) {
      trainingMap.remove(layer);
    }
    else if (name && (name.indexOf('Annual Precipitation') !== -1 || name.indexOf('Restoration Site') !== -1)
    ) {layer.setShown(true);
    } else {layer.setShown(false);
    }
  });
  inferenceMap.layers().forEach(function(layer) {
  var name = layer.getName ? layer.getName() : '';
  if (name && (name.indexOf('Restoration Site') !== -1 )) {
    layer.setShown(true); 
  } else {
    layer.setShown(false); 
  }
});

    var validationLayer = ui.Map.Layer(step5ValidationMask, {palette: ['yellow'], min: 0, max: 1}, 'Validation pixels');
    replaceLayer(trainingMap, 'Validation pixels', validationLayer);

    var makeRow = function(color, name) {
      return ui.Panel({
        widgets: [
          ui.Label({
            style: {backgroundColor: '#' + color, padding: '8px', margin: '0 0 4px 0', border: '1px solid yellow'}
          }),
          ui.Label({value: name, style: {margin: '0 0 4px 6px'}})
        ],
        layout: ui.Panel.Layout.flow('horizontal')
      });
    };
  }
});
var goToStep5Btn = createGoToLocationButton(trainingMap, 'Go to my location');
controlPanel.add(ui.Panel([runValidationBtn, goToStep5Btn], ui.Panel.Layout.flow('horizontal')));

// ================= STEP 6 =================
controlPanel.add(ui.Label('Step 6: Enter year for masking layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'This section is relevant especially for case-1 when you are trying to identify potential restoration sites, it allows you to do finer selection of potential locations. Specify current year as a recent year like 2024 when you want to identify potential sites that today look like what the reference site looked like when restoration was initiated there.',
  style: {'fontSize': '14px'}
}));
controlPanel.add(ui.Label({
  value: 'Even for case-2 where you want to find reference sites, this section can help do a finer filtering based on the current year. ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(yearPanelApp);

var enterStep6YearsBtn = ui.Button({
  label: 'Set Years',
  onClick: function() {
    var currentYear = parseInt(currentYearBox.getValue());
    if (isNaN(currentYear)) {
      print('Please enter a valid current year for Step 6.');
      return;
    }
    inferYears.current = currentYear;
    lulcAnalysis.setYears(currentYear);
    spatial.setYears(currentYear);
    if (trainYears.restoration) {
      changeDetection.setYears(trainYears.restoration, currentYear, 'test');
      print('Step 6 years saved (with change detection).');
    } else {
      print('Step 6 years saved (no change detection — Step 4 not set).');
    }
  }
});
controlPanel.add(ui.Panel([enterStep6YearsBtn], ui.Panel.Layout.flow('horizontal')));
controlPanel.add(lulcAnalysis.getPanel());
controlPanel.add(spatial.getPanel());
controlPanel.add(one_map.getPanel())
controlPanel.add(ldd.getPanel());
controlPanel.add(naturalForests.getPanel());

controlPanel.add(ui.Label({
  value: 'Likewise, especially for case-2 to identify reference sites you may want to further mask on whether the sites are natural forests or not. ',
  style: {'fontSize': '14px'}
}));

// ================= STEP 8 =================
controlPanel.add(ui.Label('Step 8: Apply rules', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'You are now ready to obtain the output for potential restoration sites in the ecoregion. ',
  style: {'fontSize': '14px'}
}));

var lastComputedLayer = null;

var computeAndBtn = ui.Button({
  label: 'Run Step 8',
  onClick: function() {
    if (!roi_boundary) {
      print('Please set ROI first.');
      return;
    }
    if (!inferYears.current) {
      print('Please enter Step 6 current year first.');
      return;
    }
    var roi = roi_boundary;
    var currentYear = inferYears.current;

    var lulcImg       = lulcAnalysis.getLoadedImage && lulcAnalysis.getLoadedImage() ? lulcAnalysis.getLoadedImage() : null;
    var spatialImg       = spatial.getLoadedImage && spatial.getLoadedImage() ? spatial.getLoadedImage() : null;
    var onesImg = one_map.getOneMap();
    var rainfallImg   = rainfall.getLoadedImage && rainfall.getLoadedImage() ? rainfall.getLoadedImage() : null;
    var tempImg   = temp.getLoadedImage && temp.getLoadedImage() ? temp.getLoadedImage() : null;
    var elevationImg  = elevation.getLoadedImage && elevation.getLoadedImage() ? elevation.getLoadedImage() : null;
    var soilImg = soil.getLoadedImage && soil.getLoadedImage() ? soil.getLoadedImage() : null;
    var lddImg        = ldd.getLoadedImage && ldd.getLoadedImage() ? ldd.getLoadedImage() : null;
    var nfImg = naturalForests.getLoadedImage ? naturalForests.getLoadedImage() : null;
    var terrainImg = terrain.getLoadedImage && ldd.getLoadedImage() ? terrain.getLoadedImage() : null;
    var fireImg = fire.getLoadedImage ? fire.getLoadedImage(trainYears.restoration, currentYear) : null;
    var changeDetImg = changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null;
    var andImage; 
    if (step5ValidationMask) {
      andImage = step5ValidationMask;
      if (changeDetImg) {
        andImage = andImage.and(changeDetImg.gt(0));
      }
    } else {
      andImage = ee.Image(1);
      [rainfallImg, tempImg, elevationImg, soilImg,
        terrainImg, fireImg, changeDetImg]
      .filter(function(img){ return img; })
      .forEach(function(img){
        andImage = andImage.and(img.gt(0));
      });
    }
    [lulcImg, spatialImg, lddImg, nfImg]
      .filter(function(img){ return img; })
      .forEach(function(img){
        andImage = andImage.and(img.gt(0));
      });

    if (onesImg) {
      andImage = andImage.and(onesImg.gt(0));
    }
      
    andImage = andImage.clip(roi).selfMask();
    
    currentAndImage = andImage;
    
    inferenceMap.layers().forEach(function(layer) {
      var name = layer.getName ? layer.getName() : '';
      if (!name) return;
      var lname = name.toLowerCase();
      if (lname.indexOf('restoration site') !== -1) {
        layer.setShown(true);
      } else {
        layer.setShown(false);
      }
    });
    replaceLayer(inferenceMap, 'Computed pixels', ui.Map.Layer(andImage, {palette:['yellow'], min:0, max:1}, 'Computed pixels'));
    
    var computedLegend = ui.Panel({
      style: {
        position: 'bottom-left',
        padding: '8px 15px',
        backgroundColor: 'white'
      }
    });
  
    computedLegend.add(ui.Label({
      value: 'Computed pixels',
      style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
    }));
    
    var makeRow = function(color, name) {
      return ui.Panel({
        widgets: [
          ui.Label({
            style: {
              backgroundColor: '#' + color,
              padding: '8px',
              margin: '0 0 4px 0',
              border: '1px solid black'
            }
          }),
          ui.Label({value: name, style: {margin: '0 0 4px 6px'}})
        ],
        layout: ui.Panel.Layout.flow('horizontal')
      });
    };
    
    computedLegend.add(makeRow('FFFF00', 'Final computed pixels'));
    inferenceMap.widgets().add(computedLegend);
  }
});
var goToStep8Btn = createGoToLocationButton(inferenceMap, 'Go to my location');
controlPanel.add(ui.Panel([computeAndBtn, goToStep8Btn], ui.Panel.Layout.flow('horizontal')));

// ================= STEP 9 =================
controlPanel.add(ui.Label('Step 9: Fine tune', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'If you are happy with the output, we can help clean up some noise and provide a segmented map of potential areas needing restoration.  ',
  style: {'fontSize': '14px'}
}));

var sizeFilterCheckbox = ui.Checkbox({
  label: 'Size Filtering',
  value: false
});

var applyFiltersBtn = ui.Button({
  label: 'Apply Selected Filters',
  onClick: function() {
    if (!roi_boundary) {
      print('Please set ROI first.');
      return;
    }
    var lastLayer = inferenceMap.layers().get(inferenceMap.layers().length() - 1);
    var combinedCondition = null;
    try {
      combinedCondition = lastLayer.getEeObject();
    } catch (e) {
      print('Could not get last ee object from map layer. Make sure a computed layer exists.');
      return;
    }

    var result = combinedCondition;
    if (sizeFilterCheckbox.getValue()) {
      result = sizeFilter.apply(result, roi_boundary, inferenceMap);
    }
  }
});

var filterOptionsPanel = ui.Panel({
  widgets: [
    ui.Label('Select filters to apply:'),
    sizeFilterCheckbox,
    applyFiltersBtn
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {stretch: 'horizontal'}
});

controlPanel.add(filterOptionsPanel);

// ================= LAYOUT =================
var mapsSplit = ui.SplitPanel({firstPanel: trainingMap, secondPanel: inferenceMap, orientation: 'horizontal', wipe: false, style: {stretch: 'both'}});
var mapsWrapper = ui.Panel({widgets: [mapsSplit], layout: ui.Panel.Layout.flow('horizontal'), style: {stretch: 'both'}});
var fullSplit = ui.SplitPanel({firstPanel: mapsWrapper, secondPanel: controlPanel, orientation: 'horizontal', wipe: false, style: {stretch: 'both'}});
ui.root.clear();
ui.root.add(fullSplit);

// ====================== 1) Collect Rules Function =========================
function unwrap(ruleObj) {
  if (!ruleObj) return null;
  var keys = Object.keys(ruleObj);
  return keys.length === 1 ? ruleObj[keys[0]] : ruleObj;
}

function getAllRulesJSON_Object() {

  var json = {};

  if (rainfall && rainfall.getRule) {
    var r = rainfall.getRule();
    if (r) json.rainfall = [r.min, r.max];
  }
  
  if (temp && temp.getRule) {
    var r = temp.getRule();
    if (r) json.temp = [r.min, r.max];
  }

  if (elevation && elevation.getRule) {
    var e = elevation.getRule();
    if (e) json.elevation = [e.min, e.max];
  }

  if (soil && soil.getRule) {
    var s = soil.getRule();
    if (s) {
      json.soil = s;
    }
  }

  if (terrain && terrain.getRule) {
    json.terrain = terrain.getRule();
  }

  if (ldd && ldd.getRule) {
    json.land_degradation = ldd.getRule();
  }

  if (fire && fire.getRule) {
    json.fire = fire.getRule();
  }

  if (lulcAnalysis && lulcAnalysis.getRule) {
    json.lulc = lulcAnalysis.getRule();
  }
  
  if (spatial && spatial.getRule) {
    json.spatial = spatial.getRule();
  }

  if (changeDetection && changeDetection.getRule) {
    json.change_detection = changeDetection.getRule();
  }
  
  if (one_map && one_map.getRule) {
    var o = one_map.getRule();
    if (o) json.ones = o;
  }
  
  print(json);

  return json;
}


function applyRulesFromJSON(jsonText) {
  var rules;
  try {
    rules = JSON.parse(jsonText);
  } catch (e) {
    print('Invalid JSON');
    return;
  }

  print('Applying rules from JSON:', rules);

  if (rules.rainfall && rainfall.setRange) {
    rainfall.setRange(rules.rainfall.min, rules.rainfall.max);
  }
  
  if (rules.temp && temp.setRange) {
    temp.setRange(rules.temp.min, rules.temp.max);
  }

  if (rules.elevation && elevation.setRange) {
    elevation.setRange(rules.elevation.min, rules.elevation.max);
  }

  if (rules.soil && soil.setValues) {
    soil.setValues(rules.soil);
  }

  if (rules.terrain && terrain.setValues) {
    terrain.setValues(rules.terrain);
  }

  if (rules.land_degradation && ldd.setValues) {
    ldd.setValues(rules.land_degradation);
  }

  if (rules.fire && fire.setFireValue) {
    fire.setFireValue(rules.fire);
  }

  if (rules.lulc && lulcAnalysis.setValues) {
    lulcAnalysis.setValues(rules.lulc);
  }
  
  if (rules.spatial && spatial.setValues) {
    spatial.setValues(rules.spatial);
  }

  if (rules.change_detection && changeDetection.setValues) {
    changeDetection.setValues(rules.change_detection);
  }
  
  if (rules.ones && ones.setValues) {
    ones.setValues(rules.ones);
  }

  showAndOnMap();
  print('Rules successfully re-initialized from JSON');
}


var exportVectorBtn = ui.Button({
  label: 'Export AND as Polygons (SHP)',
  onClick: function() {
    if (!currentAndImage || !roi_boundary) {
      print('Compute AND and set ROI first.');
      return;
    }

    // RE-EVALUATE AND LOGIC FOR EXPORT
    // We force the image to be 1 only where currentAndImage is 1, 
    // and explicitly mask out everything else.
    var exportImage = currentAndImage
      .updateMask(currentAndImage.gt(0)) // Remove all 0/NoData pixels
      .clip(roi_boundary)                // Hard-cut at ecoregion boundary
      .toInt();                          // Required for reduceToVectors

    var polygons = exportImage.reduceToVectors({
      geometry: roi_boundary,
      scale: 30,                     
      geometryType: 'polygon',
      eightConnected: true,
      labelProperty: 'AND',
      maxPixels: 1e13,
      bestEffort: false           
    });

    var finalPolygons = polygons.filterBounds(roi_boundary);
    
    var url = finalPolygons.getDownloadURL({
      format: 'kml'
    });
    
    var link = ui.Label({
      value: 'Download AND polygons (kml file)',
      targetUrl: url,
      style: {color: 'blue', textDecoration: 'underline'}
    });
    
    controlPanel.add(link);
    
    print('Download URL:', url);

    print('Strict Task Created. Run it in the Tasks tab.');
  }
});

controlPanel.add(exportVectorBtn);


// ====================== 2) Create DOWNLOAD button =========================
function convert_format(obj) {

  var newObj = {};

  Object.keys(obj).forEach(function(key) {

    // case 1 — rainfall or elevation AND is numeric 2-element array
    if ((key === 'rainfall' || key === 'elevation' || key === 'temp') &&
        Array.isArray(obj[key]) &&
        obj[key].length === 2 &&
        typeof obj[key][0] === 'number' &&
        typeof obj[key][1] === 'number') {

      newObj[key] = {
        min: obj[key][0],
        max: obj[key][1]
      };
    }
    
    else if (
      key === 'fire' &&
      (
        (Array.isArray(obj[key]) && typeof obj[key][0] === 'number') ||
        typeof obj[key] === 'number'
      )
    ) {
      newObj[key] = {
        min: Array.isArray(obj[key]) ? obj[key][0] : obj[key]
      };
    }

    else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      newObj[key] = convert_format(obj[key]);
    }

    else {
      newObj[key] = obj[key];
    }
  });

  return newObj;
}


var downloadRulesBtn = ui.Button({
  label: 'Print Final Rule JSON',
  onClick: function () {
    ee.Number(1).evaluate(function () {

      var rulesObj = getAllRulesJSON_Object();
      
      rulesObj.metadata = {
        project_name: projectName,
        description: projectDescription,
        contact: projectContact,
        use_case: projectUseCase
      };
      
      rulesObj.years = {
        train: {
          base: trainYears.base,
          restoration: trainYears.restoration
        },
        infer: {
          base: inferYears.base,
          current: inferYears.current
        }
      };

      var formatted = convert_format(rulesObj);
      var rulesJSON = JSON.stringify(formatted, null, 2);

      print('Final Rules Object:', rulesObj);
      print('Final Rules JSON (pretty):', rulesJSON);

      var jsonLabel = ui.Label({
        value: rulesJSON,
        style: {
          whiteSpace: 'pre',
          fontFamily: 'monospace',
          fontSize: '12px'
        }
      });

      controlPanel.add(jsonLabel);

      print('JSON export completed with Step 6+ rules included');
    });
  }
});

controlPanel.add(ui.Label({
  value: 'You can also generate the rules in a JSON output and save it for your site. You can later copy-paste these rules to initialize the app the next time you want to use it. ',
  style: {'fontSize': '14px'}
}));


var rulesTablePanel = ui.Panel({
  style: {
    stretch: 'horizontal',
    margin: '10px 0',
    padding: '8px',
    shown: false
  }
});

function capitalize(str) {
  return str.replace(/_/g, ' ')
            .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}


function buildRulesTable() {
  rulesTablePanel.clear();
  var rules = getAllRulesJSON_Object();

  if (!rules || Object.keys(rules).length === 0) {
    rulesTablePanel.add(ui.Label('No rules selected.'));
    return;
  }

  var table = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      border: '1px solid #777',
      padding: '0px',
      margin: '10px 0px',
      stretch: 'horizontal'
    }
  });

  function makeCell(text, width, bg, isHeader) {
    return ui.Label({
      value: text,
      style: {
        width: width,
        stretch: 'both',
        padding: '8px',
        margin: '0px',
        border: '0.5px solid #ccc',
        backgroundColor: bg,
        fontWeight: isHeader ? 'bold' : 'normal',
        whiteSpace: 'pre-wrap',
        fontSize: '13px'
      }
    });
  }

  var header = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '0px', padding: '0px', stretch: 'horizontal'}
  });
  header.add(makeCell('Layer', '30%', '#e0e0e0', true));
  header.add(makeCell('Values', '70%', '#e0e0e0', true));
  table.add(header);
  
  var metadataRows = [
    {label: 'Project Name', value: projectName},
    {label: 'Description', value: projectDescription},
    {label: 'Contact', value: projectContact},
    {label: 'Use Case', value: projectUseCase}
  ];
  
  metadataRows.forEach(function(item, idx) {
  
    if (!item.value) return;
  
    var bg = (idx % 2 === 0) ? '#ffffff' : '#f9f9f9';
  
    var row = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {margin: '0px', padding: '0px', stretch: 'horizontal'}
    });
  
    row.add(makeCell(item.label, '30%', bg, false));
    row.add(makeCell(item.value, '70%', bg, false));
  
    table.add(row);
  });

  var keys = Object.keys(rules);
  var rowIndex = 0;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = rules[key];

    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) continue;

    var valueStr;

    if (key === 'rainfall' && Array.isArray(value)) {
      valueStr = value[0] + ' - ' + value[1] + ' mm';
    } else if (key === 'elevation' && Array.isArray(value)) {
      valueStr = value[0] + ' - ' + value[1] + ' m';
    } else if (key === 'change_detection' && typeof value === 'object') {
      var fromYear = trainYears.base || '';
      var toYear   = trainYears.restoration || '';
    
      var fromVals = [];
      var toVals = [];
    
      if (Array.isArray(value)) {
        fromVals = value[0] || [];
        toVals   = value[1] || [];
      }
    
      else if (value.from && value.to) {
        fromVals = value.from;
        toVals   = value.to;
      }
    
      valueStr =
        "From (" + fromYear + "): " + fromVals.join(', ') +
        "\nTo (" + toYear + "): " + toVals.join(', ');

    } else if (Array.isArray(value)) {
      valueStr = value.join(', ');
    } else if (typeof value === 'object') {
      valueStr = JSON.stringify(value);
    } else {
      valueStr = String(value);
    }

    var bg = (rowIndex % 2 === 0) ? '#ffffff' : '#f9f9f9';
    rowIndex++;

    var row = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {
        margin: '0px',
        padding: '0px',
        stretch: 'horizontal'
      }
    });

    row.add(makeCell(capitalize(key), '30%', bg, false));
    row.add(makeCell(valueStr, '70%', bg, false));

    table.add(row);
  }

  rulesTablePanel.add(table);

  if (currentAndImage && roi_boundary) {

    var areaImage = ee.Image.pixelArea().divide(10000); // hectares

    var areaDict = currentAndImage
      .multiply(areaImage)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: roi_boundary,
        scale: 30,
        maxPixels: 1e13
      });

    areaDict.values().get(0).evaluate(function(areaHa) {

      var areaStr = areaHa
        ? areaHa.toFixed(2) + ' ha (' + (areaHa / 100).toFixed(2) + ' km²)'
        : '0 ha';

      var row = ui.Panel({
        layout: ui.Panel.Layout.flow('horizontal'),
        style: {
          margin: '0px',
          padding: '0px',
          stretch: 'horizontal'
        }
      });

      row.add(makeCell('Area of AND Polygons', '30%', bg, false));
      row.add(makeCell(areaStr, '70%', bg, false));

      table.add(row);
    });
  }
}

var showRulesBtn = ui.Button({
  label: 'Show Report',
  style: {stretch: 'horizontal'},
  onClick: function() {

    var isVisible = rulesTablePanel.style().get('shown');

    if (isVisible) {
      rulesTablePanel.style().set('shown', false);
    } else {
      buildRulesTable();  
      rulesTablePanel.style().set('shown', true);
    }
  }
});


var buttonRow = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal',
    margin: '8px 0'
  }
});

downloadRulesBtn.style().set({
  stretch: 'horizontal'
});

exportVectorBtn.style().set({
  stretch: 'horizontal'
});

buttonRow.add(downloadRulesBtn);
buttonRow.add(showRulesBtn);

controlPanel.add(buttonRow);
controlPanel.add(rulesTablePanel);
