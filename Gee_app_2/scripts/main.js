// Import modules
var lulcAnalysis = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/lulc');
var rainfall = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/bioclim');
var elevation = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/elevation');
var ldd = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/ldd');
var changeDetection = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/change_det');
var fire = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/fire');
var sizeFilter = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/sizebased');
var terrain = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/terrain');
var ones = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/ONE_map');
var soil = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/soil');
var naturalForests = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/natural_forests');
var temp = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/temp');
var spatial = require('users/ojasvibansal_total_precipitation/Ecotype_App:gee-app2/spatial');
// ================= GLOBAL VARIABLES =================
var roi_boundary = null;
var trainYears = {preDeg: null, restoration: null};
var inferYears = {preDeg: null, current: null};
var selected = null;
var currentAndImage = null;

// ================= CREATE SINGLE MAP =================
var map = ui.Map();
map.setCenter(78.06, 23.04, 5);
var legendPanel = null;

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
    'This is an experimental app under development and the results and methodology have yet to be validated. Use the app to review rules to identify prospective restoration locations similar to the listed reference sites. Please share any feedback and if you want to develop rules for your own restoration site then use this accompanying app. ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(ui.Label({
  value: '[Accompanying app to build rules]',
  targetUrl: 'https://ee-apoorvadewan13.projects.earthengine.app/view/ecotype-identification-app1',
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

// ================= STEP 1: Region selection =================
function getEcoRegionROI(lon, lat) {
  var ecoRegions = ee.FeatureCollection('RESOLVE/ECOREGIONS/2017');
  var countries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level0");
  var india = countries.filter(ee.Filter.eq('ADM0_NAME', 'India')).first();
  var india_ecoregions = ecoRegions.filterBounds(india.geometry());

  var point = ee.Geometry.Point([lon, lat]);
  var ecoregion = india_ecoregions.filterBounds(point).first();

  // Convert If result explicitly to a Geometry
  var roi = ee.Geometry(
    ee.Algorithms.If(
      ecoregion,
      ecoregion.geometry(),
      point.buffer(5000)
    )
  );
  return roi;
}


var projectRegions = [
  {
    name: 'Kedarnath Bugyal Conservation Project',
    roi: getEcoRegionROI(79.55, 30.41),
    center: [79.55, 30.41],
    years: [1985, 2018, 2018, 2024],
    rainfall: [600, 1500],
    elevation: [1500, 3000],
    terrain: [1,2,3,6,7,8,9,10,11],
    change_detection: [[1,2,4], [1,3,8]],
    lulc: [7, 9, 10, 11, 12],
    project_name:'Kedarnath Bugyal Conservation Project under Conservation Catalyst Programme',
    description:'With the financial and mentoring support from WWF-India, the Gramya Sikshan Paryavaran Sanstha is engaged in community led conservation of Manpai Bugyal (alipine) located inside the Kedarnath Wildlife Sanctuary in Uttarakhand (India). Manpai Bugyal of the Wildlife Sanctuary, which is spread in about 200 hectare area between 3600 to 4000 meter elevations. The Manpai Bugyal has been traditionally recognized as holly land that has strong connection with local religious and cultural practices. However, the effectiveness of traditionally organized activities of dependent villagers related to culture, religion, sheep rearing and harvesting of herbs has deteriorated. Major reasons behind this deterioration of social safeguards include inability of traditional social system to recognize and respond new challenges of increasing anthropogenic pressure and rapid commercialization of herbs and other alpine resources. The opportunity that we have in hand in order to conserve these Alpine rangelands is existence of locally formed people’s institution for religious and cultural interventions in the alpine and socially organized form of summer sheep rearing in the region. These two socially imbedded systems that interact with Bugyals (alpines) will be mobilized to educate and monitor sustainable harvesting of herbs for commercial uses. Key Project Activities: Educate all stakeholders, Community led assessment, Documentation of traditional practices and beliefs, Developing capacity of stakeholders',
    contact:'Jeet Singh - jssanwal@gmail.com',
    usecase: 'Scaling up successful restoration'
  },
  {
    name: 'Pandalgudi, Tamil Nadu',
    roi: getEcoRegionROI(78.097, 9.386),
    center: [78.097, 9.386],
    years: [1985, 2018, 2018, 2024],
    rainfall: [500, 900],
    elevation: [60, 120],
    terrain: [5,6],
    change_detection: [[2], [2]],
    lulc: [6],
    project_name:'Flora of the Presidency of Madras - Pandalgudi',
    description:'Finding reference sites similar to pandalgudi polygons',
    contact:'Anand Kr.p - anand82546@gmail.com',
    usecase: 'Finding reference sites'
  },
  {
    name: 'Aravali Biodiversity Park, Gurugram',
    roi: getEcoRegionROI(77.24, 28.57),
    center: [77.24, 28.57],
    years: [1985, 2011, 2011, 2024],
    rainfall: [300, 900],
    elevation: [100, 300],
    terrain: [5,6,9],
    change_detection: [[1,2,3,4], [3,8]],
    lulc: [7,8,9,10,11,12],
    project_name:'Aravali Biodiversity Park, Gurugram',
    description:'Earlier a mining quarry and stone crushing site',
    contact:'Vijay Dhasmana',
    usecase: 'Scaling up successful restoration'
  },
  {
    name: 'Ammagal Shola-grassland Restoration',
    roi: getEcoRegionROI(76.55, 11.32),
    center: [76.55, 11.32],
    years: [1985, 2013, 2013, 2024],
    rainfall: [1200,4000],
    elevation: [1000, 3000],
    terrain: [6,7,8,10],
    change_detection: [[1,2,3,4], [3,8]],
    lulc: [7,8,9,10,11,12],
    project_name:'Ammagal Ecological Restoration of shola-grassland project ',
    description:'Restoring a tea garden to its erstwhile shola-grassland habitat, using scientific ecological principles along with Traditional Knowledge of the Toda IP. Please view the Power Point presentation delivered at the ERA-India Conference plenary in Panchgani, in 2024 for additional information. Other data can be seen on the website: www.ebrtrust.org',
    contact:'Tarun Chabra - kwattein1@gmail.com',
    usecase: 'Scaling up successful restoration'
  },
  {
    name: 'Darjeeling Hills / Project SERVE',
    roi: getEcoRegionROI(88.26, 27.04),
    center: [88.26, 27.04],
    years: [1985, 2000, 2000, 2024],
    rainfall: [2000,3500],
    elevation: [1000, 3000],
    terrain: [1,2,3,8,9,11],
    change_detection: [[1,2,3,8], [3,8]],
    lulc: [7,8,9,10,11,12],
    project_name:'Project SERVE',
    description:'Save the Environment and Regenerate Vital Employment (SERVE) is a comprehensive initiative aimed at environmental conservation and livelihood security in the Darjeeling and Kalimpong hills. The project aligns with the UN’s Decade of Ecosystem Restoration (2021-2030) and addresses key regional challenges such as forest degradation, habitat fragmentation, water scarcity, and human-wildlife conflicts.',
    contact:'Rishi Kumar Sharma - rksharma@wwfindia.net',
    usecase: 'Scaling up successful restoration'
  },
  {
    name: 'Rekhalgere site / Medius Earth',
    roi: getEcoRegionROI(76.520805, 14.547696),
    center: [76.520805, 14.547696],
    years: [1985, 2010, 2010, 2024],
    rainfall: [200,800],
    elevation: [400, 1200],
    terrain: [5,6,8,9],
    change_detection: [[1,2,3,4,8],[3,8]],
    lulc: [7,8,9,10,11,12],
    project_name:'Medius Earth',
    description:'NS',
    contact:'Pradyot Porwal - pradyot@mediusearth.com',
    usecase: 'Scaling up successful restoration'
  }
];

