// =====================================================
// PAN-INDIA SPATIAL CLUSTER EXPLORER
// USING PRECOMPUTED RASTER ASSETS
// =====================================================

var rasterBasePath =
  'projects/ee-ojasvibansal/assets/spatial_clusters_cosine_raster/spatial_raster_';

var geometryTable = ee.FeatureCollection(
  'projects/ee-ojasvibansal/assets/s2_level13_india'
);

var clusterBasePath =
  'projects/ee-ojasvibansal/assets/spatial_clusters_cosine_similarity/spatial_';

var years = [];

for (var y = 2000; y <= 2022; y++) {
  years.push(y.toString());
}

var palette = [
  '#1a9850', // 0 - Deep Green        -> Mostly trees
  '#a6d96a', // 1 - Light Green       -> Intensive croplands
  '#fee08b', // 2 - Pale Yellow       -> Mostly shrublands
  '#bdbdbd', // 3 - Light Grey        -> Himalayan areas
  '#3182bd', // 4 - Strong Blue       -> Mostly wetlands and riverine areas
  '#d73027', // 5 - Red               -> Urban and adjoining agriculture areas
  '#66c2a5', // 6 - Teal Green        -> Crops and trees
  '#a9a9a9', // 7 - Dark Red          -> Bare and shrub areas
  '#dfc27d', // 8 - Tan/Khaki         -> Crops and shrubs
  '#8c510a'  // 9 - Earthy Brown      -> Trees and shrubs
];

var visParams = {
  bands: ['first'],
  min: 0,
  max: 9,
  palette: palette
};

var leftMap = ui.Map();
var rightMap = ui.Map();

ui.Map.Linker([leftMap, rightMap]);

leftMap.setControlVisibility({
  layerList: false
});

rightMap.setControlVisibility({
  layerList: false
});

var leftSelect = ui.Select({
  items: years,
  value: '2000'
});

var rightSelect = ui.Select({
  items: years,
  value: '2022'
});

var infoLabel = ui.Label(
  'Click anywhere on the map to inspect a grid'
);

var statsPanel = ui.Panel({
  style: {
    padding: '10px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #ccc'
  }
});

var sidePanel = ui.Panel({
  widgets: [

    ui.Label('Pan-India Spatial Cluster Explorer', {
      fontWeight: 'bold',
      fontSize: '18px'
    }),

    ui.Label('Left Year'),
    leftSelect,

    ui.Label('Right Year'),
    rightSelect,

    ui.Label('--- Stats Comparison ---', {
      fontWeight: 'bold',
      margin: '10px 0 5px 0'
    }),

    statsPanel,

    infoLabel
  ],

  style: {
    width: '350px',
    padding: '10px'
  }
});

ui.root.clear();

var mapsPanel = ui.Panel(
  [leftMap, rightMap],
  ui.Panel.Layout.Flow('horizontal'),
  {stretch: 'both'}
);

var mainPanel = ui.SplitPanel({
  firstPanel: mapsPanel,
  secondPanel: sidePanel,
  orientation: 'horizontal',
  wipe: false
});

ui.root.add(mainPanel);

function loadRaster(year) {

  return ee.Image(
    rasterBasePath + year
  );
}


function updateStats(year, fc, label) {

  var loadingLabel = ui.Label(
    'Loading ' + year + '...',
    {color: 'gray'}
  );

  statsPanel.add(loadingLabel);

  fc.first().toDictionary().evaluate(function(props) {

    statsPanel.remove(loadingLabel);

    if (!props) {

      statsPanel.add(
        ui.Label('No data found')
      );

      return;
    }

    statsPanel.add(ui.Label(
      label + ' (' + year + ')',
      {
        fontWeight: 'bold',
        textDecoration: 'underline'
      }
    ));

    var keys = [
      'bare_frac',
      'built_frac',
      'crop_frac',
      'shrub_frac',
      'tree_frac'
    ];

    keys.forEach(function(key) {

      var val = props[key] !== undefined
        ? (props[key] * 100).toFixed(2) + '%'
        : 'N/A';

      statsPanel.add(ui.Label(
        key + ': ' + val,
        {
          fontSize: '12px',
          margin: '0 0 2px 5px'
        }
      ));
    });

    statsPanel.add(ui.Label(' '));
  });
}

