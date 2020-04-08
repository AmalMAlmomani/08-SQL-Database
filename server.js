'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const superagent = require('superagent');
const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
//make a connection to the psql using the pro
const client = new pg.Client(process.env.DATABASE_URL);
console.log(client);

//event listener that will listen to error
client.on('error', err => {
    throw new Error(err);
});
app.get('/', (request, response) => {
    response.send('Home Page!');
});
app.get('/location', checkLocation);
app.get('/weather', weatherHandler);
app.get('/trails', trailsHandler);
app.use('*', notFoundHandler);
app.use(errorHandler);

let lon;
let lat;


function checkLocation(req, res) {
    const city = req.query.city;
    let sql = `SELECT * FROM locations WHERE search_query = '${city}';`;
    client.query(sql).then(resultOne => {
        if (resultOne.rows.length > 0) {
            res.status(200).json(resultOne.rows[0]);
            console.log(resultOne.rows.length);
        } else {
            locationHandler(city)
                .then(locationData => {
                    let search_query = locationData.search_query;
                    let formatted_query = locationData.formatted_query;
                    let latitude = locationData.latitude;
                    let longitude = locationData.longitude;
                    let SQL = 'INSERT INTO locations(search_query,formatted_query,latitude,longitude) VALUES ($1,$2,$3,$4) RETURNING *;';
                    let safeValues = [search_query, formatted_query, latitude, longitude];
                    return client.query(SQL, safeValues)
                        .then(resultTwo => {
                            res.status(200).json(resultTwo.rows[0]);
                        }).catch((err) => errorHandler(err, req, res));

                        })
                }
    })

}


    //Route Handlers
    function locationHandler(request, response) {
        const city = request.query.city;
        superagent(
            `https://eu1.locationiq.com/v1/search.php?key=${process.env.GEOCODE_API_KEY}&q=${city}&format=json`).then((res) => {
                const geoData = res.body;
                const locationData = new Location(city, geoData);
                lat =locationData.longitude;
                lon=locationData.latitude;
                response.status(200).json(locationData);
            })
            .catch((err) => errorHandler(err, request, response));

    }


    function weatherHandler(request, response) {
        superagent(`https://api.weatherbit.io/v2.0/forecast/daily?city=${request.query.search_query}&key=${process.env.WEATHER_API_KEY}`).then((weatherData) => {
            const weatherSummaries = weatherData.body.data.map((day) => {
                return new Weather(day);
            });
            response.status(200).json(weatherSummaries);
        })
            .catch(err => errorHandler(err, request, response));

    }

    function trailsHandler(request, response) {
        superagent(`https://www.hikingproject.com/data/get-trails?lat=${lat}&lon=${lon}&maxDistance=10&key=${process.env.TRAIL_API_KEY}`).then(trailData => {
            const trailSummaries = trailData.body.trails.map(trail => {
                return new Trail(trail);
            });
            response.status(200).json(trailSummaries);
        })
            .catch(err => errorHandler(err, request, response));

    }

    ///constructor function for Location
    function Location(city, geoData) {
        this.search_query = city;
        this.formatted_query = geoData[0].display_name;
        this.latitude = geoData[0].lat;
        this.longitude = geoData[0].lon;
    }


    ///constructor for the weather
    function Weather(day) {
        this.forecast = day.weather.description;
        this.time = new Date(day.valid_date).toString().slice(0, 15);
    }


    //constructorfor yhe trail
    function Trail(trailsCon) {
        this.name = trailsCon.name;
        this.location = trailsCon.location;
        this.length = trailsCon.length;
        this.stars = trailsCon.stars;
        this.star_votes = trailsCon.star_votes;
        this.summary = trailsCon.summary;
        this.trail_url = trailsCon.url;
        this.conditions = trailsCon.conditions;
        this.condition_date = trailsCon.conditionDate.toString().slice(0, 10);
        this.condition_time = trailsCon.conditionTime.toString().slice(11, 19);

    }

    //that will handle any other request that doesn't match our route
    function notFoundHandler(request, response) {
        response.status(404).send('Sorry, something went wrong');
    }
    function errorHandler(error, request, response) {
        response.status(500).send("error");
    }
    client
        .connect()
        .then(() => {
            app.listen(PORT, () =>
                console.log(`my server is up and running on port ${PORT}`)
            );
        })
        .catch((err) => {
            throw new Error(`startup error ${err}`);
        });