var regionDropdown = ui.Select({
  items: projectRegions.map(function(r) { return r.name; }),
  placeholder: 'Select a Project Region',
  style: {stretch: 'horizontal'}
});

function createGoToLocationButton(map, labelText) {
  return ui.Button({
    label: labelText,
    style: {stretch: 'horizontal'},
    onClick: function() {
      if (!selected || !selected.center) {
        print('Please select a project region first using "Set Location".');
        return;
      }
      var lon = selected.center[0];
      var lat = selected.center[1];
      map.setCenter(lon, lat, 8);
      print('Moved map to selected project region at (' + lon.toFixed(4) + ', ' + lat.toFixed(4) + ')');
    }
  });
}


function keepReferenceLayersOnTop() {

  if (!map) return;

  var layers = map.layers();

  var roiBoundaryObj = null;
  var roiCenterObj = null;
  var andLayerObj = null;

  for (var i = layers.length() - 1; i >= 0; i--) {
    var lyr = layers.get(i);
    var name = lyr.getName();
    
    if (name === 'AND of Layers') {
      andLayerObj = lyr.getEeObject();
      layers.remove(lyr);
    }

    if (name === 'ROI Boundary') {
      roiBoundaryObj = lyr.getEeObject();
      layers.remove(lyr);
    }

    if (name === 'ROI Center') {
      roiCenterObj = lyr.getEeObject();
      layers.remove(lyr);
    }
  }

  if (andLayerObj) {
    map.addLayer(
      andLayerObj,
      {palette: ['yellow'], min: 0, max: 1},
      'AND of Layers'
    );
  }

  if (roiBoundaryObj) {
    map.addLayer(
      roiBoundaryObj,
      {palette: 'black'},
      'ROI Boundary'
    );
  }

  if (roiCenterObj) {
    map.addLayer(
      roiCenterObj,
      {palette: ['red'], opacity: 0.9},
      'ROI Center'
    );
  }
}


rainfall.setKeepMarkerOnTop(keepReferenceLayersOnTop);
temp.setKeepMarkerOnTop(keepReferenceLayersOnTop);
elevation.setKeepMarkerOnTop(keepReferenceLayersOnTop);
soil.setKeepMarkerOnTop(keepReferenceLayersOnTop);
fire.setKeepMarkerOnTop(keepReferenceLayersOnTop);
ldd.setKeepMarkerOnTop(keepReferenceLayersOnTop);
terrain.setKeepMarkerOnTop(keepReferenceLayersOnTop);
spatial.setKeepMarkerOnTop(keepReferenceLayersOnTop);
changeDetection.setKeepMarkerOnTop(keepReferenceLayersOnTop);
lulcAnalysis.setKeepMarkerOnTop(keepReferenceLayersOnTop);
ones.setKeepMarkerOnTop(keepReferenceLayersOnTop);
naturalForests.setKeepMarkerOnTop(keepReferenceLayersOnTop);


// ================= AND IMAGE FUNCTION =================

