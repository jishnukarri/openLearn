// Curated science / computing / maths terms that are easily confused with a
// near-identical neighbour. A misspelling of one of these can turn it into a
// different term (mitosis/meiosis), so they get stricter spelling checks.
export const KEY_TERMS: readonly string[] = [
  // biology
  "osmosis", "diffusion", "mitosis", "meiosis", "photosynthesis", "respiration",
  "transpiration", "translocation", "xylem", "phloem", "arteries", "arteriole",
  "veins", "capillaries", "aerobic", "anaerobic", "genotype", "phenotype",
  "dominant", "recessive", "homozygous", "heterozygous", "allele", "chromosome",
  "gamete", "zygote", "enzyme", "substrate", "antibody", "antigen", "antibiotic",
  "bacteria", "virus", "pathogen", "producer", "consumer", "herbivore",
  "carnivore", "omnivore", "predator", "prey", "mutation", "evolution",
  "variation", "nucleus", "ribosome", "mitochondria", "chloroplast", "cytoplasm",
  "vacuole", "stomata", "insulin", "glucagon", "glucose", "glycogen", "hormone",
  "neurone", "synapse", "reflex", "ventricle", "atrium", "haemoglobin",
  "active transport", "differentiation", "fertilisation", "pollination",
  // chemistry
  "ionic", "covalent", "metallic", "exothermic", "endothermic", "oxidation",
  "reduction", "anode", "cathode", "electrolysis", "electrolyte", "anion",
  "cation", "proton", "neutron", "electron", "isotope", "element", "compound",
  "mixture", "solute", "solvent", "solution", "distillation", "filtration",
  "crystallisation", "chromatography", "alkane", "alkene", "alcohol",
  "carboxylic", "polymer", "monomer", "catalyst", "acid", "alkali", "neutralisation",
  "titration", "molecule", "atom", "ion", "saturated", "unsaturated", "cracking",
  "fractional", "reactivity", "displacement", "sublimation", "evaporation",
  "condensation", "reversible", "equilibrium", "oxidising", "reducing",
  // physics
  "velocity", "acceleration", "speed", "displacement", "momentum", "inertia",
  "weight", "mass", "density", "pressure", "voltage", "current", "resistance",
  "potential", "conduction", "convection", "radiation", "refraction",
  "reflection", "diffraction", "transverse", "longitudinal", "frequency",
  "wavelength", "amplitude", "fission", "fusion", "alpha", "beta", "gamma",
  "series", "parallel", "kinetic", "gravitational", "elastic", "insulator",
  "conductor", "magnetic", "electromagnet", "generator", "transformer",
  "distance", "scalar", "vector", "work", "power", "energy", "force",
  // computing
  "algorithm", "binary", "decimal", "hexadecimal", "variable", "constant",
  "iteration", "selection", "sequence", "compiler", "interpreter", "assembler",
  "bandwidth", "latency", "router", "protocol", "encryption", "decryption",
  "compression", "lossy", "lossless", "pixel", "resolution", "boolean",
  "integer", "string", "array", "function", "procedure", "recursion",
  "volatile", "cache", "register", "malware", "phishing", "firewall",
  // maths
  "numerator", "denominator", "coefficient", "hypotenuse", "perimeter",
  "circumference", "diameter", "radius", "mean", "median", "mode",
  "integer", "prime", "factor", "multiple", "quadratic", "gradient",
  "tangent", "sine", "cosine", "congruent", "similar", "reciprocal",
  "acute", "obtuse", "reflex", "parallelogram", "trapezium", "rhombus",
  "frequency", "probability", "histogram", "inequality", "expression",
  "equation", "formula", "identity",
];

export const KEY_TERM_SET: ReadonlySet<string> = new Set(
  KEY_TERMS.map((t) => t.toLowerCase())
);
