const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const USER_AGENT = "NoclegiResearchApp/1.0 (Node.js backend)";

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}


// Ustalanie lokalizacji obiektu na podstawie współrzędnych
// Darmowe API Nominatim (OpenStreetMap), bez klucza API
async function reverseGeocode(latitude, longitude) {
    if (latitude == null || longitude == null) {
        return null;
    }

    const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: "jsonv2",
        zoom: "18",
        addressdetails: "1"
    });

    try {
        const data = await fetchJson(
            `https://nominatim.openstreetmap.org/reverse?${params}`
        );

        const address = data.address || {};

        const locality =
            address.city ||
            address.town ||
            address.village ||
            address.hamlet ||
            address.municipality ||
            address.suburb ||
            address.city_district ||
            address.quarter ||
            address.neighbourhood ||
            null;

        const region =
            address.state ||
            address.province ||
            address.region ||
            address.state_district ||
            null;

        const county =
            address.county ||
            address.district ||
            null;

        const country = address.country || null;

        return {
            displayName: data.display_name || null,
            locality,
            county,
            region,
            country,
            postcode: address.postcode || null,
            rawAddress: address,
            coordinates: {
                latitude,
                longitude
            },
            source: "Nominatim / OpenStreetMap"
        };
    } catch (error) {
        console.warn("Reverse geocoding:", error.message);
        return null;
    }
}


// Bezpieczne pobieranie wartości z claims Wikidata
function getClaimValue(entity, property) {
    const claims = entity?.claims?.[property] || [];

    const claim = claims.find(
        item => item.rank === "preferred"
    ) || claims.find(
        item => item.rank === "normal"
    ) || claims[0];

    const value = claim?.mainsnak?.datavalue?.value;

    if (!value) return null;

    if (typeof value === "string") return value;

    if (value.id) return value.id;

    if (value.time) return value.time;

    if (value.amount) return value.amount;

    if (value.latitude !== undefined) {
        return `${value.latitude}, ${value.longitude}`;
    }

    return null;
}

// Pobieranie danych Wikidata
async function getWikidata(qid) {
    if (!qid || !/^Q\d+$/.test(qid)) {
        return null;
    }

    const params = new URLSearchParams({
        action: "wbgetentities",
        ids: qid,
        props: "labels|descriptions|sitelinks|claims",
        languages: "pl|en",
        format: "json"
    });

    const data = await fetchJson(
        `${WIKIDATA_API}?${params}`
    );

    const entity = data.entities?.[qid];

    if (!entity || entity.missing !== undefined) {
        return null;
    }

    const plWiki = entity.sitelinks?.plwiki;
    const enWiki = entity.sitelinks?.enwiki;

    return {
        id: qid,

        name:
            entity.labels?.pl?.value ||
            entity.labels?.en?.value ||
            null,

        description:
            entity.descriptions?.pl?.value ||
            entity.descriptions?.en?.value ||
            null,

        country: getClaimValue(entity, "P17"),
        administrativeLocation: getClaimValue(entity, "P131"),
        inception: getClaimValue(entity, "P571"),
        officialWebsite: getClaimValue(entity, "P856"),

        wikipedia: {
            pl: plWiki?.url || null,
            en: enWiki?.url || null,
            plTitle: plWiki?.title || null,
            enTitle: enWiki?.title || null
        },

        url: `https://www.wikidata.org/wiki/${qid}`
    };
}

// Rozpoznawanie tagu wikipedia, np. pl:Nazwa_artykulu
function parseWikipediaTag(value) {
    if (!value) return null;

    const separator = value.indexOf(":");

    if (separator === -1) {
        return {
            language: "pl",
            title: value
        };
    }

    return {
        language: value.slice(0, separator),
        title: value.slice(separator + 1)
    };
}

// Pobieranie streszczenia z Wikipedii
async function getWikipediaSummary(language, title) {
    if (!language || !title) return null;

    // Dopuszczamy tylko poprawne kody języków
    if (!/^[a-z-]+$/i.test(language)) {
        return null;
    }

    const url =
        `https://${language}.wikipedia.org/api/rest_v1/page/summary/` +
        encodeURIComponent(title);

    const data = await fetchJson(url);

    if (data.type === "disambiguation") {
        return {
            title: data.title,
            description: "Strona ujednoznaczniająca",
            url: data.content_urls?.desktop?.page || null
        };
    }

    return {
        title: data.title,
        description: data.description || null,
        extract: data.extract || null,
        url: data.content_urls?.desktop?.page || null,
        image: data.thumbnail?.source || null
    };
}

// Pobieranie informacji o Wikipedii na podstawie OSM i Wikidata
async function getWikipedia(osmTags, wikidata) {
    const osmArticle = parseWikipediaTag(
        osmTags.wikipedia
    );

    // Najpierw wykorzystujemy bezpośredni link z OSM
    if (osmArticle) {
        try {
            return await getWikipediaSummary(
                osmArticle.language,
                osmArticle.title
            );
        } catch (error) {
            console.warn("Wikipedia OSM:", error.message);
        }
    }

    // Jeśli OSM nie ma tagu wikipedia, korzystamy z Wikidata
    const article =
        wikidata?.wikipedia?.plTitle
            ? {
                language: "pl",
                title: wikidata.wikipedia.plTitle
            }
            : wikidata?.wikipedia?.enTitle
                ? {
                    language: "en",
                    title: wikidata.wikipedia.enTitle
                }
                : null;

    if (!article) return null;

    try {
        return await getWikipediaSummary(
            article.language,
            article.title
        );
    } catch (error) {
        console.warn("Wikipedia Wikidata:", error.message);
        return null;
    }
}