function showAndOnMap() {
  if (!roi_boundary) return;

  var layers = [
    {image: lulcAnalysis.getLoadedImage ? lulcAnalysis.getLoadedImage() : null, name: 'LULC'},
    {image: rainfall.getLoadedImage ? rainfall.getLoadedImage() : null, name: 'Rainfall'},
    {image: temp.getLoadedImage ? temp.getLoadedImage() : null, name: 'Temperature'},
    {image: elevation.getLoadedImage ? elevation.getLoadedImage() : null, name: 'Elevation'},
    {image: soil.getLoadedImage ? soil.getLoadedImage() : null, name: 'Soil'},
    {image: ldd.getLoadedImage ? ldd.getLoadedImage() : null, name: 'Land Degradation'},
    {image: changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null, name: 'Change Detection'},  //inferYears.preDeg, inferYears.current
    {image: fire.getLoadedImage ? fire.getLoadedImage(inferYears.preDeg, inferYears.current) : null, name: 'Fire'},
    {image: terrain.getLoadedImage ? terrain.getLoadedImage() : null, name: 'Terrain'},
    {image: spatial.getLoadedImage ? spatial.getLoadedImage() : null, name: 'Spatial'},
    {image: ones.getOneMap ? ones.getOneMap() : null, name: 'Open Natural Ecosystems (ONEs)'},
    {image: naturalForests.getLoadedImage ? naturalForests.getLoadedImage() : null, name: 'Natural Forests' }
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
    'Natural Forests': ['teal'],
    'AND of Layers': ['yellow']
  };
  
  var desiredOrder = ['Rainfall','Temperature','Elevation','Soil','Terrain','Spatial','Fire','Change Detection','LULC','Open Natural Ecosystems (ONEs)','Land Degradation','Natural Forests'];

  // Filter out nulls
  var filteredLayers = layers.filter(function(l) {
    return l.image;
  });

  if (filteredLayers.length === 0) {
    print('No layers loaded yet');
    return;
  }
  
  var mapLayers = map.layers();
  var layerCount = mapLayers.length();
  for (var j = layerCount - 1; j >= 0; j--) {
    var layer = mapLayers.get(j);
    var shouldRemove = filteredLayers.some(function(l) {
      return l.name === layer.getName();
    });
    if (layer.getName() === 'AND of Layers' || shouldRemove) {
      mapLayers.remove(layer);
    }
  }

  
  filteredLayers.sort(function(a,b){
    return desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name);
  });
  
  // Display all individual layers
  filteredLayers.forEach(function(l) {
    map.addLayer(l.image.clip(roi_boundary), {palette: layerPalettes[l.name], min: 0, max: 1}, l.name);
  });
  
  filteredLayers.forEach(function(l){
    print(l.name, l.image.bandNames());
  });
  
  // 1. Create a base image of 1s (True) to start the AND chain
  var andImage = ee.Image(1).clip(roi_boundary);

  // 2. Loop through each layer and apply a strict bitwise AND
  filteredLayers.forEach(function(l) {
    var binaryLayer = l.image
      .clip(roi_boundary)
      .select([0])
      .gt(0)
      .unmask(0); // Treats any 'NoData' area as False (0)
    andImage = andImage.and(binaryLayer);
  });
  
  // 3. Finalize the image
  andImage = andImage
    .rename('AND')
    .selfMask() // Only keeps pixels that are 1
    .clip(roi_boundary)
    .toByte();
  
  currentAndImage = andImage;

  // Add AND layer
  map.addLayer(andImage, {palette: layerPalettes['AND of Layers'], min: 0, max: 1}, 'AND of Layers');
  
  // Remove any existing ROI Center layer
  var layersList = map.layers();
  var layerCount = layersList.length();
  for (var j = layerCount - 1; j >= 0; j--) {
    var lyr = layersList.get(j);
    if (lyr.getName() === 'ROI Center') {
      layersList.remove(lyr);
    }
  }
  
  // RED CIRCLE at top
  var centerCoords = selected.center;
  var centerPoint = ee.Geometry.Point(centerCoords);
  var centerCircle = centerPoint.buffer(2000);
  var redCircle = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection(centerCircle),
    color: 1,
    // width: 2    // boundary thickness in pixels (adjust if needed)
  });
  map.addLayer(redCircle, {palette: ['red'], opacity: 0.9}, 'ROI Center');
  
  function addLegend() {
    if (legendPanel) {
      map.remove(legendPanel); // remove previous legend if any
    }
  
    legendPanel = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
    var title = ui.Label('Legend', {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'});
    legendPanel.add(title);
  
    Object.keys(layerPalettes).forEach(function(name) {
      var colorBox = ui.Label('', {backgroundColor: layerPalettes[name], padding: '8px', margin: '0 0 4px 0'});
      var label = ui.Label(name, {margin: '0 0 4px 6px'});
      var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
      legendPanel.add(row);
    });
  
    map.add(legendPanel);
  }
  addLegend();

  print('All individual layers + AND of layers displayed on map');
}

function showAndOnMap2() {
  if (!roi_boundary) return;

  var layers = [
    {image: lulcAnalysis.getLoadedImage ? lulcAnalysis.getLoadedImage() : null, name: 'LULC'},
    {image: rainfall.getLoadedImage ? rainfall.getLoadedImage() : null, name: 'Rainfall'},
    {image: temp.getLoadedImage ? temp.getLoadedImage() : null, name: 'Temperature'},
    {image: elevation.getLoadedImage ? elevation.getLoadedImage() : null, name: 'Elevation'},
    {image: soil.getLoadedImage ? soil.getLoadedImage() : null, name: 'Soil'},
    {image: ldd.getLoadedImage ? ldd.getLoadedImage() : null, name: 'Land Degradation'},
    {image: changeDetection.getInferenceImage ? changeDetection.getInferenceImage() : null, name: 'Change Detection'}, //inferYears.preDeg, inferYears.current
    {image: fire.getLoadedImage ? fire.getLoadedImage(inferYears.preDeg, inferYears.current) : null, name: 'Fire'},
    {image: terrain.getLoadedImage ? terrain.getLoadedImage() : null, name: 'Terrain'},
    {image: spatial.getLoadedImage ? spatial.getLoadedImage() : null, name: 'Spatial'},
    {image: ones.getOneMap ? ones.getOneMap() : null, name: 'Open Natural Ecosystems (ONEs)'},
    {image: naturalForests.getLoadedImage ? naturalForests.getLoadedImage() : null, name: 'Natural Forests'}
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
    'Natural Forests': ['teal'],
    'AND of Layers': ['yellow']
  };
  
  var desiredOrder = ['Rainfall','Temperature','Elevation','Soil', 'Terrain','Spatial','Fire','Change Detection','LULC', 'Open Natural Ecosystems (ONEs)', 'Land Degradation','Natural Forests'];

  // Filter out nulls
  var filteredLayers = layers.filter(function(l) {
    return l.image;
  });

  if (filteredLayers.length === 0) {
    print('No layers loaded yet');
    return;
  }

  // Remove previous layers to avoid duplicates
  var mapLayers = map.layers();
  var layerCount = mapLayers.length();
  for (var j = layerCount - 1; j >= 0; j--) {
    var layer = mapLayers.get(j);
    // Use regular function instead of arrow
    var shouldRemove = filteredLayers.some(function(l) {
      return l.name === layer.getName();
    });
    if (layer.getName() === 'AND of Layers' || shouldRemove) {
      mapLayers.remove(layer);
    }
  }

  
  filteredLayers.sort(function(a,b){
    return desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name);
  });
  
  // Display all individual layers
  filteredLayers.forEach(function(l) {
    var visible = (l.name === 'Rainfall' || l.name === 'AND of Layers');
    map.addLayer(
      l.image.clip(roi_boundary),
      {palette: layerPalettes[l.name], min: 0, max: 1},
      l.name,
      visible
    );
  });

  var andImage = ee.Image(1).clip(roi_boundary);

  filteredLayers.forEach(function(l) {
    var binary = l.image
      .clip(roi_boundary)
      .select([0])
      .gt(0)
      .unmask(0); // This treats "No Data" as "False", killing the pixel
    
    andImage = andImage.and(binary);
  });

  // Final mask and clip
  andImage = andImage.rename('AND').selfMask().clip(roi_boundary).toByte();
  currentAndImage = andImage;

  // Add AND layer
  map.addLayer(andImage, {palette: layerPalettes['AND of Layers'], min: 0, max: 1}, 'AND of Layers');
  
  // Remove any existing ROI Center layer
  var layersList = map.layers();
  var layerCount = layersList.length();
  for (var j = layerCount - 1; j >= 0; j--) {
    var lyr = layersList.get(j);
    if (lyr.getName() === 'ROI Center') {
      layersList.remove(lyr);
    }
  }
  // RED CIRCLE at top
  var centerCoords = selected.center;
  var centerPoint = ee.Geometry.Point(centerCoords);
  var centerCircle = centerPoint.buffer(2000);
  var redCircle = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection(centerCircle),
    color: 1,
    // width: 2    // boundary thickness in pixels (adjust if needed)
  });
  map.addLayer(redCircle, {palette: ['red'], opacity: 0.9}, 'ROI Center');
  
  function addLegend() {
    if (legendPanel) {
      map.remove(legendPanel); // remove previous legend if any
    }
  
    legendPanel = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
    var title = ui.Label('Legend', {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'});
    legendPanel.add(title);
  
    Object.keys(layerPalettes).forEach(function(name) {
      var colorBox = ui.Label('', {backgroundColor: layerPalettes[name], padding: '8px', margin: '0 0 4px 0'});
      var label = ui.Label(name, {margin: '0 0 4px 6px'});
      var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
      legendPanel.add(row);
    });
  
    map.add(legendPanel);
  }
  addLegend();

  print('All individual layers + AND of layers displayed on map');
}

// ================= REGION BUTTONS =================
var setRegionBtn = ui.Button({
  label: 'Set Location',
  onClick: function() {
    var selectedName = regionDropdown.getValue();
    if (!selectedName) { print('Please select a project region'); return; }

    // var selected = null;
    for (var i = 0; i < projectRegions.length; i++) {
      if (projectRegions[i].name === selectedName) {
        selected = projectRegions[i];
        break;
      }
    }
    roi_boundary = selected.roi;
    
    // ================= SET PROJECT METADATA FROM REGION =================
    if (selected.project_name) {
      projectNameBox.setValue(selected.project_name);
      projectName = selected.project_name;
    }
    
    if (selected.description) {
      projectDescBox.setValue(selected.description);
      projectDescription = selected.description;
    }
    
    if (selected.contact) {
      contactBox.setValue(selected.contact);
      projectContact = selected.contact;
    }
    
    print('Project metadata initialized from region');
    
    // ================= SET USE CASE FROM REGION =================
    if (selected.usecase) {
      useCaseDropdown.setValue(selected.usecase);
      projectUseCase = selected.usecase;
      print('Use case initialized:', selected.usecase);
    }
    
    // ================= SET YEARS FROM REGION =================
    if (selected.years && selected.years.length === 4) {
      var preDegTrain = selected.years[0];
      var restorationStart = selected.years[1];
      var preDegInfer = preDegTrain;
      var currentYear = selected.years[3];
  
      trainYears.preDeg = preDegTrain;
      trainYears.restoration = restorationStart;
      inferYears.preDeg = preDegInfer;
      inferYears.current = currentYear;
    
      preDegTrainBox.setValue(String(preDegTrain));
      restorationStartBox.setValue(String(restorationStart));
      currentYearBox.setValue(String(currentYear));
      
      lulcAnalysis.setYears(preDegInfer, currentYear);
      changeDetection.setYears(preDegInfer, currentYear, 'test');
      fire.setYears(preDegInfer, currentYear, 'test');
      spatial.setYears(preDegInfer, currentYear, 'test')
    
      print('Years initialized from region:', selected.years);
    }


    // Set ROI for modules
    var modules = [rainfall, temp, elevation, soil, terrain, spatial, ldd, fire, changeDetection, lulcAnalysis, ones, naturalForests];
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].setROI) {
        modules[i].setROI(roi_boundary, map);
      }
    }

    // Apply pre-set ranges/values
    if (selected.rainfall) rainfall.setRange(selected.rainfall[0], selected.rainfall[1]);
    if (selected.temp) temp.setRange(selected.temp[0], selected.temp[1]);
    if (selected.elevation) elevation.setRange(selected.elevation[0], selected.elevation[1]);
    if (selected.terrain) terrain.setValues(selected.terrain);
    if (selected.spatial) spatial.setValues(selected.spatial);
    if (selected.ldd) ldd.setValues(selected.ldd);
    if (selected.fire) fire.setFireValue(selected.fire);
    if (selected.change_detection) { // Changed from changeDetection to change_detection
      print("Calling setValues with:", selected.change_detection);
      changeDetection.setValues(selected.change_detection);
    }
    if (selected.lulc) lulcAnalysis.setValues(selected.lulc);
    if (selected.ones) ones.setValues(selected.ones);
    if (selected.naturalForests) naturalForests.setValues(selected.naturalForests);

    var roiOutline = ee.Image().byte().paint({
      featureCollection: ee.FeatureCollection(roi_boundary),
      color: 1,
      width: 2
    });
    map.layers().reset();
    map.addLayer(roiOutline, {palette: 'black'}, 'ROI Boundary');

    var centerCoords = selected.center;
    map.setCenter(centerCoords[0], centerCoords[1], 8);
    
        // --- Draw ROI Center (always on top) ---
    var centerPoint = ee.Geometry.Point(centerCoords);
    var centerCircle = centerPoint.buffer(2000);
    var redCircle = ee.Image().byte().paint({
      featureCollection: ee.FeatureCollection(centerCircle),
      color: 1
    });
    
    // Remove existing ROI Center layer if already present
    var layerCount = map.layers().length();
    for (var j = layerCount - 1; j >= 0; j--) {
      var layer = map.layers().get(j);
      if (layer.getName() === 'ROI Center') {
        map.layers().remove(layer);
      }
    }
    
    // Add it last → ensures it stays on top of all layers
    map.addLayer(redCircle, {palette: ['red'], opacity: 0.9}, 'ROI Center');
    print('ROI Center marker added.');
    print('Region set:', selectedName, selected);
    
    // SET YRS FUNCTIONALITY MERGED
    var preDegTrain = parseInt(preDegTrainBox.getValue());
    var restorationStart = parseInt(restorationStartBox.getValue());
    // var preDegInfer = parseInt(preDegInferBox.getValue());
    var preDegInfer = preDegTrain;
    var currentYear = parseInt(currentYearBox.getValue());

    if ([preDegTrain, restorationStart, preDegInfer, currentYear].some(isNaN)) {
      print('Enter valid numeric years for all fields');
      return;
    }

    // Set years
    trainYears.preDeg = preDegTrain;
    trainYears.restoration = restorationStart;
    inferYears.preDeg = preDegInfer;
    inferYears.current = currentYear;

    // Update modules
    lulcAnalysis.setYears(preDegInfer, currentYear);
    changeDetection.setYears(preDegTrain, restorationStart, 'validation');
    changeDetection.setYears(preDegInfer, currentYear, 'test');
    fire.setYears(preDegTrain, restorationStart, 'validation');
    fire.setYears(preDegInfer, currentYear, 'test');
    spatial.setYears(preDegInfer, currentYear, 'test'); 

    print('Years set: Training:', preDegTrain, restorationStart, 'Inference:', preDegInfer, currentYear);

    // ================= AUTOMATICALLY COMPUTE AND SHOW =================
    showAndOnMap(); 
  }
});

