/* global google */

// Get the built-in Node process module (lets me get env variables)
const process = require('process')
const originalFetch = require('isomorphic-fetch')
const fetch = require('fetch-retry')(originalFetch)
const script = document.createElement('script')
const mapsAPIKey = process.env.MAPS_API_KEY

script.src = 'https://maps.googleapis.com/maps/api/js?key=' + mapsAPIKey + '&callback=initMap&libraries=geometry'
console.log('Getting ' + script.src)

script.defer = true
script.async = true

// const google = window.google
let map
let bounds
const aqiMin = 400
const aqiMax = 0
const purpleDeviceIds = [
  66407, // Berkeley
  66173, // Colorado
  78959, // LA
  78941// SF
]

window.initMap = function () {
  map = new google.maps.Map(document.getElementById('map'))
  bounds = new google.maps.LatLngBounds()

  // set up the style rules and events for google.maps.Data
  map.data.setStyle(styleFeature)
  loadMapShapes(loadSensors)
}

/**
 * Loads sensor data into Google Map's data layer
 *
 */

function loadSensors () {
  // on error purpleair redirects to another domain which doesn't use cors
  const fetchSettings = {
    method: 'GET',
    mode: 'cors',
    redirect: 'manual',
    retries: 3,
    retryDelay: 1000,
    retryOn: function (attempt, error, response) {
      if (response.status === 0 || !response.ok) {
        console.log('retrying')
        return true
      }
    }
  }

  for (const id in purpleDeviceIds) {
    const url = 'https://www.purpleair.com/json?show=' + purpleDeviceIds[id]

    fetch(url, fetchSettings)
      .then(function (response) {
        return response.json()
      })
      .then(function (json) {
        // two results are returned... not sure why, just use first
        const sensor = json.results[0]

        const lat = sensor.Lat
        const lon = sensor.Lon
        const pm = sensor.pm2_5_atm
        const sensorCoordinate = new google.maps.LatLng(lat, lon)

        const aqi = Math.trunc(pm25ToAQI(pm))

        // Draw a market with a calculated AQI
        const marker = new google.maps.Marker({
          position: sensorCoordinate,
          label: String(aqi),
          map: map
        })

        map.data.forEach(function (feature) {
          // console.log(feature);
          const geometry = feature.getGeometry()

          var polygons = []

          // in constructing the below polygons I am relying on
          // https://developers.google.com/maps/documentation/javascript/reference/data#Data.Polygon
          // and the getAt function returning the exterior boundary at 0

          if (geometry.getType() === 'MultiPolygon') {
            for (let x = 0; x < geometry.getLength(); x++) {
              // polygon = new google.maps.Polygon(geometry.getAt(x));
              const polygon = new google.maps.Polygon({
                paths: geometry.getAt(x).getAt(0).getArray()
              })
              polygons.push(polygon)
            }
          } else if (geometry.getType() === 'Polygon') {
            // polygon = new google.maps.Polygon(geometry);
            const polygon = new google.maps.Polygon({
              paths: geometry.getAt(0).getArray()
            })

            polygons.push(polygon)
          } else {
            return
          }

          polygons.forEach(function (polygon) {
            const isInside = google.maps.geometry.poly.containsLocation(sensorCoordinate, polygon)
            if (isInside) {
              feature.setProperty('aqi', aqi)
            }
          })
        })

        // update the bounding box
        const loc = new google.maps.LatLng(marker.position.lat(), marker.position.lng())
        bounds.extend(loc)

        // auto-zoom and center. ideally would be calling this once, and not
        // per-market
        map.fitBounds(bounds)
        map.panToBounds(bounds)
      })
  }
}

/**
 * Loads the state boundary polygons from a GeoJSON source.
 *
 * @param {function} callback
 */

function loadMapShapes (callback) {
  // load US state outline polygons from a GeoJson file
  map.data.loadGeoJson(
    'https://storage.googleapis.com/mapsdevsite/json/states.js', {
      idPropertyName: 'id'
    },
    callback)
}

/**
 * Applies a gradient style based on the 'aqi' column.
 * This is the callback passed to data.setStyle() and is called for each row in
 * the data set.  Check out the docs for Data.StylingFunction.
 *
 * @param {google.maps.Data.Feature} feature
 */

function styleFeature (feature) {
  const low = [5, 69, 54] // color of smallest datum
  const high = [151, 83, 34] // color of largest datum
  // delta represents where the value sits between the min and max
  const delta =
        (feature.getProperty('aqi') - aqiMin) /
        (aqiMax - aqiMin)
  const color = []

  for (let i = 0; i < 3; i++) {
    // calculate an integer color based on the delta
    color.push((high[i] - low[i]) * delta + low[i])
  }
  // determine whether to show this shape or not
  let showRow = true

  if (
    feature.getProperty('aqi') == null ||
        isNaN(feature.getProperty('aqi'))
  ) {
    showRow = false
  }
  let outlineWeight = 0.5
  let zIndex = 1

  if (feature.getProperty('state') === 'hover') {
    outlineWeight = zIndex = 2
  }
  return {
    strokeWeight: outlineWeight,
    strokeColor: '#fff',
    zIndex: zIndex,
    fillColor: 'hsl(' + color[0] + ',' + color[1] + '%,' + color[2] + '%)',
    fillOpacity: 0.75,
    visible: showRow
  }
}
// here's a reference on calculating AQI
// https://github.com/dazimmermann/PurpleAir/blob/master/PurpleAir/Program.cs

function linear (aqihigh, aqilow, conchigh, conclow, concentration) {
  const a = ((concentration - conclow) / (conchigh - conclow)) * (aqihigh - aqilow) + aqilow
  return a
}

function pm25ToAQI (pm25) {
  var aqi = 0
  var c = (Math.floor(10 * pm25)) / 10

  if (c < 12.1) {
    aqi = linear(50, 0, 12, 0, c)
  } else if (c < 35.5) {
    aqi = linear(100, 51, 35.4, 12.1, c)
  } else if (c < 55.5) {
    aqi = linear(150, 101, 55.4, 35.5, c)
  } else if (c < 150.5) {
    aqi = linear(200, 151, 150.4, 55.5, c)
  } else if (c < 250.5) {
    aqi = linear(300, 201, 250.4, 150.5, c)
  } else if (c < 350.5) {
    aqi = linear(400, 301, 350.4, 250.5, c)
  } else if (c < 500.5) {
    aqi = linear(500, 401, 500.4, 350.5, c)
  } else {
    aqi = -1
  }
  return Math.round(aqi)
}

// Append the 'script' element to 'head'
document.head.appendChild(script)
