// api/realtid.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    // Sök efter "Stuvsta station" istället för bara "Stuvsta"
    const searchUrl = `https://transport.integration.sl.se/v1/sites?q=Stuvsta%20station`;
    console.log("Söker efter Stuvsta station:", searchUrl);
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error("Fel vid sökning:", searchResponse.status);
      return res.status(searchResponse.status).json({ error: "Kunde inte söka efter station" });
    }
    
    const searchData = await searchResponse.json();
    
    // Logga alla hittade stationer på ett tydligt sätt
    if (searchData && searchData.sites && searchData.sites.length > 0) {
      console.log(`Hittade ${searchData.sites.length} stationer i sökningen:`);
      searchData.sites.forEach((site, index) => {
        console.log(`${index + 1}. ID: ${site.id}, Namn: ${site.name}, Typ: ${site.type || 'N/A'}`);
      });
      
      // Välj första stationen om den finns
      const stationId = searchData.sites[0]?.id || 9507; // Fallback till 9507 om ingen hittas
      console.log(`Använder station med ID: ${stationId}`);
      
      // Hämta avgångar med detta ID
      const url = `https://transport.integration.sl.se/v1/sites/${stationId}/departures`;
      console.log("Hämtar avgångar från:", url);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error("API svarade med fel:", response.status);
        return res.status(response.status).json({ error: "Fel vid anrop till SL API" });
      }
      
      const data = await response.json();
      
      // Logga namnet på stationen vi faktiskt får data för
      if (data.departures && data.departures.length > 0 && data.departures[0].stop_area) {
        console.log("Hämtade avgångar från station:", data.departures[0].stop_area.name);
      }
      
      console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);

      if (!data || !data.departures) {
        console.log("Ingen data från SL Transport");
        return res.status(500).json({ error: "Ingen avgångsinformation hittades" });
      }

      // Filtrera pendeltåg först
      const allTrains = data.departures
        .filter(dep => {
          const lineInfo = dep.line || {};
          const isTrainMode = lineInfo.transport_mode === "TRAIN";
          const isPendeltag = lineInfo.group_of_lines === "Pendeltåg";
          return isTrainMode && isPendeltag;
        });
      
      console.log(`Hittade ${allTrains.length} pendeltåg totalt från denna station.`);
      
      // Logga information om alla pendeltåg för att se mönster
      if (allTrains.length > 0) {
        console.log("Information om alla pendeltåg:");
        allTrains.forEach((train, index) => {
          console.log(`${index + 1}. Destination: ${train.destination}, ` +
                     `Riktning: ${train.direction}, ` +
                     `Riktningskod: ${train.direction_code}, ` +
                     `Plattform: ${train.stop_point?.designation}, ` +
                     `Avgång: ${train.display}`);
        });
      }
      
      // Nu filtrera för att få norrgående tåg baserat på riktningskod
      // Vi antar att riktningskod 2 är norrut (baserat på tidigare observationer)
      const trains = allTrains
        .filter(train => {
          const isNorthDirection = train.direction_code === 2;
          return isNorthDirection;
        })
        .map(dep => ({
          line: dep.line?.designation || "Pendeltåg",
          destination: dep.destination || "Okänd",
          displayTime: dep.display || "Okänd tid",
          scheduledTime: dep.scheduled || null,
          isDelayed: dep.state === "DELAYED",
          isCancelled: dep.state === "CANCELLED",
          platform: dep.stop_point?.designation || "?"
        }));

      console.log("Filtrerade fram", trains.length, "norrgående pendeltåg");
      if (trains.length > 0) {
        console.log("Filtrerade tåg:", JSON.stringify(trains));
      }
      
      // Tillåt CORS för enklare testning
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      res.status(200).json({ departures: trains });
    } else {
      console.log("Inga stationer hittades i sökningen.");
      res.status(404).json({ error: "Kunde inte hitta Stuvsta station" });
    }
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation" });
  }
};