var clearRegionBtn = ui.Button({
  label: 'Clear Location',
  onClick: function() {
    roi_boundary = null;
    map.layers().reset();
    var allModules = [lulcAnalysis, rainfall, temp, elevation, ldd, changeDetection, fire, terrain, spatial, ones, naturalForests];
    allModules.forEach(function(mod) {
      if (mod.clearMap) {  // module has its own clear function
        mod.clearMap();     // clear layers + legends
      } else if (mod.reset) { 
        mod.reset();        // optional fallback
      }
    });
    
    if (legendPanel) {
      map.remove(legendPanel);
      legendPanel = null;
    }

    print('Region cleared. Please select a new project region.');
  }
});

controlPanel.add(ui.Label('Step 1: Select a project region', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(regionDropdown);
controlPanel.add(ui.Panel([setRegionBtn, clearRegionBtn], ui.Panel.Layout.flow('horizontal')));


// ================= UPLOAD JSON RULES =================
controlPanel.add(ui.Label('Load rules from JSON', {
  fontWeight: 'bold',
  fontSize: '15px'
}));

controlPanel.add(ui.Label({
  value: 'In case you saved JSON rules from a previous session, you can paste the rules here to re-initialize all the layers.',
  style: {fontSize: '13px'}
}));

var jsonTextBox = ui.Textbox({
  value: '',
  placeholder: 'Paste rules JSON here...',
  // multiline: true,
  onChange: function (text) {
    try {
      JSON.parse(text);   // validate only
    } catch (e) {}
  },
  style: {
    stretch: 'horizontal',
    height: '32px',
    fontSize: '12px',
    fontFamily: 'monospace'
  }
});

controlPanel.add(jsonTextBox);


var applyJsonTextBtn = ui.Button({
  label: 'Apply Rules from Textbox JSON',
  style: {stretch: 'horizontal'},
  onClick: function () {

    var text = jsonTextBox.getValue();

    if (!text || text.trim() === '') {
      print('No JSON pasted in textbox');
      return;
    }

    try {
      var obj = JSON.parse(text);

      applyRulesFromJSON(JSON.stringify(obj));

      print('Rules applied from textbox JSON');
      
      if (obj.metadata) {

        if (obj.metadata.project_name) {
          projectNameBox.setValue(obj.metadata.project_name);
          projectName = obj.metadata.project_name;
        }

        if (obj.metadata.description) {
          projectDescBox.setValue(obj.metadata.description);
          projectDescription = obj.metadata.description;
        }

        if (obj.metadata.contact) {
          contactBox.setValue(obj.metadata.contact);
          projectContact = obj.metadata.contact;
        }

        if (obj.metadata.use_case) {
          useCaseDropdown.setValue(obj.metadata.use_case);
          projectUseCase = obj.metadata.use_case;
        }

        print('Project metadata loaded from JSON');
      }

    } catch (e) {
      print('Invalid JSON. Error: ' + e);
    }
  }
});

controlPanel.add(applyJsonTextBtn);


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


// ================= STEP 2: Unified Temporal Inputs (4 years) =================
var preDegTrainBox = ui.Textbox({placeholder: 'Base year', value: '1985'});
var restorationStartBox = ui.Textbox({placeholder: 'Restoration start', value: '2010'});
var currentYearBox = ui.Textbox({placeholder: 'Current year', value: '2022'});

var yearPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {margin: '6px 0'}
});
var mask_yearPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {margin: '6px 0'}
});

