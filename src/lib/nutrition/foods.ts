/**
 * ÖRZA's built-in food list: home-style Indian cooking first, plus common global foods.
 * Values are per default serving (cooked weight), cross-checked against IFCT/NIN-style
 * references and typical home recipes (about a teaspoon of oil per katori of dal or sabzi).
 * `restaurant_multiplier` captures the extra oil, butter and cream of restaurant/dhaba versions,
 * e.g. dal cooked with 5 ml oil at home vs ~30 ml outside.
 */
import type { FoodDiet, FoodEntry, FoodHints } from "./types";

type Macros = [calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number];
type Serving = FoodEntry["serving"];
interface Extra extends FoodHints {
  rm?: number; // restaurant_multiplier
  region?: string;
}

/* Default servings in Indian-natural units. Labels are what people see in the food picker. */
const S = {
  piece: (g: number, label?: string): Serving => ({ unit: "piece", grams: g, label: label ?? `1 piece (${g} g)` }),
  katori: (g = 150, label?: string): Serving => ({ unit: "katori", grams: g, label: label ?? `1 katori (${g} g)` }),
  bowl: (g: number, label?: string): Serving => ({ unit: "bowl", grams: g, label: label ?? `1 bowl (${g} g)` }),
  plate: (g: number, label?: string): Serving => ({ unit: "plate", grams: g, label: label ?? `1 plate (${g} g)` }),
  glass: (ml = 250, label?: string): Serving => ({ unit: "glass", grams: ml, label: label ?? `1 glass (${ml} ml)` }),
  cup: (ml = 150, label?: string): Serving => ({ unit: "cup", grams: ml, label: label ?? `1 cup (${ml} ml)` }),
  slice: (g: number, label?: string): Serving => ({ unit: "slice", grams: g, label: label ?? `1 slice (${g} g)` }),
  tbsp: (g = 15, label?: string): Serving => ({ unit: "tbsp", grams: g, label: label ?? `1 tbsp (${g} g)` }),
  tsp: (g = 5, label?: string): Serving => ({ unit: "tsp", grams: g, label: label ?? `1 tsp (${g} g)` }),
  handful: (g: number, label?: string): Serving => ({ unit: "handful", grams: g, label: label ?? `1 handful (${g} g)` }),
  serving: (g: number, label: string): Serving => ({ unit: "serving", grams: g, label }),
  packet: (g: number, label: string): Serving => ({ unit: "packet", grams: g, label }),
  bar: (g: number): Serving => ({ unit: "bar", grams: g, label: `1 small bar (${g} g)` }),
  scoop: (g: number): Serving => ({ unit: "scoop", grams: g, label: `1 scoop (${g} g)` }),
  bottle: (ml: number, label?: string): Serving => ({ unit: "bottle", grams: ml, label: label ?? `1 bottle (${ml} ml)` }),
  peg: (ml = 30): Serving => ({ unit: "peg", grams: ml, label: `1 peg (${ml} ml)` }),
};

/* Regions are full state names so they match the profile region picked in onboarding. */
const R = {
  north: "Punjab, Haryana, Delhi, Uttar Pradesh, Chandigarh, Himachal Pradesh, Uttarakhand",
  punjab: "Punjab, Haryana, Delhi, Chandigarh, Himachal Pradesh",
  south: "Tamil Nadu, Karnataka, Kerala, Andhra Pradesh, Telangana, Puducherry",
  tn: "Tamil Nadu, Puducherry",
  kerala: "Kerala",
  karnataka: "Karnataka",
  andhra: "Andhra Pradesh, Telangana",
  maha: "Maharashtra, Goa",
  guj: "Gujarat",
  raj: "Rajasthan",
  west: "Gujarat, Maharashtra, Rajasthan",
  central: "Madhya Pradesh, Maharashtra, Chhattisgarh",
  bengal: "West Bengal, Tripura, Assam",
  east: "West Bengal, Odisha, Assam, Tripura",
  odisha: "Odisha",
  bihar: "Bihar, Jharkhand, Uttar Pradesh",
  ne: "Sikkim, Arunachal Pradesh, Nagaland, Meghalaya, Manipur, Mizoram, Assam, Tripura, Ladakh, Himachal Pradesh",
  kashmir: "Jammu and Kashmir, Ladakh",
  konkan: "Goa, Maharashtra, Karnataka",
  hyd: "Telangana, Andhra Pradesh",
};

const list: FoodEntry[] = [];
/** Parser hints by food key (pieces per serving, "half"/"full" meanings, eggs per serving). */
export const FOOD_HINTS = new Map<string, FoodHints>();

function add(
  key: string,
  name: string,
  category: string,
  diet: FoodDiet,
  serving: Serving,
  m: Macros,
  aliases: string[],
  x: Extra = {}
) {
  const [calories, protein_g, carbs_g, fat_g, fiber_g] = m;
  const entry: FoodEntry = {
    key,
    name,
    aliases: Array.from(new Set(aliases.map((a) => a.toLowerCase().trim()).filter(Boolean))),
    category,
    diet,
    serving,
    per_serving: { calories, protein_g, carbs_g, fat_g, fiber_g },
  };
  if (x.region) entry.region = x.region;
  if (x.rm && x.rm > 1) entry.restaurant_multiplier = x.rm;
  const hints: FoodHints = {};
  if (x.pcs) hints.pcs = x.pcs;
  if (x.plate) hints.plate = x.plate;
  if (x.eggs) hints.eggs = x.eggs;
  if (x.words) hints.words = x.words;
  if (x.same) hints.same = x.same;
  if (Object.keys(hints).length) FOOD_HINTS.set(key, hints);
  list.push(entry);
}

/* ─────────────────────────── Breads ─────────────────────────── */
add("roti", "Roti", "bread", "vegan", S.piece(40, "1 medium roti (40 g)"), [110, 3.6, 21, 1.2, 3], ["roti", "chapati", "chapathi", "chappati", "chapatti", "phulka", "fulka", "rotli", "poli", "wheat roti", "atta roti", "tawa roti", "gehu roti", "plain roti", "home roti"]);
add("ghee_roti", "Roti with Ghee", "bread", "veg", S.piece(43, "1 roti + ½ tsp ghee"), [137, 3.6, 21, 4.2, 3], ["ghee roti", "roti with ghee", "ghee wali roti", "chupadi roti", "chopdi roti", "ghee chapati", "chapati with ghee", "butter roti", "roti with butter"]);
add("tandoori_roti", "Tandoori Roti", "bread", "vegan", S.piece(50), [125, 4.3, 25, 1, 2.2], ["tandoori roti", "tandoor roti", "tandoori chapati", "butter tandoori roti"], { rm: 1.2 });
add("missi_roti", "Missi Roti", "bread", "veg", S.piece(50), [150, 5.5, 22, 4.5, 3.5], ["missi roti", "besan roti", "besan ki roti"], { rm: 1.2, region: R.punjab });
add("paratha", "Plain Paratha", "bread", "veg", S.piece(60, "1 paratha (60 g)"), [190, 4.2, 26, 7.5, 3.5], ["paratha", "plain paratha", "sada paratha", "tawa paratha", "tikona paratha", "triangle paratha", "paratha plain"], { rm: 1.3 });
add("aloo_paratha", "Aloo Paratha", "bread", "veg", S.piece(110, "1 paratha (110 g)"), [270, 5.5, 38, 10.5, 4.5], ["aloo paratha", "aloo ka paratha", "potato paratha", "aloo parotha"], { rm: 1.3, region: R.punjab });
add("gobi_paratha", "Gobi Paratha", "bread", "veg", S.piece(110, "1 paratha (110 g)"), [250, 6, 33, 10, 4.5], ["gobi paratha", "gobi ka paratha", "cauliflower paratha"], { rm: 1.3, region: R.punjab });
add("paneer_paratha", "Paneer Paratha", "bread", "veg", S.piece(110, "1 paratha (110 g)"), [300, 11, 32, 14, 3.5], ["paneer paratha", "paneer ka paratha"], { rm: 1.3, region: R.punjab });
add("mooli_paratha", "Mooli Paratha", "bread", "veg", S.piece(110, "1 paratha (110 g)"), [230, 5.5, 32, 9, 4.5], ["mooli paratha", "mooli ka paratha", "radish paratha", "mixed veg paratha", "veg paratha"], { rm: 1.3, region: R.punjab });
add("lachha_paratha", "Lachha Paratha", "bread", "veg", S.piece(60), [230, 4.5, 28, 11, 2.5], ["lachha paratha", "laccha paratha", "lachedar paratha", "lacha paratha"], { rm: 1.2 });
add("thepla", "Methi Thepla", "bread", "veg", S.piece(40, "1 thepla (40 g)"), [130, 3.5, 17, 5.5, 2.5], ["thepla", "methi thepla", "theplu", "methi na thepla", "methi paratha", "methi ka paratha"], { region: R.guj });
add("naan", "Naan", "bread", "veg", S.piece(90, "1 naan (90 g)"), [260, 8.5, 45, 5, 2], ["naan", "plain naan", "tandoori naan", "nan"]);
add("butter_naan", "Butter Naan", "bread", "veg", S.piece(100, "1 naan (100 g)"), [320, 8.7, 46, 11, 2], ["butter naan", "naan with butter", "makhani naan"]);
add("garlic_naan", "Garlic Naan", "bread", "veg", S.piece(100, "1 naan (100 g)"), [300, 9, 47, 8.5, 2], ["garlic naan", "lahsun naan", "garlic butter naan", "cheese naan"]);
add("kulcha", "Kulcha", "bread", "veg", S.piece(80), [230, 7, 40, 4.5, 1.5], ["kulcha", "kulche", "plain kulcha", "onion kulcha"]);
add("amritsari_kulcha", "Amritsari Kulcha", "bread", "veg", S.piece(130, "1 stuffed kulcha (130 g)"), [340, 8, 45, 14, 3], ["amritsari kulcha", "aloo kulcha", "stuffed kulcha", "paneer kulcha"], { rm: 1.2, region: R.punjab });
add("puri", "Puri", "bread", "vegan", S.piece(25, "1 puri (25 g)"), [95, 1.8, 11, 5, 1], ["puri", "poori", "luchi", "puris"]);
add("bhatura", "Bhatura", "bread", "veg", S.piece(80, "1 bhatura (80 g)"), [290, 6, 38, 13, 1.5], ["bhatura", "bhature", "bhatoora"], { region: R.punjab });
add("bajra_roti", "Bajra Roti", "bread", "vegan", S.piece(60), [150, 4.5, 27, 2.5, 4.5], ["bajra roti", "bajre ki roti", "bajra rotla", "rotla", "bajra bhakri", "bajri no rotlo", "pearl millet roti", "bajra"], { region: R.west });
add("jowar_roti", "Jowar Bhakri", "bread", "vegan", S.piece(60), [140, 4, 29, 1, 3.5], ["jowar roti", "jowar bhakri", "bhakri", "jolada rotti", "jonna rotte", "jwari bhakri", "sorghum roti", "jowar"], { region: R.maha });
add("ragi_roti", "Ragi Roti", "bread", "vegan", S.piece(60), [140, 3.5, 26, 2.5, 4], ["ragi roti", "nachni bhakri", "nachni roti", "finger millet roti", "ragi rotti"], { region: R.karnataka });
add("ragi_mudde", "Ragi Mudde", "bread", "vegan", S.piece(150, "1 ball (150 g)"), [200, 4.5, 43, 1, 5], ["ragi mudde", "ragi ball", "ragi sankati", "ragi", "ragi kali", "nachni"], { region: R.karnataka });
add("makki_roti", "Makki di Roti", "bread", "veg", S.piece(60), [180, 3.5, 28, 6, 3.5], ["makki roti", "makki ki roti", "makki di roti", "makke di roti", "makai roti", "corn roti", "maize roti"], { region: R.punjab });
add("appam", "Appam", "bread", "vegan", S.piece(60, "1 appam (60 g)"), [120, 2, 24, 1.5, 0.8], ["appam", "palappam", "aapam", "vellayappam", "hoppers", "appams"], { region: R.kerala });
add("kerala_parotta", "Kerala Parotta", "bread", "veg", S.piece(80, "1 parotta (80 g)"), [280, 5.5, 38, 11.5, 1.5], ["kerala parotta", "parotta", "porotta", "malabar parotta", "barotta", "paratta", "layered parotta"], { rm: 1.15, region: R.south });
add("bread_white", "White Bread", "bread", "veg", S.slice(25), [67, 2.2, 12.6, 0.8, 0.6], ["bread", "white bread", "bread slice", "sandwich bread", "double roti", "sliced bread", "milk bread", "plain bread"]);
add("bread_brown", "Brown Bread", "bread", "veg", S.slice(25), [62, 2.8, 10.5, 0.9, 1.7], ["brown bread", "whole wheat bread", "atta bread", "multigrain bread", "wheat bread", "brown bread slice"]);
add("pav", "Pav", "bread", "veg", S.piece(40, "1 pav (40 g)"), [110, 3.5, 20, 1.6, 0.8], ["pav", "pao", "ladi pav", "bun", "burger bun", "pav bun"]);
add("butter_toast", "Butter Toast", "bread", "veg", S.slice(30, "1 slice + 1 tsp butter"), [105, 2.3, 12.6, 4.9, 0.6], ["butter toast", "toast", "buttered toast", "bread butter", "bread with butter", "makhan toast", "bread toast", "bun maska"]);
add("khakhra", "Khakhra", "snack", "veg", S.piece(20, "1 khakhra (20 g)"), [80, 2.5, 13, 2, 2], ["khakhra", "khakra", "methi khakhra", "jeera khakhra"], { region: R.guj });

