import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const siteUrl = (process.env.SITE_URL || "https://carbrochurearchive.com").replace(/\/$/, "");
const pdfBaseUrl = process.env.PDF_BASE_URL || "https://pub-b4d0d3d7cb284abc8a79724880c09cb7.r2.dev/pdfs";
const adsensePublisherId = "pub-1607011220192909";
const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const assetVersion = process.env.ASSET_VERSION || `${now.replace(/-/g, "")}-design`;

function add(name, official, models, options = {}) {
  return {
    name,
    region: options.region || "Global",
    official,
    note: options.note || `${name} official vehicle information`,
    logoText: options.logoText || name.split(/\s|-/).map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
    models
  };
}

const brands = [
  add("Acura", "https://www.acura.com/", ["Integra", "TLX", "RDX", "MDX", "ZDX"], { region: "US" }),
  add("Alfa Romeo", "https://www.alfaromeousa.com/", ["Giulia", "Stelvio", "Tonale", "4C", "Junior"], { logoText: "AR" }),
  add("Alpine", "https://www.alpinecars.com/", ["A110", "A290", "A390", "A424"], { region: "Europe" }),
  add("AMC", "https://www.stellantis.com/en/heritage", ["AMX", "Ambassador", "Concord", "Eagle", "Gremlin", "Hornet", "Javelin", "Matador", "Pacer", "Rambler"], { region: "Heritage", note: "AMC heritage and owner-group information", logoText: "AMC" }),
  add("Aston Martin", "https://www.astonmartin.com/en/models", ["DB11", "DB12", "DBS", "DBX", "Valhalla", "Vantage", "Vanquish", "Rapide"], { logoText: "AM" }),
  add("Audi", "https://www.audiusa.com/us/web/en/models.html", ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "e-tron GT", "TT", "R8"]),
  add("Austin", "https://www.britishmotormuseum.co.uk/archive", ["A30", "A35", "A40", "A55 Cambridge", "A60 Cambridge", "Allegro", "Maestro", "Maxi", "Mini", "Metro"], { region: "Heritage" }),
  add("Austin-Healey", "https://www.britishmotormuseum.co.uk/archive", ["100", "100-6", "3000", "Sprite"], { region: "Heritage", logoText: "AH" }),
  add("Bentley", "https://www.bentleymotors.com/en/models.html", ["Bentayga", "Continental GT", "Continental GTC", "Flying Spur", "Mulsanne", "Batur", "Bacalar"]),
  add("BMW", "https://www.bmwusa.com/vehicles.html", ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "8 Series", "i4", "i5", "i7", "iX", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z4", "M2", "M3", "M4", "M5", "XM"], { logoText: "BMW" }),
  add("Bugatti", "https://www.bugatti.com/models/", ["Veyron", "Chiron", "Divo", "Centodieci", "Bolide", "Mistral", "Tourbillon"]),
  add("Buick", "https://www.buick.com/", ["Encore", "Encore GX", "Envista", "Envision", "Enclave", "LaCrosse", "Regal", "Verano"]),
  add("Cadillac", "https://www.cadillac.com/", ["CT4", "CT5", "XT4", "XT5", "XT6", "Escalade", "Lyriq", "Celestiq", "Optiq", "Vistiq"]),
  add("Chevrolet", "https://www.chevrolet.com/", ["Malibu", "Trax", "Trailblazer", "Equinox", "Blazer", "Traverse", "Tahoe", "Suburban", "Colorado", "Silverado 1500", "Silverado HD", "Corvette", "Camaro", "Bolt EV", "Bolt EUV"]),
  add("Chrysler", "https://www.chrysler.com/", ["200", "300", "Pacifica", "Pacifica Hybrid", "Town & Country", "Voyager", "Sebring", "PT Cruiser"]),
  add("Citroen", "https://www.citroen.com/", ["C3", "C3 Aircross", "C4", "C4 X", "C5 Aircross", "Berlingo", "SpaceTourer", "Ami", "e-C3"], { region: "Europe" }),
  add("Datsun", "https://www.nissan-global.com/EN/HERITAGE/", ["240Z", "260Z", "280Z", "510", "610", "710", "B210", "Bluebird", "Fairlady", "Roadster"], { region: "Heritage" }),
  add("DeLorean", "https://delorean.com/", ["DMC-12", "Alpha5", "Alpha2", "Alpha3", "Alpha4"], { logoText: "DMC" }),
  add("Dodge", "https://www.dodge.com/", ["Charger", "Challenger", "Durango", "Hornet", "Journey", "Dart", "Viper", "Grand Caravan"]),
  add("Ferrari", "https://www.ferrari.com/en-EN/auto/car-range", ["296 GTB", "296 GTS", "Roma", "Roma Spider", "SF90 Stradale", "SF90 Spider", "Purosangue", "812 Superfast", "F8 Tributo", "Portofino M"]),
  add("Fiat", "https://www.fiat.com/", ["500", "500e", "500X", "600e", "Panda", "Tipo", "Doblo", "Ducato"]),
  add("Fisker", "https://www.fiskerinc.com/", ["Ocean", "Pear", "Alaska", "Ronin", "Karma"], { logoText: "FSK" }),
  add("Ford", "https://www.ford.com.au/vehicles/download-brochure/", ["Mustang", "Mustang Mach-E", "Escape", "Explorer", "Expedition", "Bronco", "Bronco Sport", "Maverick", "Ranger", "F-150", "Super Duty", "Transit", "Everest"]),
  add("Genesis", "https://www.genesis.com/us/en/models.html", ["G70", "G80", "G90", "GV60", "GV70", "GV80", "Electrified G80", "Electrified GV70"]),
  add("GMC", "https://www.gmc.com/", ["Terrain", "Acadia", "Yukon", "Canyon", "Sierra 1500", "Sierra HD", "Hummer EV Pickup", "Hummer EV SUV", "Savana"], { logoText: "GMC" }),
  add("Gumpert", "https://www.rolandgumpert.com/", ["Apollo", "Nathalie", "Explosion", "Tornante"], { region: "Europe" }),
  add("Honda", "https://automobiles.honda.com/", ["Accord", "Civic", "Civic Type R", "CR-V", "HR-V", "Passport", "Pilot", "Ridgeline", "Odyssey", "Prologue"]),
  add("Hummer", "https://www.gmc.com/electric/hummer-ev", ["H1", "H2", "H3", "Hummer EV Pickup", "Hummer EV SUV"], { logoText: "HMR" }),
  add("Hyundai", "https://www.hyundaiusa.com/us/en/brochures", ["Accent", "Elantra", "Sonata", "Venue", "Kona", "Tucson", "Santa Fe", "Palisade", "Santa Cruz", "Ioniq 5", "Ioniq 6", "Nexo"]),
  add("Infiniti", "https://www.infinitiusa.com/", ["Q50", "Q60", "Q70", "QX30", "QX50", "QX55", "QX60", "QX70", "QX80"]),
  add("International", "https://www.internationaltrucks.com/", ["Scout", "Travelall", "Harvester Pickup", "Terra", "Transtar", "MV Series", "HV Series"], { logoText: "IH" }),
  add("Isuzu", "https://www.isuzu.com/", ["Ascender", "Axiom", "D-Max", "F-Series", "MU-X", "N-Series", "Rodeo", "Trooper", "VehiCROSS"]),
  add("Jaguar", "https://www.jaguarusa.com/all-models/index.html", ["XE", "XF", "XJ", "F-Type", "E-Pace", "F-Pace", "I-Pace"]),
  add("Jensen", "https://www.jensenmuseum.org/", ["Interceptor", "FF", "Healey", "541", "C-V8"], { region: "Heritage" }),
  add("Jeep", "https://www.jeep.com/", ["Avenger", "Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Renegade", "Wagoneer", "Wrangler"]),
  add("Kia", "https://www.kia.com/us/en/brochure-request?vehicle=Sportage&year=2026", ["Rio", "Forte", "K4", "K5", "Stinger", "Soul", "Seltos", "Niro", "Sportage", "Sorento", "Telluride", "Carnival", "EV6", "EV9"]),
  add("Koenigsegg", "https://www.koenigsegg.com/model", ["Agera", "CC8S", "CCR", "CCX", "Gemera", "Jesko", "One:1", "Regera"], { logoText: "KSG" }),
  add("Lamborghini", "https://www.lamborghini.com/en-en/models", ["Aventador", "Huracan", "Revuelto", "Urus", "Gallardo", "Murcielago", "Diablo", "Countach"]),
  add("Land Rover", "https://www.landroverusa.com/vehicles/index.html", ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Discovery", "Discovery Sport", "Defender 90", "Defender 110", "Defender 130"], { logoText: "LR" }),
  add("Lexus", "https://www.lexus.com/models", ["ES", "IS", "LS", "LC", "RC", "UX", "NX", "RX", "GX", "LX", "RZ", "TX"]),
  add("Lincoln", "https://www.lincoln.com/", ["Aviator", "Continental", "Corsair", "MKC", "MKS", "MKT", "MKX", "MKZ", "Nautilus", "Navigator"]),
  add("Lotus", "https://www.lotuscars.com/en-US/models", ["Elise", "Emira", "Emeya", "Eletre", "Esprit", "Europa", "Evora", "Exige"]),
  add("Maserati", "https://www.maserati.com/global/en/models", ["Ghibli", "Quattroporte", "Grecale", "Levante", "GranTurismo", "GranCabrio", "MC20"]),
  add("Maybach", "https://www.mbusa.com/en/mercedes-maybach", ["57", "62", "S-Class", "GLS", "EQS SUV"], { logoText: "MM" }),
  add("Mazda", "https://www.mazdausa.com/brochures-and-guides/request-a-brochure", ["Mazda3 Sedan", "Mazda3 Hatchback", "Mazda6", "CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "MX-5 Miata", "MX-30"]),
  add("McLaren", "https://cars.mclaren.com/us-en", ["570S", "600LT", "650S", "720S", "750S", "Artura", "Elva", "GT", "P1", "Senna"], { logoText: "MCL" }),
  add("Mercedes-Benz", "https://www.mbusa.com/en/vehicle-brochures", ["A-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "G-Class", "SL", "AMG GT", "EQA", "EQB", "EQE", "EQS", "Sprinter"], { logoText: "MB" }),
  add("Mercury", "https://www.ford.com/about-ford/heritage/", ["Capri", "Cougar", "Grand Marquis", "Marauder", "Mariner", "Milan", "Montego", "Monterey", "Mountaineer", "Sable"], { region: "Heritage" }),
  add("MG", "https://www.mgmotor.eu/", ["MG3", "MG4", "MG5", "MG ZS", "MG HS", "MG Cyberster", "MGB", "Midget"], { logoText: "MG" }),
  add("MINI", "https://www.miniusa.com/model.html", ["Cooper 2 Door", "Cooper 4 Door", "Convertible", "Clubman", "Countryman", "Electric Hardtop"], { logoText: "MINI" }),
  add("Mitsubishi", "https://www.mitsubishicars.com/", ["Mirage", "Lancer", "Eclipse Cross", "Outlander", "Outlander Sport", "Outlander PHEV", "Pajero", "Montero", "Triton"]),
  add("Morgan", "https://morgan-motor.com/models/", ["3 Wheeler", "Plus Four", "Plus Six", "Super 3", "Aero 8", "Roadster"]),
  add("Nissan", "https://www.nissanusa.com/brochures.html", ["Altima", "Sentra", "Versa", "Maxima", "LEAF", "Ariya", "Kicks", "Rogue", "Murano", "Pathfinder", "Armada", "Frontier", "Titan", "Z", "GT-R"]),
  add("Oldsmobile", "https://www.gm.com/heritage", ["442", "Achieva", "Alero", "Aurora", "Bravada", "Cutlass", "Eighty-Eight", "Intrigue", "Silhouette", "Toronado"], { region: "Heritage" }),
  add("Opel", "https://www.opel.com/", ["Adam", "Astra", "Corsa", "Crossland", "Grandland", "Insignia", "Mokka", "Zafira", "Combo", "Vivaro"]),
  add("Pagani", "https://www.pagani.com/", ["Zonda", "Huayra", "Utopia", "Imola", "Codalunga"]),
  add("Peugeot", "https://www.peugeot.com/en/models/", ["208", "308", "408", "508", "2008", "3008", "5008", "Rifter", "Traveller", "e-208", "e-3008"]),
  add("Plymouth", "https://www.stellantis.com/en/heritage", ["Barracuda", "Belvedere", "Duster", "Fury", "GTX", "Prowler", "Road Runner", "Satellite", "Valiant", "Voyager"], { region: "Heritage" }),
  add("Pontiac", "https://www.gm.com/heritage", ["Bonneville", "Firebird", "G6", "G8", "Grand Am", "Grand Prix", "GTO", "Solstice", "Sunfire", "Vibe"], { region: "Heritage" }),
  add("Porsche", "https://www.porsche.com/usa/models/", ["718 Boxster", "718 Cayman", "911", "Taycan", "Panamera", "Macan", "Cayenne"]),
  add("Ram", "https://www.ramtrucks.com/", ["1500", "2500", "3500", "4500", "5500", "ProMaster", "ProMaster City", "Dakota"], { logoText: "RAM" }),
  add("Rolls-Royce", "https://www.rolls-roycemotorcars.com/en_GB/showroom.html", ["Cullinan", "Dawn", "Ghost", "Phantom", "Spectre", "Wraith"], { logoText: "RR" }),
  add("Saab", "https://saabcars.com/", ["9-2X", "9-3", "9-4X", "9-5", "9-7X", "900", "9000"], { region: "Heritage" }),
  add("Saturn", "https://www.gm.com/heritage", ["Astra", "Aura", "Ion", "L-Series", "Outlook", "Relay", "S-Series", "Sky", "Vue"], { region: "Heritage" }),
  add("Scion", "https://www.toyota.com/", ["FR-S", "iA", "iM", "iQ", "tC", "xA", "xB", "xD"], { region: "Heritage" }),
  add("Smart", "https://www.smart.com/", ["Fortwo", "Forfour", "Roadster", "Smart #1", "Smart #3", "Smart #5"]),
  add("Spyker", "https://spykercars.com/", ["C8", "C12", "B6 Venator", "D8 Peking-to-Paris"], { logoText: "SPY" }),
  add("SRT", "https://www.dodge.com/srt.html", ["Viper", "Challenger SRT", "Charger SRT", "Durango SRT", "Grand Cherokee SRT"], { logoText: "SRT" }),
  add("SSC", "https://www.sscnorthamerica.com/", ["Aero", "Tuatara", "Ultimate Aero", "Tuatara Striker"], { logoText: "SSC" }),
  add("Studebaker", "https://www.studebakermuseum.org/", ["Avanti", "Champion", "Commander", "Daytona", "Dictator", "Golden Hawk", "Lark", "President"], { region: "Heritage", logoText: "STU" }),
  add("Subaru", "https://www.subaru.com/", ["Impreza", "Legacy", "WRX", "BRZ", "Crosstrek", "Forester", "Outback", "Ascent", "Solterra"]),
  add("Suzuki", "https://www.globalsuzuki.com/automobile/", ["Alto", "Baleno", "Celerio", "Grand Vitara", "Jimny", "S-Cross", "Swift", "SX4", "Vitara", "Wagon R"]),
  add("Toyota", "https://www.toyota.com/brochures/", ["Camry", "Corolla", "Corolla Cross", "Crown", "Prius", "GR86", "GR Supra", "RAV4", "Highlander", "Grand Highlander", "4Runner", "Land Cruiser", "Sequoia", "Tacoma", "Tundra", "Sienna", "bZ4X"]),
  add("Volkswagen", "https://www.vw.com/en/models.html", ["Jetta", "Jetta GLI", "Golf GTI", "Golf R", "Passat", "Arteon", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport", "ID.4", "ID. Buzz"], { logoText: "VW" }),
  add("Volvo", "https://www.volvocars.com/us/cars/", ["S60", "S90", "V60", "V90", "XC40", "XC60", "XC90", "EX30", "EX40", "EX90", "EC40"]),
  add("Tesla", "https://www.tesla.com/", ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Roadster", "Semi"]),
  add("Vencer", "https://www.vencer.nl/", ["Sarthe"], { region: "Europe" }),
].sort((a, b) => a.name.localeCompare(b.name));

const totalModels = brands.reduce((sum, brand) => sum + brand.models.length, 0);

const editorialPages = [
  {
    path: "research-guide.html",
    id: "research-guide",
    title: "How to Research Car Brochure PDFs | Car Brochure Archive",
    navTitle: "Research Guide",
    description: "A practical guide to using car brochure PDFs for vehicle research, trim comparison, equipment checks, and historical model-year study.",
    keywords: ["how to research car brochures", "car brochure PDF guide", "vehicle brochure research", "car catalog research"],
    bodyHtml: `<p class="eyebrow">Research Guide</p>
        <h1 id="research-guide-title">How to research car brochure PDFs</h1>
        <p>Car brochures are period documents. They show how a manufacturer described a vehicle when it was new, including the trim ladder, standard equipment, optional packages, color names, wheel designs, interior materials, warranty language, dimensions, towing notes, and sometimes even the marketing claims that shaped how the model was positioned.</p>
        <p>The most useful way to read a brochure is to treat it as one piece of evidence. A PDF title, model year, market, print date, and file name can all matter. A brochure for one country may not match another country, and a late print brochure may include changes that were not present in an early launch PDF.</p>
        <h2>Start with the exact model year</h2>
        <p>Begin with the brochure that matches the vehicle year you are researching. If you are checking a 2020 compact SUV, open the 2020 PDF first, then compare the 2019 and 2021 brochures to understand what changed. Adjacent years often reveal whether a feature was newly added, discontinued, renamed, or moved between trims.</p>
        <h2>Compare standard equipment and options</h2>
        <p>Brochure tables often separate standard equipment from optional packages. This is important for used-car research because listings frequently describe features without showing whether they were standard, optional, or part of a regional package. Look for repeated words such as standard, available, optional, package, group, edition, and dealer-installed.</p>
        <h2>Check visual details carefully</h2>
        <p>Images in brochures can help identify wheels, upholstery patterns, exterior trim, lighting signatures, dashboard layouts, infotainment screens, cargo arrangements, and special edition appearance packages. They are especially helpful when a later listing uses generic photos or incomplete feature descriptions.</p>
        <h2>Use brochures for historical context</h2>
        <p>Older brochures are valuable for restoration, auction descriptions, collector research, and model history. They can show paint codes, original accessory names, model positioning, and the way a manufacturer explained a new technology at launch. For current purchase decisions, always verify final specifications with the manufacturer or an authorized dealer because brochure information may be historical or market-specific.</p>`
  },
  {
    path: "model-year-guide.html",
    id: "model-year-guide",
    title: "Model-Year Brochure Comparison Guide | Car Brochure Archive",
    navTitle: "Model-Year Guide",
    description: "Learn how to compare model-year changes in car brochures, including trims, powertrains, dimensions, safety features, and packages.",
    keywords: ["model year comparison", "compare car brochures by year", "vehicle model year changes", "brochure comparison guide"],
    bodyHtml: `<p class="eyebrow">Model-Year Guide</p>
        <h1 id="model-year-guide-title">How to compare model-year brochure changes</h1>
        <p>Model-year brochures are useful because they preserve a snapshot of how a vehicle was sold at a specific time. When you compare brochures across years, you can often see small changes that are missing from short online summaries: a new engine tune, a renamed trim, a revised screen, an added driver-assistance system, a new paint color, or a package that moved from optional to standard.</p>
        <h2>Build a three-year comparison</h2>
        <p>For most research, open the target year plus the year before and the year after. This three-year view helps separate true changes from wording differences. If a feature appears in the previous year and the target year, it was probably carried over. If it appears only after the target year, it may not apply to the vehicle you are checking.</p>
        <h2>Read the trim table before the highlights</h2>
        <p>Brochure highlights are promotional. Trim tables and specification pages are usually more useful for research. Compare powertrain lines, wheel sizes, tire information, safety features, seating material, audio systems, exterior lighting, cargo measurements, towing ratings, and warranty notes. If a brochure has both a feature list and a specification table, use both before drawing a conclusion.</p>
        <h2>Watch for market and print-date differences</h2>
        <p>A model sold in North America, Europe, Japan, or Australia may use different engines, model names, trims, packages, and safety equipment. Some brochures also have version numbers or publication dates. When two PDFs disagree, the more specific market and print date usually matter more than a broad model name.</p>
        <h2>Record the source clearly</h2>
        <p>If you use a brochure for a listing, article, restoration file, or collector note, record the brand, model, brochure year, title, and PDF file name. That habit makes your research easier to verify later and avoids mixing details from different years or markets.</p>`
  },
  {
    path: "brochure-glossary.html",
    id: "brochure-glossary",
    title: "Car Brochure Terms and Specification Glossary | Car Brochure Archive",
    navTitle: "Brochure Glossary",
    description: "A plain-English glossary for common car brochure terms, specifications, trim labels, option packages, and research notes.",
    keywords: ["car brochure glossary", "vehicle specifications glossary", "trim package meaning", "automotive brochure terms"],
    bodyHtml: `<p class="eyebrow">Glossary</p>
        <h1 id="brochure-glossary-title">Car brochure terms and specification glossary</h1>
        <p>Brochures use a mix of marketing language and technical specification terms. This glossary explains common wording so readers can interpret old PDF catalogs more accurately and compare vehicles without relying only on promotional copy.</p>
        <h2>Trim level</h2>
        <p>A trim level is a version of a model with a defined equipment set. Entry trims usually emphasize price and essential equipment, while higher trims may add larger wheels, upgraded audio, driver-assistance features, leather or synthetic upholstery, more powerful engines, or appearance packages.</p>
        <h2>Standard, available, and optional</h2>
        <p>Standard means a feature is included on the referenced trim. Available often means it can be ordered, but it may require a package or higher trim. Optional usually means extra-cost equipment. Always check the footnotes because manufacturers sometimes restrict options by engine, drivetrain, market, or production date.</p>
        <h2>Package or group</h2>
        <p>A package combines multiple options under one name. Packages can change year to year even when the name stays similar. When researching a used vehicle, compare the package contents in the brochure with photos, window stickers, or build sheets when available.</p>
        <h2>Wheelbase, length, cargo volume, and towing</h2>
        <p>Dimension and capacity figures are useful for comparison, but they may be measured differently between markets or body styles. Cargo volume can vary with seat position, roofline, spare tire layout, and measurement standard. Towing ratings can depend on engine, drivetrain, cooling package, hitch equipment, and local regulations.</p>
        <h2>Concept, preview, and launch brochures</h2>
        <p>Some brochures are early launch pieces rather than final catalog documents. They may show design intent, concept images, or limited specifications. Treat them as context, then look for a later full brochure or specification sheet before relying on exact equipment claims.</p>`
  }
];

function brandHistoryImage(brand) {
  const images = {
    Heritage: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1800&q=85",
    Europe: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1800&q=85",
    US: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=1800&q=85",
    Global: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1800&q=85"
  };
  const pool = images[brand.region] || images.Global;
  return pool;
}

function buildBrandHistoryArticle(brand) {
  const models = brand.models.slice(0, 6);
  const modelLead = models.length ? models.join(", ") : "its current model lineup";
  const articleSlug = slug(brand.name);

  if (articleSlug === "acura") {
    return {
      brand: "Acura",
      slug: "acura",
      title: "Acura: The History of Honda's Luxury Brand",
      headline: "Acura Brand History: From Honda's Luxury Experiment to a Global Automotive Brand",
      description: "Explore the history of Acura, Honda's luxury automotive brand, from its launch in North America in 1986 to the Legend, Integra, NSX, MDX and its later development in international markets.",
      summary: "Acura began as Honda's premium-market experiment in North America and grew around the Legend, Integra, NSX, MDX, and a dedicated dealer network.",
      region: "North America",
      published: "2026-08-18",
      heroImage: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1800&q=85",
      imageAlt: "Acura luxury automobile",
      timeline: [
        ["1986", "Acura launches in the United States with the Legend and Integra."],
        ["1989", "The Acura NSX is introduced, strengthening the brand's performance image."],
        ["2000", "Acura introduces the MDX and expands into the luxury SUV market."],
        ["2006", "Acura enters the Chinese market through Guangqi Honda."],
        ["2022", "Guangqi Honda announces the end of Acura production and sales in China."]
      ],
      sections: [
        {
          id: "birth",
          title: "The Birth of Acura",
          paragraphs: [
            "During the 1970s and early 1980s, the North American automotive market experienced significant changes. Consumers became more interested in fuel economy, reliability and operating costs. Honda's compact and midsize cars benefited from this change and established a strong reputation in the United States.",
            "As economic conditions improved, however, some Honda customers began looking for more sophisticated automobiles. European luxury manufacturers already had a strong presence in this market, and Honda needed a different strategy if it wanted to compete at the premium end of the market.",
            "Rather than simply adding more expensive models to the Honda lineup, the company decided to establish a separate luxury brand."
          ]
        },
        {
          id: "launch",
          title: "1986: Acura Enters the U.S. Market",
          paragraphs: [
            "Acura officially launched in the United States in 1986. The original lineup included the Acura Legend and Acura Integra, giving the new brand two different approaches to the premium automobile market.",
            "The Legend was positioned as a larger luxury model, while the Integra offered a smaller and more accessible alternative. Together, the two vehicles helped establish Acura as a new Japanese premium brand in North America.",
            "An important part of Honda's strategy was the creation of a dedicated Acura dealer network. The separate retail environment helped Acura develop an identity that was distinct from Honda."
          ]
        },
        {
          id: "nsx",
          title: "The NSX Era",
          paragraphs: [
            "In 1989, Acura introduced one of the most important cars in its history: the NSX.",
            "The NSX demonstrated that Honda's engineering philosophy could be applied to a high-performance sports car. Its mid-mounted engine, lightweight construction and precise handling helped it attract attention far beyond the traditional Japanese automobile market.",
            "For Acura, the NSX represented more than another model. It became a technological statement and helped establish the brand's performance-oriented image."
          ]
        },
        {
          id: "models",
          title: "Acura's Model Expansion",
          paragraphs: [
            "During the 1990s and 2000s, Acura continued to develop its product range. Models such as the Integra, Legend, Vigor, TL, RL and TSX allowed the brand to reach different segments of the premium market.",
            "The Integra became particularly popular with younger buyers and enthusiasts because it combined practicality with a more performance-oriented character."
          ]
        },
        {
          id: "mdx",
          title: "2000: The MDX Changes the Lineup",
          paragraphs: [
            "The introduction of the Acura MDX in 2000 marked another important stage in the company's history.",
            "Luxury SUVs were becoming increasingly popular, and the MDX gave Acura an opportunity to compete in a market that was growing rapidly.",
            "The success of the MDX helped establish SUVs as an important part of Acura's product strategy. Later models such as the RDX and ZDX expanded the company's SUV offering."
          ],
          image: {
            src: "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1400&q=80",
            alt: "Luxury SUV",
            caption: "SUVs became an increasingly important part of Acura's product strategy during the 2000s."
          }
        },
        {
          id: "china",
          title: "Acura in China",
          paragraphs: [
            "Acura entered the Chinese market in 2006 through its partnership with Guangqi Honda. Models including the MDX, RDX, CDX and TLX-L were introduced to Chinese customers at different stages.",
            "The Chinese premium-car market was already highly competitive. Established luxury brands had strong consumer recognition, while Acura faced challenges related to brand awareness, dealer coverage, product selection and pricing.",
            "In April 2022, Guangqi Honda announced that it would stop production and sales of existing Acura products in China from 2023. This marked the end of Acura's relatively short period as a mainstream premium brand in the Chinese market."
          ]
        },
        {
          id: "archive",
          title: "Acura Through the Brochure Archive",
          paragraphs: [
            "Automotive brochures provide an interesting way to study the development of Acura. A brochure from a specific model year can preserve information about the vehicle's specifications, equipment, available packages, colors and design that may become difficult to find after the model is discontinued.",
            "Comparing brochures from different generations also reveals how Acura changed its products and marketing strategy over time."
          ]
        },
        {
          id: "preserve",
          title: "Why Preserve Acura Brochures?",
          paragraphs: [
            "Original vehicle brochures are useful historical documents. They can help enthusiasts and researchers understand what a manufacturer offered during a particular model year.",
            "Depending on the document, a brochure may contain information about engines, trim levels, safety equipment, dimensions, available options, interior materials, exterior colors and other factory equipment.",
            "For discontinued models, these documents can be especially useful because manufacturers frequently replace older online information when new generations are introduced."
          ]
        },
        {
          id: "legacy",
          title: "Acura's Automotive Legacy",
          paragraphs: [
            "Acura's history reflects Honda's attempt to build a premium automotive identity around engineering, technology and performance.",
            "The Legend helped establish the brand in the luxury market. The Integra developed a strong connection with younger enthusiasts, while the NSX demonstrated Honda's ambitions in high-performance automobiles. The MDX then helped Acura adapt to the rapidly growing luxury SUV segment.",
            "Looking through brochures from different periods provides another way to understand this evolution. These documents preserve not only vehicle specifications, but also the way Acura presented its products to customers at different points in its history."
          ]
        }
      ],
      relatedModels: ["Acura NSX", "Acura Integra", "Acura MDX"]
    };
  }

  const intro = `${brand.name} appears in this archive as a ${brand.region.toLowerCase()} brand with brochure records arranged around ${modelLead}.`;
  return {
    brand: brand.name,
    slug: articleSlug,
    title: `${brand.name}: Brand History`,
    headline: `${brand.name} Brand History`,
    description: `A concise brand history page for ${brand.name}, linked to brochure archive records and model-year PDF pages.`,
    summary: `${brand.name} brochure pages in this archive focus on ${modelLead}. The history page provides a simple reference layer so readers can understand the brand before opening model brochures.`,
    region: brand.region,
    published: now,
    heroImage: brandHistoryImage(brand),
    imageAlt: `${brand.name} vehicle`,
    timeline: [
      ["Archive", `${brand.name} brochure records are grouped here by model family and year.`],
      ["Models", `The archive includes brochure pages for ${modelLead}.`],
      ["Research", `Use the PDFs to compare trims, equipment, dimensions, colors, and model-year changes.`]
    ],
    sections: [
      {
        id: "overview",
        title: `${brand.name} Overview`,
        paragraphs: [
          intro,
          `In practice, this means the archive keeps ${brand.name} brochure titles, years, and PDF records visible so a reader can move from the brand level to the model level without hunting across unrelated pages.`,
          `The official brand site is still the best source for current sales information, but the brochure archive is better for understanding how ${brand.name} presented its products in different periods.`
        ]
      },
      {
        id: "models",
        title: `${brand.name} Models in the Archive`,
        paragraphs: [
          `Some of the main model families indexed here include ${modelLead}. Those pages are where the archive becomes most useful because each model page concentrates the brochure records, file sizes, and years in one place.`,
          `When a brand has heritage or discontinued models, the archive can also surface older naming conventions and market-specific brochures that are harder to find on modern manufacturer sites.`
        ]
      },
      {
        id: "brochures",
        title: `Why ${brand.name} Brochures Matter`,
        paragraphs: [
          `Brochures are more than download files. They preserve trim names, option packages, color naming, equipment descriptions, dimensions, and the marketing language that shaped the vehicle when it was new.`,
          `For researchers, that makes them useful for restoration notes, listing verification, collector references, and simple year-to-year comparisons.`
        ]
      },
      {
        id: "archive",
        title: `Using the Archive`,
        paragraphs: [
          `Start at the brand page, move into a model page, and then compare adjacent years when you want the clearest picture of change. The archive is designed to keep that path short and readable.`,
          `If you are looking at a used vehicle or a classic model, this page gives you the context you need before you open the brochure PDFs themselves.`
        ]
      }
    ],
    relatedModels: models.slice(0, 3).map((model) => `${brand.name} ${model}`)
  };
}

const brandHistoryArticles = brands.map(buildBrandHistoryArticle);

const brochureLibrary = {};

async function loadBrochureLibrary() {
  const file = path.join(root, "data", "brochures.json");
  if (!existsSync(file)) return brochureLibrary;
  const imported = JSON.parse(await readFile(file, "utf8"));
  return { ...brochureLibrary, ...imported };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/#/g, "number-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoSvg(brand) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96" role="img" aria-label="${esc(brand.name)}">
  <rect width="160" height="96" rx="14" fill="#fff"/>
  <rect x="8" y="8" width="144" height="80" rx="12" fill="#fbfaf7" stroke="#d9d4cb"/>
  <circle cx="80" cy="48" r="25" fill="none" stroke="#17201c" stroke-width="8"/>
  <path d="M52 48h56M80 20v56" fill="none" stroke="#17201c" stroke-width="8" stroke-linecap="round"/>
</svg>
`;
}

function siteLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Car Brochure Archive">
  <rect width="96" height="96" rx="20" fill="#17201c"/>
  <path d="M27 22h30l12 12v40H27z" fill="#fbfaf7"/>
  <path d="M57 22v13h12" fill="none" stroke="#d7a94d" stroke-width="5" stroke-linejoin="round"/>
  <path d="M34 55c7-9 21-9 28 0" fill="none" stroke="#1e5a7a" stroke-width="5" stroke-linecap="round"/>
  <circle cx="37" cy="62" r="4" fill="#1e5a7a"/>
  <circle cx="59" cy="62" r="4" fill="#1e5a7a"/>
  <path d="M34 43h22" stroke="#a55f3f" stroke-width="5" stroke-linecap="round"/>
</svg>
`;
}

function faviconIco() {
  const width = 32;
  const height = 32;
  const pixelBytes = width * height * 4;
  const xor = Buffer.alloc(pixelBytes);
  const andMask = Buffer.alloc(width * height / 8);

  function setPixel(x, y, r, g, b, a = 255) {
    const row = height - 1 - y;
    const offset = (row * width + x) * 4;
    xor[offset] = b;
    xor[offset + 1] = g;
    xor[offset + 2] = r;
    xor[offset + 3] = a;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.max(Math.abs(x - 16) - 12, 0);
      const dy = Math.max(Math.abs(y - 16) - 12, 0);
      const inside = dx * dx + dy * dy <= 16;
      setPixel(x, y, inside ? 23 : 0, inside ? 32 : 0, inside ? 28 : 0, inside ? 255 : 0);
    }
  }
  for (let y = 8; y < 24; y++) for (let x = 10; x < 21; x++) setPixel(x, y, 251, 250, 247);
  for (let y = 8; y < 13; y++) for (let x = 20; x < 25; x++) if (x - y <= 12) setPixel(x, y, 251, 250, 247);
  for (let x = 12; x < 23; x++) setPixel(x, 18, 30, 90, 122);
  for (let x = 13; x < 22; x++) setPixel(x, 17, 30, 90, 122);
  for (let y = 19; y < 22; y++) {
    setPixel(13, y, 30, 90, 122);
    setPixel(21, y, 30, 90, 122);
  }

  const bitmapInfo = Buffer.alloc(40);
  bitmapInfo.writeUInt32LE(40, 0);
  bitmapInfo.writeInt32LE(width, 4);
  bitmapInfo.writeInt32LE(height * 2, 8);
  bitmapInfo.writeUInt16LE(1, 12);
  bitmapInfo.writeUInt16LE(32, 14);
  bitmapInfo.writeUInt32LE(0, 16);
  bitmapInfo.writeUInt32LE(pixelBytes + andMask.length, 20);

  const image = Buffer.concat([bitmapInfo, xor, andMask]);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const dir = Buffer.alloc(16);
  dir.writeUInt8(width, 0);
  dir.writeUInt8(height, 1);
  dir.writeUInt8(0, 2);
  dir.writeUInt8(0, 3);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(image.length, 8);
  dir.writeUInt32LE(header.length + dir.length, 12);
  return Buffer.concat([header, dir, image]);
}

function pageShell({ title, description, canonical, cssPath, body, schema = "", keywords = [], robots = "index,follow,max-image-preview:large", ads = true }) {
  const assetPrefix = cssPath.replace(/styles\.css$/, "");
  const keywordText = Array.isArray(keywords) ? [...new Set(keywords.filter(Boolean))].join(", ") : keywords;
  const adsScript = ads
    ? `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${adsensePublisherId}" crossorigin="anonymous"></script>\n`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    ${keywordText ? `<meta name="keywords" content="${esc(keywordText)}" />` : ""}
    <meta name="robots" content="${esc(robots)}" />
    <meta name="theme-color" content="#f7f4ef" />
    <link rel="canonical" href="${esc(canonical)}" />
    <link rel="icon" href="${assetPrefix}assets/favicon.ico" sizes="any" />
    <link rel="icon" href="${assetPrefix}assets/site-logo.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${cssPath}?v=${assetVersion}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
${adsScript}
    ${schema}
    <script>
      if (location.pathname.endsWith("/index.html")) {
        location.replace(location.pathname.replace(/index\\.html$/, "") + location.search + location.hash);
      }
    </script>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function header(prefix = "") {
  const homeHref = prefix || "./";
  return `<header class="site-header">
      <a class="brand-mark" href="${homeHref}" aria-label="Home">
        <img class="site-logo" src="${prefix}assets/site-logo.svg" alt="Car Brochure Archive logo" />
        <span>
          <strong>Car Brochure Archive</strong>
          <small>PDF brochure archive</small>
        </span>
      </a>
      <nav class="top-nav" aria-label="Primary navigation">
        <a href="${homeHref}#brands">Brands</a>
        <a href="${prefix}history/">History</a>
        <a href="${prefix}research-guide.html">Guides</a>
        <a href="${prefix}about.html">About</a>
      </nav>
    </header>`;
}

function footer(prefix = "") {
  const homeHref = prefix || "./";
  return `<footer class="site-footer">
      <p>Car Brochure Archive. Updated ${now}.</p>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="${homeHref}">Home</a>
        <a href="${prefix}history/">Brand History</a>
        <a href="${prefix}research-guide.html">Research Guide</a>
        <a href="${prefix}model-year-guide.html">Model-Year Guide</a>
        <a href="${prefix}brochure-glossary.html">Glossary</a>
        <a href="${prefix}about.html">About</a>
        <a href="${prefix}contact.html">Contact</a>
        <a href="${prefix}privacy.html">Privacy</a>
        <a href="${prefix}terms.html">Terms</a>
      </nav>
    </footer>`;
}

function historyUrl(article) {
  return `history/${article.slug}/`;
}

function historyPagePath(article) {
  return `history/${article.slug}/index.html`;
}

function brandHistoryFor(brand) {
  return brandHistoryArticles.find((article) => slug(article.brand) === slug(brand.name));
}

function brandPagePath(brand) {
  return `brands/${slug(brand.name)}/index.html`;
}

function brandUrl(brand) {
  return `brands/${slug(brand.name)}/`;
}

function modelPagePath(brand, model) {
  return `models/${slug(brand.name)}/${slug(model)}/index.html`;
}

function modelUrl(brand, model) {
  return `models/${slug(brand.name)}/${slug(model)}/`;
}

function brochureYear(entry) {
  return entry.title.match(/\d{4}/)?.[0] || "Other";
}

function brochureModel(entry, brand) {
  let model = entry.section || `${brand.name} Brochures`;
  model = model
    .replace(/\s+PDF Sales Brochures?$/i, "")
    .replace(/\s+Brochures?$/i, "")
    .trim();
  if (model.length > 72) model = model.split(/\s+\d{4}\s+/)[0].trim();
  return model;
}

function isSpecificModel(model, brand) {
  if (model.toLowerCase() === brand.name.toLowerCase()) return false;
  return !/\b(model range|full line|part range|design inspiration|accessories|accessory|utility vehicles|commercial vehicles|hybrid\s*&\s*electric|cars|car range|truck range|people movers|performance|milestones)\b/i.test(model);
}

function localPdfPath(brand, entry) {
  if (pdfBaseUrl) return `${pdfBaseUrl.replace(/\/$/, "")}/${encodeURI(`${slug(brand.name)}/${entry.file}`)}`;
  return `../../pdfs/${slug(brand.name)}/${entry.file}`;
}

function localPdfFile(brand, entry) {
  return path.join(root, "pdfs", slug(brand.name), entry.file);
}

function publicPdfUrl(brand, entry) {
  if (pdfBaseUrl) return localPdfPath(brand, entry);
  return `${siteUrl}/pdfs/${slug(brand.name)}/${encodeURI(entry.file)}`;
}

function hasPublicPdf(brand, entry) {
  return Boolean(pdfBaseUrl) || existsSync(localPdfFile(brand, entry));
}

function topModels(brand, limit = 6) {
  return brand.models.slice(0, limit).join(", ");
}

function homeKeywords() {
  return [
    "car brochure PDF",
    "auto brochure archive",
    "vehicle sales brochure",
    "car catalog PDF",
    "model brochure download",
    "classic car brochure PDF",
    "local car brochure archive",
    ...brands.slice(0, 24).map((brand) => `${brand.name} brochure PDF`)
  ];
}

function brandKeywords(brand) {
  const modelTerms = brand.models.slice(0, 8).flatMap((model) => [
    `${brand.name} ${model} brochure`,
    `${brand.name} ${model} PDF`
  ]);
  return [
    `${brand.name} brochure PDF`,
    `${brand.name} brochures`,
    `${brand.name} car brochure archive`,
    `${brand.name} sales brochure PDF`,
    `${brand.name} catalog PDF`,
    `${brand.name} model brochure download`,
    `${brand.name} owners brochure archive`,
    ...modelTerms
  ];
}

function brandDescription(brand, count) {
  const models = topModels(brand, 5);
  if (count) {
    return `Research ${count} ${brand.name} brochure PDF records by model and year, including ${models}. Compare sales catalogs, specification sheets, trim guides, and model-year brochure details in one organized archive.`;
  }
  return `Browse ${brand.name} brochure references by model, including ${models}. PDF records are organized for vehicle research, brochure comparison, and catalog searches.`;
}

function modelKeywords(brand, model, years) {
  const qualifiedModel = model.toLowerCase().startsWith(brand.name.toLowerCase())
    ? model
    : `${brand.name} ${model}`;
  const yearTerms = years.slice(0, 6).flatMap((year) => [
    `${year} ${model} brochure`,
    `${year} ${model} PDF`
  ]);
  return [
    `${model} brochure PDF`,
    `${model} brochures`,
    `${qualifiedModel} brochure`,
    `${qualifiedModel} PDF`,
    `${model} sales brochure`,
    `${model} catalog PDF`,
    `${model} brochure download`,
    ...yearTerms
  ];
}

function modelDescription(brand, model, entries) {
  const years = [...new Set(entries.map(brochureYear).filter((year) => year !== "Other"))].sort((a, b) => b.localeCompare(a));
  const range = years.length > 1 ? `${years.at(-1)}-${years[0]}` : years[0] || "available years";
  return `Research ${entries.length} ${model} PDF brochure${entries.length === 1 ? "" : "s"} from ${range}. Compare ${brand.name} sales catalogs, specifications, trim information, and model-year guide details.`;
}

function brandIntro(brand, count) {
  const models = topModels(brand, 8);
  if (count) {
    return `Explore ${count} ${brand.name} brochure PDFs organized by model and year. This page collects sales brochures, model catalogs, specifications, and downloadable PDF guides for ${models}. Each record is grouped so researchers can move from a broad ${brand.name} overview to a specific model brochure without sorting through unrelated files.`;
  }
  return `Explore ${brand.name} brochure references organized by model. This page is prepared for future PDF brochures, catalogs, specifications, and model guides for ${models}.`;
}

function brandResearchNote(brand, count) {
  const models = topModels(brand, 6);
  if (count) {
    return `${brand.name} brochure PDFs are useful for comparing original equipment lists, trim naming, engine choices, interior and exterior color references, package descriptions, warranty language, dimensions, towing claims, and market-specific model positioning. This archive keeps the ${brand.name} records grouped by model family so a reader can move from a broad brand overview to individual brochures for ${models}.`;
  }
  return `${brand.name} brochure records will be organized here as PDF catalogs are added. The archive format is designed to make model-year research easier by grouping original sales literature, specifications, and model guides in one place.`;
}

function brandCoverageText(brand, documents) {
  const years = [...new Set(documents.map(brochureYear).filter((year) => year !== "Other"))].sort();
  const modelCount = new Set(documents.map((entry) => brochureModel(entry, brand))).size;
  const yearText = years.length > 1 ? `${years[0]} through ${years.at(-1)}` : years[0] || "available model years";
  return `The current ${brand.name} archive includes ${documents.length} PDF record${documents.length === 1 ? "" : "s"} across ${modelCount || brand.models.length} model group${modelCount === 1 ? "" : "s"}, with brochure years covering ${yearText}. Use the list as a year-by-year index for sales literature, fact sheets, full-line catalogs, special editions, and model-specific PDF brochures.`;
}

function brandUseCases(brand) {
  const models = topModels(brand, 5);
  return [
    `Verify original ${brand.name} trim names, option packages, wheel designs, paint colors, interior materials, and standard equipment before comparing used-car listings.`,
    `Compare brochure years for ${models} to spot facelifts, powertrain changes, safety feature updates, infotainment revisions, and market-specific naming differences.`,
    `Save or open the matching PDF when documenting restoration details, auction listings, collector research, dealership history, or old manufacturer specification claims.`
  ];
}

function brandEditorialGuide(brand, documents) {
  const years = [...new Set(documents.map(brochureYear).filter((year) => year !== "Other"))].sort();
  const models = topModels(brand, 5);
  const recent = years.at(-1) || "the newest available year";
  const earliest = years[0] || "the earliest available year";
  return [
    `${brand.name} brochures are most useful when they are read as period documents, not just as download files. Start with ${recent} to see the latest catalog language available in this archive, then compare back to ${earliest} when you need to understand how equipment, trim names, engines, body styles, or option packages changed over time.`,
    `For ${models}, pay close attention to the way each brochure describes standard equipment versus optional packages. Manufacturer brochures often reveal small details that later listings omit, including wheel designs, upholstery names, audio systems, driver-assistance features, cargo dimensions, towing notes, special editions, and market-specific model positioning.`,
    `This page is maintained as a research index. The PDF titles, model grouping, years, and file sizes are kept visible so readers can choose the right document quickly and avoid opening unrelated catalogs. When a brochure appears to cover multiple models, use the title and year as the primary clue before comparing individual model pages.`
  ];
}

function modelResearchNote(brand, model, entries, years) {
  const yearText = years.length > 1 ? `${years.at(-1)} through ${years[0]}` : years[0] || "the available brochure years";
  return `Use this ${model} brochure page to compare how ${brand.name} presented the model across ${yearText}. Brochures can help identify original trim names, standard and optional equipment, wheel and color availability, powertrain descriptions, interior materials, cargo and dimension claims, and package changes that may not be obvious from later resale listings.`;
}

function modelEditorialGuide(brand, model, entries, years) {
  const yearText = years.length > 1 ? `${years.at(-1)}-${years[0]}` : years[0] || "available years";
  const sortedYears = years.length ? years.join(", ") : "the listed years";
  return [
    `Use the ${model} PDFs as a model-year comparison set for ${yearText}. Open the exact year first, then check the previous and following brochures when researching a facelift, new trim, revised engine, updated safety feature, infotainment change, wheel design, color palette, or special package.`,
    `${brand.name} brochure copy can vary by market and print date. If two PDFs appear to describe similar vehicles, compare the cover year, title wording, file size, and equipment tables before treating a specification as final. Brochure language is especially helpful for distinguishing standard features from optional bundles.`,
    `The available ${model} records on this page cover ${sortedYears}. For restoration, resale research, auction notes, or ownership history, save the PDF that matches the vehicle year and quote the brochure title rather than relying on a generic model description.`
  ];
}

function guideCards(prefix = "") {
  return editorialPages
    .map((page) => `<article>
            <span>${esc(page.navTitle)}</span>
            <h3><a href="${prefix}${page.path}">${esc(page.title.replace(" | Car Brochure Archive", ""))}</a></h3>
            <p>${esc(page.description)}</p>
          </article>`)
    .join("\n");
}

function guideCrossLinks(prefix = "") {
  return `<p class="guide-crosslinks">Need a research method? Read the <a href="${prefix}research-guide.html">car brochure research guide</a>, compare years with the <a href="${prefix}model-year-guide.html">model-year guide</a>, or check terms in the <a href="${prefix}brochure-glossary.html">brochure glossary</a>.</p>`;
}

function historyCards(prefix = "") {
  return brandHistoryArticles
    .map((article) => `<article class="history-card">
          <a href="${prefix}${historyUrl(article)}">
            <img src="${esc(article.heroImage)}" alt="${esc(article.imageAlt)}" loading="lazy" />
            <span>${esc(article.region)}</span>
            <h3>${esc(article.title)}</h3>
            <p>${esc(article.summary)}</p>
          </a>
        </article>`)
    .join("\n");
}

function brandFaqSchema(brand, count) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Where can I find ${brand.name} brochure PDFs?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${brand.name} brochures are organized on this archive page by model and year, with preview and download links for each available PDF.`
        }
      },
      {
        "@type": "Question",
        name: `How many ${brand.name} brochures are indexed?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: count
            ? `This page currently indexes ${count} ${brand.name} brochure PDF records.`
            : `This page is prepared for ${brand.name} brochure records and will list PDF files as they are added.`
        }
      },
      {
        "@type": "Question",
        name: `Are ${brand.name} brochures grouped by model and year?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. The ${brand.name} archive groups brochure records by model family and keeps each PDF title visible so users can choose the correct model year or fact sheet.`
        }
      },
      {
        "@type": "Question",
        name: `What can I use ${brand.name} brochure PDFs for?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${brand.name} brochures are useful for checking original specifications, trim names, color references, package descriptions, dimensions, equipment lists, and historical model-year changes.`
        }
      }
    ]
  });
}

