/**
 * Text vocabulary shared by the food matcher and the meal parser:
 * normalisation, Hinglish spelling canon, number words, Indian portions, fillers and cues.
 */

/** Prototype-free lookup table, so words like "constructor" never hit Object.prototype. */
export function dict<T>(entries: Record<string, T>): Record<string, T> {
  return Object.assign(Object.create(null) as Record<string, T>, entries);
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercase, drop diacritics/punctuation, split digits from letters ("7up" → "7 up"), collapse spaces. */
export function basicNormalize(s: string): string {
  return stripDiacritics(String(s ?? ""))
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/(\d)(?=[a-z])/g, "$1 ")
    .replace(/([a-z])(?=\d)/g, "$1 ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Common Hinglish / regional spelling variants → one canonical token (applied to aliases and queries alike). */
export const CANON: Record<string, string> = dict({
  daal: "dal", dhal: "dal", dall: "dal", daals: "dal",
  sabji: "sabzi", subzi: "sabzi", subji: "sabzi", sabjee: "sabzi", sabzee: "sabzi", sabziyan: "sabzi", sabjiyan: "sabzi", sbzi: "sabzi",
  chaawal: "chawal", chaval: "chawal", chawel: "chawal", chawl: "chawal",
  aalu: "aloo", alu: "aloo", aaloo: "aloo", aloos: "aloo",
  gobhi: "gobi", ghobi: "gobi",
  panir: "paneer", panner: "paneer", paner: "paneer", paneeer: "paneer",
  parantha: "paratha", prantha: "paratha", parotha: "paratha", parathe: "paratha", paranthe: "paratha", parathas: "paratha", paratha: "paratha",
  chapathi: "chapati", chappati: "chapati", chapatti: "chapati", chapathy: "chapati", chapattis: "chapati", chapatiyan: "chapati",
  rotiyan: "roti", rotiya: "roti", rotian: "roti", rotiyaan: "roti", rooti: "roti",
  idly: "idli", iddli: "idli", idlies: "idli", idliyan: "idli",
  dosai: "dosa", dosas: "dosa", dosey: "dosa",
  vadai: "vada", wada: "vada", vade: "vada", vadas: "vada",
  sambhar: "sambar", saambar: "sambar", sambaar: "sambar",
  chhole: "chole", cholay: "chole", chholey: "chole", cholle: "chole", chhola: "chole",
  channa: "chana", chane: "chana", chaney: "chana", chanay: "chana",
  rajmah: "rajma", rajmaa: "rajma",
  bhendi: "bhindi", bindi: "bhindi", bhindy: "bhindi",
  baigan: "baingan", bengan: "baingan", baingun: "baingan", bhaingan: "baingan",
  yoghurt: "yogurt", yoghourt: "yogurt",
  omelet: "omelette", omlet: "omelette", omlette: "omelette", amlet: "omelette", omellete: "omelette", omelete: "omelette", aamlet: "omelette", omlate: "omelette", omelettes: "omelette",
  biriyani: "biryani", briyani: "biryani", biryaani: "biryani", biriani: "biryani", beriyani: "biryani", biryanis: "biryani",
  kichdi: "khichdi", khichadi: "khichdi", khichri: "khichdi", khichdee: "khichdi", khichuri: "khichdi", kichadi: "khichdi",
  pakoda: "pakora", pakode: "pakora", pakore: "pakora", pakodas: "pakora", pakoras: "pakora",
  ande: "anda", andey: "anda", andaa: "anda", ando: "anda",
  poori: "puri", puriyan: "puri", pooris: "puri",
  masaala: "masala",
  murg: "murgh", murgi: "murgh",
  mutter: "matar", mattar: "matar", mutar: "matar",
  kheema: "keema", qeema: "keema", kima: "keema",
  machhi: "machli", machhli: "machli", macchi: "machli", machi: "machli", machchi: "machli", machali: "machli",
  achaar: "achar", aachar: "achar",
  laddu: "ladoo", laddoo: "ladoo", ladu: "ladoo", laddus: "ladoo", ladoos: "ladoo", laddoos: "ladoo",
  burfi: "barfi", barafi: "barfi",
  rasagulla: "rasgulla", rasgula: "rasgulla", rasgulle: "rasgulla",
  halva: "halwa",
  chaay: "chai", chay: "chai", chaai: "chai",
  coffe: "coffee", cofee: "coffee", coffie: "coffee", kofi: "coffee",
  chiken: "chicken", chikken: "chicken", chickn: "chicken", chikan: "chicken",
  biscut: "biscuit", biskut: "biscuit", biscit: "biscuit", buscuit: "biscuit", biskit: "biscuit",
  samose: "samosa", samosey: "samosa",
  kachauri: "kachori", kachodi: "kachori", kachoriyan: "kachori",
  dahee: "dahi", dahin: "dahi",
  dudh: "doodh", dood: "doodh",
  chini: "cheeni",
  chaach: "chaas", chhach: "chaas", chhaas: "chaas", chhaach: "chaas", chhas: "chaas", chach: "chaas",
  paani: "pani",
  nariyel: "nariyal", naariyal: "nariyal", narial: "nariyal",
  kele: "kela", kelaa: "kela",
  tamater: "tamatar",
  pyaaz: "pyaz", pyaj: "pyaz", pyaaj: "pyaz",
  kadhai: "kadai", karahi: "kadai", kadhaai: "kadai",
  kadi: "kadhi", karhi: "kadhi",
  makhni: "makhani",
  noodle: "noodles",
  sprout: "sprouts",
  cornflake: "cornflakes",
  jalebee: "jalebi", jalebiyan: "jalebi",
  chappathi: "chapati",
  maggie: "maggi", magi: "maggi",
  momoes: "momos",
  sandwhich: "sandwich", sandwitch: "sandwich", sandwhiches: "sandwich", sandwiches: "sandwich",
  piza: "pizza", pizaa: "pizza",
  burgur: "burger",
  frys: "fries",
});

/** Number words (English + Hindi/Hinglish). "a"/"an" count as 1. */
export const NUM_WORDS: Record<string, number> = dict({
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  half: 0.5, quarter: 0.25, couple: 2, pair: 2, dozen: 12, single: 1, double: 2, triple: 3, few: 3, several: 3, full: 1, whole: 1,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, che: 6, cheh: 6, chheh: 6,
  saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12,
  aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, aadhe: 0.5, adhe: 0.5, aadhaa: 0.5,
  dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, sawa: 1.25, pura: 1, poora: 1, puraa: 1,
});

/** "saade teen" = 3.5, "paune do" = 1.75 (alone, "paune" = 0.75). */
export const NUM_PREFIX: Record<string, number> = dict({ saade: 0.5, sade: 0.5, saadhe: 0.5, sadhe: 0.5, paune: -0.25, pone: -0.25 });

/** Words that mean "half/full/single/double" for foods with special portion meanings. */
export const PORTION_NUM_WORDS: Record<string, "half" | "full" | "single" | "double"> = dict({
  half: "half", aadha: "half", adha: "half", aadhi: "half", adhi: "half", aadhe: "half", adhe: "half", aadhaa: "half",
  full: "full", pura: "full", poora: "full", puraa: "full", whole: "full",
  single: "single", double: "double",
});

/** Portion words → canonical unit. */
export const PORTIONS: Record<string, string> = dict({
  katori: "katori", katoris: "katori", katories: "katori", vati: "katori", vaati: "katori", wati: "katori",
  bowl: "bowl", bowls: "bowl", bowlful: "bowl", katora: "bowl", katore: "bowl",
  plate: "plate", plates: "plate", plateful: "plate",
  glass: "glass", glasses: "glass", gilas: "glass", gilaas: "glass", glas: "glass",
  cup: "cup", cups: "cup", cupful: "cup", pyala: "cup", pyaala: "cup", pyali: "cup", pyaali: "cup",
  mug: "mug", mugs: "mug",
  tumbler: "tumbler", tumblers: "tumbler",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", pis: "piece", peice: "piece", peices: "piece", nos: "piece",
  tukda: "piece", tukde: "piece", tukra: "piece", tukre: "piece",
  slice: "slice", slices: "slice",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  spoon: "spoon", spoons: "spoon", spoonful: "spoon", spoonfuls: "spoon", chamach: "spoon", chammach: "spoon", chamcha: "spoon", chamche: "spoon",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  handful: "handful", handfuls: "handful", mutthi: "handful", muthi: "handful", mutthibhar: "handful",
  ladle: "ladle", ladles: "ladle", karchi: "ladle", kadchi: "ladle", kalchi: "ladle", karchhi: "ladle",
  scoop: "scoop", scoops: "scoop",
  packet: "packet", packets: "packet", pack: "packet", packs: "packet", pkt: "packet", pkts: "packet",
  bottle: "bottle", bottles: "bottle", pint: "pint", pints: "pint",
  peg: "peg", pegs: "peg", shot: "peg", shots: "peg",
  serving: "serving", servings: "serving", portion: "serving", portions: "serving", helping: "serving", helpings: "serving",
  bar: "bar", bars: "bar", stick: "piece", sticks: "piece", cob: "piece", cobs: "piece",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g", grm: "g", grms: "g", gramme: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", mls: "ml", millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml",
  l: "l", ltr: "l", ltrs: "l", litre: "l", litres: "l", liter: "l", liters: "l",
});

export type PortionKind = "weight" | "count" | "volume" | "measure";

/** How a portion (or a food's serving unit) behaves when converting between units. */
export const UNIT_KIND: Record<string, PortionKind> = dict({
  g: "weight", kg: "weight", ml: "weight", l: "weight",
  piece: "count", slice: "count", bar: "count", packet: "count", serving: "count",
  glass: "volume", cup: "volume", mug: "volume", tumbler: "volume", bottle: "volume", pint: "volume", peg: "volume",
  katori: "measure", bowl: "measure", plate: "measure", tbsp: "measure", spoon: "measure", tsp: "measure",
  handful: "measure", ladle: "measure", scoop: "measure",
});

/** Typical grams (or ml) of a household portion when the food's own unit differs. */
export const PORTION_GRAMS: Record<string, number> = dict({
  katori: 150, bowl: 200, plate: 250, glass: 250, cup: 150, mug: 250, tumbler: 120, bottle: 500, pint: 330, peg: 30,
  ladle: 90, handful: 30, tbsp: 15, spoon: 10, tsp: 5, scoop: 50,
});

export const WEIGHT_FACTOR: Record<string, number> = dict({ g: 1, kg: 1000, ml: 1, l: 1000 });

/** Size words multiply the portion. */
export const SIZE_WORDS: Record<string, number> = dict({
  small: 0.75, chota: 0.75, chhota: 0.75, choti: 0.75, chhoti: 0.75, chote: 0.75, chhote: 0.75, mini: 0.6, tiny: 0.5,
  medium: 1, regular: 1, normal: 1, standard: 1,
  large: 1.4, big: 1.4, bada: 1.4, badi: 1.4, bade: 1.4, jumbo: 1.6, huge: 1.6,
});

/** Separate items. */
export const CONNECTORS = new Set([",", "and", "aur", "te", "with", "plus", "then", "phir", "fir", "saath", "sath", "n", "also", "along", "alongwith"]);

/** Connectors across which a known combo name may be re-joined ("oats with milk", "mac and cheese"). */
export const JOINABLE = new Set(["and", "with"]); // "n", "aur", "te" arrive normalised to "and"

/** Meal-time words. Tier 1 (explicit meal) beats tier 2 (time of day). */
export const MEAL_WORDS: Record<string, { meal: "breakfast" | "lunch" | "dinner" | "snack"; tier: 1 | 2 }> = dict({
  breakfast: { meal: "breakfast", tier: 1 }, bfast: { meal: "breakfast", tier: 1 }, brekkie: { meal: "breakfast", tier: 1 },
  nashta: { meal: "breakfast", tier: 1 }, naashta: { meal: "breakfast", tier: 1 }, nasta: { meal: "breakfast", tier: 1 }, nashte: { meal: "breakfast", tier: 1 },
  brunch: { meal: "breakfast", tier: 1 },
  subah: { meal: "breakfast", tier: 2 }, morning: { meal: "breakfast", tier: 2 }, savere: { meal: "breakfast", tier: 2 }, sawere: { meal: "breakfast", tier: 2 },
  lunch: { meal: "lunch", tier: 1 }, lunchtime: { meal: "lunch", tier: 1 },
  dopahar: { meal: "lunch", tier: 2 }, dophar: { meal: "lunch", tier: 2 }, dopehar: { meal: "lunch", tier: 2 }, dupahar: { meal: "lunch", tier: 2 }, afternoon: { meal: "lunch", tier: 2 }, noon: { meal: "lunch", tier: 2 },
  dinner: { meal: "dinner", tier: 1 }, supper: { meal: "dinner", tier: 1 },
  raat: { meal: "dinner", tier: 2 }, night: { meal: "dinner", tier: 2 }, tonight: { meal: "dinner", tier: 2 }, rat: { meal: "dinner", tier: 2 },
  snack: { meal: "snack", tier: 1 }, snacks: { meal: "snack", tier: 1 }, snacking: { meal: "snack", tier: 1 }, munchies: { meal: "snack", tier: 1 },
  teatime: { meal: "snack", tier: 1 },
  evening: { meal: "snack", tier: 2 }, shaam: { meal: "snack", tier: 2 }, sham: { meal: "snack", tier: 2 }, shyam: { meal: "snack", tier: 2 },
});

/** Cues that the food was restaurant / dhaba / party style (more oil, butter, cream). */
export const RESTAURANT_WORDS = new Set([
  "restaurant", "restaurants", "restro", "resto", "restraunt", "restuarant", "resturant", "hotel", "dhaba", "dhabba", "dhabe",
  "outside", "bahar", "baahar", "order", "ordered", "ordering", "mangaya", "mangaye", "mangai", "mangwaya", "mangwaye", "mangvaya", "mangwaaya",
  "zomato", "swiggy", "takeaway", "takeout", "delivery", "delivered", "wedding", "shaadi", "shadi", "reception",
  "party", "cafe", "buffet", "canteen", "eatery", "dineout",
]);

/** "no sugar", "bina cheeni", "less ghee" → drop the add-on. */
export const NEGATIONS = new Set(["no", "without", "bina", "less", "kam", "zero", "not", "nahi", "nahin", "minus", "skip", "skipped", "sugarless", "sans"]);

/** Nutrient words, ignored when the text is a question ("how much protein in paneer?"). */
export const NUTRIENT_WORDS = new Set(["calorie", "calories", "cal", "cals", "kcal", "kcals", "protein", "proteins", "carbs", "carb", "carbohydrates", "fat", "fats", "fibre", "fiber", "macros", "macro", "nutrition", "nutrients", "value", "values"]);

export const QUESTION_RE = /\?|\b(how|kitna|kitni|kitne|kya|what|whats|which)\b/;

/** Words with no food meaning, removed everywhere (never used inside aliases). */
export const FILLERS = new Set([
  // English
  "i", "im", "ive", "id", "me", "my", "mine", "we", "our", "us", "you", "your", "he", "she", "they", "it", "its", "this", "that", "these", "those",
  "the", "of", "for", "to", "at", "in", "on", "from", "by", "into", "onto", "over", "around", "about", "approx", "approximately", "roughly", "nearly", "almost",
  "like", "just", "only", "some", "little", "bit", "lot", "lots", "much", "many", "more", "bunch", "had", "have", "has", "having", "ate", "eaten", "eat", "eating", "eats",
  "drank", "drunk", "drinking", "took", "take", "taking", "taken", "got", "get", "getting", "consumed", "consume", "grabbed", "finished", "tried", "try", "enjoyed",
  "was", "were", "is", "are", "am", "be", "been", "being", "did", "does", "done", "will", "would", "should", "could", "can", "may", "might", "must", "shall",
  "today", "yesterday", "tomorrow", "now", "recently", "earlier", "later", "before", "after", "post", "pre", "workout", "so", "very", "really", "too", "quite", "pretty",
  "please", "pls", "plz", "log", "logged", "add", "added", "track", "tracked", "record", "note", "entry", "meal", "stuff", "item", "items", "thing", "things",
  "something", "what", "whats", "how", "why", "when", "where", "which", "who", "there", "here", "if", "but", "yeah", "yes", "ok", "okay", "hi", "hello", "hey",
  "want", "wanted", "need", "tin", "x", "etc", "each", "every", "per", "total", "went", "go", "out", "late", "early", "midnight", "maybe", "probably", "around", "extra",
  // Hindi / Hinglish
  "aaj", "aj", "maine", "mainey", "mene", "meine", "humne", "hamne", "hum", "ham", "mai", "main", "mein", "mujhe", "mera", "meri", "mere", "ne", "ko", "ka", "ki",
  "ke", "se", "par", "pe", "tak", "liye", "khaya", "khaaya", "khayi", "khaayi", "khaye", "khaaye", "khai", "kha", "khaa", "khake", "khaake", "khana", "khane", "khaana",
  "piya", "piyaa", "piyi", "piye", "pi", "pee", "peeya", "pili", "liya", "liyaa", "li", "lee", "le", "lia", "tha", "thi", "thhe", "hai", "hain", "hei", "h", "ho",
  "hua", "hui", "hue", "gaya", "gayi", "gaye", "gya", "gyi", "abhi", "kal", "parso", "bas", "sirf", "bhi", "thoda", "thodi", "thode", "thora", "thori", "kuch", "kuchh",
  "wala", "wali", "wale", "vala", "vali", "vale", "waala", "waali", "waale", "banaya", "banayi", "bani", "bana", "lagbhag", "karib", "kareeb", "kitna", "kitni", "kitne",
  "kya", "kaise", "kyun", "ya", "or", "hota", "hoti", "hote", "raha", "rahi", "rahe", "diya", "di", "dia", "de", "da", "time", "baje", "waqt", "wagera", "vagaira",
]);

/** Leftover words that are safe to ignore when nothing else in the phrase is a food. */
export const IGNORABLE = new Set([
  "water", "pani", "jal", "nothing", "nahi", "nahin", "na", "food", "ghar", "home", "homemade", "homestyle", "house", "garam", "hot", "cold", "thanda", "thandi",
  "fresh", "healthy", "tasty", "spicy", "delicious", "yummy", "plain", "simple", "light", "heavy", "mom", "mummy", "maa", "mother", "wife", "husband", "bhabhi",
  "didi", "nani", "dadi", "friend", "friends", "family", "office", "college", "school", "hostel", "mess", "style", "cooked", "made", "prepared", "desi",
  "birthday", "anniversary", "festival", "diwali", "holi", "eid", "christmas", "navratri", "puja", "pooja", "celebration", "function", "occasion",
  "treat", "cheat", "day", "weekend", "sunday", "saturday", "friday", "together", "get", "punjabi", "south", "indian", "north", "chinese", "italian",
]);

/** Iterative Levenshtein distance with an early exit once it exceeds `max`. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
