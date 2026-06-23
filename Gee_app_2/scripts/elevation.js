var roi_boundary = null;
var loadedImage = null;
var activeMaps = [Map]; 
var keepRestorationMarkerOnTopFn = null;

var minBox, maxBox;

exports.setROI = function(roi, mapInstance) {
  roi_boundary = roi;
  if (mapInstance && activeMaps.indexOf(mapInstance) === -1) {
    activeMaps.push(mapInstance);
  }
};

exports.setKeepMarkerOnTop = function(fn) {
  keepRestorationMarkerOnTopFn = fn;
};

var elevationUtils = {
  layer: null,
  legends: []
};

exports.getPanel = function() {
  var panel = ui.Panel();
  
  var sectionTitle = ui.Label({
    value: 'Elevation',
    style: {'fontSize': '16px', 'fontWeight': 'bold', 'margin': '15px 0 5px 10px'}
  });
  panel.add(sectionTitle);
  
  panel.add(ui.Label({
    value: 'Provide a range corresponding to the area.',
    style: {'fontSize': '14px'}
  }));

  var controlPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '10px 0', padding: '0 10px'}
  });
  panel.add(controlPanel);

  minBox = ui.Textbox({
    placeholder: 'Min elevation (m)',
    value: '0',
    style: {width: '120px', margin: '0 5px 0 0'}
  });

  maxBox = ui.Textbox({
    placeholder: 'Max elevation (m)',
    value: '3000',
    style: {width: '120px', margin: '0 10px 0 0'}
  });

  var loadButton = ui.Button({
    label: 'Load',
    style: {margin: '0 5px 0 0', height: '30px'}
  });

  var clearButton = ui.Button({
    label: 'Clear Map',
    style: {margin: '0', height: '30px'}
  });

  controlPanel.add(minBox);
  controlPanel.add(maxBox);
  controlPanel.add(loadButton);
  controlPanel.add(clearButton);

  var loadElevation = function() {
    if (!roi_boundary) {
      print('Error: Please set ROI from the main panel first.');
      return;
    }

    var minVal = parseFloat(minBox.getValue());
    var maxVal = parseFloat(maxBox.getValue());

    if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
      print('Error: Please enter valid min/max values');
      return;
    }

    clearMap();

    var dataset = ee.Image('USGS/SRTMGL1_003');
    var elevation = dataset.clip(roi_boundary);

    var masked = elevation.gte(minVal).and(elevation.lte(maxVal)).selfMask();

    activeMaps.forEach(function(m) {
      elevationUtils.layer = m.addLayer(
        masked,
        {palette: ['brown']},
        'Elevation'
      );

      var legend = ui.Panel({
        style: {position: 'bottom-left', padding: '8px 15px', backgroundColor: 'white'}
      });

      legend.add(ui.Label({
        value: 'Elevation Range',
        style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
      }));

      legend.add(ui.Panel({
        widgets: [
          ui.Label({style: {backgroundColor: 'brown', padding: '8px', margin: '0', border: '1px solid black'}}),
          ui.Label({value: minVal + '–' + maxVal + ' m', style: {margin: '0 0 0 6px'}})
        ],
        layout: ui.Panel.Layout.flow('horizontal')
      }));

      elevationUtils.legends.push(legend);
    });

    loadedImage = masked;
    
    if (keepRestorationMarkerOnTopFn) {
      ui.util.setTimeout(keepRestorationMarkerOnTopFn, 100);
    }

  };

  loadButton.onClick(loadElevation);
  clearButton.onClick(clearMap);

  return panel;
};

exports.getLoadedImage = function() {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue() || '0');
  var maxVal = parseFloat(maxBox.getValue() || '3000');

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) return null;

  var dataset = ee.Image('USGS/SRTMGL1_003');
  var elevationImage = dataset.clip(roi_boundary);
  loadedImage = elevationImage.gte(minVal).and(elevationImage.lte(maxVal)).selfMask();

  return loadedImage;
};

exports.setRange = function(minVal, maxVal) {
  if (minBox && maxBox) {
    minBox.setValue(minVal);
    maxBox.setValue(maxVal);
  } else {
    print('Error: Elevation textboxes not initialized yet.');
  }
};

function removeLegend() {
  elevationUtils.legends.forEach(function(legend) {
    activeMaps.forEach(function(m) {
      if (m && typeof m.remove === 'function') m.remove(legend);
    });
  });
  elevationUtils.legends = [];
}

function clearMap() {
  activeMaps.forEach(function(m) {
    m.layers().forEach(function(layer) {
      if (layer.getName() && layer.getName().indexOf('Elevation') === 0) {
        m.remove(layer);
      }
    });
  });

  removeLegend();

  elevationUtils.layer = null;
  loadedImage = null;
}

exports.clearMap = clearMap;
exports.removeLegend = removeLegend;


exports.getRule = function () {
  if (!roi_boundary) return null;

  var minVal = parseFloat(minBox.getValue());
  var maxVal = parseFloat(maxBox.getValue());

  if (isNaN(minVal) || isNaN(maxVal) || minVal > maxVal) {
    return null;
  }

  return {
    min: minVal,
    max: maxVal
  };
};


