// api/realtid.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    // Först, sök efter Stuvsta för att få rätt stations-ID
    const searchUrl = `https://transport.integration.sl.se/v1/sites?q=Stuvsta`;
    console.log("Söker efter Stuvsta stationer:", searchUrl);
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error("Fel vid sökning:", searchResponse.status);
      return res.status(searchResponse.status).json({ error: "Kunde inte söka efter station" });
    }
    
    const searchData = await searchResponse.json();
    console.log("Sökresultat:", JSON.stringify(searchData));
    
    // Om vi hittar stationer, använd den första som matchar Stuvsta pendeltågsstation
    let siteId = 9525; // Standard, men kommer att ändras om vi hittar en match
    if (searchData && searchData.sites && searchData.sites.length > 0) {
      const stuvstaStation = searchData.sites.find(site => 
        site.name && site.name.toLowerCase().includes('stuvsta'));
      
      if (stuvstaStation) {
        siteId = stuvstaStation.id;
        console.log("Hittade Stuvsta station med ID:", siteId);
      }
    }
    
    // Nu hämta avgångar med rätt station ID
    const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;
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

    // Filtrera norrgående pendeltåg
    const trains = data.departures
      .filter(dep => {
        // Kontrollera att det är ett pendeltåg
        const lineInfo = dep.line || {};
        const isTrainMode = lineInfo.transport_mode === "TRAIN";
        const isPendeltag = lineInfo.group_of_lines === "Pendeltåg";
        
        // Kontrollera att destinationen är norrgående
        const destination = (dep.destination || "").toLowerCase();
        const direction = (dep.direction || "").toLowerCase();
        const northDestinations = ["märsta", "uppsala", "stockholm", "arlanda", "odenplan"];
        const isNorthbound = northDestinations.some(dest => 
          destination.includes(dest) || direction.includes(dest));
        
        // Logga för felsökning
        console.log(`Avgång: ${dep.destination}, Riktning: ${dep.direction}, ` + 
                  `Tåg: ${isTrainMode}, Pendeltåg: ${isPendeltag}, ` + 
                  `Norrgående: ${isNorthbound}, Riktningskod: ${dep.direction_code}`);
        
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