function breadcrumbSchema(brand) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: brand.name,
        item: `${siteUrl}/${brandUrl(brand)}`
      }
    ]
  });
}

function modelBreadcrumbSchema(brand, model) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: brand.name,
        item: `${siteUrl}/${brandUrl(brand)}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: model,
        item: `${siteUrl}/${modelUrl(brand, model)}`
      }
    ]
  });
}

function mimeType(file) {
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function isGenericLogo(svg) {
  return svg.includes('M52 48h56M80 20v56');
}

async function logoFile(brand) {
  const base = path.join(root, "assets", "logos", slug(brand.name));
  const svgPath = `${base}.svg`;
  if (existsSync(svgPath)) {
    const svg = await readFile(svgPath, "utf8");
    if (!isGenericLogo(svg)) return { file: svgPath, data: Buffer.from(svg), mime: "image/svg+xml" };
  }

  for (const ext of ["png", "webp", "ico", "jpg", "jpeg"]) {
    const file = `${base}.${ext}`;
    if (existsSync(file)) {
      return { file, data: await readFile(file), mime: mimeType(file) };
    }
  }

  if (existsSync(svgPath)) {
    const svg = await readFile(svgPath, "utf8");
    return { file: svgPath, data: Buffer.from(svg), mime: "image/svg+xml" };
  }

  const svg = logoSvg(brand);
  return { file: "", data: Buffer.from(svg), mime: "image/svg+xml" };
}

async function logoSrc(brand) {
  const logo = await logoFile(brand);
  return `data:${logo.mime};base64,${logo.data.toString("base64")}`;
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

async function write(relativePath, content) {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function buildHome() {
  const brandItems = (await Promise.all(
    brands.map(async (brand) => `<a class="brand-item" id="${slug(brand.name)}" href="${brandUrl(brand)}" data-brand="${esc(`${brand.name} ${brand.models.join(" ")}`)}">
          <img class="brand-logo-img" src="${await logoSrc(brand)}" alt="${esc(brand.name)} logo" loading="lazy" />
          <span>${esc(brand.name)}</span>
        </a>`)
  ))
    .join("\n");
  const schema = [
    jsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Car Brochure Archive",
      description: "Research car brochure PDFs by brand, model, trim, specification, and model year.",
      inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }),
    jsonLd({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Car brochure brand index",
      numberOfItems: brands.length,
      itemListElement: brands.map((brand, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: brand.name,
        url: `${siteUrl}/${brandUrl(brand)}`
      }))
    })
  ].join("\n");

  const body = `${header("")}
    <main>
      <section class="directory-hero" aria-labelledby="page-title">
        <div>
          <h1 id="page-title">Car Brochure Archive</h1>
          <p class="hero-copy">Research car brochure PDFs, sales catalogs, model guides, and specification sheets across ${brands.length} manufacturers and ${totalModels} model families. Use the archive to compare trim details, model-year changes, equipment lists, and historical catalog language.</p>
          <form class="search-box" role="search" aria-label="Search brands">
            <label for="site-search">Search brands</label>
            <input id="site-search" type="search" placeholder="BMW / Toyota / Audi" autocomplete="off" />
          </form>
        </div>
      </section>
      <section id="brands" class="directory-section">
        <div class="brand-list" id="brand-list">${brandItems}</div>
        <p class="empty-state" hidden>No matching brand found.</p>
      </section>
      <section class="directory-section editorial-guide" aria-labelledby="archive-research-guide">
        <h2 id="archive-research-guide">How to use this brochure archive</h2>
        <div class="seo-note-grid">
          <article>
            <span>Research</span>
            <p>Start with the brand directory, choose a manufacturer, then open the model page that matches the vehicle you are researching. The archive keeps brochure titles, years, model groups, and file sizes visible so you can identify the right document before opening a PDF.</p>
          </article>
          <article>
            <span>Compare</span>
            <p>Brochures are useful for comparing original trim names, standard equipment, option packages, color names, wheel designs, dimensions, towing notes, engine descriptions, and market-specific language across model years.</p>
          </article>
          <article>
            <span>Verify</span>
            <p>Use brochure PDFs as historical reference material. Specifications can vary by country, print date, and package, so confirm important purchase or restoration details against the exact brochure year and title.</p>
          </article>
        </div>
      </section>
      <section class="directory-section editorial-guide guide-index" aria-labelledby="research-guides">
        <h2 id="research-guides">Brochure research guides</h2>
        <div class="seo-note-grid">
          ${guideCards("")}
        </div>
      </section>
      <section class="directory-section history-index" aria-labelledby="brand-history">
        <div class="section-heading">
          <h2 id="brand-history">Brand history</h2>
          <a href="history/">View history archive</a>
        </div>
        <div class="history-card-grid">
          ${historyCards("")}
        </div>
      </section>
    </main>
    ${footer("")}
    <script src="app.js" defer></script>`;

  await write(
    "index.html",
    pageShell({
      title: "Car Brochure Archive | Vehicle Brochure Research Index",
      description: `Research car brochure PDFs by brand and model across ${brands.length} brands. Compare sales catalogs, specification sheets, trim guides, and model-year brochure records.`,
      canonical: `${siteUrl}/`,
      cssPath: "styles.css",
      body,
      schema,
      keywords: homeKeywords()
    })
  );
}

async function buildNotFoundPage() {
  const popular = new Set(["Honda", "Toyota", "BMW", "Mercedes-Benz", "Audi", "Ford", "Chevrolet", "Porsche", "Volkswagen", "Volvo", "Lexus", "Nissan"]);
  const brandItems = (await Promise.all(
    brands
      .filter((brand) => popular.has(brand.name))
      .map(async (brand) => `<a class="brand-item" id="not-found-${slug(brand.name)}" href="/${brandUrl(brand)}" data-brand="${esc(`${brand.name} ${brand.models.join(" ")}`)}">
          <img class="brand-logo-img" src="${await logoSrc(brand)}" alt="${esc(brand.name)} logo" loading="lazy" />
          <span>${esc(brand.name)}</span>
        </a>`)
  )).join("\n");

  const schema = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Page not found",
    description: "Find car brochure PDF pages by brand or model from the Car Brochure Archive.",
    isPartOf: {
      "@type": "WebSite",
      name: "Car Brochure Archive",
      url: `${siteUrl}/`
    }
  });

  const body = `${header("/")}
    <main>
      <section class="not-found-hero" aria-labelledby="page-title">
        <p class="error-code">404</p>
        <h1 id="page-title">Page not found</h1>
        <p class="hero-copy">The brochure page may have moved. Search the archive or jump back to a popular brand.</p>
        <form class="search-box not-found-search" role="search" aria-label="Search brochure brands" action="/">
          <label for="site-search">Search brands and models</label>
          <div>
            <input id="site-search" name="q" type="search" placeholder="CR-V / Corolla / BMW" autocomplete="off" />
            <button type="submit">Search</button>
          </div>
        </form>
        <a class="home-link" href="/">Back to homepage</a>
      </section>
      <section class="directory-section not-found-directory" aria-label="Popular brochure brands">
        <div class="section-heading">
          <h2>Popular brands</h2>
          <a href="/#brands">View all brands</a>
        </div>
        <div class="brand-list" id="brand-list">${brandItems}</div>
        <p class="empty-state" hidden>No matching brand found. Try the full brand directory.</p>
      </section>
    </main>
    ${footer("/")}
    <script src="/app.js" defer></script>`;

  await write(
    "404.html",
    pageShell({
      title: "Page Not Found | Car Brochure Archive",
      description: "This brochure page could not be found. Search car brochure PDFs by brand, model, and catalog name.",
      canonical: `${siteUrl}/404.html`,
      cssPath: "/styles.css",
      body,
      schema,
      keywords: ["car brochure archive", "car brochure PDF search", "vehicle catalog PDF"],
      robots: "noindex,follow",
      ads: false
    })
  );
}

async function buildHistoryIndexPage() {
  const schema = [
    jsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Brand History Archive",
      description: "Read automotive brand history articles connected to original car brochure PDF records.",
      url: `${siteUrl}/history/`,
      inLanguage: "en",
      isPartOf: {
        "@type": "WebSite",
        name: "Car Brochure Archive",
        url: `${siteUrl}/`
      },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: brandHistoryArticles.length,
        itemListElement: brandHistoryArticles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: article.title,
          url: `${siteUrl}/${historyUrl(article)}`
        }))
      }
    })
  ].join("\n");

  const body = `${header("../")}
    <main>
      <section class="brand-page-head">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="../">Home</a>
          <span>/</span>
          <span>Brand History</span>
        </nav>
        <h1>Brand History</h1>
        <p>Read concise automotive brand history articles linked to the brochure archive. These pages add historical context around manufacturers, model launches, market changes, and the brochures that preserve those details.</p>
      </section>
      <section class="directory-section history-index">
        <div class="history-card-grid">
          ${historyCards("../")}
        </div>
      </section>
    </main>
    ${footer("../")}`;

  await write(
    "history/index.html",
    pageShell({
      title: "Brand History Archive | Car Brochure Archive",
      description: "Read automotive brand history articles and connect manufacturer history with original car brochure PDF records.",
      canonical: `${siteUrl}/history/`,
      cssPath: "../styles.css",
      body,
      schema,
      keywords: ["brand history archive", "automotive brand history", "car manufacturer history", "car brochure history"]
    })
  );
}

function historyBreadcrumbSchema(article) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Brand History",
        item: `${siteUrl}/history/`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.brand,
        item: `${siteUrl}/${historyUrl(article)}`
      }
    ]
  });
}

async function buildBrandHistoryPages() {
  for (const article of brandHistoryArticles) {
    const brand = brands.find((item) => slug(item.name) === slug(article.brand));
    if (!brand) continue;
    const sectionLinks = article.sections
      .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
      .join("\n");
    const relatedLinks = article.relatedModels
      .map((model) => `<a class="related-card" href="../../${modelUrl(brand, model)}">
            <h3>${esc(model)}</h3>
            <p>Explore brochure records and model-year details connected to ${esc(article.brand)} history.</p>
          </a>`)
      .join("\n");
    const sectionHtml = article.sections
      .map((section) => `<section id="${esc(section.id)}" class="history-section">
            <h2>${esc(section.title)}</h2>
            ${section.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("\n")}
            ${section.image
              ? `<figure class="article-image">
                <img src="${esc(section.image.src)}" alt="${esc(section.image.alt)}" loading="lazy" />
                <figcaption>${esc(section.image.caption)}</figcaption>
              </figure>`
              : ""}
          </section>`)
      .join("\n");
    const timelineHtml = article.timeline
      .map(([year, text]) => `<div class="timeline-item">
              <span class="timeline-year">${esc(year)}</span>
              <p>${esc(text)}</p>
            </div>`)
      .join("\n");
    const body = `${header("../../")}
      <main>
        <section class="history-hero" style="--history-image: url('${esc(article.heroImage)}')" aria-labelledby="page-title">
          <div class="history-hero-content">
            <nav class="breadcrumb light" aria-label="Breadcrumb">
              <a href="../../">Home</a>
              <span>/</span>
              <a href="../../history/">Brand History</a>
              <span>/</span>
              <span>${esc(article.brand)}</span>
            </nav>
            <p class="eyebrow">Brand History</p>
            <h1 id="page-title">${esc(article.title)}</h1>
            <p>${esc(article.summary)}</p>
            <div class="hero-meta">Automotive History / ${esc(article.brand)} / ${esc(article.region)}</div>
          </div>
        </section>
        <div class="history-layout">
          <article class="history-article">
            <p class="article-intro">${esc(article.summary)} Its brochure records make that development easier to study because they preserve model-year language, specifications, equipment details, and the way the brand presented itself to buyers.</p>
            <figure class="article-image">
              <img src="${esc(article.heroImage)}" alt="${esc(article.imageAlt)}" loading="lazy" />
              <figcaption>${esc(article.brand)} developed a distinct identity around engineering, technology and performance.</figcaption>
            </figure>
            ${sectionHtml}
            <section class="history-section" aria-labelledby="${esc(article.slug)}-timeline">
              <h2 id="${esc(article.slug)}-timeline">${esc(article.brand)} timeline</h2>
              <div class="timeline">${timelineHtml}</div>
            </section>
            <section class="brochure-box">
              <h2>Explore ${esc(article.brand)} brochures</h2>
              <p>Browse ${esc(article.brand)} brochures by model and model year to study original automotive sales literature, historical vehicle specifications, and factory equipment information.</p>
              <a class="primary-link" href="../../${brandUrl(brand)}">View ${esc(article.brand)} brochure archive</a>
            </section>
            <section class="related">
              <h2>Related ${esc(article.brand)} resources</h2>
              <div class="related-grid">
                <a class="related-card" href="../../${brandUrl(brand)}">
                  <h3>${esc(article.brand)} brochure archive</h3>
                  <p>Browse ${esc(article.brand)} brochures by model and year.</p>
                </a>
                ${relatedLinks}
              </div>
            </section>
          </article>
          <aside class="history-sidebar">
            <section class="sidebar-box">
              <h2>${esc(article.brand)} history</h2>
              ${sectionLinks}
            </section>
            <section class="sidebar-box">
              <h2>Browse brands</h2>
              ${["Acura", "Audi", "BMW", "Honda", "Lexus", "Toyota"]
                .map((name) => {
                  const linkedBrand = brands.find((item) => item.name === name);
                  return linkedBrand ? `<a href="../../${brandUrl(linkedBrand)}">${esc(name)}</a>` : "";
                })
                .join("\n")}
            </section>
            <section class="sidebar-box">
              <h2>Archive note</h2>
              <p>Use brochure PDFs as historical sources. Details can vary by market, model year, print date, and trim package.</p>
            </section>
          </aside>
        </div>
      </main>
      ${footer("../../")}`;
    const schema = [
      jsonLd({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.description,
        image: [article.heroImage],
        author: {
          "@type": "Organization",
          name: "Car Brochure Archive"
        },
        publisher: {
          "@type": "Organization",
          name: "Car Brochure Archive"
        },
        datePublished: article.published,
        dateModified: now,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${siteUrl}/${historyUrl(article)}`
        }
      }),
      historyBreadcrumbSchema(article)
    ].join("\n");

    await write(
      historyPagePath(article),
      pageShell({
        title: `${article.headline} | Car Brochure Archive`,
        description: article.description,
        canonical: `${siteUrl}/${historyUrl(article)}`,
        cssPath: "../../styles.css",
        body,
        schema,
        keywords: [`${article.brand} history`, `${article.brand} brand history`, `${article.brand} brochure archive`, `${article.brand} automotive history`]
      })
    );
  }
}