yearPanel.add(ui.Panel([
  ui.Label('Restoration start :'),
  restorationStartBox
], ui.Panel.Layout.flow('horizontal')));

yearPanel.add(ui.Panel([
  ui.Label('Base year :'),
  preDegTrainBox
], ui.Panel.Layout.flow('horizontal')));

mask_yearPanel.add(ui.Panel([
  ui.Label('Current year :'),
  currentYearBox
], ui.Panel.Layout.flow('horizontal')));


var setYearsBtn1 = ui.Button({
  label: 'Set Years',
  onClick: function() {
    var preDegTrain = parseInt(preDegTrainBox.getValue());
    var restorationStart = parseInt(restorationStartBox.getValue());

    if ([preDegTrain, restorationStart].some(isNaN)) {
      print('Enter valid numeric years for all fields');
      return;
    }

    // Set years
    trainYears.preDeg = preDegTrain;
    trainYears.restoration = restorationStart;
 
    changeDetection.setYears(preDegTrain, restorationStart, 'validation'); 
    fire.setYears(preDegTrain, restorationStart, 'validation'); 
    // fire.setYears(preDegInfer, currentYear, 'test'); // inference

    print('Years set: Training:', preDegTrain, restorationStart);

    // ================= AUTOMATICALLY COMPUTE AND SHOW =================
    // showAndOnMap(); // This will compute AND and display on map immediately
  }
});