/* ─────────────────────── Breakfast & tiffin ─────────────────────── */
add("idli", "Idli", "breakfast", "vegan", S.piece(40, "1 idli (40 g)"), [58, 1.9, 12, 0.2, 0.6], ["idli", "idly", "iddli", "plain idli", "steamed idli", "thatte idli", "mini idli"], { region: R.south, plate: 2 });
add("rava_idli", "Rava Idli", "breakfast", "veg", S.piece(50, "1 idli (50 g)"), [90, 2.5, 13, 3, 0.6], ["rava idli", "rawa idli", "sooji idli", "suji idli"], { region: R.karnataka, plate: 2 });
add("plain_dosa", "Plain Dosa", "breakfast", "vegan", S.piece(90, "1 dosa (90 g)"), [150, 3.5, 24, 4.5, 1], ["dosa", "plain dosa", "sada dosa", "dosai", "set dosa", "paper dosa", "ghee roast dosa", "ghee dosa"], { rm: 1.3, region: R.south });
add("masala_dosa", "Masala Dosa", "breakfast", "vegan", S.piece(180, "1 dosa with aloo masala (180 g)"), [300, 6.5, 44, 11, 3.5], ["masala dosa", "masala dosai", "aloo dosa", "potato dosa", "masale dose"], { rm: 1.3, region: R.south });
add("rava_dosa", "Rava Dosa", "breakfast", "vegan", S.piece(110, "1 dosa (110 g)"), [190, 3.5, 26, 8, 1], ["rava dosa", "rawa dosa", "sooji dosa", "onion rava dosa", "rava masala dosa"], { rm: 1.3, region: R.south });
add("mysore_masala_dosa", "Mysore Masala Dosa", "breakfast", "veg", S.piece(200, "1 dosa (200 g)"), [360, 7, 46, 16, 4], ["mysore masala dosa", "mysore dosa", "mysore masala dose"], { rm: 1.25, region: R.karnataka });
add("neer_dosa", "Neer Dosa", "breakfast", "vegan", S.piece(50, "1 dosa (50 g)"), [80, 1.3, 16, 1, 0.3], ["neer dosa", "neer dose"], { region: R.karnataka });
add("pesarattu", "Pesarattu", "breakfast", "vegan", S.piece(100, "1 pesarattu (100 g)"), [170, 8, 22, 5.5, 4], ["pesarattu", "pesaret", "moong dosa", "green gram dosa", "moong dal dosa"], { region: R.andhra });
add("uttapam", "Onion Uttapam", "breakfast", "vegan", S.piece(150, "1 uttapam (150 g)"), [220, 5.5, 36, 6, 2.5], ["uttapam", "uthappam", "uttappa", "onion uttapam", "oothappam", "uthapam", "veg uttapam", "tomato uttapam"], { rm: 1.25, region: R.south });
add("medu_vada", "Medu Vada", "breakfast", "vegan", S.piece(50, "1 vada (50 g)"), [135, 4.3, 13, 7.4, 2], ["medu vada", "vada", "vadai", "uddina vada", "garelu", "ulundu vadai", "urad vada", "sambar vada"], { region: R.south, plate: 2 });
add("poha", "Poha", "breakfast", "vegan", S.plate(150, "1 plate (150 g)"), [230, 4.5, 38, 7, 2], ["poha", "pohe", "kanda poha", "batata poha", "aval", "avalakki", "aval upma", "indori poha", "chivda poha", "chire bhaja"], { rm: 1.2, region: R.central });
add("upma", "Upma", "breakfast", "vegan", S.plate(150, "1 plate (150 g)"), [220, 5, 32, 8, 2.5], ["upma", "uppuma", "uppittu", "rava upma", "suji upma", "sooji upma", "rawa upma", "khara bath"], { rm: 1.25, region: R.south });
add("semiya_upma", "Semiya Upma", "breakfast", "vegan", S.plate(150, "1 plate (150 g)"), [205, 4.5, 33, 6, 2], ["semiya upma", "vermicelli upma", "seviyan upma", "shavige bath", "semiya", "vermicelli"], { region: R.south });
add("sabudana_khichdi", "Sabudana Khichdi", "breakfast", "veg", S.plate(150, "1 plate (150 g)"), [330, 3.5, 55, 11, 1.5], ["sabudana khichdi", "sago khichdi", "sabudana", "sabudana khichadi", "sabakki upma"], { region: R.maha });
add("pongal", "Ven Pongal", "breakfast", "veg", S.bowl(200), [280, 7.5, 40, 10, 2], ["pongal", "ven pongal", "khara pongal", "huggi", "katte pongali"], { rm: 1.25, region: R.tn });
add("puttu", "Puttu", "breakfast", "vegan", S.piece(100, "1 puttu (100 g)"), [170, 3, 36, 1.5, 1.5], ["puttu", "rice puttu", "kuzhal puttu", "wheat puttu"], { region: R.kerala });
add("idiyappam", "Idiyappam", "breakfast", "vegan", S.piece(40, "1 idiyappam (40 g)"), [70, 1, 16, 0.3, 0.5], ["idiyappam", "string hoppers", "nool puttu", "sevai", "noolappam", "shavige"], { region: R.south });
add("dhokla", "Khaman Dhokla", "snack", "veg", S.piece(30, "1 piece (30 g)"), [50, 1.8, 6.8, 1.6, 0.7], ["dhokla", "khaman", "khaman dhokla", "white dhokla", "khatta dhokla", "rava dhokla"], { region: R.guj, plate: 4 });
add("khandvi", "Khandvi", "snack", "veg", S.plate(120, "1 plate (6 rolls, 120 g)"), [205, 8, 20, 10, 2], ["khandvi", "suralichi vadi", "patuli"], { pcs: 6, region: R.guj });
add("handvo", "Handvo", "snack", "veg", S.piece(100, "1 slice (100 g)"), [200, 6, 24, 9, 3], ["handvo", "handwa"], { region: R.guj });
add("besan_chilla", "Besan Chilla", "breakfast", "vegan", S.piece(80, "1 chilla (80 g)"), [180, 8, 18, 8, 3.5], ["besan chilla", "chilla", "cheela", "besan cheela", "pudla", "besan ka chilla", "tomato omelette", "veg omelette"]);
add("moong_chilla", "Moong Dal Chilla", "breakfast", "vegan", S.piece(80, "1 chilla (80 g)"), [150, 9, 18, 5, 3], ["moong dal chilla", "moong chilla", "moong cheela", "green moong chilla", "moong dal cheela"]);
add("oats", "Oats Porridge", "breakfast", "vegan", S.bowl(250, "1 bowl (40 g oats, cooked in water)"), [150, 5.3, 27, 2.8, 4], ["oats", "oatmeal", "porridge", "oats with water", "plain oats", "rolled oats", "oats porridge", "steel cut oats"]);
add("oats_milk", "Oats with Milk", "breakfast", "veg", S.bowl(250, "1 bowl (40 g oats + 200 ml milk)"), [270, 11.5, 35, 8.8, 4], ["oats with milk", "milk oats", "oats in milk", "oatmeal with milk", "oats porridge with milk", "doodh oats", "overnight oats"]);
add("masala_oats", "Masala Oats", "breakfast", "vegan", S.bowl(250, "1 bowl (1 packet)"), [180, 5, 28, 5, 4], ["masala oats", "saffola oats", "savoury oats", "vegetable oats", "oats upma", "oats khichdi"]);
add("cornflakes", "Cornflakes with Milk", "breakfast", "veg", S.bowl(180, "1 bowl (30 g + 150 ml milk)"), [220, 6.8, 37, 4.8, 0.9], ["cornflakes", "corn flakes", "cornflakes with milk", "cereal", "cereal with milk", "chocos", "kelloggs", "breakfast cereal", "corn flakes with milk"]);
add("muesli", "Muesli with Milk", "breakfast", "veg", S.bowl(195, "1 bowl (45 g + 150 ml milk)"), [250, 9, 38, 7, 4], ["muesli", "muesli with milk", "granola", "granola with milk", "granola with yogurt"]);
add("daliya", "Vegetable Daliya", "breakfast", "vegan", S.bowl(200), [180, 6, 32, 3, 5], ["daliya", "dalia", "broken wheat", "namkeen daliya", "vegetable daliya", "godhuma rava upma", "fada khichdi"]);
add("puri_bhaji", "Puri Bhaji", "breakfast", "vegan", S.plate(250, "1 plate (3 puri + aloo bhaji)"), [450, 8, 55, 22, 5], ["puri bhaji", "poori bhaji", "aloo puri", "puri sabzi", "poori masala", "puri aloo", "bedmi puri", "poori sabji"], { rm: 1.2 });

/* ─────────────────────────── Rice ─────────────────────────── */
add("rice", "Steamed Rice", "rice", "vegan", S.plate(250, "1 plate (250 g cooked)"), [325, 6.8, 71, 0.8, 1], ["rice", "chawal", "chaawal", "bhaat", "bhat", "annam", "sadam", "choru", "plain rice", "white rice", "steamed rice", "boiled rice", "sada chawal", "basmati rice", "basmati", "cooked rice", "matta rice", "ukda chawal", "sona masoori"]);
add("brown_rice", "Brown Rice", "rice", "vegan", S.plate(250, "1 plate (250 g cooked)"), [280, 6.5, 58, 2.2, 4.5], ["brown rice", "red rice", "unpolished rice", "hand pounded rice", "kerala red rice"]);
add("jeera_rice", "Jeera Rice", "rice", "veg", S.plate(250), [400, 7, 72, 9, 1.5], ["jeera rice", "zeera rice", "cumin rice", "jira rice", "ghee rice"], { rm: 1.3 });
add("veg_pulao", "Veg Pulao", "rice", "veg", S.plate(250), [420, 8, 70, 12, 4], ["pulao", "pulav", "pulau", "pilaf", "veg pulao", "vegetable pulao", "matar pulao", "peas pulao", "tawa pulao", "kashmiri pulao"], { rm: 1.3 });
add("veg_biryani", "Veg Biryani", "rice", "veg", S.plate(300), [480, 10, 72, 16, 5], ["veg biryani", "vegetable biryani", "veg dum biryani", "subz biryani", "tehri", "tahiri", "paneer biryani", "mushroom biryani"], { rm: 1.35 });
add("chicken_biryani", "Chicken Biryani", "rice", "nonveg", S.plate(350), [580, 30, 70, 19, 2.5], ["chicken biryani", "biryani", "murgh biryani", "chicken dum biryani", "dum biryani", "hyderabadi biryani", "lucknowi biryani", "kolkata biryani", "ambur biryani", "dindigul biryani", "malabar biryani", "thalassery biryani", "chicken biriyani"], { rm: 1.35 });
add("mutton_biryani", "Mutton Biryani", "rice", "nonveg", S.plate(350), [640, 30, 68, 27, 2.5], ["mutton biryani", "gosht biryani", "lamb biryani", "goat biryani", "kacchi biryani"], { rm: 1.35, region: R.hyd });
add("egg_biryani", "Egg Biryani", "rice", "egg", S.plate(300), [520, 20, 72, 17, 2.5], ["egg biryani", "anda biryani", "muttai biryani"], { rm: 1.3 });
add("curd_rice", "Curd Rice", "rice", "veg", S.bowl(200), [230, 6.5, 36, 6.5, 0.8], ["curd rice", "dahi chawal", "thayir sadam", "mosaru anna", "dahi bhaat", "perugu annam", "daddojanam", "thayir saadam", "curd rice bowl"], { region: R.south });
add("khichdi", "Moong Dal Khichdi", "rice", "veg", S.bowl(200), [240, 9, 38, 5.5, 4], ["khichdi", "moong dal khichdi", "dal khichdi", "khichuri", "masala khichdi", "khichdi kadhi"], { rm: 1.3 });
add("lemon_rice", "Lemon Rice", "rice", "vegan", S.plate(200), [320, 5.5, 52, 10, 2], ["lemon rice", "chitranna", "nimbu chawal", "elumichai sadam", "nimmakaya pulihora"], { region: R.south });
add("tamarind_rice", "Tamarind Rice", "rice", "vegan", S.plate(200), [350, 5.5, 55, 12, 2.5], ["tamarind rice", "puliyogare", "pulihora", "puliyodharai", "imli chawal", "puli sadam"], { region: R.south });
add("veg_fried_rice", "Veg Fried Rice", "rice", "vegan", S.plate(250), [420, 8, 65, 14, 3], ["fried rice", "veg fried rice", "schezwan fried rice", "vegetable fried rice", "chinese fried rice", "veg schezwan rice"], { rm: 1.2 });
add("egg_fried_rice", "Egg Fried Rice", "rice", "egg", S.plate(250), [470, 14, 64, 17, 2.5], ["egg fried rice", "anda fried rice", "egg schezwan fried rice"], { rm: 1.2 });
add("chicken_fried_rice", "Chicken Fried Rice", "rice", "nonveg", S.plate(250), [520, 22, 64, 19, 2.5], ["chicken fried rice", "chicken schezwan fried rice"], { rm: 1.2 });
add("bisi_bele_bath", "Bisi Bele Bath", "rice", "veg", S.bowl(250), [350, 10, 50, 12, 6], ["bisi bele bath", "bisibelebath", "bisi bele bhath", "bisibele bath"], { rm: 1.2, region: R.karnataka });
add("sambar_rice", "Sambar Rice", "rice", "vegan", S.plate(250), [330, 9, 57, 7, 5], ["sambar rice", "sambar sadam", "sambar annam", "sambar bhaat"], { region: R.south });
add("dal_chawal", "Dal Chawal", "rice", "vegan", S.plate(350, "1 plate (1 katori dal + 200 g rice)"), [410, 12.2, 75, 6.1, 5.3], ["dal chawal", "dal rice", "daal chawal", "dal bhaat", "varan bhaat", "pappu annam", "dal bhat", "rice dal", "chawal dal", "paruppu sadam"], { rm: 1.3 });
add("rajma_chawal", "Rajma Chawal", "rice", "vegan", S.plate(350, "1 plate (1 katori rajma + 200 g rice)"), [450, 13.9, 82, 6.6, 8.5], ["rajma chawal", "rajma rice", "rajma chaawal"], { rm: 1.3, region: R.punjab });
add("kadhi_chawal", "Kadhi Chawal", "rice", "veg", S.plate(350, "1 plate (1 katori kadhi + 200 g rice)"), [380, 9.4, 66, 8.1, 1.6], ["kadhi chawal", "kadhi rice", "kadi chawal", "kadhi bhaat"], { rm: 1.3, region: R.north });
add("pakhala", "Pakhala Bhata", "rice", "vegan", S.bowl(300, "1 bowl (300 g)"), [240, 5, 55, 0.5, 1.5], ["pakhala", "pakhala bhata", "panta bhat", "panta bhaat", "fermented rice", "pazhaya soru"], { region: R.east });

