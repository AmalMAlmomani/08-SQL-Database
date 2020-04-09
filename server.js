'use strict';
require('dotenv').config();
const express = require('express');
const pg = require('pg');
const cors = require('cors');
const superagent = require('superagent');

const PORT = process.env.PORT || 4000;

const app = express();

//make a connection to the psql using the pro
const client = new pg.Client(process.env.DATABASE_URL);
app.use(cors());

app.get('/', (request, response) => {
    response.status(200).send('Home Page!');
});
app.get('/location', locationHandler);
app.get('/weather', weatherHandler);
app.get('/trails', trailsHandler);
app.get('/movies', movieHandler);
app.get('/yelp', yelpHandler);
app.use('*', notFoundHandler);
app.use(errorHandler);

//event listener that will listen to error
// client.on('error', err => {
//     throw new Error(err);
// });
// app.get('/', (request, response) => {
//     response.send('Home Page!');
// });
function locationHandler(request, response) {
    const city = request.query.city;
    console.log(city);
    const sql = `SELECT * FROM locations WHERE search_query = $1`;
    const values = [city];
    console.log("hi");
    client
        .query(sql, values)
        .then((results) => {
            if (results.rows.length > 0) {
                response.status(200).json(results.rows[0]);
            } else {
                superagent(`https://eu1.locationiq.com/v1/search.php?key=${process.env.GEOCODE_API_KEY}&q=${city}&format=json`)
                    .then((res) => {
                        const geoData = res.body;
                        const locationData = new Location(city, geoData);
                        const SQL = 'INSERT INTO locations (search_query,formatted_query,latitude,longitude) VALUES($1,$2,$3,$4) RETURNING *';
                        const safeValues = [
                            locationData.search_query,
                            locationData.formatted_query,
                            locationData.latitude,
                            locationData.longitude,
                        ];
                        client.query(SQL, safeValues)
                            .then((results) => {
                                response.status(200).json(results.rows[0]);
                            });

                    });
            }
        })
        .catch((err) => errorHandler(err, request, response));


}


function weatherHandler(request, response) {

    superagent(`https://api.weatherbit.io/v2.0/forecast/daily?city=${request.query.search_query}&key=${process.env.WEATHER_API_KEY}`)
        .then((weatherData) => {
            const weatherSummaries = weatherData.body.data.map((day) => {
                return new Weather(day);
            });
            response.status(200).json(weatherSummaries);
        })
        .catch((err) => errorHandler(err, request, response));

}

// function trailsHandler (request,response){
// const lan = request.query.latitude;
// const long = request.query.longitude;
// getTrailData(lan,long).then(trailData=>{
// response.status(200).json(trailData);
// });
// }
// function getTrailData(lan,long){
// superagent(`https://www.hikingproject.com/data/get-trails?lat=${lan}&lon=${long}&maxDistance=500&key=${process.env.TRAIL_API_KEY}`)
// .then ( trailData =>{
// let trailsInfo = trailData.body.trails.map(val=>{
// return new Trails(val);
// });
// return trailsInfo;
// });
// }
function trailsHandler(request, response) {
    const lat = request.query.latitude;
    const lon = request.query.longitude;
    getTrailData(lat, lon)
        .then((trailData) =>
         response.status(200).json(trailData));
}

function getTrailData(lat, lon) {
    const url = `https://www.hikingproject.com/data/get-trails?lat=${lat}&lon=${lon}&maxDistance=500&key=${process.env.TRAIL_API_KEY}`; 
    return superagent.get(url).then((trailData) => {
        let trailsSummaries = trailData.body.trails.map((val) => {
            return new Trail(val);
        }); return trailsSummaries;
    });
}





// function trailsHandler(request, response) {
//     superagent(`https://www.hikingproject.com/data/get-trails?lat=${request.query.latitude}&lon=${request.query.longitude}&maxDistance=400&key=${process.env.TRAIL_API_KEY}`)
//         .then(trailData => {
//             console.log("????????",request.query.lat);
//             console.log("!!!!!!!",request.query.lon);
//             console.log("data",trailData);
//             trailData.body.trails.map(trail => {
//                return new Trail(trail); 
//             })
//             response.status(200).json(trailData);

//         })
//         .catch(err => errorHandler(err, request, response));

// }

function movieHandler(request, response) {
    superagent(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${request.query.search_query}`)
        .then((movieData) => {
            const movieSum = movieData.body.results.map((movies) => {
                return new Movie(movies);

            });
            response.status(200).json(movieSum);

        })
        .catch(err => errorHandler(err, request, response));

};


function yelpHandler(request, response) {
    superagent(`https://api.yelp.com/v3/businesses/search?location=${request.query.search_query}`)
        .set({ "Authorization": `Bearer ${process.env.YELP_API_KEY}` })
        .then(yelpData => {
            console.log("yelp", yelpData);

            const yelpSummaries = yelpData.body.businesses.map((yelps) => {
                return new Yelp(yelps);
            });
            response.status(200).json(yelpSummaries);

        })
        .catch(err => errorHandler(err, request, response));

};


// Constructor




//   {
//     "name": "Pike Place Chowder",
//     "image_url": "https://s3-media3.fl.yelpcdn.com/bphoto/ijju-wYoRAxWjHPTCxyQGQ/o.jpg",
//     "price": "$$   ",
//     "rating": "4.5",
//     "url": "https://www.yelp.com/biz/pike-place-chowder-seattle?adjust_creative=uK0rfzqjBmWNj6-d3ujNVA&utm_campaign=yelp_api_v3&utm_medium=api_v3_business_search&utm_source=uK0rfzqjBmWNj6-d3ujNVA"
//   },


function Yelp(yelp) {
    this.name = yelp.name;
    this.image_url = yelp.image_url;
    this.price = yelp.price;
    this.rating = yelp.rating;
    this.url = yelp.url;
}


// {
//   "title": "Sleepless in Seattle",
//   "overview": "A young boy who tries to set his dad up on a date after the death of his mother. He calls into a radio station to talk about his dad’s loneliness which soon leads the dad into meeting a Journalist Annie who flies to Seattle to write a story about the boy and his dad. Yet Annie ends up with more than just a story in this popular romantic comedy.",
//   "average_votes": "6.60",
//   "total_votes": "881",
//   "image_url": "https://image.tmdb.org/t/p/w500/afkYP15OeUOD0tFEmj6VvejuOcz.jpg",
//   "popularity": "8.2340",
//   "released_on": "1993-06-24"
// },

//constructor function for Movies
function Movie(movie) {
    this.title = movie.title;
    this.overview = movie.overview;
    this.average_votes = movie.vote_average;
    this.total_votes = movie.vote_count;
    this.image_url = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
    this.popularity = movie.popularity;
    this.released_on = movie.release_date;
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
    this.star_votes = trailsCon.starVotes;
    this.summary = trailsCon.summary;
    this.trail_url = trailsCon.url;
    this.conditions = trailsCon.conditionDetails;
    this.condition_date = trailsCon.conditionDate.substring(0, 11);
    this.condition_time = trailsCon.conditionDate.substring(11);

}

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