var setYearsBtn2 = ui.Button({
  label: 'Set Years',
  onClick: function() {
    var preDegTrain = parseInt(preDegTrainBox.getValue());
    var preDegInfer = preDegTrain;
    var currentYear = parseInt(currentYearBox.getValue());

    if ([preDegInfer, currentYear].some(isNaN)) {
      print('Enter valid numeric years for all fields');
      return;
    }

    // Set years
    inferYears.preDeg = preDegInfer;
    inferYears.current = currentYear;

    // Update modules
    lulcAnalysis.setYears(preDegInfer, currentYear);
    changeDetection.setYears(preDegInfer, currentYear, 'test'); 
    fire.setYears(preDegInfer, currentYear, 'test');
    spatial.setYears(preDegInfer, currentYear, 'test');

    print('Inference:', preDegInfer, currentYear);

    // ================= AUTOMATICALLY COMPUTE AND SHOW =================
    // showAndOnMap(); // This will compute AND and display on map immediately
  }
});


// ================= STEP 2 =================
controlPanel.add(ui.Label('Step 2: Select Environment Layers', {fontWeight: 'bold', fontSize: '16px'}));
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


// ================= STEP 3 =================
controlPanel.add(ui.Label('Step 3: Select temporal range to filter on time-based layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'We have provided added functionality to isolate reference sites based on two temporal layers – fire incidence and change detection – but you can skip this if you are using the tool for the first time. For advanced users, for case-1 when you have a reference site and want to find other candidate sites that can be similarly restored, set the restoration start year as when you initiated restoration at your site and the base year as 1985. For case-2 when you have a candidate site and want to find similar reference sites, set the restoration start year as something recent like 2024 and the base year as when restoration started at the reference site or 1985 in case the reference sites you seek are pristine and have gone unchanged. ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(yearPanel);
controlPanel.add(ui.Panel([setYearsBtn1], ui.Panel.Layout.flow('horizontal')));


// ================= STEP 4 =================
controlPanel.add(ui.Label('Step 4: Apply Time-based Layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(fire.getPanel());
controlPanel.add(spatial.getPanel());
controlPanel.add(changeDetection.getPanel());


// ================= STEP 5 =================
controlPanel.add(ui.Label('Step 5: Select year for masking layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Label({
  value: 'Current year is relevant especially for case-1 when you are trying to identify potential restoration sites, it allows you to do finer selection of potential locations. Specify current year as a recent year like 2024 when you want to identify potential sites that today look like what the reference site looked like when restoration was initiated there.',
  style: {'fontSize': '14px'}
}));
controlPanel.add(ui.Label({
  value: 'Even for case-2 where you want to find reference sites, it can help with finer filtering based on the current year. ',
  style: {'fontSize': '14px'}
}));
controlPanel.add(mask_yearPanel);
controlPanel.add(ui.Panel([setYearsBtn2], ui.Panel.Layout.flow('horizontal')));


// ================= STEP 6 =================
controlPanel.add(ui.Label('Step 6: Apply Masking Layers', {fontWeight: 'bold', fontSize: '16px'}));

controlPanel.add(lulcAnalysis.getPanel());
// controlPanel.add(wasteland.getPanel());
controlPanel.add(ones.getPanel());
controlPanel.add(ldd.getPanel());
controlPanel.add(naturalForests.getPanel());

controlPanel.add(ui.Label({
  value: 'Likewise, especially for case-2 to identify reference sites you may want to further mask on whether the sites are natural forests or not. ',
  style: {'fontSize': '14px'}
}));


// ================= AND BUTTON =================
var computeAndBtn = ui.Button({
  label: 'Compute AND of Layers',
  onClick: showAndOnMap2
});

// Create "Go to my location" button
var goToLocationBtn = createGoToLocationButton(map, 'Go to my location');

controlPanel.add(ui.Label('Step 7: Compute AND of all loaded layers', {fontWeight: 'bold', fontSize: '16px'}));
controlPanel.add(ui.Panel([computeAndBtn, goToLocationBtn], ui.Panel.Layout.flow('horizontal')));

// ================= STEP 7: Filters =================
var sizeFilterCheckbox = ui.Checkbox({label: 'Size Filtering', value: false});
var applyFiltersBtn = ui.Button({
  label: 'Apply Selected Filters',
  onClick: function() {
    if (!roi_boundary) { print('Please set ROI first.'); return; }
    var lastLayer = map.layers().get(map.layers().length() - 2);
    var combinedCondition = null;
    try { combinedCondition = lastLayer.getEeObject(); } 
    catch(e) { print('No computed layer exists'); return; }

    var result = combinedCondition;
    if (sizeFilterCheckbox.getValue()) {
      result = sizeFilter.apply(result, roi_boundary, map);
    }
  }
});

controlPanel.add(ui.Panel([sizeFilterCheckbox, applyFiltersBtn], ui.Panel.Layout.flow('vertical')));

// ================= LAYOUT =================
ui.root.clear();
ui.root.add(ui.SplitPanel({firstPanel: map, secondPanel: controlPanel, orientation: 'horizontal', wipe: false, style: {stretch: 'both'}}));



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

  if (spatial && spatial.getRule) {
    json.spatial = spatial.getRule();
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

  if (changeDetection && changeDetection.getRule) {
    json.change_detection = changeDetection.getRule();
  }
  
  if (ones && ones.getRule) {
    var o = ones.getRule();
    if (o) json.ones = o;
  }
  
  if (naturalForests && naturalForests.getRule) {
    json.naturalForests = naturalForests.getRule();
  }
  
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
  
  
  if (rules.years) {

    // ---- Training years ----
    if (rules.years.train) {
      trainYears.preDeg = parseInt(rules.years.train.base);
      trainYears.restoration = parseInt(rules.years.train.restoration);

      preDegTrainBox.setValue(String(trainYears.preDeg));
      restorationStartBox.setValue(String(trainYears.restoration));
    }

    // ---- Inference years ----
    if (rules.years.infer) {
      inferYears.preDeg = parseInt(rules.years.infer.base);
      inferYears.current = parseInt(rules.years.infer.current);

      // preDegInferBox.setValue(String(inferYears.preDeg));
      currentYearBox.setValue(String(inferYears.current));
    }

    // ---- Update modules with new years ----
    lulcAnalysis.setYears(inferYears.preDeg, inferYears.current);

    changeDetection.setYears(trainYears.preDeg, trainYears.restoration, 'validation');
    changeDetection.setYears(inferYears.preDeg, inferYears.current, 'test');

    fire.setYears(trainYears.preDeg, trainYears.restoration, 'validation');
    fire.setYears(inferYears.preDeg, inferYears.current, 'test');
    
    spatial.setYears(inferYears.preDeg, inferYears.current, 'test');

    print('Years loaded from JSON');
  }


  // ---- Apply each module safely ----
  if (rules.rainfall && rainfall.setRange) {
    rainfall.setRange(rules.rainfall.min, rules.rainfall.max);
  }
  
  if (rules.temp && temp.setRange) {
    temp.setRange(rules.temp.min, rules.temp.max);
  }

  if (rules.elevation && elevation.setRange) {
    elevation.setRange(rules.elevation.min, rules.elevation.max);
  }

  if (rules.soil) {

    // texture
    if (rules.soil['Topsoil Texture'] && soil.setTextureValues) {
      soil.setTextureValues(rules.soil['Topsoil Texture']);
    }

    // drainage
    if (rules.soil['Soil Drainage'] && soil.setDrainageValues) {
      soil.setDrainageValues(rules.soil['Soil Drainage']);
    }

    // pH
    if (rules.soil['Soil pH'] && soil.setPhValues) {
      soil.setPhValues(rules.soil['Soil pH']);
    }
  }
  
  if (rules.terrain && terrain.setValues) {
    var terrainValueMap = {
      'V-shape river valleys, Deep narrow canyons': 1,
      'Lateral midslope incised drainages, Local valleys in plains': 2,
      'Upland incised drainages, Stream headwaters': 3,
      'U-shape valleys': 4,
      'Broad Flat Areas': 5,
      'Broad open slopes': 6,
      'Mesa tops': 7,
      'Upper Slopes': 8,
      'Local ridge/hilltops within broad valleys': 9,
      'Lateral midslope drainage divides, Local ridges in plains': 10,
      'Mountain tops, high ridges': 11
    };
  
    var terrainValues = rules.terrain
      .map(function(name) { return terrainValueMap[name]; })
      .filter(function(v) { return v !== undefined; });
  
    terrain.setValues(terrainValues);
  }


  if (rules.land_degradation && ldd.setValues) {
    ldd.setValues(rules.land_degradation);
  }

  if (rules.fire && fire.setFireValue) {
    fire.setFireValue(rules.fire);
  }
  
  if (rules.spatial && fire.setValues) {
    fire.setValues(rules.spatial);
  }
  
  if (rules.lulc && lulcAnalysis.setValues) {

    var lulcValueMap = {
      'Built up': 1,
      'Kharif water': 2,
      'Kharif and rabi water': 3,
      'Kharif and rabi and zaid water': 4,
      'Trees': 6,
      'Barren lands': 7,
      'Single Kharif Cropping': 8,
      'Single Non-Kharif Cropping': 9,
      'Double Cropping': 10,
      'Triple Cropping': 11,
      'Shrubs_Scrubs': 12
    };
  
    // Convert class NAMES → numeric VALUES
    var lulcValues = rules.lulc
      .map(function(name) { return lulcValueMap[name]; })
      .filter(function(v) { return v !== undefined; });
    lulcAnalysis.setValues(lulcValues);
  
    print('LULC classes loaded from JSON:', rules.lulc);
  }


  if (rules.change_detection && changeDetection.setValues) {
    changeDetection.setValues(rules.change_detection);
  }
  
  if (rules.ones && ones.setValues) {
    ones.setValues(rules.ones);
  }
  
  if (rules.naturalForests && naturalForests.setValues) {
    naturalForests.setValues(rules.naturalForests);
  }

  // ---- Recompute AND automatically ----
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

    // Final spatial filter to remove any "ghost" pixels outside the boundary
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

    // case 2 — nested object → recurse (soil, change_detection, etc.)
    else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      newObj[key] = convert_format(obj[key]);
    }

    // case 3 — keep unchanged
    else {
      newObj[key] = obj[key];
    }
  });

  return newObj;
}

