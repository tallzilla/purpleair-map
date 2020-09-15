
const fetch = require('node-fetch');

// Create the script tag, set the appropriate attributes
var script = document.createElement('script');

// Gmaps key is in here, but not much I can do as the app is publically accessible
script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyD3Zs-gMW0thfy0m90zhZGS4QH5mv6UU8c&callback=initMap';
script.defer = true;
script.async = true;


window.initMap = function() {

	// Center the map on SF. could be fancy to pick center of all the urls
    const sf = {
      lat: 37.23,
      lng: -121.93
    };

 	const map = new google.maps.Map(document.getElementById("map"), {
      	zoom: 8,
      	center: sf
    });

    let purpleDeviceIds = [
    23931, // Berkeley real
    66407, // Monterey 'fake'
    19077, // ESJ 'fake'
    24223, // SF 'fake'
    ]

    for (const id in purpleDeviceIds) {
	let url = "https://www.purpleair.com/data.json?show=" + purpleDeviceIds[id];
	let settings = { method: "Get", mode: 'no-cors'};

	console.log("Fetching: " + url)
	fetch(url, settings)
	    .then(res => res.json())
	    .then((json) => {
	    	console.log(json);
	    	let latIndex = json['fields'].indexOf('Lat');
	    	let lonIndex = json['fields'].indexOf('Lon');
	    	let pmIndex = json['fields'].indexOf('pm_1');

	    	if (json.data.length > 0) { // if valid data array returned
		    	let lat = json.data[0][latIndex];
		    	let lon = json.data[0][lonIndex];
		    	let pm = json.data[0][pmIndex];

		    	addMarker(lat, lon, pm, map);	    		
	    	}

	    });    	
    }
}

function addMarker(lat, lng, pm, map) {
        // Add the marker at the clicked location, and add the next-available label
        // from the array of alphabetical characters.
        new google.maps.Marker({
          position: {lat: lat, lng: lng},
          label: String(pm25ToAQI(pm)),
          //label: labels[labelIndex++ % labels.length],
          map: map
        });	
}

	//here's a reference on calculating AQI
	//https://github.com/dazimmermann/PurpleAir/blob/master/PurpleAir/Program.cs

function linear(aqihigh, aqilow, conchigh, conclow, concentration) {
        a = ((concentration - conclow) / (conchigh - conclow)) * (aqihigh - aqilow) + aqilow;
        return a;
}

function pm25ToAQI(pm25)
    {
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
