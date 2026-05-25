## Modular structure
The main script imports modular components:
```javascript
var lulcAnalysis = require('.../lulc');
var rainfall = require('.../bioclim');
var elevation = require('.../elevation');
var ldd = require('.../ldd');
var changeDetection = require('.../change_det');
var fire = require('.../fire');
var sizeFilter = require('.../sizebased');
var terrain = require('.../terrain');
var one_map = require('.../ONE_map');
var soil = require('.../soil');
var naturalForests = require('.../natural_forests');
var temp = require('.../temp');
var spatial =require('.../spatial');
```

Each module has: 
```javascript
setROI(roi, map)
getLoadedImage()
getPanel()
getRule()
setValues(...)
applyFromJSON(...)
setKeepMarkerOnTop(...)
```