/* ─────────────────────── Dals & legumes ─────────────────────── */
add("dal", "Toor Dal", "dal", "vegan", S.katori(), [150, 6.8, 18, 5.5, 4.5], ["dal", "daal", "dhal", "toor dal", "tur dal", "tuvar dal", "tuar dal", "arhar dal", "arhar", "yellow dal", "plain dal", "pappu", "varan", "ghar ki dal", "home dal", "sada dal", "paruppu", "dal curry"], { rm: 1.6 });
add("dal_tadka", "Dal Tadka", "dal", "veg", S.katori(), [170, 7.5, 20, 7, 4.5], ["dal tadka", "tadka dal", "tarka dal", "dal tarka", "yellow dal tadka", "dal tadkewali", "jeera dal"], { rm: 1.6 });
add("dal_fry", "Dal Fry", "dal", "vegan", S.katori(), [180, 7.5, 20, 8, 4.5], ["dal fry", "daal fry", "fry dal", "dal fry tadka"], { rm: 1.6 });
add("dal_makhani", "Dal Makhani", "dal", "veg", S.katori(), [250, 9, 22, 14, 6], ["dal makhani", "dal makhni", "makhani dal", "kaali dal makhani", "black dal"], { rm: 1.5, region: R.punjab });
add("moong_dal", "Moong Dal", "dal", "vegan", S.katori(), [135, 8, 18, 3.5, 4], ["moong dal", "mung dal", "moong ki dal", "yellow moong dal", "dhuli moong dal", "pesara pappu", "moong dal tadka", "green moong dal", "sabut moong"], { rm: 1.6 });
add("masoor_dal", "Masoor Dal", "dal", "vegan", S.katori(), [145, 8.5, 19, 4, 4.5], ["masoor dal", "masur dal", "musur dal", "lal dal", "red lentil", "red lentils", "red dal", "masoor", "musurir dal"], { rm: 1.6 });
add("chana_dal", "Chana Dal", "dal", "vegan", S.katori(), [185, 9.5, 24, 5.5, 6], ["chana dal", "channa dal", "chane ki dal", "bengal gram dal", "cholar dal", "lauki chana dal", "chana dal lauki"], { rm: 1.6 });
add("urad_dal", "Urad Dal", "dal", "veg", S.katori(), [170, 9, 20, 6, 5], ["urad dal", "maa ki dal", "kaali dal", "sabut urad", "dal maa", "maah di dal", "urad ki dal"], { rm: 1.6, region: R.punjab });
add("mixed_dal", "Mixed Dal", "dal", "vegan", S.katori(), [160, 8.5, 20, 5, 5], ["mixed dal", "panchmel dal", "panchratna dal", "mix dal", "dal palak", "palak dal", "methi dal"], { rm: 1.6 });
add("sambar", "Sambar", "dal", "vegan", S.katori(), [120, 5, 16, 4, 4], ["sambar", "sambhar", "saambar", "huli", "kuzhambu", "tiffin sambar", "drumstick sambar", "onion sambar", "vegetable sambar"], { rm: 1.3, region: R.south });
add("rasam", "Rasam", "dal", "vegan", S.katori(), [60, 2, 8, 2.2, 1.5], ["rasam", "saaru", "chaaru", "tomato rasam", "pepper rasam", "mysore rasam", "charu", "sathamudu", "lemon rasam"], { region: R.south });
add("rajma", "Rajma", "dal", "vegan", S.katori(), [190, 8.5, 25, 6, 7.5], ["rajma", "rajmah", "rajma masala", "kidney beans", "rajma curry"], { rm: 1.5, region: R.punjab });
add("chole", "Chole", "dal", "vegan", S.katori(), [210, 8.5, 27, 7.5, 7.5], ["chole", "chhole", "chana masala", "chana", "chole masala", "kabuli chana", "pindi chole", "pindi chana", "chickpea curry", "chickpeas", "chana curry", "safed chana", "amritsari chole", "ragda", "chole curry"], { rm: 1.5, region: R.punjab });
add("kala_chana", "Kala Chana", "dal", "vegan", S.katori(), [180, 9, 25, 5, 8], ["kala chana", "black chana", "kale chane", "kala chana masala", "sookha kala chana", "chana sundal", "sundal", "boiled chana", "chana chaat"]);
add("kadala_curry", "Kadala Curry", "dal", "vegan", S.katori(), [180, 8, 22, 7, 7], ["kadala curry", "kadala", "puttu kadala", "kadala kari"], { region: R.kerala });
add("kadhi", "Kadhi", "dal", "veg", S.katori(), [120, 4, 9, 7.5, 0.8], ["kadhi", "kadi", "karhi", "kadhi pakora", "punjabi kadhi", "gujarati kadhi", "dahi kadhi", "majjige huli", "mor kuzhambu", "pakoda kadhi"], { rm: 1.4, region: R.north });
add("lobia", "Lobia Masala", "dal", "vegan", S.katori(), [160, 8, 22, 4.5, 6], ["lobia", "lobiya", "rongi", "chawli", "black eyed peas", "alsande", "karamani", "chawli usal"]);
add("dalma", "Dalma", "dal", "vegan", S.katori(), [160, 7.5, 22, 4.5, 6], ["dalma", "dalma dal"], { region: R.odisha });
add("dal_baati", "Dal Baati", "dal", "veg", S.plate(300, "1 plate (2 baati + 1 katori dal)"), [620, 16, 72, 30, 9], ["dal baati", "dal bati", "daal baati", "dal baati churma", "baati", "bati"], { rm: 1.2, region: R.raj });
add("dal_dhokli", "Dal Dhokli", "dal", "vegan", S.bowl(250), [300, 11, 45, 9, 7], ["dal dhokli", "dal dhokri", "varan phal", "chakolya"], { region: R.guj });
add("usal", "Usal / Sprouts Curry", "dal", "vegan", S.katori(), [170, 9, 22, 5, 6.5], ["usal", "matki usal", "moth usal", "sprouts curry", "moth bean curry"], { region: R.maha });

/* ─────────────────────────── Sabzis ─────────────────────────── */
add("aloo_gobi", "Aloo Gobi", "sabzi", "vegan", S.katori(), [150, 3.5, 17, 7.5, 4], ["aloo gobi", "aloo gobhi", "gobi aloo", "aloo phool gobi", "alu gobi"], { rm: 1.5 });
add("gobi_sabzi", "Gobi Sabzi", "sabzi", "vegan", S.katori(), [110, 3.5, 10, 6.5, 4], ["gobi", "phool gobi", "cauliflower", "gobi masala", "cauliflower sabzi", "cauliflower curry", "gobi matar"], { rm: 1.5 });
add("aloo_sabzi", "Aloo Sabzi", "sabzi", "vegan", S.katori(), [180, 2.8, 25, 7.5, 3], ["aloo sabzi", "aloo", "aloo bhaji", "batata bhaji", "potato sabzi", "jeera aloo", "aloo jeera", "aloo fry", "potato fry", "sukhi aloo", "batata", "potato", "urulaikizhangu", "aloo ki sukhi sabzi", "aloo capsicum", "aloo shimla mirch"], { rm: 1.4 });
add("aloo_curry", "Aloo Tamatar Curry", "sabzi", "vegan", S.katori(), [150, 2.5, 20, 6.5, 2.5], ["aloo curry", "aloo tamatar", "aloo rasedar", "potato curry", "batata rassa", "aloo ka jhol", "aloo tamatar sabzi", "aloo gravy", "aloo sabji gravy"], { rm: 1.4 });
add("dum_aloo", "Dum Aloo", "sabzi", "veg", S.katori(), [200, 3, 22, 11, 3], ["dum aloo", "dum alu", "aloo dum", "kashmiri dum aloo", "alur dom", "punjabi dum aloo"], { rm: 1.5 });
add("aloo_matar", "Aloo Matar", "sabzi", "vegan", S.katori(), [160, 4.5, 20, 7, 4.5], ["aloo matar", "matar aloo", "aloo mutter", "aloo peas", "matar", "green peas", "peas", "matar ki sabzi"], { rm: 1.5 });
add("bhindi", "Bhindi Masala", "sabzi", "vegan", S.katori(), [130, 3, 11, 8.5, 4.5], ["bhindi", "bhindi masala", "bhindi fry", "okra", "lady finger", "ladyfinger", "ladies finger", "bhindi do pyaza", "vendakkai", "bendakaya", "bhende", "bhinda", "kurkuri bhindi", "bhindi sabji"], { rm: 1.5 });
add("baingan_bharta", "Baingan Bharta", "sabzi", "vegan", S.katori(), [130, 2.5, 12, 8.5, 5], ["baingan bharta", "bharta", "baingan ka bharta", "brinjal bharta", "eggplant bharta", "vangyache bharit", "bharit", "begun pora", "baingan chokha"], { rm: 1.5 });
add("baingan_sabzi", "Baingan Sabzi", "sabzi", "vegan", S.katori(), [140, 2.5, 14, 8.5, 4.5], ["baingan", "brinjal", "eggplant", "aloo baingan", "baingan aloo", "baingan masala", "vangi", "vangi bhaji", "bharli vangi", "ennai kathirikai", "gutti vankaya", "begun", "brinjal curry", "bharwa baingan"], { rm: 1.5 });
add("mixed_veg", "Mixed Veg Sabzi", "sabzi", "vegan", S.katori(), [130, 3.5, 13, 7, 4.5], ["mixed veg", "mix veg", "mixed vegetable", "mixed vegetables", "sabzi", "veg sabzi", "vegetable curry", "veg curry", "tarkari", "vegetables", "veggies", "capsicum", "shimla mirch", "veg jalfrezi", "veg kolhapuri", "veg handi", "green vegetables", "seasonal sabzi", "ghar ki sabzi", "sabzi curry", "subzi", "sabji"], { rm: 1.5 });
add("palak_paneer", "Palak Paneer", "sabzi", "veg", S.katori(), [220, 11, 8, 16, 3], ["palak paneer", "saag paneer", "spinach paneer", "palak panir"], { rm: 1.5, region: R.punjab });
add("paneer_butter_masala", "Paneer Butter Masala", "sabzi", "veg", S.katori(), [330, 12, 12, 26, 2], ["paneer butter masala", "pbm", "butter paneer", "paneer makhani", "paneer makhanwala", "paneer butter", "paneer lababdar", "paneer makhni"], { rm: 1.5, region: R.punjab });
add("kadai_paneer", "Kadai Paneer", "sabzi", "veg", S.katori(), [280, 12, 10, 21, 2.5], ["kadai paneer", "kadhai paneer", "karahi paneer", "paneer kadai", "paneer do pyaza", "paneer jalfrezi", "paneer tikka masala", "paneer handi"], { rm: 1.5 });
add("matar_paneer", "Matar Paneer", "sabzi", "veg", S.katori(), [240, 10.5, 13, 16, 4], ["matar paneer", "mutter paneer", "paneer matar", "peas paneer"], { rm: 1.5 });
add("paneer_masala", "Paneer Masala", "sabzi", "veg", S.katori(), [260, 11.5, 9, 19, 2], ["paneer masala", "paneer", "panir", "paneer sabzi", "paneer curry", "paneer gravy", "paneer ki sabzi", "masala paneer", "paneer sabji"], { rm: 1.5 });
add("paneer_bhurji", "Paneer Bhurji", "sabzi", "veg", S.katori(120, "1 katori (120 g)"), [280, 15, 7, 21, 1.5], ["paneer bhurji", "paneer bhurjee", "scrambled paneer", "paneer burji"], { rm: 1.4 });
add("shahi_paneer", "Shahi Paneer", "sabzi", "veg", S.katori(), [340, 11.5, 12, 27, 1.5], ["shahi paneer", "paneer korma", "paneer pasanda"], { rm: 1.4 });
add("malai_kofta", "Malai Kofta", "sabzi", "veg", S.katori(150, "1 katori (2 koftas, 150 g)"), [360, 8.5, 20, 27, 2.5], ["malai kofta", "kofta", "kofta curry", "lauki kofta", "veg kofta", "paneer kofta"], { rm: 1.4, pcs: 2 });
add("sarson_saag", "Sarson ka Saag", "sabzi", "veg", S.katori(), [170, 5, 11, 12, 5.5], ["sarson ka saag", "sarson da saag", "saag", "sarson saag", "mustard greens", "sarson"], { rm: 1.5, region: R.punjab });
add("aloo_palak", "Aloo Palak", "sabzi", "vegan", S.katori(), [120, 3.5, 12, 6.5, 3.5], ["aloo palak", "palak aloo", "palak", "spinach", "spinach sabzi", "palak sabzi", "keerai poriyal", "keerai", "palak bhaji", "palak ki sabzi"], { rm: 1.5 });
add("aloo_methi", "Aloo Methi", "sabzi", "vegan", S.katori(), [150, 3.5, 17, 7.5, 4], ["aloo methi", "methi aloo", "methi sabzi", "methi", "fenugreek sabzi", "methi bhaji", "methi ki sabzi"], { rm: 1.5 });
add("cabbage_sabzi", "Cabbage Sabzi", "sabzi", "vegan", S.katori(), [100, 2, 9, 6.5, 3], ["cabbage", "patta gobi", "band gobi", "bandh gobi", "cabbage sabzi", "cabbage poriyal", "muttakose", "kobi", "cabbage thoran", "cabbage matar", "patta gobhi"], { rm: 1.4 });
add("beans_sabzi", "Beans Sabzi", "sabzi", "vegan", S.katori(), [100, 2.5, 9, 6, 4], ["beans", "french beans", "beans poriyal", "beans sabzi", "beans thoran", "beans palya", "farasbi", "green beans", "beans carrot"], { rm: 1.4 });
add("lauki", "Lauki Sabzi", "sabzi", "vegan", S.katori(), [80, 1.5, 8, 5, 2.5], ["lauki", "ghiya", "ghia", "doodhi", "dudhi", "bottle gourd", "sorakaya", "lauki sabzi", "lau", "lauki ki sabzi", "dudhi bhaji", "lau ghonto"], { rm: 1.4 });
add("tori", "Tori / Tinda Sabzi", "sabzi", "vegan", S.katori(), [80, 1.5, 8, 5, 2.5], ["tori", "turai", "torai", "ridge gourd", "tinda", "tindora", "dodka", "beerakaya", "peerkangai", "parwal", "potol", "tinde"], { rm: 1.4 });
add("karela", "Karela Sabzi", "sabzi", "vegan", S.katori(), [110, 2, 9, 7.5, 3.5], ["karela", "bitter gourd", "karela fry", "pavakkai", "kakarakaya", "karle", "bharwa karela", "karela sabzi"], { rm: 1.4 });
add("mushroom_masala", "Mushroom Masala", "sabzi", "veg", S.katori(), [150, 5, 10, 10, 3], ["mushroom", "mushroom masala", "matar mushroom", "mushroom curry", "kadai mushroom", "mushrooms", "mushroom sabzi"], { rm: 1.5 });
add("avial", "Avial", "sabzi", "veg", S.katori(), [170, 3.5, 12, 12, 4.5], ["avial", "aviyal"], { region: R.kerala });
add("undhiyu", "Undhiyu", "sabzi", "vegan", S.katori(), [250, 5.5, 22, 16, 6], ["undhiyu", "undhiya", "oondhiya", "undhiyun"], { rm: 1.2, region: R.guj });
add("poriyal", "Poriyal / Thoran", "sabzi", "vegan", S.katori(), [110, 2.5, 9, 7, 3.5], ["poriyal", "thoran", "palya", "upperi", "stir fry vegetables", "veg thoran", "carrot poriyal", "beetroot poriyal", "stir fried vegetables"], { region: R.south });
add("veg_stew", "Kerala Veg Stew", "sabzi", "vegan", S.katori(), [150, 3, 12, 10, 3], ["stew", "veg stew", "vegetable stew", "ishtu", "kerala stew"], { region: R.kerala });
add("kootu", "Kootu", "sabzi", "vegan", S.katori(), [140, 5.5, 14, 7, 4.5], ["kootu", "koottu", "poricha kootu"], { region: R.tn });
add("soya_curry", "Soya Chunks Curry", "sabzi", "vegan", S.katori(), [180, 15, 12, 8, 5], ["soya chunks", "soya curry", "soya chunks curry", "soya chunk sabzi", "nutrela", "meal maker", "soya", "soyabean curry", "soya bean", "soya matar"], { rm: 1.4 });
add("kaddu", "Kaddu Sabzi", "sabzi", "vegan", S.katori(), [110, 1.5, 13, 6, 2.5], ["kaddu", "kaddu ki sabzi", "sitaphal sabzi", "pumpkin", "pumpkin sabzi", "bhopla", "kumro", "khatta meetha kaddu", "kashiphal"], { rm: 1.4 });
add("veg_korma", "Veg Korma", "sabzi", "veg", S.katori(), [250, 5, 16, 18, 3.5], ["veg korma", "navratan korma", "vegetable korma", "kurma", "veg kurma", "vegetable kurma", "saagu", "sagu"], { rm: 1.4 });
add("gatte", "Gatte ki Sabzi", "sabzi", "veg", S.katori(), [220, 8, 20, 12, 4], ["gatte ki sabzi", "gatte", "besan gatte", "gatte curry"], { rm: 1.3, region: R.raj });
add("aloo_posto", "Aloo Posto", "sabzi", "vegan", S.katori(), [200, 4, 18, 13, 3], ["aloo posto", "posto", "alu posto"], { region: R.bengal });
add("kathal", "Kathal Sabzi", "sabzi", "vegan", S.katori(), [150, 3, 16, 8, 5], ["kathal", "kathal ki sabzi", "jackfruit curry", "raw jackfruit", "echor", "kathal masala"], { rm: 1.4 });
add("arbi", "Arbi Fry", "sabzi", "vegan", S.katori(), [150, 2.5, 20, 7, 4], ["arbi", "arbi fry", "colocasia", "arvi", "seppankizhangu", "arbi masala", "chamagadda"], { rm: 1.4 });

