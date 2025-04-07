module.exports = async (req, res) => {
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;
  const trafiklabApiKey = process.env.TRAFIKLAB_API_KEY;

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Huddinge,SE&units=metric&lang=se&appid=${weatherApiKey}`;
  const gtfsUrl = 'https://opendata.samtrafiken.se//gtfs-rt/sl/TripUpdates';

  const response = await fetch(gtfsUrl, {
  headers: {
    'Accept': 'application/json',
    'Authorization': `apikey ${trafiklabApiKey}`
  }
});

  try {
    const [weatherResponse, gtfsResponse] = await Promise.all([
      fetch(weatherUrl),
      fetch(gtfsUrl),
    ]);

    const weatherData = await weatherResponse.json();
    const gtfsData = await gtfsResponse.json();

    // 👇 Lägg till loggning
    console.log("GTFS-response:", JSON.stringify(gtfsData, null, 2));

    const now = new Date();
    const departures = [];

    // ✅ Säker kontroll så vi inte kraschar
    if (Array.isArray(gtfsData.entity)) {
      for (const entity of gtfsData.entity) {
        const trip = entity.tripUpdate?.trip;
        const stopTimeUpdates = entity.tripUpdate?.stopTimeUpdate;
        const stopUpdates = stopTimeUpdates?.filter(s => s.stopId === "930001202");
    
        if (stopUpdates?.length > 0) {
          console.log("🔍 Hittade en avgång till/från Stuvsta:", {
            route_id: trip?.route_id,
            direction_id: trip?.direction_id,
            trip_headsign: trip?.trip_headsign,
            departure: stopUpdates[0]?.departure?.time
          });
        }
      }
    }

    console.log(${trafiklabApiKey});
    
    if (Array.isArray(gtfsData.entity)) {
      for (const entity of gtfsData.entity) {
        const trip = entity.tripUpdate?.trip;
        const stopTimeUpdates = entity.tripUpdate?.stopTimeUpdate;
        const directionId = trip?.direction_id;
        const stopUpdates = stopTimeUpdates?.filter(s => s.stopId === "930001202");

        if (trip?.route_id?.startsWith('40') && directionId === 1 && stopUpdates?.length > 0) {
          const depTimeEpoch = stopUpdates[0]?.departure?.time;
          if (depTimeEpoch) {
            const departureTime = new Date(depTimeEpoch * 1000);
            if (departureTime > now) {
              departures.push({
                lineNumber: trip.route_id,
                departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                destination: trip.trip_headsign,
              });
            }
          }
        }
      }
    } else {
      console.warn("Ingen entity-array i GTFS-datan!");
    }

    departures.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    res.status(200).json({
      weather: {
        description: weatherData.weather[0].description,
        temperature: Math.round(weatherData.main.temp),
        icon: weatherData.weather[0].icon,
      },
      departures: departures.slice(0, 4),
    });
  } catch (error) {
    console.error("Fel:", error);
    res.status(500).json({ error: 'Fel vid hämtning av data' });
  }
};