function loadMaps() {

  var leftYear = leftSelect.getValue();
  var rightYear = rightSelect.getValue();

  leftMap.layers().reset();
  rightMap.layers().reset();

  var leftRaster = loadRaster(leftYear);
  var rightRaster = loadRaster(rightYear);

  leftMap.addLayer(
    leftRaster,
    visParams,
    'Left ' + leftYear
  );

  rightMap.addLayer(
    rightRaster,
    visParams,
    'Right ' + rightYear
  );

  addLegend();

  infoLabel.setValue(
    'Click on map to inspect a grid'
  );
}

function setupClickHandler(mapObj) {

  mapObj.onClick(function(coords) {

    statsPanel.clear();

    infoLabel.setValue(
      'Loading clicked grid...'
    );

    var point = ee.Geometry.Point([
      coords.lon,
      coords.lat
    ]);

    var clicked = geometryTable
      .filterBounds(point)
      .first();

    var joinID = ee.String(
      clicked.get('s2_id')
    );

    var leftYear = leftSelect.getValue();
    var rightYear = rightSelect.getValue();

    var leftFC = ee.FeatureCollection(
      clusterBasePath + leftYear
    ).filter(
      ee.Filter.eq('s2_id', joinID)
    );

    var rightFC = ee.FeatureCollection(
      clusterBasePath + rightYear
    ).filter(
      ee.Filter.eq('s2_id', joinID)
    );

    joinID.evaluate(function(idStr) {

      infoLabel.setValue(
        'Selected Grid: ' + idStr
      );

    });

    var styledFeature = ee.FeatureCollection([clicked]).style({
      color: 'black',
      fillColor: '00000000',
      width: 2
    });
    
    leftMap.layers().set(
      1,
      ui.Map.Layer(
        styledFeature,
        {},
        'Selected Grid Left'
      )
    );
    
    rightMap.layers().set(
      1,
      ui.Map.Layer(
        styledFeature,
        {},
        'Selected Grid Right'
      )
    );

    updateStats(
      leftYear,
      leftFC,
      'Left Map'
    );

    updateStats(
      rightYear,
      rightFC,
      'Right Map'
    );

  });
}


function addLegend() {

  var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 15px'
    }
  });

  legend.add(ui.Label(
    'Clusters',
    {
      fontWeight: 'bold', 
      fontSize: '14px', 
      margin: '0 0 6px 0' 
    }
  ));

  var clusterNames = [
    'Mostly trees',         // 0
    'Intensive croplands',  // 1
    'Mostly shrublands',    // 2
    'Himalayan areas',  // 3
    'Mostly wetands and riverine areas',     // 4
    'Urban and adjoining agriculture areas',       // 5
    'Crops and trees',     // 6
    'Bare and shrub areas',// 7
    'Crops and shrubs',     // 8
    'Trees and shrubs'         // 9
  ];

  for (var i = 0; i < 10; i++) {

    var colorBox = ui.Label({
      style: {
        backgroundColor: palette[i],
        padding: '8px',
        margin: '2px 6px 4px 0'
      }
    });

    var description = ui.Label(
      clusterNames[i],
      {
        margin: '2px 0 4px 0',
        fontSize: '12px' 
      }
    );

    legend.add(
      ui.Panel(
        [colorBox, description],
        ui.Panel.Layout.Flow('horizontal')
      )
    );
  }

  leftMap.add(legend);
}

loadMaps();

leftSelect.onChange(loadMaps);
rightSelect.onChange(loadMaps);


setupClickHandler(leftMap);
setupClickHandler(rightMap);

leftMap.setCenter(78.9629, 20.5937, 5);
rightMap.setCenter(78.9629, 20.5937, 5);