/* ─────────────────────── Chicken, mutton, fish ─────────────────────── */
add("butter_chicken", "Butter Chicken", "meat", "nonveg", S.katori(), [330, 22, 8, 23, 1], ["butter chicken", "murgh makhani", "chicken makhani", "chicken butter masala", "makhani chicken"], { rm: 1.4, pcs: 4, region: R.punjab });
add("chicken_curry", "Chicken Curry", "meat", "nonveg", S.katori(150, "1 katori (3 pieces with gravy)"), [240, 21, 6, 14.5, 1.2], ["chicken curry", "chicken", "murgh", "murgh curry", "chicken masala", "chicken gravy", "kozhi curry", "kodi kura", "chicken rassa", "desi chicken", "chicken salan", "chicken korma", "chicken chettinad", "chettinad chicken", "chicken do pyaza", "kosha murgi", "murgir jhol", "chicken xacuti", "home style chicken", "chicken sukka", "chicken kosha", "murgi"], { rm: 1.5, pcs: 3 });
add("chicken_tikka_masala", "Chicken Tikka Masala", "meat", "nonveg", S.katori(), [300, 23, 9, 19, 1.5], ["chicken tikka masala", "ctm", "tikka masala", "chicken lababdar"], { rm: 1.4, pcs: 4 });
add("kadai_chicken", "Kadai Chicken", "meat", "nonveg", S.katori(), [270, 22, 7, 17, 1.5], ["kadai chicken", "kadhai chicken", "chicken kadai", "karahi chicken", "chicken karahi", "chicken handi", "chicken kolhapuri", "chicken jalfrezi"], { rm: 1.4, pcs: 3 });
add("tandoori_chicken", "Tandoori Chicken", "meat", "nonveg", S.piece(120, "1 leg piece (120 g edible)"), [220, 27, 3, 11, 0.5], ["tandoori chicken", "chicken tandoori", "tangdi kabab", "tangri kabab", "tandoori leg", "afghani chicken", "chicken leg piece", "tandoori", "chicken leg"], { rm: 1.2, words: { half: 2, full: 4 } });
add("chicken_tikka", "Chicken Tikka", "meat", "nonveg", S.plate(150, "1 plate (6 pieces, 150 g)"), [250, 34, 4, 11, 0.5], ["chicken tikka", "murgh tikka", "malai tikka", "reshmi kabab", "chicken malai tikka", "hariyali tikka", "chicken reshmi tikka"], { rm: 1.2, pcs: 6 });
add("chilli_chicken", "Chilli Chicken", "meat", "nonveg", S.plate(150, "1 plate (150 g)"), [350, 24, 15, 21, 1.5], ["chilli chicken", "chili chicken", "chicken manchurian", "dragon chicken", "garlic chicken", "chilli chicken dry", "chilli chicken gravy"], { pcs: 8 });
add("chicken_65", "Chicken 65", "meat", "nonveg", S.plate(150, "1 plate (150 g)"), [390, 26, 14, 25, 1], ["chicken 65", "chicken fry", "fried chicken", "chicken pakora", "chicken lollipop", "chicken popcorn", "chicken wings", "kfc chicken"], { pcs: 8 });
add("mutton_curry", "Mutton Curry", "meat", "nonveg", S.katori(150, "1 katori (3 pieces with gravy)"), [300, 23, 5, 21, 1], ["mutton curry", "mutton", "gosht", "goat curry", "mutton masala", "rogan josh", "mutton rogan josh", "lamb curry", "meat curry", "kosha mangsho", "mangsho", "mutton gravy", "mutton salan", "bhuna gosht", "mutton korma", "laal maas", "gosht curry", "mutton kosha", "mutton sukka"], { rm: 1.4, pcs: 3 });
add("keema", "Keema", "meat", "nonveg", S.katori(), [320, 22, 8, 22, 2.5], ["keema", "kheema", "qeema", "keema matar", "mutton keema", "chicken keema", "kheema masala"], { rm: 1.4 });
add("nihari", "Nihari / Paya", "meat", "nonveg", S.katori(200, "1 katori (200 g)"), [360, 24, 8, 26, 1], ["nihari", "paya", "nalli nihari", "paya soup", "nihari gosht"], { rm: 1.2, region: "Uttar Pradesh, Delhi, Telangana" });
add("haleem", "Haleem", "meat", "nonveg", S.bowl(250), [400, 26, 30, 19, 5], ["haleem", "harees", "hareesa", "mutton haleem", "chicken haleem"], { region: R.hyd });
add("pork_curry", "Pork Curry", "meat", "nonveg", S.katori(), [310, 20, 4, 24, 1], ["pork", "pork curry", "pork vindaloo", "vindaloo", "smoked pork", "pork with bamboo shoot", "sorpotel", "pork fry"], { rm: 1.3, region: "Goa, Nagaland, Meghalaya, Mizoram, Manipur, Assam" });
add("fish_curry", "Fish Curry", "meat", "nonveg", S.katori(150, "1 katori (2 pieces with gravy)"), [210, 20, 6, 12, 1], ["fish curry", "fish", "machli curry", "machhi curry", "machli", "meen curry", "meen kuzhambu", "fish gravy", "goan fish curry", "fish masala", "meen", "fish moilee", "malabar fish curry", "chepala pulusu", "pomfret curry", "surmai curry", "fish kalia", "macchi"], { rm: 1.4, pcs: 2 });
add("machher_jhol", "Machher Jhol", "meat", "nonveg", S.katori(180, "1 katori (2 pieces, 180 g)"), [190, 19, 6, 10, 1], ["machher jhol", "macher jhol", "maacher jhol", "fish jhol", "bengali fish curry", "rui jhol", "rui macher jhol", "doi maach", "shorshe ilish", "ilish", "hilsa"], { rm: 1.3, pcs: 2, region: R.bengal });
add("fish_fry", "Fish Fry", "meat", "nonveg", S.piece(100, "1 piece (100 g)"), [220, 20, 6, 13, 0.5], ["fish fry", "fried fish", "machli fry", "meen varuval", "meen fry", "surmai fry", "pomfret fry", "rava fish fry", "fish tawa fry", "bangda fry", "macher bhaja", "fish pakora", "amritsari fish", "fish fingers"], { rm: 1.2 });
add("grilled_fish", "Grilled Fish", "meat", "nonveg", S.piece(120, "1 fillet (120 g)"), [160, 26, 1, 6, 0], ["grilled fish", "tandoori fish", "fish tikka", "baked fish", "steamed fish", "fish fillet", "salmon", "basa"]);
add("prawn_curry", "Prawn Curry", "meat", "nonveg", S.katori(), [220, 20, 7, 12, 1], ["prawns", "prawn", "prawn curry", "jhinga", "jhinga masala", "chingri", "chingri malai curry", "shrimp curry", "prawn masala", "shrimp", "prawn fry", "royyala kura", "konju curry", "kolambi"], { rm: 1.4 });
add("grilled_chicken", "Grilled Chicken Breast", "meat", "nonveg", S.piece(120, "1 breast piece (120 g)"), [195, 37, 0, 5, 0], ["grilled chicken", "chicken breast", "boiled chicken", "grilled chicken breast", "chicken breast grilled", "roast chicken", "chicken steak"]);
add("seekh_kebab", "Seekh Kebab", "meat", "nonveg", S.piece(40, "1 kebab (40 g)"), [110, 7, 2, 8, 0.3], ["seekh kebab", "seekh kabab", "seekh", "kebab", "kabab", "chicken seekh", "mutton seekh", "shami kebab", "galouti kebab", "kebabs"], { plate: 4 });
add("chicken_soup", "Chicken Soup", "soup", "nonveg", S.bowl(250, "1 bowl (250 ml)"), [100, 10, 6, 4, 0.5], ["chicken soup", "chicken clear soup", "chicken broth", "bone broth", "chicken manchow soup", "chicken sweet corn soup", "mutton soup"]);
add("chicken_momos", "Chicken Momos", "snack", "nonveg", S.plate(150, "1 plate (6 pieces)"), [280, 16, 32, 9, 1.5], ["chicken momos", "chicken momo", "chicken dumplings", "fried chicken momos", "chicken steamed momos"], { pcs: 6, region: R.ne });
add("chicken_roll", "Chicken Kathi Roll", "street", "nonveg", S.piece(220, "1 roll (220 g)"), [420, 20, 45, 18, 3], ["chicken roll", "kathi roll", "chicken kathi roll", "chicken frankie", "kolkata roll", "chicken tikka roll"]);
add("egg_roll", "Egg Roll", "street", "egg", S.piece(200, "1 roll (200 g)"), [350, 13, 42, 15, 2.5], ["egg roll", "anda roll", "egg frankie", "egg kathi roll"]);
add("shawarma", "Chicken Shawarma", "street", "nonveg", S.piece(250, "1 roll (250 g)"), [480, 28, 45, 20, 3], ["shawarma", "chicken shawarma", "shawarma roll", "shwarma", "shawarma plate"]);
add("chicken_noodles", "Chicken Hakka Noodles", "global", "nonveg", S.plate(250), [450, 20, 55, 16, 3], ["chicken noodles", "chicken hakka noodles", "chicken chowmein", "chicken chow mein", "chicken schezwan noodles"], { rm: 1.2 });
add("chicken_pizza", "Chicken Pizza Slice", "global", "nonveg", S.slice(100), [260, 12, 28, 11, 1.8], ["chicken pizza", "pepperoni pizza", "non veg pizza", "bbq chicken pizza", "chicken tikka pizza", "pepperoni"]);
add("chicken_burger", "Chicken Burger", "global", "nonveg", S.piece(180, "1 burger (180 g)"), [430, 22, 40, 20, 2], ["chicken burger", "mcchicken", "zinger burger", "zinger", "crispy chicken burger"]);
add("chicken_sandwich", "Chicken Sandwich", "snack", "nonveg", S.piece(170, "1 sandwich (2 slices)"), [320, 20, 32, 12, 2], ["chicken sandwich", "chicken club sandwich", "club sandwich", "chicken mayo sandwich"]);
add("chicken_wrap", "Chicken Wrap", "global", "nonveg", S.piece(230, "1 wrap (230 g)"), [400, 24, 40, 15, 3], ["chicken wrap", "chicken burrito", "chicken tortilla wrap"]);
add("chicken_salad", "Chicken Salad", "salad", "nonveg", S.bowl(300), [300, 28, 12, 16, 4], ["chicken salad", "grilled chicken salad", "chicken caesar salad"]);
add("sushi", "Sushi", "global", "nonveg", S.piece(30, "1 piece (30 g)"), [45, 1.8, 8, 0.5, 0.3], ["sushi", "maki", "sushi roll", "california roll", "nigiri", "sashimi"], { plate: 6 });
add("nonveg_thali", "Non-veg Thali", "meat", "nonveg", S.plate(700, "1 thali (rice, 2 roti, curry, dal, sides)"), [950, 45, 110, 35, 12], ["non veg thali", "nonveg thali", "chicken thali", "fish thali", "mutton thali", "non veg meals", "chicken meals"], { rm: 1.3 });

