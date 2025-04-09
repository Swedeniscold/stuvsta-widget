// api/realtid.js - Uppdaterad kod
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const siteId = 9525; // Stuvsta pendeltågsstation
  const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;
  console.log("Hämtar avgångar för station ID:", siteId);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("API svarade med fel:", response.status);
      return res.status(response.status).json({ error: "Fel vid anrop till SL API" });
    }
    
    const data = await response.json();
    console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);

    if (!data || !data.departures) {
      console.log("Ingen data från SL Transport");
      return res.status(500).json({ error: "Ingen avgångsinformation hittades" });
    }

    // Filtrera norrgående pendeltåg
    const trains = data.departures
      .filter(dep => {
        // Kontrollera att det är ett pendeltåg
        const lineInfo = dep.line || {};
        const isTrainMode = lineInfo.transport_mode === "TRAIN";
        const isPendeltag = lineInfo.group_of_lines === "Pendeltåg";
        
        // Kontrollera att destinationen är norrgående
        const destination = (dep.destination || "").toLowerCase();
        const northDestinations = ["märsta", "uppsala", "stockholm", "arlanda"];
        const isNorthbound = northDestinations.some(dest => destination.includes(dest));

        console.log(`Avgång: ${destination}, ` + 
              `Tåg: ${isTrainMode}, ` + 
              `Pendeltåg: ${isPendeltag}, ` + 
              `Norrgående: ${isNorthbound}, ` +
              `Riktningskod: ${dep.direction_code}`);
        
        return isTrainMode && isPendeltag && isNorthbound;
      })
      .map(dep => ({
        line: dep.line?.designation || "Pendeltåg",
        destination: dep.destination || "Okänd",
        displayTime: dep.display || "Okänd tid",
        scheduledTime: dep.scheduled || null,
        isDelayed: dep.state === "DELAYED",
        isCancelled: dep.state === "CANCELLED"
      }));

    console.log("Filtrerade fram", trains.length, "norrgående pendeltåg");

    // I din realtid.js, lägg till denna rad efter att ha fått svaret
    console.log("Komplett API-svar:", JSON.stringify(data).substring(0, 2000)); // Visar första 2000 tecken

    // Och denna rad efter filtrering
    console.log("Filtrerade tåg:", JSON.stringify(trains));
    
    // Tillåt CORS för enklare testning
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    res.status(200).json({ departures: trains });
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation" });
  }
};