function policyPageShell({ id, title, description, canonicalPath, bodyHtml, keywords = [] }) {
  const body = `${header("")}
    <main>
      <section class="legal-page" aria-labelledby="${id}-title">
        ${bodyHtml}
      </section>
    </main>
    ${footer("")}`;

  const schema = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${siteUrl}/${canonicalPath}`,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "Car Brochure Archive",
      url: `${siteUrl}/`
    }
  });

  return pageShell({
    title,
    description,
    canonical: `${siteUrl}/${canonicalPath}`,
    cssPath: "styles.css",
    body,
    schema,
    keywords
  });
}

async function buildPolicyPages() {
  const pages = [
    ...editorialPages,
    {
      path: "about.html",
      id: "about",
      title: "About Car Brochure Archive",
      description: "Learn how Car Brochure Archive organizes car brochure PDFs, model catalogs, and specification guides for research and comparison.",
      keywords: ["about car brochure archive", "car brochure research", "auto catalog archive"],
      bodyHtml: `<p class="eyebrow">About</p>
        <h1 id="about-title">About Car Brochure Archive</h1>
        <p>Car Brochure Archive is an independent reference index for automotive brochure PDFs. The site organizes sales brochures, model catalogs, specification sheets, and range guides by manufacturer and model so readers can compare trim language, engines, dimensions, equipment, and market positioning across model years.</p>
        <p>The archive is built for shoppers, owners, collectors, researchers, and writers who need a fast way to find original brochure material without digging through scattered manufacturer pages. Each brand page groups brochures by model family, while model pages focus on year-by-year PDF records when documents are available.</p>
        <h2>How pages are organized</h2>
        <p>Brand pages summarize the available brochure records for one manufacturer. Model pages narrow the archive to a single model family and list brochure years, titles, file sizes, and download links. The home page is a compact brand directory designed for quick scanning.</p>
        <h2>Editorial approach</h2>
        <p>The site adds its own organization, model grouping, research notes, comparison guidance, and page metadata around brochure records. The goal is to help readers understand which brochure to open, what details to compare, and how to treat each PDF as historical reference material rather than current manufacturer advice.</p>
        <h2>Independence</h2>
        <p>Car Brochure Archive is not affiliated with, endorsed by, or sponsored by any vehicle manufacturer. Brand names, model names, logos, and brochure titles are used for identification and historical reference.</p>`
    },
    {
      path: "contact.html",
      id: "contact",
      title: "Contact Car Brochure Archive",
      description: "Contact Car Brochure Archive for correction requests, removal requests, missing brochure reports, or archive feedback.",
      keywords: ["contact car brochure archive", "brochure correction request", "PDF removal request"],
      bodyHtml: `<p class="eyebrow">Contact</p>
        <h1 id="contact-title">Contact Car Brochure Archive</h1>
        <p>Use this page for archive corrections, broken PDF links, missing brochure reports, and rights or removal requests. Please include the exact page URL and brochure title so the issue can be reviewed quickly.</p>
        <div class="contact-options">
          <a class="secondary-link" href="mailto:contact@carbrochurearchive.com">contact@carbrochurearchive.com</a>
          <a class="secondary-link" href="https://github.com/lg-list/BrochureGarage/issues" target="_blank" rel="noopener">GitHub issue tracker</a>
        </div>
        <h2>What to include</h2>
        <p>For corrections, include the brand, model, model year, brochure title, and the corrected information. For rights or removal requests, include the affected URL, your relationship to the rights holder, and enough detail to identify the specific PDF or image.</p>
        <h2>Rights and removal requests</h2>
        <p>If a rights holder asks for a brochure file, logo, title, or page reference to be removed or changed, the request will be reviewed and acted on when enough information is provided to identify the material. The archive is intended for reference and research, not to replace official manufacturer websites or current sales material.</p>
        <h2>Response scope</h2>
        <p>The archive is maintained as a reference project. Requests are reviewed for accuracy, relevance, and whether the content should remain available as a historical brochure reference.</p>`
    },
    {
      path: "privacy.html",
      id: "privacy",
      title: "Privacy Policy | Car Brochure Archive",
      description: "Read the Car Brochure Archive privacy policy, including analytics, advertising cookies, server logs, and third-party PDF hosting.",
      keywords: ["car brochure archive privacy policy", "advertising cookies", "Google AdSense privacy"],
      bodyHtml: `<p class="eyebrow">Privacy</p>
        <h1 id="privacy-title">Privacy Policy</h1>
        <p>Car Brochure Archive is a public, static website. Visitors can browse pages and open brochure PDFs without creating an account or submitting personal information.</p>
        <h2>Information collected automatically</h2>
        <p>Like most websites, hosting providers and content delivery services may process basic technical information such as IP address, browser type, referring page, requested URL, timestamps, and device information. This information is used for site delivery, security, abuse prevention, troubleshooting, and aggregate performance review.</p>
        <h2>Advertising and cookies</h2>
        <p>This site may use Google AdSense. Google and its partners may use cookies or similar technologies to serve, personalize, limit, and measure ads. Visitors can learn how Google uses information from sites or apps that use Google services and can manage ad personalization in their Google account settings.</p>
        <h2>Third-party services</h2>
        <p>PDF files may be delivered through third-party storage or content delivery networks. Opening a PDF may cause the PDF host to receive technical request information needed to serve the file.</p>
        <h2>Contact</h2>
        <p>For privacy questions or requests related to this site, use the contact page and include the relevant URL or document title.</p>`
    },
    {
      path: "terms.html",
      id: "terms",
      title: "Terms and Disclaimer | Car Brochure Archive",
      description: "Review the Car Brochure Archive terms, trademark disclaimer, brochure reference purpose, and removal request process.",
      keywords: ["car brochure archive terms", "automotive brochure disclaimer", "trademark disclaimer"],
      bodyHtml: `<p class="eyebrow">Terms</p>
        <h1 id="terms-title">Terms and Disclaimer</h1>
        <p>Car Brochure Archive is provided as an informational reference for automotive brochure research. Use of the site means you understand that brochure details may be historical, market-specific, incomplete, or superseded by newer manufacturer information.</p>
        <h2>No affiliation</h2>
        <p>This site is independent and is not affiliated with any manufacturer, dealer group, publisher, or brand owner. Trademarks, logos, model names, and brochure names belong to their respective owners and are used for identification and reference.</p>
        <h2>Brochure content</h2>
        <p>Brochure PDFs are listed for research, comparison, and historical reference. If you own rights to a document and believe it should be corrected, credited differently, or removed, use the contact page with the affected URL and enough information to identify the material.</p>
        <h2>Removal process</h2>
        <p>Removal and correction requests should identify the exact page URL, PDF title, brand, model, and the requester's relationship to the material. When a valid request is received, the site may remove the file link, update attribution or wording, replace a logo, or revise the surrounding page text.</p>
        <h2>No professional advice</h2>
        <p>Vehicle specifications, availability, pricing, safety equipment, warranty terms, and regulatory details vary by market and time. Always verify current vehicle information with the manufacturer or an authorized dealer before making purchase or repair decisions.</p>
        <h2>External links</h2>
        <p>The site links to PDF files and third-party resources. External pages and files are controlled by their respective operators, and their availability may change without notice.</p>`
    }
  ];

  for (const page of pages) {
    await write(
      page.path,
      policyPageShell({
        id: page.id,
        title: page.title,
        description: page.description,
        canonicalPath: page.path,
        bodyHtml: page.bodyHtml,
        keywords: page.keywords
      })
    );
  }
}

async function buildLogos() {
  for (const brand of brands) {
    const base = path.join(root, "assets", "logos", slug(brand.name));
    const hasAnyLogo = ["svg", "png", "webp", "ico", "jpg", "jpeg"].some((ext) => existsSync(`${base}.${ext}`));
    if (!hasAnyLogo) {
      await write(`assets/logos/${slug(brand.name)}.svg`, logoSvg(brand));
    }
  }
}

async function buildSiteAssets() {
  await write("assets/site-logo.svg", siteLogoSvg());
  await writeFile(path.join(root, "assets", "favicon.ico"), faviconIco());
}

async function buildBrandPages() {
  const library = await loadBrochureLibrary();
  for (const brand of brands) {
    const documents = library[slug(brand.name)] || [];
    const historyArticle = brandHistoryFor(brand);
    const historyLink = historyArticle
      ? `\n          <p class="brand-history-link"><a href="../../${historyUrl(historyArticle)}">${esc(brand.name)} brand history</a></p>`
      : "";
    const groupedDocuments = documents.reduce((groups, entry) => {
      const model = brochureModel(entry, brand);
      const year = brochureYear(entry);
      if (!groups.has(model)) groups.set(model, new Map());
      if (!groups.get(model).has(year)) groups.get(model).set(year, []);
      groups.get(model).get(year).push(entry);
      return groups;
    }, new Map());
    const documentList = documents.length
      ? [...groupedDocuments.entries()]
          .map(([model, yearGroups]) => `<section class="model-brochure-group" aria-labelledby="${slug(brand.name)}-${slug(model)}">
            <h2 id="${slug(brand.name)}-${slug(model)}">${isSpecificModel(model, brand)
              ? `<a href="../../${modelUrl(brand, model)}">${esc(model)}</a>`
              : esc(model)}</h2>
            <div class="brochure-list">${[...yearGroups.values()]
              .flat()
                  .map((entry) => {
                    const href = localPdfPath(brand, entry);
                    const hasFile = hasPublicPdf(brand, entry);
                    return `<article class="brochure-row">
                      <span class="brochure-title">${esc(entry.title)}</span>
                      <span class="brochure-size">${esc(entry.size)}</span>
                      <span class="file-actions">
                        ${hasFile
                          ? `<a class="pdf-link" href="${esc(href)}" target="_blank" rel="noopener">Preview</a>
                        <a class="pdf-link" href="${esc(href)}" target="_blank" rel="noopener" download>Download</a>`
                          : `<span class="missing-file">Missing file</span>`}
                      </span>
                    </article>`;
                  })
                  .join("\n")}</div>
          </section>`)
          .join("\n")
      : `<p class="empty-state">No local PDF records yet. Add PDFs under <code>pdfs/${slug(brand.name)}/</code> and add records to <code>data/brochures.json</code>.</p>`;
    const body = `${header("../../")}
      <main>
        <section class="brand-page-head">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="../../">Home</a>
            <span>/</span>
            <span>${esc(brand.name)}</span>
          </nav>
          <h1>${esc(brand.name)} PDF Brochures</h1>
          <p>${esc(brandIntro(brand, documents.length))}</p>${historyLink}
          <dl class="brand-stats" aria-label="${esc(brand.name)} brochure index summary">
            <div>
              <dt>PDF records</dt>
              <dd>${documents.length}</dd>
            </div>
            <div>
              <dt>Model focus</dt>
              <dd>${esc(topModels(brand, 4))}</dd>
            </div>
          </dl>
        </section>
        <section class="directory-section tight">
          ${documentList}
        </section>
        <section class="directory-section guide-links" aria-labelledby="${slug(brand.name)}-guide-links">
          <h2 id="${slug(brand.name)}-guide-links">Use ${esc(brand.name)} brochures as research sources</h2>
          ${guideCrossLinks("../../")}
        </section>
        <section class="directory-section editorial-guide" aria-labelledby="${slug(brand.name)}-research-guide">
          <h2 id="${slug(brand.name)}-research-guide">How to research ${esc(brand.name)} brochures</h2>
          <div class="seo-note-grid">
            ${brandEditorialGuide(brand, documents)
              .map((item, index) => `<article>
                <span>${["Start", "Compare", "Verify"][index]}</span>
                <p>${esc(item)}</p>
              </article>`)
              .join("\n")}
          </div>
        </section>
        <section class="directory-section brand-seo-panel" aria-labelledby="${slug(brand.name)}-archive-overview">
          <h2 id="${slug(brand.name)}-archive-overview">${esc(brand.name)} brochure archive overview</h2>
          <p>${esc(brandCoverageText(brand, documents))}</p>
          <div class="seo-note-grid">
            ${brandUseCases(brand)
              .map((item, index) => `<article>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <p>${esc(item)}</p>
              </article>`)
              .join("\n")}
          </div>
        </section>
        <section class="directory-section archive-note">
          <h2>${esc(brand.name)} brochure research notes</h2>
          <p>${esc(brandResearchNote(brand, documents.length))}</p>
          <p>For best results, open the PDF title above that matches the model year you need, then compare it against nearby years on the same page. Manufacturer brochure language can vary by market, print date, and trim package, so the listed PDF title and year should be treated as the primary reference point.</p>
        </section>
        <section class="directory-section faq-section" aria-labelledby="${slug(brand.name)}-faq">
          <h2 id="${slug(brand.name)}-faq">${esc(brand.name)} brochure FAQ</h2>
          <details open>
            <summary>Where can I find ${esc(brand.name)} brochure PDFs?</summary>
            <p>${esc(brand.name)} brochures are organized above by model and year, with preview and download links for each available PDF record.</p>
          </details>
          <details>
            <summary>How should I compare ${esc(brand.name)} brochure years?</summary>
            <p>Start with the brochure year that matches the vehicle or research target, then check adjacent years for changes to trims, engines, packages, dimensions, colors, and standard equipment.</p>
          </details>
          <details>
            <summary>Are these pages official ${esc(brand.name)} pages?</summary>
            <p>No. Car Brochure Archive is an independent reference index. Brand names, model names, and brochure titles are used only to identify historical sales literature and PDF records.</p>
          </details>
        </section>
      </main>
      ${footer("../../")}`;

    await write(
      brandPagePath(brand),
      pageShell({
        title: `${brand.name} PDF Brochures | Car Catalog Archive`,
        description: brandDescription(brand, documents.length),
        canonical: `${siteUrl}/${brandUrl(brand)}`,
        cssPath: "../../styles.css",
        body,
        keywords: brandKeywords(brand),
        schema: [
          jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${brand.name} PDF brochure archive`,
            description: brandDescription(brand, documents.length),
            keywords: brandKeywords(brand).join(", "),
            url: `${siteUrl}/${brandUrl(brand)}`,
            dateModified: now,
            inLanguage: "en",
            isPartOf: {
              "@type": "WebSite",
              name: "Car Brochure Archive",
              url: `${siteUrl}/`
            },
            about: {
              "@type": "Brand",
              name: brand.name,
              url: brand.official
            },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: documents.length,
              itemListElement: documents.map((entry, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: entry.title,
                url: publicPdfUrl(brand, entry)
              }))
            }
          }),
          breadcrumbSchema(brand),
          brandFaqSchema(brand, documents.length)
        ].join("\n")
      })
    );
  }
}