/* ─────────────────────────── Eggs ─────────────────────────── */
add("boiled_egg", "Boiled Egg", "egg", "egg", S.piece(50, "1 egg (50 g)"), [72, 6.3, 0.4, 4.8, 0], ["egg", "boiled egg", "anda", "ubla anda", "hard boiled egg", "eggs", "mutta", "dim", "dimer", "egg boiled", "whole egg", "soft boiled egg", "poached egg"]);
add("egg_white", "Egg White", "egg", "egg", S.piece(33, "1 egg white (33 g)"), [17, 3.6, 0.2, 0.1, 0], ["egg white", "egg whites", "boiled egg white", "anda safedi"]);
add("omelette", "Masala Omelette", "egg", "egg", S.piece(110, "1 omelette (2 eggs)"), [190, 13, 2.5, 14, 0.5], ["omelette", "masala omelette", "anda omelette", "egg omelette", "plain omelette", "cheese omelette", "onion omelette", "mushroom omelette"], { rm: 1.3, eggs: 2, words: { single: 0.5, double: 1 } });
add("bread_omelette", "Bread Omelette", "egg", "egg", S.piece(170, "2 slices + 2-egg omelette"), [325, 17.4, 27.5, 15.6, 1.2], ["bread omelette", "omelette bread", "anda bread", "egg sandwich", "bun omelette", "anda pav"], { rm: 1.2, eggs: 2, words: { single: 0.5, double: 1 } });
add("egg_bhurji", "Egg Bhurji", "egg", "egg", S.katori(120, "1 katori (2 eggs)"), [210, 13, 4, 16, 1], ["egg bhurji", "anda bhurji", "scrambled eggs", "scrambled egg", "egg burji", "egg podimas", "mutta podimas"], { rm: 1.3, eggs: 2, words: { single: 0.5, double: 1 } });
add("fried_egg", "Fried Egg", "egg", "egg", S.piece(55, "1 egg"), [90, 6.3, 0.4, 7, 0], ["fried egg", "half fry", "egg half fry", "sunny side up", "bullseye", "full fry", "egg fry", "anda fry", "fried eggs"]);
add("egg_curry", "Egg Curry", "egg", "egg", S.katori(150, "1 katori (2 eggs with gravy)"), [260, 14, 8, 19, 1.5], ["egg curry", "anda curry", "ande ki curry", "egg masala", "mutta curry", "dimer jhol", "dimer curry", "anda masala", "egg gravy", "egg roast"], { rm: 1.4, pcs: 2, eggs: 2 });

/* ─────────────────────── Snacks & street food ─────────────────────── */
add("samosa", "Samosa", "snack", "vegan", S.piece(70, "1 samosa (70 g)"), [260, 3.5, 27, 15, 2.5], ["samosa", "samose", "aloo samosa", "singara", "shingara", "punjabi samosa", "samosas"]);
add("kachori", "Kachori", "snack", "vegan", S.piece(60, "1 kachori (60 g)"), [240, 5, 22, 15, 2.5], ["kachori", "kachauri", "khasta kachori", "pyaz kachori", "dal kachori", "moong dal kachori", "kachodi"], { region: "Rajasthan, Uttar Pradesh, Delhi" });
add("pakora", "Pakora", "snack", "vegan", S.plate(100, "1 plate (about 5 pieces, 100 g)"), [290, 7, 25, 18, 3.5], ["pakora", "pakoda", "pakode", "bhajiya", "bhajia", "bajji", "bhajji", "onion pakoda", "pyaz pakoda", "kanda bhaji", "onion bhaji", "onion pakora", "mirchi bajji", "aloo pakora", "mix pakora", "paneer pakora", "pakodi", "fritters", "vegetable pakora", "mirchi vada", "bhaji"], { pcs: 5 });
add("bread_pakora", "Bread Pakora", "snack", "veg", S.piece(100, "1 piece (100 g)"), [270, 6, 28, 15, 1.5], ["bread pakora", "bread pakoda", "bread bajji"]);
add("aloo_bonda", "Aloo Bonda", "snack", "vegan", S.piece(60, "1 bonda (60 g)"), [155, 2.5, 18, 8, 2], ["bonda", "aloo bonda", "batata vada", "urulai bonda", "mysore bonda"]);
add("sabudana_vada", "Sabudana Vada", "snack", "veg", S.piece(50, "1 vada (50 g)"), [145, 1.5, 18, 7.5, 1], ["sabudana vada", "sago vada", "sabudana wada"], { region: R.maha });
add("vada_pav", "Vada Pav", "street", "vegan", S.piece(130, "1 vada pav (130 g)"), [300, 7, 40, 13, 3], ["vada pav", "wada pav", "vadapav", "vada pao", "bombay burger"], { region: R.maha });
add("pav_bhaji", "Pav Bhaji", "street", "veg", S.plate(300, "1 plate (bhaji + 2 buttered pav)"), [420, 10, 58, 16, 7], ["pav bhaji", "pao bhaji", "bhaji pav", "pavbhaji"], { rm: 1.4, region: R.maha });
add("misal_pav", "Misal Pav", "street", "vegan", S.plate(350, "1 plate (misal + 2 pav)"), [480, 16, 58, 21, 10], ["misal pav", "misal", "misal pao", "puneri misal", "kolhapuri misal"], { rm: 1.2, region: R.maha });
add("dabeli", "Dabeli", "street", "veg", S.piece(120, "1 dabeli (120 g)"), [280, 6, 40, 11, 3], ["dabeli", "kutchi dabeli", "kacchi dabeli"], { region: R.guj });
add("bhel_puri", "Bhel Puri", "street", "vegan", S.plate(150, "1 plate (150 g)"), [250, 6, 40, 7.5, 3.5], ["bhel", "bhel puri", "bhelpuri", "jhalmuri", "jhal muri", "churmuri", "sukha bhel", "puffed rice chaat", "murmura", "kurmura"]);
add("pani_puri", "Pani Puri", "street", "vegan", S.plate(120, "1 plate (6 puris)"), [200, 4.5, 32, 6, 3.5], ["pani puri", "panipuri", "golgappa", "gol gappa", "gol gappe", "golgappe", "puchka", "phuchka", "gupchup", "pani ke batashe", "pani patashi", "pani poori"], { pcs: 6 });
add("papdi_chaat", "Papdi Chaat", "street", "veg", S.plate(150, "1 plate (150 g)"), [300, 8, 38, 13, 3.5], ["papdi chaat", "chaat", "dahi puri", "sev puri", "dahi papdi", "raj kachori", "aloo chaat", "samosa chaat", "tikki chaat", "dahi papdi chaat", "basket chaat", "dahi batata puri"], { pcs: 6 });
add("aloo_tikki", "Aloo Tikki", "street", "vegan", S.piece(70, "1 tikki (70 g)"), [170, 2.5, 20, 9, 2], ["aloo tikki", "tikki", "potato patty", "ragda pattice", "veg cutlet", "cutlet", "aloo cutlet"], { plate: 2 });
add("dahi_vada", "Dahi Vada", "street", "veg", S.plate(160, "1 plate (2 vadas in curd)"), [280, 10, 32, 12, 3], ["dahi vada", "dahi bhalla", "dahi bada", "thayir vadai", "dahi vade", "perugu vada"], { pcs: 2 });
add("veg_momos", "Veg Momos", "snack", "veg", S.plate(150, "1 plate (6 pieces)"), [250, 7, 38, 7, 3], ["momos", "momo", "veg momos", "veg momo", "steamed momos", "dumplings", "paneer momos", "fried momos", "tandoori momos", "dim sum"], { pcs: 6, region: R.ne });
add("thukpa", "Veg Thukpa", "soup", "veg", S.bowl(350), [320, 12, 47, 9, 3], ["thukpa", "veg thukpa", "thupka", "gyathuk"], { region: R.ne });
add("litti_chokha", "Litti Chokha", "street", "veg", S.plate(250, "1 plate (2 litti + chokha)"), [450, 13, 60, 17, 9], ["litti chokha", "litti", "chokha", "baati chokha", "litti chokha plate"], { region: R.bihar });
add("chole_bhature", "Chole Bhature", "street", "veg", S.plate(350, "1 plate (2 bhature + chole)"), [720, 18, 88, 34, 10], ["chole bhature", "chole bhatura", "chhole bhature", "chana bhatura", "bhature chole", "chole bhature plate"], { rm: 1.15, region: R.punjab });
add("chole_kulche", "Chole Kulche", "street", "veg", S.plate(300, "1 plate (2 kulche + chole)"), [520, 16, 75, 17, 10], ["chole kulche", "chole kulcha", "matar kulcha", "kulche chole", "matar kulche"], { rm: 1.2, region: "Delhi, Punjab" });
add("fafda", "Fafda", "snack", "vegan", S.plate(50, "1 plate (50 g)"), [260, 5, 24, 16, 3], ["fafda", "fafda gathiya", "gathiya", "papdi gathiya"], { region: R.guj });
add("patra", "Patra", "snack", "vegan", S.plate(100, "1 plate (4 pieces)"), [190, 4, 22, 10, 4], ["patra", "patrode", "patrodo", "alu vadi", "aloo vadi", "pathrode"], { pcs: 4, region: "Gujarat, Maharashtra, Karnataka" });
add("namkeen", "Namkeen Mixture", "snack", "vegan", S.handful(30), [160, 4, 14, 10, 1.5], ["namkeen", "mixture", "bhujia", "aloo bhujia", "haldiram", "chivda", "chiwda", "farsan", "sev", "dalmoth", "khatta meetha", "moong dal namkeen", "navratan mix", "madras mixture", "bombay mix", "bikaneri bhujia", "chakna", "chakhna"]);
add("chakli", "Chakli / Murukku", "snack", "vegan", S.piece(20), [100, 1.8, 12, 5, 0.8], ["chakli", "murukku", "chakri", "murkku", "thenkuzhal"]);
add("mathri", "Mathri", "snack", "veg", S.piece(20), [105, 1.8, 11, 6, 0.5], ["mathri", "mathi", "namak para", "namakpare", "nimki"]);
add("biscuit", "Biscuit", "snack", "veg", S.piece(7, "1 biscuit (7 g)"), [32, 0.5, 5.3, 1, 0.1], ["biscuit", "biscuits", "marie", "marie biscuit", "parle g", "glucose biscuit", "digestive", "digestive biscuit", "tiger biscuit", "arrowroot biscuit", "monaco", "krackjack", "cracker", "crackers", "salted biscuit"]);
add("cream_biscuit", "Cream Biscuit", "snack", "veg", S.piece(12, "1 biscuit (12 g)"), [58, 0.6, 8.3, 2.5, 0.2], ["cream biscuit", "bourbon", "oreo", "hide and seek", "dark fantasy", "jim jam", "cream biscuits"]);
add("cookie", "Cookie", "snack", "veg", S.piece(15, "1 cookie (15 g)"), [75, 1, 10, 3.6, 0.4], ["cookie", "cookies", "choco chip cookie", "good day", "nankhatai", "butter cookie", "chocolate chip cookie"]);
add("rusk", "Rusk", "snack", "veg", S.piece(12, "1 rusk (12 g)"), [50, 1.3, 8.5, 1.2, 0.3], ["rusk", "toast rusk", "suji rusk", "cake rusk", "rusks"]);
add("veg_sandwich", "Veg Sandwich", "snack", "veg", S.piece(150, "1 sandwich (2 slices)"), [230, 6, 33, 8, 3], ["sandwich", "veg sandwich", "bombay sandwich", "vegetable sandwich", "cucumber sandwich", "aloo sandwich", "chutney sandwich", "mumbai sandwich"]);
add("grilled_sandwich", "Grilled Cheese Sandwich", "snack", "veg", S.piece(160, "1 sandwich (2 slices)"), [300, 9, 36, 13, 3], ["grilled sandwich", "cheese sandwich", "toast sandwich", "veg grilled sandwich", "cheese grilled sandwich", "paneer sandwich", "corn cheese sandwich", "cheese toast", "grilled cheese"]);
add("maggi", "Maggi Noodles", "snack", "veg", S.packet(200, "1 packet (70 g dry, cooked)"), [310, 7, 43, 12, 2], ["maggi", "maggie", "instant noodles", "masala maggi", "yippee", "top ramen", "cup noodles", "ramen", "maggi noodles", "wai wai"]);
add("popcorn", "Popcorn", "snack", "vegan", S.bowl(25, "1 bowl (25 g)"), [120, 3, 16, 5, 3], ["popcorn", "pop corn", "butter popcorn", "salted popcorn", "caramel popcorn"]);
add("chips", "Potato Chips", "snack", "vegan", S.packet(30, "1 small packet (30 g)"), [160, 2, 15, 10, 1.2], ["chips", "lays", "potato chips", "wafers", "kurkure", "banana chips", "nachos", "crisps", "uncle chips", "bingo", "pringles", "chip"]);
add("roasted_chana", "Roasted Chana", "snack", "vegan", S.handful(30), [110, 6.5, 17, 1.5, 5], ["roasted chana", "bhuna chana", "chana jor garam", "bhune chane", "phutana", "roasted gram", "putani", "chana jor", "bhuna kala chana"]);
add("makhana", "Roasted Makhana", "snack", "veg", S.bowl(25, "1 bowl (25 g)"), [100, 3.5, 17, 2, 2], ["makhana", "phool makhana", "fox nuts", "lotus seeds", "roasted makhana", "makhane"]);
add("sweet_potato", "Roasted Sweet Potato", "snack", "vegan", S.piece(130, "1 medium (130 g)"), [115, 2, 27, 0.2, 4], ["sweet potato", "shakarkandi", "shakarkand", "shakarkandi chaat", "ratalu", "genasu"]);
add("bhutta", "Bhutta / Corn", "snack", "vegan", S.piece(100, "1 cob (100 g)"), [110, 3.3, 21, 1.5, 2.4], ["bhutta", "corn", "sweet corn", "corn cob", "makai", "butta", "masala corn", "corn chaat", "corn cup", "boiled corn", "roasted corn"]);
add("paneer_tikka", "Paneer Tikka", "snack", "veg", S.plate(150, "1 plate (6 pieces, 150 g)"), [330, 22, 9, 23, 2], ["paneer tikka", "tandoori paneer", "paneer tikka dry", "achari paneer tikka", "malai paneer tikka", "paneer shashlik"], { rm: 1.3, pcs: 6 });
add("hara_bhara_kabab", "Hara Bhara Kabab", "snack", "veg", S.piece(40, "1 kabab (40 g)"), [90, 2.5, 9, 5, 2], ["hara bhara kabab", "hara bhara kebab", "veg kebab", "veg seekh", "veg kabab"], { plate: 4 });
add("sprouts", "Sprouts Salad", "salad", "vegan", S.katori(100, "1 katori (100 g)"), [110, 7.5, 17, 1.5, 5], ["sprouts", "moong sprouts", "sprouts chaat", "ankurit moong", "sprout salad", "sprouted moong", "mixed sprouts", "sprouts salad"]);
add("french_fries", "French Fries", "global", "vegan", S.serving(115, "1 medium serving (115 g)"), [360, 4, 44, 18, 4], ["fries", "french fries", "finger chips", "potato fries", "peri peri fries", "salted fries"]);
add("spring_roll", "Veg Spring Roll", "global", "veg", S.piece(60, "1 roll (60 g)"), [150, 2.5, 17, 8, 1.5], ["spring roll", "spring rolls", "veg spring roll"], { plate: 4 });
add("veg_roll", "Veg Roll / Frankie", "street", "veg", S.piece(200, "1 roll (200 g)"), [330, 9, 45, 13, 4], ["veg roll", "roll", "frankie", "veg frankie", "paneer roll", "paneer frankie", "paneer kathi roll", "veg kathi roll", "aloo roll"]);

