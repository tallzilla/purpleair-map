// Get the built-in Node process module (lets me get env variables)
const process = require('process');
const originalFetch = require('isomorphic-fetch');
const fetch = require('fetch-retry')(originalFetch);
const script = document.createElement('script');
const mapsAPIKey = process.env.MAPS_API_KEY;
const inside = require('point-in-polygon');

script.src = 'https://maps.googleapis.com/maps/api/js?key=' + mapsAPIKey + '&callback=initMap&libraries=geometry';
script.defer = true;
script.async = true;

let map;
let bounds;
let censusMin = Number.MAX_VALUE,
  censusMax = -Number.MAX_VALUE;
let purpleDeviceIds = [
    66407, // Berkeley real
    66173, // Colorado real
];

window.initMap = function() {

    map = new google.maps.Map(document.getElementById("map"));
    bounds = new google.maps.LatLngBounds();

    // set up the style rules and events for google.maps.Data
    map.data.setStyle(styleFeature);
    //map.data.addListener("mouseover", mouseInToRegion);
    //map.data.addListener("mouseout", mouseOutOfRegion);
    loadMapShapes(loadSensors);
}

function loadSensors() {
    // on error purpleair redirects to another domain which doesn't use cors
    let fetchSettings = {
        method: "GET",
        mode: "cors",
        redirect: "manual",
        retries:3,
        retryDelay:1000,
        retryOn: function(attempt, error, response) {
            if (response.status == 0 || !response.ok) {
                console.log("retrying");
                return true
            }
        }
    };

    for (const id in purpleDeviceIds) {
        let url = "https://www.purpleair.com/json?show=" + purpleDeviceIds[id];

        fetch(url, fetchSettings)
          .then(function(response) {
            return response.json();            
          })
          .then(function(json) {
            // two results are returned... not sure why, just use first
            let sensor = json.results[0]; 

            const lat = sensor['Lat'];
            const lon = sensor['Lon'];
            const pm = sensor['pm2_5_atm'];
            const sensorCoordinate = new google.maps.LatLng(lat, lon);

            map.data.forEach(function(feature) {
               //console.log(feature);
                geometry = feature.getGeometry();

                var polygons = [];

                if (geometry.getType() == 'MultiPolygon') {
                    for (let x = 0; x < geometry.getLength(); x++) {
                        polygon = new google.maps.Polygon(geometry.getAt(x));
                        polygons.push(polygon);
                    }
                } else if (geometry.getType() == 'Polygon') {
                    polygon = new google.maps.Polygon(geometry);
                    polygons.push(polygon);
                } else {
                    return;                 
                }

                polygons.forEach(function (polygon) {
                    feature.setProperty("census_variable", 1000);

                    isInside = google.maps.geometry.poly.containsLocation(sensorCoordinate, polygon);
                    if (isInside) {
                        console.log("Is the sensor inside " + feature.getProperty('NAME') + "? " + isInside);
                    }
                    else {
                        feature.setProperty("census_variable", -1000);
                    }
                });
            });

            // Draw a market with a calculated AQI
            marker = new google.maps.Marker({
              position: sensorCoordinate,
              label: String(pm25ToAQI(pm)),
              map: map
            });

            // update the bounding box
            loc = new google.maps.LatLng(marker.position.lat(), marker.position.lng());
            bounds.extend(loc);

            // auto-zoom and center. ideally would be calling this once, and not
            // per-market
            map.fitBounds(bounds);
            map.panToBounds(bounds);
            });
        }
}

/** Loads the state boundary polygons from a GeoJSON source. */
function loadMapShapes(callback) {
  // load US state outline polygons from a GeoJson file
  map.data.loadGeoJson(
    "https://storage.googleapis.com/mapsdevsite/json/states.js",
    {idPropertyName: 'id'},
    callback);
}
/**
 * Applies a gradient style based on the 'census_variable' column.
 * This is the callback passed to data.setStyle() and is called for each row in
 * the data set.  Check out the docs for Data.StylingFunction.
 *
 * @param {google.maps.Data.Feature} feature
 */

function styleFeature(feature) {
  const low = [5, 69, 54]; // color of smallest datum
  const high = [151, 83, 34]; // color of largest datum
  // delta represents where the value sits between the min and max
  const delta =
    (feature.getProperty("census_variable") - censusMin) /
    (censusMax - censusMin);
  const color = [];

  for (let i = 0; i < 3; i++) {
    // calculate an integer color based on the delta
    color.push((high[i] - low[i]) * delta + low[i]);
  }
  // determine whether to show this shape or not
  let showRow = true;

  if (
    feature.getProperty("census_variable") == null ||
    isNaN(feature.getProperty("census_variable"))
  ) {
    showRow = false;
  }
  let outlineWeight = 0.5,
    zIndex = 1;

  if (feature.getProperty("state") === "hover") {
    outlineWeight = zIndex = 2;
  }
  return {
    strokeWeight: outlineWeight,
    strokeColor: "#fff",
    zIndex: zIndex,
    fillColor: "hsl(" + color[0] + "," + color[1] + "%," + color[2] + "%)",
    fillOpacity: 0.75,
    visible: showRow,
  };
}
//here's a reference on calculating AQI
//https://github.com/dazimmermann/PurpleAir/blob/master/PurpleAir/Program.cs

function linear(aqihigh, aqilow, conchigh, conclow, concentration) {
        a = ((concentration - conclow) / (conchigh - conclow)) * (aqihigh - aqilow) + aqilow;
        return a;
}

function pm25ToAQI(pm25) {
    var aqi = 0;
    var c = (Math.floor(10 * pm25)) / 10;

    if (c < 12.1) {
        aqi = linear(50, 0, 12, 0, c);            
    } else if (c < 35.5) {
        aqi = linear(100, 51, 35.4, 12.1, c);           
    } else if (c < 55.5) {
        aqi = linear(150, 101, 55.4, 35.5, c);    
    } else if (c < 150.5) {
        aqi = linear(200, 151, 150.4, 55.5, c);
    } else if (c < 250.5) {
        aqi = linear(300, 201, 250.4, 150.5, c);            
    } else if (c < 350.5) {
        aqi = linear(400, 301, 350.4, 250.5, c);          
    } else if (c < 500.5) {
        aqi = linear(500, 401, 500.4, 350.5, c);
    } else {
        aqi = -1;
    }
    return Math.round(aqi);
}

// Append the 'script' element to 'head'
document.head.appendChild(script);