async function buildModelPages(library) {
  let modelPageCount = 0;
  for (const brand of brands) {
    const documents = library[slug(brand.name)] || [];
    const groupedDocuments = documents.reduce((groups, entry) => {
      const model = brochureModel(entry, brand);
      if (!isSpecificModel(model, brand)) return groups;
      if (!groups.has(model)) groups.set(model, []);
      groups.get(model).push(entry);
      return groups;
    }, new Map());

    for (const [model, entries] of groupedDocuments) {
      const years = [...new Set(entries.map(brochureYear).filter((year) => year !== "Other"))].sort((a, b) => b.localeCompare(a));
      const rows = entries
        .map((entry) => {
          const href = localPdfPath(brand, entry);
          return `<article class="brochure-row">
            <span class="brochure-title">${esc(entry.title)}</span>
            <span class="brochure-size">${esc(entry.size)}</span>
            <span class="file-actions">
              <a class="pdf-link" href="${esc(href)}" target="_blank" rel="noopener">Preview</a>
              <a class="pdf-link" href="${esc(href)}" target="_blank" rel="noopener" download>Download</a>
            </span>
          </article>`;
        })
        .join("\n");
      const description = modelDescription(brand, model, entries);
      const body = `${header("../../../")}
        <main>
          <section class="brand-page-head">
            <nav class="breadcrumb" aria-label="Breadcrumb">
              <a href="../../../">Home</a>
              <span>/</span>
              <a href="../../../${brandUrl(brand)}">${esc(brand.name)}</a>
              <span>/</span>
              <span>${esc(model)}</span>
            </nav>
            <h1>${esc(model)} PDF Brochures</h1>
            <p>${esc(description)}</p>
            <dl class="brand-stats" aria-label="${esc(model)} brochure archive summary">
              <div>
                <dt>PDF records</dt>
                <dd>${entries.length}</dd>
              </div>
              <div>
                <dt>Available years</dt>
                <dd>${esc(years.join(", ") || "Unspecified")}</dd>
              </div>
            </dl>
          </section>
          <section class="directory-section tight">
            <section class="model-brochure-group" aria-labelledby="${slug(model)}-downloads">
              <h2 id="${slug(model)}-downloads">${esc(model)} brochure downloads</h2>
              <div class="brochure-list">${rows}</div>
            </section>
          </section>
          <section class="directory-section guide-links" aria-labelledby="${slug(model)}-guide-links">
            <h2 id="${slug(model)}-guide-links">Use ${esc(model)} brochures as research sources</h2>
            ${guideCrossLinks("../../../")}
          </section>
          <section class="directory-section editorial-guide" aria-labelledby="${slug(model)}-research-guide">
            <h2 id="${slug(model)}-research-guide">${esc(model)} brochure research guide</h2>
            <div class="seo-note-grid">
              ${modelEditorialGuide(brand, model, entries, years)
                .map((item, index) => `<article>
                  <span>${["Match", "Compare", "Cite"][index]}</span>
                  <p>${esc(item)}</p>
                </article>`)
                .join("\n")}
            </div>
          </section>
          <section class="directory-section archive-note">
            <h2>${esc(model)} research notes</h2>
            <p>${esc(modelResearchNote(brand, model, entries, years))}</p>
            <p>The PDF list above is arranged as a compact reference index. Open the brochure year that matches your research target, then compare adjacent years when checking feature changes, styling updates, option packages, or market-specific equipment descriptions.</p>
          </section>
        </main>
        ${footer("../../../")}`;
      const schema = [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${model} PDF brochure archive`,
          description,
          url: `${siteUrl}/${modelUrl(brand, model)}`,
          dateModified: now,
          inLanguage: "en",
          isPartOf: {
            "@type": "WebSite",
            name: "Car Brochure Archive",
            url: `${siteUrl}/`
          },
          about: {
            "@type": "Product",
            name: model,
            brand: {
              "@type": "Brand",
              name: brand.name
            }
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: entries.length,
            itemListElement: entries.map((entry, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: entry.title,
              url: publicPdfUrl(brand, entry)
            }))
          }
        }),
        modelBreadcrumbSchema(brand, model)
      ].join("\n");

      await write(
        modelPagePath(brand, model),
        pageShell({
          title: `${model} PDF Brochures by Year | ${brand.name}`,
          description,
          canonical: `${siteUrl}/${modelUrl(brand, model)}`,
          cssPath: "../../../styles.css",
          body,
          schema,
          keywords: modelKeywords(brand, model, years),
          robots: "index,follow,max-image-preview:large"
        })
      );
      modelPageCount += 1;
    }
  }
  return modelPageCount;
}

function modelUrls(library) {
  return brands.flatMap((brand) => {
    const documents = library[slug(brand.name)] || [];
    const counts = documents.reduce((map, entry) => {
      const model = brochureModel(entry, brand);
      if (!isSpecificModel(model, brand)) return map;
      map.set(model, (map.get(model) || 0) + 1);
      return map;
    }, new Map());
    return [...counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([model]) => model)
      .map((model) => modelUrl(brand, model));
  });
}

async function buildSitemap(library) {
  const urls = [
    { url: "", priority: "1.0", changefreq: "weekly" },
    { url: "history/", priority: "0.8", changefreq: "monthly" },
    ...brandHistoryArticles.map((article) => ({ url: historyUrl(article), priority: "0.8", changefreq: "monthly" })),
    ...editorialPages.map((page) => ({ url: page.path, priority: "0.7", changefreq: "monthly" })),
    { url: "about.html", priority: "0.6", changefreq: "monthly" },
    { url: "contact.html", priority: "0.5", changefreq: "monthly" },
    { url: "privacy.html", priority: "0.4", changefreq: "yearly" },
    { url: "terms.html", priority: "0.4", changefreq: "yearly" },
    ...brands.map((brand) => ({ url: brandUrl(brand), priority: "0.9", changefreq: "monthly" })),
    ...modelUrls(library).map((url) => ({ url, priority: "0.8", changefreq: "monthly" }))
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((entry) => `  <url>
    <loc>${siteUrl}/${entry.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`)
  .join("\n")}
</urlset>`;
  await write("sitemap.xml", body);
}

async function buildRedirects() {
  const redirectLines = [
    "/index.html / 301",
    "/acura-brand-history.html /history/acura/ 301",
    "/history/index.html /history/ 301",
    ...brandHistoryArticles.map((article) => `/${historyUrl(article)}index.html /${historyUrl(article)} 301`),
    ...brands.map((brand) => `/${brandUrl(brand)}index.html /${brandUrl(brand)} 301`)
  ];
  await write("_redirects", `${redirectLines.join("\n")}\n`);
}

async function buildRobots() {
  await write("robots.txt", `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);
}

async function buildAdsTxt() {
  await write("ads.txt", `google.com, ${adsensePublisherId}, DIRECT, f08c47fec0942fa0
`);
}

async function main() {
  await rm(path.join(root, "brands"), { recursive: true, force: true });
  await rm(path.join(root, "models"), { recursive: true, force: true });
  await rm(path.join(root, "history"), { recursive: true, force: true });
  await buildSiteAssets();
  await buildLogos();
  await buildPolicyPages();
  await buildHome();
  await buildNotFoundPage();
  await buildHistoryIndexPage();
  await buildBrandHistoryPages();
  await buildBrandPages();
  const library = await loadBrochureLibrary();
  const modelPageCount = await buildModelPages(library);
  await buildSitemap(library);
  await buildRobots();
  await buildAdsTxt();
  await buildRedirects();
  const totalBrochures = Object.values(library).reduce((sum, entries) => sum + entries.length, 0);
  console.log(`Generated ${brands.length} brand pages and ${modelPageCount} model pages with ${totalBrochures} local PDF records.`);
}

await main();