/* ─────────────────────────── Global ─────────────────────────── */
add("pizza", "Veg Pizza Slice", "global", "veg", S.slice(90, "1 medium slice (90 g)"), [230, 9.5, 28, 9, 1.8], ["pizza", "pizza slice", "veg pizza", "margherita", "margarita pizza", "cheese pizza", "farmhouse pizza", "paneer pizza", "corn pizza", "cheese burst pizza", "pizzas"]);
add("veg_burger", "Veg Burger", "global", "veg", S.piece(160, "1 burger (160 g)"), [350, 9, 45, 15, 3], ["burger", "veg burger", "aloo tikki burger", "mcaloo tikki", "mcaloo", "paneer burger", "veggie burger"]);
add("pasta", "Pasta", "global", "veg", S.plate(250), [420, 12, 55, 16, 3.5], ["pasta", "white sauce pasta", "red sauce pasta", "penne", "macaroni", "spaghetti", "alfredo", "arrabbiata", "mac and cheese", "pink sauce pasta", "penne pasta", "masala pasta", "fusilli"], { rm: 1.2 });
add("hakka_noodles", "Veg Hakka Noodles", "global", "vegan", S.plate(250), [380, 8, 55, 14, 3], ["noodles", "hakka noodles", "chowmein", "chow mein", "veg noodles", "schezwan noodles", "chinese noodles", "veg hakka noodles", "veg chowmein", "chilli garlic noodles"], { rm: 1.2 });
add("manchurian", "Veg Manchurian", "global", "vegan", S.katori(), [280, 5, 26, 17, 3], ["manchurian", "veg manchurian", "gobi manchurian", "manchurian gravy", "dry manchurian", "gobi 65"], { rm: 1.2 });
add("chilli_paneer", "Chilli Paneer", "global", "veg", S.plate(150, "1 plate (150 g)"), [330, 14, 15, 24, 2], ["chilli paneer", "chili paneer", "paneer chilli", "paneer 65", "paneer manchurian", "chilli paneer dry", "chilli paneer gravy"], { rm: 1.2 });
add("salad_bowl", "Salad Bowl", "salad", "veg", S.bowl(300, "1 bowl with dressing (300 g)"), [300, 12, 22, 18, 6], ["salad bowl", "caesar salad", "pasta salad", "quinoa salad", "quinoa bowl", "buddha bowl", "paneer salad", "greek salad", "quinoa"]);
add("green_salad", "Green Salad", "salad", "vegan", S.katori(100, "1 katori (100 g)"), [25, 1, 5, 0.2, 1.5], ["salad", "green salad", "kachumber", "kachumber salad", "cucumber salad", "kheera", "cucumber", "kakdi", "tomato onion salad", "onion salad", "sirka pyaz", "carrot", "gajar", "mooli", "raw vegetables", "salad plate", "tomato", "onion", "beetroot", "vegetable salad"]);
add("veg_wrap", "Veg Wrap", "global", "veg", S.piece(230, "1 wrap (230 g)"), [350, 10, 45, 14, 5], ["wrap", "veg wrap", "burrito", "veg burrito", "falafel wrap", "mexican wrap", "falafel", "tortilla wrap"]);
add("tomato_soup", "Tomato Soup", "soup", "veg", S.bowl(250, "1 bowl (250 ml)"), [110, 2.5, 15, 4.5, 2], ["tomato soup", "soup", "veg soup", "sweet corn soup", "manchow soup", "clear soup", "vegetable soup", "hot and sour soup", "cream of mushroom soup", "lemon coriander soup", "veg clear soup"]);
add("peanut_butter", "Peanut Butter", "nuts", "vegan", S.tbsp(16, "1 tbsp (16 g)"), [94, 4, 3.2, 8, 1], ["peanut butter", "pb", "pintola", "crunchy peanut butter", "almond butter", "creamy peanut butter"]);
add("protein_shake", "Protein Shake", "drink", "veg", S.glass(300, "1 scoop whey in water (300 ml)"), [120, 24, 3, 1.5, 0], ["protein shake", "whey", "whey protein", "protein", "protein powder", "protein scoop", "isolate", "plant protein", "protein drink"], { same: ["scoop", "bottle", "cup", "mug", "serving"] });

/* ─────────────────────────── Sweets ─────────────────────────── */
add("gulab_jamun", "Gulab Jamun", "sweet", "veg", S.piece(40, "1 piece with syrup (40 g)"), [150, 2, 22, 6, 0.3], ["gulab jamun", "gulabjamun", "kala jamun", "kala jam", "gulab jamoon", "pantua", "gulab jaman", "gulab jamuns"]);
add("rasgulla", "Rasgulla", "sweet", "veg", S.piece(50, "1 piece (50 g)"), [125, 2.5, 25, 1.5, 0], ["rasgulla", "rosogolla", "rasagola", "roshogolla", "rasgola", "rasagulla", "chhena rasgulla", "rasgullas"], { region: "West Bengal, Odisha" });
add("jalebi", "Jalebi", "sweet", "veg", S.piece(30, "1 piece (30 g)"), [120, 0.8, 18, 5, 0.2], ["jalebi", "jilebi", "jilapi", "imarti", "jangiri", "jalebis"]);
add("kheer", "Kheer", "sweet", "veg", S.katori(), [240, 6.5, 34, 8.5, 0.5], ["kheer", "payasam", "payesh", "phirni", "firni", "rice kheer", "chawal ki kheer", "seviyan", "seviyan kheer", "semiya payasam", "sheer khurma", "palpayasam", "paal payasam", "doodh pak", "basundi", "sabudana kheer"]);
add("rabri", "Rabri", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [300, 8, 30, 16, 0], ["rabri", "rabdi", "malai rabri"]);
add("sheera", "Suji Halwa / Sheera", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [290, 4, 42, 12, 1], ["sheera", "shira", "suji halwa", "sooji halwa", "rava kesari", "kesari bath", "halwa", "kesari", "rava sheera", "atta halwa", "kada prasad", "prasad", "sooji ka halwa"]);
add("gajar_halwa", "Gajar Halwa", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [280, 5, 36, 13, 2], ["gajar halwa", "gajar ka halwa", "carrot halwa", "gajrela"]);
add("moong_halwa", "Moong Dal Halwa", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [380, 6, 40, 22, 1.5], ["moong dal halwa", "moong halwa", "moong dal ka halwa"]);
add("besan_ladoo", "Besan Ladoo", "sweet", "veg", S.piece(40, "1 ladoo (40 g)"), [180, 3.5, 20, 10, 1], ["ladoo", "besan ladoo", "besan laddu", "rava ladoo", "til ladoo", "dry fruit ladoo", "atta ladoo", "pinni", "coconut ladoo", "laddu", "laddoo"]);
add("boondi_ladoo", "Motichoor Ladoo", "sweet", "veg", S.piece(40, "1 ladoo (40 g)"), [170, 2.5, 23, 8, 0.5], ["boondi ladoo", "motichoor ladoo", "motichoor laddu", "bundi laddu", "motichur", "boondi laddu"]);
add("barfi", "Barfi", "sweet", "veg", S.piece(25, "1 piece (25 g)"), [105, 2.5, 14, 4.5, 0.2], ["barfi", "burfi", "milk barfi", "khoya barfi", "kalakand", "coconut barfi", "besan barfi", "mithai", "sweet", "sweets", "mishti", "milk cake"]);
add("kaju_katli", "Kaju Katli", "sweet", "veg", S.piece(20, "1 piece (20 g)"), [90, 2, 11, 4.5, 0.3], ["kaju katli", "kaju barfi", "kaju katri", "kaju kathli"]);
add("rasmalai", "Rasmalai", "sweet", "veg", S.piece(70, "1 piece with rabri (70 g)"), [180, 5.5, 20, 8.5, 0], ["rasmalai", "ras malai", "roshmalai"], { region: R.bengal });
add("kulfi", "Kulfi", "sweet", "veg", S.piece(70, "1 kulfi (70 g)"), [190, 4.5, 20, 10.5, 0], ["kulfi", "malai kulfi", "matka kulfi", "pista kulfi", "kesar kulfi"]);
add("falooda", "Falooda", "sweet", "veg", S.glass(250, "1 glass (250 ml)"), [360, 8, 55, 12, 1], ["falooda", "faluda", "royal falooda", "kulfi falooda"]);
add("ice_cream", "Ice Cream", "sweet", "veg", S.scoop(65), [135, 2.3, 16, 7, 0.3], ["ice cream", "icecream", "vanilla ice cream", "chocolate ice cream", "ice cream cone", "cone", "sundae", "gelato", "softy", "soft serve", "butterscotch ice cream", "ice creams"]);
add("sandesh", "Sandesh", "sweet", "veg", S.piece(30, "1 piece (30 g)"), [90, 3.5, 12, 3, 0], ["sandesh", "sondesh", "nolen gur sandesh"], { region: R.bengal });
add("mishti_doi", "Mishti Doi", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [140, 4, 22, 4, 0], ["mishti doi", "mishti dahi", "sweet curd", "sweet dahi", "bhapa doi"], { region: R.bengal });
add("mysore_pak", "Mysore Pak", "sweet", "veg", S.piece(30, "1 piece (30 g)"), [170, 1.5, 14, 12, 0.5], ["mysore pak", "mysorepak"], { region: R.karnataka });
add("peda", "Peda", "sweet", "veg", S.piece(25, "1 peda (25 g)"), [100, 2.5, 14, 4, 0], ["peda", "pedha", "pera", "doodh peda", "mathura peda", "dharwad peda"]);
add("modak", "Modak", "sweet", "veg", S.piece(40, "1 modak (40 g)"), [130, 1.5, 20, 5, 1.2], ["modak", "ukadiche modak", "kozhukattai", "modakam", "kudumulu"], { region: R.maha });
add("shrikhand", "Shrikhand", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [250, 6, 38, 8.5, 0], ["shrikhand", "amrakhand"], { region: "Maharashtra, Gujarat" });
add("puran_poli", "Puran Poli", "sweet", "veg", S.piece(80, "1 poli (80 g)"), [290, 6, 48, 8, 3.5], ["puran poli", "puranpoli", "holige", "obbattu", "bobbatlu"], { region: "Maharashtra, Karnataka, Andhra Pradesh" });
add("malpua", "Malpua", "sweet", "veg", S.piece(50, "1 malpua (50 g)"), [195, 2.5, 24, 10, 0.5], ["malpua", "malpoa", "pua"]);
add("gujiya", "Gujiya", "sweet", "veg", S.piece(40, "1 gujiya (40 g)"), [180, 2.5, 20, 10, 0.8], ["gujiya", "gujia", "karanji", "kajjikayalu", "ghughra", "pedakiya"]);
add("chikki", "Chikki", "sweet", "vegan", S.piece(25, "1 piece (25 g)"), [120, 3.5, 15, 5.5, 1], ["chikki", "gajak", "groundnut chikki", "peanut chikki", "til chikki", "revdi", "rewari", "til patti", "gur patti"]);
add("soan_papdi", "Soan Papdi", "sweet", "veg", S.piece(25, "1 piece (25 g)"), [125, 1.3, 16, 6.5, 0.3], ["soan papdi", "son papdi", "patisa", "sohan papdi"]);
add("dessert", "Dessert", "sweet", "veg", S.katori(100, "1 small katori (100 g)"), [280, 4, 40, 12, 0.5], ["dessert", "desserts", "meetha", "sweet dish", "pudding", "custard", "fruit custard", "caramel custard"]);
add("paan", "Meetha Paan", "sweet", "veg", S.piece(30, "1 paan (30 g)"), [95, 0.5, 18, 2.5, 1], ["paan", "meetha paan", "sweet paan", "beeda", "beeda paan", "meetha pan", "banarasi paan"]);
add("chocolate", "Milk Chocolate", "sweet", "veg", S.bar(25), [135, 2, 15, 7.5, 0.8], ["chocolate", "dairy milk", "chocolate bar", "kitkat", "5 star", "munch", "milky bar", "perk", "dark chocolate", "cadbury", "chocolates", "snickers"]);
add("cake", "Cake Slice", "sweet", "egg", S.slice(60, "1 slice (60 g)"), [230, 3, 32, 10, 0.5], ["cake", "pastry", "chocolate cake", "birthday cake", "black forest", "cupcake", "cake slice", "muffin", "fruit cake", "plum cake", "red velvet", "pineapple pastry", "cheesecake", "cakes"]);
add("brownie", "Brownie", "sweet", "egg", S.piece(50, "1 brownie (50 g)"), [220, 2.5, 28, 11, 1], ["brownie", "brownies", "chocolate brownie", "walnut brownie", "sizzling brownie"]);

