
const fetch = require('node-fetch');

// Create the script tag, set the appropriate attributes
var script = document.createElement('script');

script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyD3Zs-gMW0thfy0m90zhZGS4QH5mv6UU8c&callback=initMap';

script.defer = true;
script.async = true;
console.log("hi!!!");

const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let labelIndex = 0;


window.initMap = function() {
	console.log("hi!!!");

	// this url has some info on getting json with node:
	//https://dev.to/isalevine/three-ways-to-retrieve-json-from-the-web-using-node-js-3c88
	// TODO: there's a key below!!!

    const sf = {
      lat: 37.43,
      lng: -121.93
    };

 	const map = new google.maps.Map(document.getElementById("map"), {
      	zoom: 9,
      	center: sf
    });

	let url = "https://www.purpleair.com/data.json?show=66407";
	let settings = { method: "Get" };

	fetch(url, settings)
	    .then(res => res.json())
	    .then((json) => {
	    	console.log(json);
	    	let latIndex = json['fields'].indexOf('Lat');
	    	let lonIndex = json['fields'].indexOf('Lon');

	    	//here's a reference on calculating AQI
	    	//https://github.com/dazimmermann/PurpleAir/blob/master/PurpleAir/Program.cs


	    	let lat = json.data[0][latIndex]
	    	let lon = json.data[0][lonIndex]

	    	addMarker(lat, lon, map)

	    });
}

function addMarker(lat, lng, map) {
        // Add the marker at the clicked location, and add the next-available label
        // from the array of alphabetical characters.
        new google.maps.Marker({
          position: {lat: lat, lng: lng},
          label: labels[labelIndex++ % labels.length],
          map: map
        });	
}

// Append the 'script' element to 'head'
document.head.appendChild(script);