// Główna funkcja: zbieranie informacji o obiekcie
export async function researchOsmObject(osmObject) {
    if (!osmObject || typeof osmObject !== "object") {
        throw new Error("Nieprawidłowe dane OSM");
    }

    const tags = osmObject.tags || osmObject;

    const name = tags.name || "Nieznany obiekt";

    const results = {
        osm: null,
        wikidata: null,
        wikipedia: null,
        commons: [],
        reviews: []
    };

    // 1. Informacje z OSM
    results.osm = {
        id: osmObject.id || null,
        type: osmObject.type || null,
        name,
        tourism: tags.tourism || null,
        description: tags.description || null,
        address: [
            tags["addr:street"],
            tags["addr:housenumber"],
            tags["addr:postcode"],
            tags["addr:city"],
            tags["addr:country"]
        ].filter(Boolean).join(", "),
        website: tags.website || null,
        phone: tags.phone || null,
        email: tags.email || null,
        stars: tags.stars || null,
        rooms: tags.rooms || null,
        beds: tags.beds || null,
        internet: tags.internet_access || null,
        wikidataId: tags.wikidata || null,
        wikipediaTag: tags.wikipedia || null,
        latitude: osmObject.lat ?? osmObject.center?.lat ?? null,
        longitude: osmObject.lon ?? osmObject.center?.lon ?? null,
        osmUrl: osmObject.id && osmObject.type
            ? `https://www.openstreetmap.org/${osmObject.type}/${osmObject.id}`
            : null
    };


    // 1a. Ustalanie lokalizacji na podstawie współrzędnych
    results.location = null;

    const latitude = results.osm.latitude;
    const longitude = results.osm.longitude;

    if (latitude != null && longitude != null) {
        results.location = await reverseGeocode(latitude, longitude);
    }


    // 2. Pobieranie dodatkowych danych z Wikidata
    if (tags.wikidata) {
        try {
            results.wikidata = await getWikidata(
                tags.wikidata
            );
        } catch (error) {
            console.warn("Wikidata:", error.message);
        }
    }

    // 3. Pobieranie opisu z Wikipedii
    try {
        results.wikipedia = await getWikipedia(
            tags,
            results.wikidata
        );
    } catch (error) {
        console.warn("Wikipedia:", error.message);
    }


    // 5. Budowanie tekstu dla AI
    const lines = [];

    lines.push(`INFORMACJE O OBIEKCIE: ${name}`);
    lines.push("================================");

    lines.push("\nDANE OPENSTREETMAP");

    for (const [key, value] of Object.entries(results.osm)) {
        if (value !== null && value !== "") {
            lines.push(`${key}: ${value}`);
        }
    }


    // Lokalizacja ustalona na podstawie współrzędnych
    if (results.location) {
        lines.push("\nLOKALIZACJA USTALONA NA PODSTAWIE WSPÓŁRZĘDNYCH");

        if (results.location.locality) {
            lines.push(`Najbliższa miejscowość / lokalizacja: ${results.location.locality}`);
        }

        if (results.location.county) {
            lines.push(`Powiat: ${results.location.county}`);
        }

        if (results.location.region) {
            lines.push(`Region / województwo: ${results.location.region}`);
        }

        if (results.location.country) {
            lines.push(`Kraj: ${results.location.country}`);
        }

        if (results.location.postcode) {
            lines.push(`Kod pocztowy: ${results.location.postcode}`);
        }

        if (results.location.displayName) {
            lines.push(`Pełna lokalizacja: ${results.location.displayName}`);
        }

        lines.push(`Źródło lokalizacji: ${results.location.source}`);
    }


    if (results.wikidata) {
        lines.push("\nDANE WIKIDATA");

        lines.push(`ID: ${results.wikidata.id}`);

        if (results.wikidata.name) {
            lines.push(`Nazwa: ${results.wikidata.name}`);
        }

        if (results.wikidata.description) {
            lines.push(
                `Opis: ${results.wikidata.description}`
            );
        }

        if (results.wikidata.country) {
            lines.push(
                `Kraj (identyfikator): ${results.wikidata.country}`
            );
        }

        if (results.wikidata.administrativeLocation) {
            lines.push(
                `Lokalizacja administracyjna: ${results.wikidata.administrativeLocation}`
            );
        }

        if (results.wikidata.inception) {
            lines.push(
                `Data powstania: ${results.wikidata.inception}`
            );
        }

        if (results.wikidata.officialWebsite) {
            lines.push(
                `Oficjalna strona: ${results.wikidata.officialWebsite}`
            );
        }

        lines.push(`Źródło: ${results.wikidata.url}`);
    }

    if (results.wikipedia) {
        lines.push("\nWIKIPEDIA");

        lines.push(`Tytuł: ${results.wikipedia.title}`);

        if (results.wikipedia.description) {
            lines.push(
                `Opis: ${results.wikipedia.description}`
            );
        }

        if (results.wikipedia.extract) {
            lines.push(
                `Treść: ${results.wikipedia.extract}`
            );
        }

        if (results.wikipedia.url) {
            lines.push(
                `Źródło: ${results.wikipedia.url}`
            );
        }
    }


    lines.push("\nOPINIE KLIENTÓW");
    lines.push(
        "Nie znaleziono opinii. Wykorzystane publiczne źródła nie udostępniają recenzji klientów tego obiektu."
    );

    lines.push("\nWAŻNE");
    lines.push(
        "Dane pochodzą z różnych źródeł. Nie wszystkie informacje dotyczą bezpośrednio obiektu noclegowego."
    );


    return {
        text: lines.join("\n"),
        data: results
    };
}