/* ─────────────────────── Dairy, fats & condiments ─────────────────────── */
add("curd", "Curd (Dahi)", "dairy", "veg", S.katori(), [95, 5.3, 7, 5, 0], ["dahi", "curd", "yogurt", "yoghurt", "doi", "mosaru", "thayir", "perugu", "plain curd", "homemade curd", "plain yogurt", "curds", "dahee"]);
add("greek_yogurt", "Greek Yogurt", "dairy", "veg", S.cup(150, "1 cup (150 g)"), [110, 15, 6, 3, 0], ["greek yogurt", "hung curd", "skyr", "high protein curd", "protein yogurt", "epigamia"]);
add("raita", "Raita", "dairy", "veg", S.katori(), [100, 4.5, 8, 5.5, 1], ["raita", "boondi raita", "cucumber raita", "kheera raita", "pachadi", "veg raita", "onion raita", "mix raita", "burani raita", "pineapple raita"]);
add("paneer", "Paneer", "dairy", "veg", S.serving(100, "100 g"), [265, 18, 3.5, 20, 0], ["raw paneer", "cottage cheese", "plain paneer", "paneer cubes", "chhena", "chena", "fresh paneer", "low fat paneer", "paneer block", "malai paneer"]);
add("tofu", "Tofu", "dairy", "vegan", S.serving(100, "100 g"), [125, 13, 2.5, 7, 1], ["tofu", "soya paneer", "bean curd", "tofu bhurji"]);
add("milk", "Milk (toned)", "dairy", "veg", S.glass(), [145, 7.8, 11.8, 7.5, 0], ["milk", "doodh", "dudh", "toned milk", "garam doodh", "haldi doodh", "turmeric milk", "paal", "cow milk", "hot milk", "cold milk", "amul milk", "haldi wala doodh", "golden milk", "plain milk"]);
add("full_cream_milk", "Full Cream Milk", "dairy", "veg", S.glass(), [215, 8, 12, 15, 0], ["full cream milk", "whole milk", "buffalo milk", "bhains ka doodh", "full fat milk", "gold milk"]);
add("skimmed_milk", "Skimmed Milk", "dairy", "veg", S.glass(), [88, 8.5, 12.5, 0.3, 0], ["skimmed milk", "skim milk", "fat free milk", "double toned milk", "low fat milk"]);
add("plant_milk", "Soy / Almond Milk", "dairy", "vegan", S.glass(), [80, 7, 4, 4, 1], ["soy milk", "soya milk", "almond milk", "oat milk", "plant milk", "unsweetened almond milk"]);
add("cheese", "Cheese Slice", "dairy", "veg", S.slice(20, "1 slice (20 g)"), [62, 4, 1.2, 4.6, 0], ["cheese", "cheese slice", "processed cheese", "cheese cube", "mozzarella", "cheddar", "amul cheese", "cheese slices"]);
add("ghee", "Ghee", "fat", "veg", S.tsp(5), [45, 0, 0, 5, 0], ["ghee", "desi ghee", "clarified butter", "neyyi", "tuppa", "nei"]);
add("butter", "Butter", "fat", "veg", S.tsp(5), [36, 0, 0, 4.1, 0], ["butter", "makhan", "makkhan", "amul butter", "maska", "white butter", "salted butter"]);
add("oil", "Cooking Oil", "fat", "vegan", S.tsp(5, "1 tsp (5 ml)"), [45, 0, 0, 5, 0], ["oil", "cooking oil", "tel", "mustard oil", "refined oil", "olive oil", "coconut oil", "groundnut oil", "sunflower oil"]);
add("sugar", "Sugar", "condiment", "vegan", S.tsp(5), [20, 0, 5, 0, 0], ["sugar", "cheeni", "chini", "shakkar", "sakhar", "brown sugar"]);
add("jaggery", "Jaggery (Gur)", "condiment", "vegan", S.piece(10, "1 small piece (10 g)"), [38, 0, 9.8, 0, 0], ["jaggery", "gur", "gud", "bellam", "vellam", "gul"]);
add("honey", "Honey", "condiment", "veg", S.tsp(7, "1 tsp (7 g)"), [21, 0, 5.8, 0, 0], ["honey", "shahad", "madhu", "shehad"]);
add("jam", "Jam", "condiment", "vegan", S.tbsp(20, "1 tbsp (20 g)"), [55, 0.1, 13.5, 0, 0.2], ["jam", "kissan jam", "fruit jam", "mixed fruit jam", "marmalade"]);
add("mayonnaise", "Mayonnaise", "condiment", "veg", S.tbsp(), [100, 0.2, 0.6, 10.5, 0], ["mayonnaise", "mayo", "eggless mayo", "veg mayo", "salad dressing", "dressing", "tandoori mayo"]);
add("ketchup", "Tomato Ketchup", "condiment", "vegan", S.tbsp(), [17, 0.2, 4, 0, 0.1], ["ketchup", "tomato ketchup", "sauce", "tomato sauce", "chilli sauce", "schezwan sauce", "maggi sauce", "red chilli sauce"]);
add("pickle", "Pickle (Achar)", "condiment", "vegan", S.tbsp(), [35, 0.3, 1.5, 3.3, 0.8], ["pickle", "achar", "achaar", "aachar", "mango pickle", "nimbu achar", "lemon pickle", "uppinakayi", "avakaya", "oorugai", "aam ka achar", "mirchi ka achar"]);
add("green_chutney", "Green Chutney", "condiment", "vegan", S.tbsp(), [10, 0.4, 1.5, 0.2, 0.6], ["green chutney", "hari chutney", "pudina chutney", "dhaniya chutney", "mint chutney", "coriander chutney"]);
add("coconut_chutney", "Coconut Chutney", "condiment", "vegan", S.katori(50, "1 small katori (50 g)"), [95, 1.5, 4, 8, 2.5], ["chutney", "coconut chutney", "nariyal chutney", "thengai chutney", "kobbari pachadi", "peanut chutney", "groundnut chutney", "tomato chutney", "shenga chutney"], { region: R.south });
add("tamarind_chutney", "Tamarind Chutney", "condiment", "vegan", S.tbsp(20, "1 tbsp (20 g)"), [50, 0.2, 12, 0.1, 0.4], ["imli chutney", "meethi chutney", "saunth", "tamarind chutney", "sonth", "khajur imli chutney", "date tamarind chutney"]);
add("papad", "Papad", "condiment", "vegan", S.piece(15, "1 roasted papad (15 g)"), [50, 3.3, 8.5, 0.4, 2], ["papad", "papadum", "pappadam", "appalam", "poppadom", "papadam", "roasted papad", "masala papad", "fried papad", "papads"]);

