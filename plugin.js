/// <reference path="./kino.d.ts" />

// URL directa del archivo M3U provisto
const M3U_URL = "https://drive.usercontent.google.com/download?id=1-gbTEgkeKL1xuy3rudmBLgMcq7X0NinY&export=download";

let cachedChannels = null;

// Función auxiliar para parsear listas M3U simples
async function getChannels() {
  if (cachedChannels) return cachedChannels;
  
  try {
    const res = await kino.fetch(M3U_URL);
    const text = await res.text();
    const lines = text.split("\n");
    
    const channels = [];
    let currentTitle = "";
    let currentLogo = "";
    let currentGroup = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith("#EXTINF:")) {
        // Extraer logo si existe
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        currentLogo = logoMatch ? logoMatch[1] : "";

        // Extraer categoría/grupo si existe
        const groupMatch = line.match(/group-title="([^"]*)"/);
        currentGroup = groupMatch ? groupMatch[1] : "General";

        // Extraer el nombre del canal (después de la última coma)
        const parts = line.split(",");
        currentTitle = parts.length > 1 ? parts[parts.length - 1].trim() : "Canal sin nombre";
      } else if (line && !line.startsWith("#")) {
        // Es la URL del stream
        if (currentTitle) {
          channels.push({
            id: "channel_" + channels.length,
            title: currentTitle,
            poster: currentLogo || undefined,
            type: "video",
            url: line,
            group: currentGroup
          });
        }
        currentTitle = "";
        currentLogo = "";
      }
    }

    cachedChannels = channels;
    return channels;
  } catch (e) {
    kino.log.error("Error al cargar la lista M3U: " + e);
    return [];
  }
}

// Implementación del buscador requerido en las capabilities
async function search(query) {
  const channels = await getChannels();
  const q = query.toLowerCase();
  
  const results = channels.filter(ch => ch.title.toLowerCase().includes(q));
  
  return results.map(ch => ({
    id: ch.id,
    title: ch.title,
    poster: ch.poster,
    type: "video",
    // Pasamos la URL en el payload para recuperarla al reproducir
    payload: ch.url 
  }));
}

// Resolver el enlace final para que Kino lo reproduzca
async function resolve(id, payload) {
  // Si tenemos el payload (la URL directa), lo retornamos para reproducir
  if (payload) {
    return {
      url: payload,
      type: "hls" // o "direct" dependiendo del formato del stream
    };
  }
  
  // Como respaldo, buscamos por ID si no viene en el payload
  const channels = await getChannels();
  const ch = channels.find(c => c.id === id);
  
  if (!ch) {
    throw new Error("No se encontró el contenido solicitado");
  }

  return {
    url: ch.url,
    type: "direct"
  };
}