var downloadRulesBtn = ui.Button({
  label: 'Print Final Rule JSON',
  onClick: function () {

    // Allow UI + rule state to settle (important for Step 6 rules)
    ee.Number(1).evaluate(function () {

      var rulesObj = getAllRulesJSON_Object();
      
      // ================= ADD METADATA =================
      rulesObj.metadata = {
        project_name: projectName,
        description: projectDescription,
        contact: projectContact,
        use_case: projectUseCase
      };

      // ADD YEARS (from reference code)
      rulesObj.years = {
        train: {
          base: trainYears.preDeg,
          restoration: trainYears.restoration
        },
        infer: {
          base: inferYears.preDeg,
          current: inferYears.current
        }
      };

      // Convert rainfall, temp & elevation formats
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

      print('JSON export completed with years included');
    });
  }
});


function capitalize(str) {
  return str.replace(/_/g, ' ')
            .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}


var rulesTablePanel = ui.Panel({
  style: {
    stretch: 'horizontal',
    margin: '10px 0',
    padding: '8px',
    shown: false
  }
});

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

  // Helper to make cells
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

  // Header Row
  var header = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '0px', padding: '0px', stretch: 'horizontal'}
  });
  header.add(makeCell('Layer', '30%', '#e0e0e0', true));
  header.add(makeCell('Values', '70%', '#e0e0e0', true));
  table.add(header);
  
  // ================= ADD METADATA ROWS =================
  var metadataRows = [
    {label: 'Project Name', value: projectName},
    {label: 'Description', value: projectDescription},
    {label: 'Contact', value: projectContact},
    {label: 'Use Case', value: projectUseCase}
  ];
  
  metadataRows.forEach(function(item, idx) {
  
    if (!item.value) return; // skip empty fields
  
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
      var selectedRegion = null;
      var selectedName = regionDropdown.getValue();
    
      for (var j = 0; j < projectRegions.length; j++) {
        if (projectRegions[j].name === selectedName) {
          selectedRegion = projectRegions[j];
          break;
        }
      }
    
      var yrs = (selectedRegion && selectedRegion.years) ? selectedRegion.years : [];
    
      var fromYear = (yrs.length >= 1) ? yrs[0] : '';
      var toYear   = (yrs.length >= 2) ? yrs[1] : '';
      var fromVals = [];
      var toVals = [];
    
      // CASE 1: Array format [[...],[...]]
      if (Array.isArray(value)) {
        fromVals = value[0] || [];
        toVals   = value[1] || [];
      }
    
      // CASE 2: Object format {from:[], to:[]}
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

  // ================= AREA ROW (ASYNC) =================
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

    areaDict.get('AND').evaluate(function(areaHa) {

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

    // Toggle visibility
    var isVisible = rulesTablePanel.style().get('shown');

    if (isVisible) {
      rulesTablePanel.style().set('shown', false);
    } else {
      buildRulesTable();   // rebuild fresh each time
      rulesTablePanel.style().set('shown', true);
    }
  }
});


var actionButtonsPanel = ui.Panel({
  widgets: [downloadRulesBtn, showRulesBtn],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal',
    margin: '10px 0'
  }
});

controlPanel.add(actionButtonsPanel);
controlPanel.add(rulesTablePanel);
