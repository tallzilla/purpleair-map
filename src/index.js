// Get the built-in Node process module (lets me get env variables)
const process = require('process');

const dotenv = require('dotenv').config();

//from https://www.npmjs.com/package/fetch-retry
const originalFetch = require('isomorphic-fetch');
const fetch = require('fetch-retry')(originalFetch);

// Create the script tag, set the appropriate attributes
const script = document.createElement('script');

const api_key = process.env.MAPS_API_KEY;
script.src = 'https://maps.googleapis.com/maps/api/js?key=' + api_key + '&callback=initMap';

console.log("Here's the url we're getting " + script.src);

console.log("Secrets try:" + process.env.SECRETS_DOGGO);
console.log("Secrets try:" + process.env.SECRETS_MAPS_API_KEY);


script.defer = true;
script.async = true;

window.initMap = function() {

    const map = new google.maps.Map(document.getElementById("map"));

    bounds  = new google.maps.LatLngBounds();

    let purpleDeviceIds = [
    66407, // Berkeley real
    66173, // Colorado real
    ];

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
            console.log("got " + url + ", response:" + response);
            return response.json();            
          })

          .then(function(json) {
            // two results are returned... not sure why, just use first
            let sensor = json.results[0]; 

            let lat = sensor['Lat'];
            let lon = sensor['Lon'];
            let pm = sensor['pm2_5_atm'];

            // Draw a market with a calculated AQI
            marker = new google.maps.Marker({
              position: {lat: lat, lng: lon},
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