/* ─────────────────────────── Drinks ─────────────────────────── */
add("chai", "Chai", "drink", "veg", S.cup(150, "1 cup (150 ml, with milk & sugar)"), [85, 2.3, 13.5, 2.2, 0], ["chai", "tea", "masala chai", "adrak chai", "ginger tea", "milk tea", "chaha", "chaya", "cha", "doodh chai", "doodh wali chai", "chai with sugar", "tea with sugar", "tea with milk", "elaichi chai", "kadak chai", "tapri chai", "irani chai", "adrak wali chai", "chai with milk"]);
add("cutting_chai", "Cutting Chai", "drink", "veg", S.cup(75, "1 cutting (75 ml)"), [45, 1.1, 7, 1.1, 0], ["cutting chai", "cutting", "cutting tea", "half chai"]);
add("chai_no_sugar", "Chai without Sugar", "drink", "veg", S.cup(150), [45, 2.3, 3.5, 2.2, 0], ["chai without sugar", "tea without sugar", "sugar free chai", "sugarfree chai", "sugar free tea", "bina cheeni chai", "bina cheeni ki chai", "fika chai", "phika chai", "chai no sugar", "tea no sugar", "unsweetened tea", "chai bina cheeni", "chai bina sugar", "chai with stevia", "chai less sugar", "chai sugarless"]);
add("green_tea", "Green Tea", "drink", "vegan", S.cup(150), [2, 0, 0.5, 0, 0], ["green tea", "black tea", "herbal tea", "tulsi tea", "chamomile tea", "lemongrass tea", "hibiscus tea", "lal chai", "black tea without sugar"]);
add("kahwa", "Kahwa", "drink", "vegan", S.cup(150), [35, 0.5, 7, 0.8, 0], ["kahwa", "kehwa", "kashmiri kahwa", "sulaimani", "lemon tea", "honey lemon tea"], { region: R.kashmir });
add("coffee", "Coffee", "drink", "veg", S.cup(150, "1 cup (150 ml, with milk & sugar)"), [95, 3, 13, 3.2, 0], ["coffee", "milk coffee", "instant coffee", "nescafe", "bru", "hot coffee", "coffee with milk", "coffee with sugar"]);
add("coffee_no_sugar", "Coffee without Sugar", "drink", "veg", S.cup(150), [55, 3, 4, 3.2, 0], ["coffee without sugar", "coffee no sugar", "sugar free coffee", "unsweetened coffee", "bina cheeni coffee", "coffee sugarless"]);
add("filter_coffee", "Filter Coffee", "drink", "veg", S.cup(120, "1 tumbler (120 ml)"), [88, 2.8, 11, 3.5, 0], ["filter coffee", "south indian coffee", "kaapi", "kapi", "degree coffee", "madras coffee", "kumbakonam degree coffee", "mysore coffee", "filter kaapi"], { region: R.south });
add("black_coffee", "Black Coffee", "drink", "vegan", S.cup(150), [5, 0.3, 0.5, 0, 0], ["black coffee", "americano", "espresso", "cold brew", "long black", "black coffee without sugar"]);
add("cappuccino", "Cappuccino / Latte", "drink", "veg", S.cup(180, "1 cup (180 ml)"), [110, 6, 9, 5.5, 0], ["cappuccino", "latte", "cafe latte", "flat white", "mocha", "cortado", "caffe latte"]);
add("cold_coffee", "Cold Coffee", "drink", "veg", S.glass(), [220, 7, 30, 8, 0], ["cold coffee", "iced coffee", "frappe", "frappuccino", "cafe frappe", "coffee shake"]);
add("nimbu_pani", "Nimbu Pani", "drink", "vegan", S.glass(), [60, 0.2, 15, 0, 0], ["nimbu pani", "nimbu paani", "lemonade", "shikanji", "shikanjvi", "lime soda", "lemon soda", "limbu pani", "lemon juice", "nimboo pani", "lemon water", "fresh lime soda", "jaljeera"]);
add("coconut_water", "Coconut Water", "drink", "vegan", S.glass(250, "1 coconut / glass (250 ml)"), [45, 1.8, 9, 0.5, 1], ["coconut water", "nariyal pani", "tender coconut", "elaneer", "daab", "narial pani", "nariyal paani", "tender coconut water"]);
add("cold_drink", "Cold Drink", "drink", "vegan", S.glass(), [105, 0, 26.5, 0, 0], ["cold drink", "colddrink", "coke", "coca cola", "pepsi", "soft drink", "thums up", "thumbs up", "sprite", "fanta", "limca", "mountain dew", "7 up", "cola", "mirinda", "aerated drink", "soda pop", "red bull", "energy drink", "cold drinks"]);
add("diet_coke", "Diet Soft Drink", "drink", "vegan", S.glass(), [1, 0, 0.2, 0, 0], ["diet coke", "coke zero", "diet pepsi", "diet soda", "zero sugar drink", "pepsi black", "club soda", "soda water", "sparkling water", "soda"]);
add("mango_drink", "Mango Drink", "drink", "vegan", S.glass(), [150, 0, 37, 0, 0], ["frooti", "maaza", "mango drink", "mango juice", "packaged juice", "tetra pack juice", "real juice", "tropicana", "appy fizz"]);
add("fresh_juice", "Fresh Fruit Juice", "drink", "vegan", S.glass(), [115, 1.7, 26, 0.5, 0.5], ["juice", "fresh juice", "orange juice", "mosambi juice", "sweet lime juice", "santra juice", "fruit juice", "apple juice", "pomegranate juice", "anar juice", "watermelon juice", "pineapple juice", "mixed fruit juice", "carrot juice", "abc juice"]);
add("sugarcane_juice", "Sugarcane Juice", "drink", "vegan", S.glass(), [180, 0.5, 45, 0, 0], ["sugarcane juice", "ganne ka ras", "ganna juice", "ganne ka juice", "sugar cane juice", "ganne ras", "ganna ras"]);
add("aam_panna", "Aam Panna", "drink", "vegan", S.glass(), [100, 0.3, 24, 0.2, 0.5], ["aam panna", "aam ka panna", "kairi panha", "panha", "raw mango drink"]);
add("sattu_drink", "Sattu Sharbat", "drink", "vegan", S.glass(250, "1 glass (30 g sattu, 250 ml)"), [120, 6.5, 19, 2, 5], ["sattu", "sattu drink", "sattu sharbat", "sattu ka sharbat", "namkeen sattu"], { region: R.bihar });
add("sol_kadhi", "Sol Kadhi", "drink", "vegan", S.glass(200, "1 glass (200 ml)"), [90, 1, 6, 7, 0.5], ["sol kadhi", "solkadi", "sol kadi"], { region: R.konkan });
add("sweet_lassi", "Sweet Lassi", "drink", "veg", S.glass(), [230, 7.5, 34, 7, 0], ["lassi", "sweet lassi", "meethi lassi", "punjabi lassi", "lassi sweet", "malai lassi", "rose lassi"], { region: R.punjab });
add("mango_lassi", "Mango Lassi", "drink", "veg", S.glass(), [270, 7, 45, 7, 1], ["mango lassi", "aam lassi", "mango smoothie"]);
add("salted_lassi", "Salted Lassi", "drink", "veg", S.glass(), [135, 7, 10, 7.5, 0], ["salted lassi", "namkeen lassi", "salty lassi", "lassi salted", "masala lassi", "plain lassi"]);
add("chaas", "Chaas (Buttermilk)", "drink", "veg", S.glass(), [60, 3.3, 4.5, 3, 0], ["chaas", "chhaas", "chhach", "chaach", "buttermilk", "mattha", "majjige", "moru", "taak", "masala chaas", "spiced buttermilk", "neer mor", "sambharam", "ghol", "butter milk"]);
add("milkshake", "Milkshake", "drink", "veg", S.glass(), [280, 8.5, 40, 9, 1], ["milkshake", "milk shake", "shake", "banana shake", "mango shake", "chocolate shake", "strawberry shake", "chikoo shake", "oreo shake", "thick shake", "smoothie", "banana smoothie", "milkshakes"]);
add("badam_milk", "Badam Milk", "drink", "veg", S.glass(), [230, 8, 28, 10, 1], ["badam milk", "badam doodh", "kesar badam milk", "masala doodh", "thandai", "rose milk", "kesar milk"]);
add("malted_milk", "Bournvita / Horlicks Milk", "drink", "veg", S.glass(), [215, 9, 28, 7.5, 0.5], ["bournvita", "horlicks", "boost", "complan", "hot chocolate", "chocolate milk", "milo", "bournvita milk", "horlicks milk"]);
add("beer", "Beer", "drink", "vegan", S.bottle(330, "1 pint bottle (330 ml)"), [150, 1.6, 12, 0, 0], ["beer", "lager", "kingfisher", "budweiser", "tuborg", "heineken", "craft beer", "draught beer", "chilled beer", "bira", "beers"]);
add("wine", "Wine", "drink", "vegan", S.glass(150, "1 glass (150 ml)"), [125, 0.1, 4, 0, 0], ["wine", "red wine", "white wine", "rose wine", "sparkling wine", "champagne", "sangria"]);
add("spirits", "Whisky / Rum / Vodka", "drink", "vegan", S.peg(30), [70, 0, 0, 0, 0], ["whisky", "whiskey", "rum", "vodka", "gin", "brandy", "scotch", "daaru", "daru", "tequila", "old monk", "liquor", "alcohol", "drinks"]);

/* ─────────────────────────── Fruits ─────────────────────────── */
add("banana", "Banana", "fruit", "vegan", S.piece(100, "1 medium banana (100 g edible)"), [105, 1.3, 27, 0.4, 3.1], ["banana", "kela", "kele", "bananas", "vazhaipazham", "pazham", "elaichi banana", "yelakki", "robusta banana"]);
add("apple", "Apple", "fruit", "vegan", S.piece(150, "1 medium apple (150 g)"), [78, 0.4, 21, 0.3, 3.6], ["apple", "seb", "saib", "apples", "green apple"]);
add("mango", "Mango", "fruit", "vegan", S.piece(200, "1 medium mango (200 g edible)"), [120, 1.6, 30, 0.8, 3.2], ["mango", "aam", "amba", "alphonso", "hapus", "mangoes", "dasheri", "langra", "kesar mango", "safeda", "banganapalli", "totapuri"]);
add("orange", "Orange / Mosambi", "fruit", "vegan", S.piece(130, "1 medium (130 g)"), [62, 1.2, 15, 0.2, 3], ["orange", "santra", "narangi", "kinnow", "oranges", "malta", "sweet lime", "mosambi", "musambi"]);
add("papaya", "Papaya", "fruit", "vegan", S.katori(), [60, 0.7, 15, 0.4, 2.5], ["papaya", "papita", "pappali", "boppayi"]);
add("watermelon", "Watermelon", "fruit", "vegan", S.cup(150, "1 cup (150 g)"), [45, 0.9, 11, 0.2, 0.6], ["watermelon", "tarbooz", "tarbuj", "kalingad", "tarbuz"]);
add("muskmelon", "Muskmelon", "fruit", "vegan", S.cup(150, "1 cup (150 g)"), [51, 1.3, 12, 0.3, 1.4], ["muskmelon", "kharbuja", "kharbooja", "cantaloupe", "melon"]);
add("grapes", "Grapes", "fruit", "vegan", S.cup(100, "1 cup (100 g)"), [69, 0.7, 18, 0.2, 0.9], ["grapes", "angoor", "angur", "black grapes", "green grapes", "grape"]);
add("guava", "Guava", "fruit", "vegan", S.piece(100, "1 guava (100 g)"), [68, 2.6, 14, 1, 5.4], ["guava", "amrood", "amrud", "peru", "jamfal", "koyya", "jama"]);
add("pomegranate", "Pomegranate", "fruit", "vegan", S.cup(100, "1 cup arils (100 g)"), [83, 1.7, 19, 1.2, 4], ["pomegranate", "anar", "anaar", "dalimb", "dalimbe", "pomegranate seeds"]);
add("chikoo", "Chikoo", "fruit", "vegan", S.piece(100, "1 chikoo (100 g)"), [83, 0.4, 20, 1.1, 5.3], ["chikoo", "chiku", "sapota", "sapodilla", "chickoo"]);
add("pineapple", "Pineapple", "fruit", "vegan", S.cup(150, "1 cup (150 g)"), [75, 0.8, 20, 0.2, 2.1], ["pineapple", "ananas", "annanas"]);
add("pear", "Pear", "fruit", "vegan", S.piece(170, "1 pear (170 g)"), [97, 0.6, 26, 0.2, 5.3], ["pear", "nashpati", "naspati", "pears", "babugosha"]);
add("jamun", "Jamun", "fruit", "vegan", S.cup(100, "1 cup (100 g)"), [62, 0.7, 15.5, 0.2, 0.6], ["jamun", "black plum", "java plum", "naval pazham", "jambul"]);
add("litchi", "Litchi", "fruit", "vegan", S.cup(100, "1 cup (about 10, 100 g)"), [66, 0.8, 16.5, 0.4, 1.3], ["litchi", "lychee", "lichi"]);
add("jackfruit", "Ripe Jackfruit", "fruit", "vegan", S.cup(150, "1 cup bulbs (150 g)"), [143, 2.6, 35, 1, 2.3], ["jackfruit", "ripe jackfruit", "chakka", "halasina hannu", "phanas", "palapazham"]);
add("strawberry", "Strawberries", "fruit", "vegan", S.cup(150, "1 cup (150 g)"), [48, 1, 11.5, 0.5, 3], ["strawberry", "strawberries", "berries", "blueberries"]);
add("kiwi", "Kiwi", "fruit", "vegan", S.piece(70, "1 kiwi (70 g)"), [42, 0.8, 10, 0.4, 2.1], ["kiwi", "kiwifruit", "kiwis"]);
add("dates", "Dates (Khajur)", "fruit", "vegan", S.piece(8, "1 date (8 g)"), [23, 0.2, 6, 0, 0.6], ["dates", "khajur", "khajoor", "date", "kharek", "medjool", "dry dates", "chuara"]);
add("coconut", "Fresh Coconut", "fruit", "vegan", S.piece(40, "1 piece (40 g)"), [140, 1.3, 6, 13, 3.6], ["coconut", "fresh coconut", "nariyal", "thenga", "coconut piece", "narkel", "kopra"]);
add("fruit_salad", "Fruit Bowl", "fruit", "vegan", S.bowl(200), [120, 1.5, 30, 0.5, 4], ["fruit salad", "fruit bowl", "fruits", "mixed fruit", "fruit chaat", "cut fruits", "fruit plate", "seasonal fruits", "fruit", "mixed fruits"]);

/* ─────────────────────── Nuts & seeds ─────────────────────── */
add("almonds", "Almonds", "nuts", "vegan", S.handful(20, "1 handful (about 16 almonds, 20 g)"), [116, 4.2, 4.3, 10, 2.5], ["almonds", "almond", "badam", "soaked almonds", "bhige badam", "badaam", "roasted almonds"], { pcs: 16 });
add("cashews", "Cashews", "nuts", "vegan", S.handful(20, "1 handful (about 13 cashews, 20 g)"), [110, 3.6, 6, 8.8, 0.7], ["cashew", "cashews", "kaju", "cashew nuts", "roasted cashews", "godambi"], { pcs: 13 });
add("walnuts", "Walnuts", "nuts", "vegan", S.handful(20, "1 handful (about 10 halves, 20 g)"), [131, 3, 2.8, 13, 1.3], ["walnut", "walnuts", "akhrot"], { pcs: 10 });
add("peanuts", "Roasted Peanuts", "nuts", "vegan", S.handful(30), [170, 7.5, 5, 14.5, 2.5], ["peanuts", "peanut", "moongphali", "mungfali", "singdana", "groundnut", "groundnuts", "shengdana", "kadalai", "verkadalai", "masala peanuts", "roasted peanuts", "boiled peanuts"], { pcs: 40 });
add("pista", "Pistachios", "nuts", "vegan", S.handful(20, "1 handful (about 25, 20 g)"), [112, 4, 5.6, 9, 2], ["pista", "pistachio", "pistachios"], { pcs: 25 });
add("mixed_nuts", "Mixed Dry Fruits", "nuts", "vegan", S.handful(30), [165, 4.5, 11, 12, 2.5], ["dry fruits", "dry fruit", "mixed nuts", "trail mix", "meva", "mixed dry fruits", "nuts", "dryfruits"]);
add("raisins", "Raisins (Kishmish)", "nuts", "vegan", S.tbsp(15), [45, 0.5, 12, 0, 0.6], ["raisins", "kishmish", "kismis", "munakka", "raisin", "black raisins"]);
add("seeds", "Chia / Flax Seeds", "nuts", "vegan", S.tbsp(10), [50, 1.8, 4, 3.2, 3.4], ["chia seeds", "flax seeds", "alsi", "sabja", "pumpkin seeds", "sunflower seeds", "seeds", "mixed seeds", "flaxseed", "chia", "flaxseeds"]);

/* ─────────────────────────── Thalis ─────────────────────────── */
add("veg_thali", "Veg Thali", "global", "veg", S.plate(650, "1 thali (2 roti, rice, dal, sabzi, curd, salad)"), [780, 25, 120, 22, 16], ["thali", "veg thali", "gujarati thali", "rajasthani thali", "full meals", "south indian meals", "veg meals", "punjabi thali", "maharashtrian thali", "lunch thali", "mini meals", "meals thali"], { rm: 1.35 });

export const FOODS: FoodEntry[] = list;
