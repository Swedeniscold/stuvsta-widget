const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // API-nycklar
  const weatherApiKey = 'be599ad20e043a231aae8d76cdd8b0b9';
  const slApiKey = 'af6540c922a84c3ca95d4fd1fa55a37a';

  // Hämta väderdata från OpenWeather
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Huddinge,SE&units=metric&appid=${weatherApiKey}`;

  // Hämta pendeltågavgångar från SL:s GTFS API
  const departureUrl = `https://api.sl.se/REALTID/RealTimeTrainDepartures.json?station=Stuvsta&direction=Norr&apikey=${slApiKey}`;

  try {
    // Väderdata
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    // Pendeltågavgångar
    const departureResponse = await fetch(departureUrl);
    const departureData = await departureResponse.json();

    // Skapa svaret som ska returneras
    const result = {
      weather: {
        description: weatherData.weather[0].description,
        temperature: weatherData.main.temp,
        icon: weatherData.weather[0].icon,
      },
      departures: departureData.ResponseData.map(departure => ({
        lineNumber: departure.LineNumber,
        departureTime: new Date(departure.ExpectedDepartureTime).toLocaleTimeString(),
        destination: departure.Destination,
      })),
    };

    // Skicka tillbaka svaret till klienten
    res.status(200).json(result);
  } catch (error) {
    console.error("Fel vid hämtning av data:", error);
    res.status(500).json({ error: 'Något gick fel vid hämtning av data' });
  }
};
