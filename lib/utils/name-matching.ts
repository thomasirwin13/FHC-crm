/**
 * Nickname-aware name matching utility.
 *
 * Maps common English first-name variants (diminutives, short forms) to a
 * canonical form so that "Tom Smith" matches "Thomas Smith", "Bob Jones"
 * matches "Robert Jones", etc.
 *
 * Used across every contact import / sync / dedup path in the CRM.
 */

// ---------------------------------------------------------------------------
// Nickname database
// ---------------------------------------------------------------------------
// Each entry maps a canonical first name to its known variants.
// All values are lowercase.  The reverse index is built automatically.

const NICKNAME_GROUPS: Record<string, string[]> = {
  // A
  abraham: ['abe'],
  albert: ['al', 'bert'],
  alexander: ['alex', 'al', 'xander', 'sandy'],
  alexandra: ['alex', 'alexa', 'lexi', 'lexie', 'sandy', 'sasha'],
  alfred: ['al', 'fred', 'alfie'],
  alice: ['ali'],
  alicia: ['ali'],
  allison: ['ali', 'allie', 'ally'],
  amanda: ['mandy', 'mandi'],
  andrew: ['andy', 'drew'],
  angela: ['angie'],
  ann: ['annie', 'anna', 'anne'],
  anna: ['annie', 'ann', 'anne'],
  anne: ['annie', 'ann', 'anna'],
  anthony: ['tony', 'ant'],
  antoinette: ['toni', 'nettie'],
  antonio: ['tony'],
  arthur: ['art', 'artie'],

  // B
  barbara: ['barb', 'barbie', 'babs'],
  beatrice: ['bea', 'trixie'],
  benjamin: ['ben', 'benny', 'benji'],
  bernard: ['bernie'],
  bernice: ['bernie'],
  beverly: ['bev'],
  bradford: ['brad'],
  bradley: ['brad'],
  bridget: ['birdie', 'biddy'],

  // C
  cameron: ['cam'],
  camille: ['cami'],
  caroline: ['carol', 'carrie', 'lynn'],
  carolyn: ['carol', 'carrie', 'lyn'],
  catherine: ['cathy', 'cath', 'cat', 'kate', 'katie', 'kathy', 'kit'],
  charles: ['charlie', 'chuck', 'chas'],
  charlotte: ['charlie', 'lottie', 'char'],
  chester: ['chet'],
  christina: ['chris', 'tina', 'christy', 'christie'],
  christine: ['chris', 'tina', 'christy', 'christie'],
  christopher: ['chris', 'topher'],
  clarence: ['clare'],
  clifford: ['cliff'],
  constance: ['connie'],
  cornelius: ['corny', 'neil'],
  cynthia: ['cindy', 'cindi'],

  // D
  daniel: ['dan', 'danny'],
  david: ['dave', 'davey'],
  deborah: ['deb', 'debbie', 'debby'],
  delores: ['dee', 'lola'],
  dennis: ['denny'],
  diana: ['di'],
  dolores: ['dee', 'lola'],
  dominic: ['dom', 'nick'],
  donald: ['don', 'donny', 'donnie'],
  dorothy: ['dot', 'dottie', 'dolly'],
  douglas: ['doug'],

  // E
  edgar: ['ed', 'eddie'],
  edmund: ['ed', 'eddie', 'ned'],
  edward: ['ed', 'eddie', 'ned', 'ted', 'teddy'],
  edwin: ['ed', 'eddie'],
  eleanor: ['ellie', 'ella', 'nell', 'nelly'],
  elizabeth: ['liz', 'lizzy', 'beth', 'betty', 'betsy', 'eliza', 'ellie', 'bess', 'bessie'],
  ellen: ['ellie', 'nell'],
  emily: ['em', 'emmy'],
  emma: ['em', 'emmy'],
  ernest: ['ernie'],
  eugene: ['gene'],
  evelyn: ['ev', 'evie'],

  // F
  florence: ['flo', 'flossie'],
  frances: ['fran', 'frannie'],
  francis: ['frank', 'fran'],
  frank: ['frankie'],
  franklin: ['frank', 'frankie'],
  frederick: ['fred', 'freddy', 'fritz'],

  // G
  gabriel: ['gabe'],
  gabriella: ['gabby', 'ella'],
  geoffrey: ['geoff', 'jeff'],
  george: ['georgie'],
  gerald: ['jerry', 'gerry'],
  geraldine: ['geri', 'jerry', 'gerry'],
  gertrude: ['gert', 'gertie', 'trudy'],
  gilbert: ['gil'],
  gordon: ['gordy'],
  gregory: ['greg'],
  guadalupe: ['lupe'],

  // H
  harold: ['hal', 'harry'],
  harriet: ['hattie'],
  harrison: ['harry'],
  helen: ['nell', 'nellie'],
  henrietta: ['hettie', 'etta'],
  henry: ['hank', 'harry', 'hal'],
  herbert: ['herb', 'herbie'],
  howard: ['howie'],

  // I
  irene: ['rene'],
  isaiah: ['zay'],
  isidore: ['izzy'],

  // J
  jacqueline: ['jackie', 'jacqui'],
  jacob: ['jake'],
  james: ['jim', 'jimmy', 'jamie'],
  janet: ['jan'],
  janice: ['jan'],
  jasmine: ['jas', 'jazz'],
  jason: ['jase', 'jay'],
  jean: ['jeanie'],
  jennifer: ['jen', 'jenny', 'jenn'],
  jeremy: ['jer', 'jerry'],
  jerome: ['jerry'],
  jessica: ['jess', 'jessie'],
  joan: ['joanie'],
  joanna: ['jo', 'joanie'],
  joanne: ['jo', 'joanie'],
  john: ['jack', 'johnny', 'jon'],
  jonathan: ['jon', 'jonny', 'nathan'],
  joseph: ['joe', 'joey'],
  josephine: ['jo', 'josie'],
  joshua: ['josh'],
  judith: ['judy', 'judi'],
  julie: ['jules'],
  julian: ['jules'],
  julius: ['jules'],
  justin: ['jus'],

  // K
  kathryn: ['kathy', 'kate', 'katie', 'kath'],
  kathleen: ['kathy', 'kate', 'katie', 'kath'],
  katherine: ['kate', 'kathy', 'katie', 'kath', 'kit'],
  kenneth: ['ken', 'kenny'],
  kimberly: ['kim', 'kimmy'],
  kristin: ['kris'],
  kristina: ['kris', 'tina'],

  // L
  laura: ['laurie'],
  laurence: ['larry', 'laurie'],
  lawrence: ['larry', 'laurie'],
  leonard: ['leo', 'lenny', 'len'],
  leopold: ['leo'],
  lillian: ['lily', 'lil'],
  lincoln: ['linc'],
  linda: ['lindy'],
  louisa: ['lou'],
  louis: ['lou', 'louie'],
  louise: ['lou'],
  lucas: ['luke'],
  lucille: ['lucy', 'lu'],
  lucius: ['luke'],

  // M
  madeline: ['maddie', 'maddy'],
  madison: ['maddie', 'maddy'],
  margaret: ['maggie', 'meg', 'peggy', 'marge', 'margie', 'madge', 'greta', 'rita'],
  maria: ['mary'],
  marilyn: ['mary'],
  marjorie: ['margie', 'marge'],
  marshall: ['marsh'],
  martha: ['marty', 'mattie'],
  martin: ['marty'],
  mary: ['maria'],
  mathew: ['matt'],
  matthew: ['matt', 'matty'],
  maureen: ['mo'],
  maxwell: ['max'],
  melissa: ['mel', 'missy', 'lissa'],
  michael: ['mike', 'mikey', 'mick', 'mickey'],
  michelle: ['shelly', 'shelley'],
  mildred: ['millie', 'milly'],
  mitchell: ['mitch'],
  morris: ['mo'],
  moses: ['mo', 'moe'],

  // N
  nancy: ['nan'],
  natalie: ['nat'],
  nathan: ['nate'],
  nathaniel: ['nate', 'nat'],
  nicholas: ['nick', 'nicky'],
  nicole: ['nicky', 'nikki'],
  norman: ['norm'],

  // O
  oliver: ['ollie'],
  olivia: ['liv', 'livvy'],

  // P
  pamela: ['pam'],
  patricia: ['pat', 'patty', 'tricia', 'trish'],
  patrick: ['pat', 'paddy', 'patty'],
  pauline: ['polly'],
  penelope: ['penny'],
  peter: ['pete'],
  philip: ['phil'],
  phillip: ['phil'],
  priscilla: ['prissy', 'cilla'],

  // R
  rachel: ['rae'],
  ralph: ['rafe'],
  randolph: ['randy'],
  randall: ['randy'],
  raymond: ['ray'],
  rebecca: ['becky', 'becca', 'beck'],
  reginald: ['reggie', 'reg'],
  rhonda: ['ronnie'],
  richard: ['rick', 'ricky', 'rich', 'dick', 'dickie'],
  robert: ['rob', 'robby', 'bob', 'bobby', 'bert', 'robbie'],
  roberta: ['bobbie', 'robbie', 'bert'],
  roderick: ['rod', 'roddy'],
  rodney: ['rod'],
  roger: ['rog'],
  roland: ['rollie', 'ro'],
  ronald: ['ron', 'ronny', 'ronnie'],
  rosemary: ['rosie', 'rose'],
  roxanne: ['roxy'],
  russell: ['russ', 'rusty'],
  ruth: ['ruthie'],

  // S
  samantha: ['sam', 'sammy'],
  samuel: ['sam', 'sammy'],
  sandra: ['sandy', 'san'],
  sarah: ['sally', 'sadie'],
  sebastian: ['seb'],
  sharon: ['shari'],
  sheldon: ['shelly'],
  solomon: ['sol'],
  sophia: ['sophie'],
  stanley: ['stan'],
  stephanie: ['steph', 'stevie'],
  stephen: ['steve', 'stevie'],
  steven: ['steve', 'stevie'],
  stuart: ['stu'],
  susan: ['sue', 'susie', 'suzy', 'suzie'],
  suzanne: ['sue', 'susie', 'suzy'],
  sylvia: ['syl'],

  // T
  tabitha: ['tabby'],
  tamara: ['tammy', 'tam'],
  teresa: ['terry', 'tess', 'tessa'],
  terrence: ['terry'],
  theodore: ['ted', 'teddy', 'theo'],
  theresa: ['terry', 'tess', 'tessa'],
  thomas: ['tom', 'tommy'],
  timothy: ['tim', 'timmy'],

  // V
  valerie: ['val'],
  vanessa: ['nessa'],
  vernon: ['vern'],
  veronica: ['ronnie', 'roni'],
  victoria: ['vicky', 'vicki', 'tori'],
  vincent: ['vince', 'vinny', 'vin'],
  virginia: ['ginny', 'ginger'],
  vivian: ['viv'],

  // W
  wallace: ['wally'],
  walter: ['walt', 'wally'],
  wendy: ['wen'],
  wilbur: ['will'],
  william: ['will', 'willy', 'bill', 'billy', 'liam'],
  winifred: ['winnie'],

  // Z
  zachary: ['zach', 'zack'],
};

// Build a reverse index: variant → Set of canonical names.
// E.g. "bob" → Set(["robert"]), "ted" → Set(["edward", "theodore"])
const REVERSE_INDEX = new Map<string, Set<string>>();

for (const [canonical, variants] of Object.entries(NICKNAME_GROUPS)) {
  // The canonical name maps to itself
  if (!REVERSE_INDEX.has(canonical)) REVERSE_INDEX.set(canonical, new Set());
  REVERSE_INDEX.get(canonical)!.add(canonical);

  for (const variant of variants) {
    if (!REVERSE_INDEX.has(variant)) REVERSE_INDEX.set(variant, new Set());
    REVERSE_INDEX.get(variant)!.add(canonical);
    // Canonical also belongs in the variant's set for symmetric matching
  }
}

// ---------------------------------------------------------------------------
// Name normalization helpers
// ---------------------------------------------------------------------------

/** Suffixes to strip from the end of a name */
const SUFFIXES = /\b(jr\.?|sr\.?|ii|iii|iv|v|esq\.?|phd|md|dds)$/i;

/**
 * Split a full name into [first, last] parts.
 * Handles "Last, First" format. Middle names/initials are dropped.
 * Returns lowercased, trimmed parts.
 */
function splitName(fullName: string): { first: string; last: string } {
  let name = fullName.toLowerCase().trim().replace(/\s+/g, ' ');

  // Strip suffixes
  name = name.replace(SUFFIXES, '').trim();
  // Strip trailing commas/periods left over
  name = name.replace(/[.,]+$/, '').trim();

  // Handle "Last, First" format
  if (name.includes(',')) {
    const [last, ...rest] = name.split(',').map((s) => s.trim());
    const firstParts = rest.join(' ').trim().split(/\s+/);
    return { first: firstParts[0] || '', last };
  }

  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };

  // First word is first name, last word is last name, middle parts are dropped
  return { first: parts[0], last: parts[parts.length - 1] };
}

/**
 * Get all canonical forms for a given first name.
 * E.g. "bob" → Set(["robert"]), "thomas" → Set(["thomas"])
 */
function getCanonicals(firstName: string): Set<string> {
  return REVERSE_INDEX.get(firstName) || new Set([firstName]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if two first names are equivalent considering nicknames.
 * "tom" and "thomas" → true, "bob" and "robert" → true,
 * "tom" and "bob" → false
 */
export function firstNamesMatch(a: string, b: string): boolean {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  // Exact match
  if (aLower === bLower) return true;

  // Check if they share any canonical form
  const aCanonicals = getCanonicals(aLower);
  const bCanonicals = getCanonicals(bLower);

  for (const canon of aCanonicals) {
    if (bCanonicals.has(canon)) return true;
  }

  return false;
}

/**
 * Check if two full names match, considering nicknames for the first name
 * and requiring an exact match on the last name.
 *
 * - Strips suffixes (Jr., Sr., III, etc.)
 * - Drops middle names/initials
 * - Handles "Last, First" format
 * - Case-insensitive
 */
export function namesMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const a = splitName(nameA);
  const b = splitName(nameB);

  // If either has no first name, fall back to exact full-name comparison
  if (!a.first || !b.first) {
    return nameA.toLowerCase().trim() === nameB.toLowerCase().trim();
  }

  // If one has a last name and the other doesn't, they can't match by name
  // (e.g. "Thomas" alone should not match "Thomas Smith")
  if ((a.last && !b.last) || (!a.last && b.last)) {
    // Unless the single-word name matches either the first or last of the other
    if (!a.last) return firstNamesMatch(a.first, b.first) || a.first === b.last;
    if (!b.last) return firstNamesMatch(a.first, b.first) || b.first === a.last;
    return false;
  }

  // Last names must match exactly
  if (a.last !== b.last) return false;

  // First names match with nickname awareness
  return firstNamesMatch(a.first, b.first);
}

/**
 * Find a matching contact from a list, trying email first, then nickname-aware
 * name matching. Returns the matched contact or null.
 *
 * This is the primary function all import paths should use.
 */
export function findMatchingContact<T extends { name?: string | null; email?: string | null }>(
  incomingName: string,
  incomingEmail: string | null | undefined,
  existingContacts: T[],
): T | null {
  // 1. Try email match first (most reliable)
  if (incomingEmail) {
    const emailLower = incomingEmail.toLowerCase().trim();
    const byEmail = existingContacts.find(
      (c) => c.email && c.email.toLowerCase().trim() === emailLower
    );
    if (byEmail) return byEmail;
  }

  // 2. Fall back to nickname-aware name match
  if (incomingName) {
    const byName = existingContacts.find(
      (c) => c.name && namesMatch(c.name, incomingName)
    );
    if (byName) return byName;
  }

  return null;
}

/**
 * Check if a contact (by name or email) already exists in a contact list.
 * Uses nickname-aware name matching.
 */
export function isExistingContact(
  contact: { name: string; email: string },
  existingContacts: { name?: string | null; email?: string | null }[],
): boolean {
  return findMatchingContact(contact.name, contact.email, existingContacts) !== null;
}

/**
 * Build a fast lookup index for nickname-aware name matching.
 * Returns a function that finds a match by email or name.
 *
 * Use this in server-side code (Action Network, MailerLite, Partiful)
 * where you're iterating over many incoming records against a fixed list
 * of existing contacts. It indexes by email and keeps the full list for
 * name matching.
 */
export function buildContactMatcher<T extends { id: number; name?: string | null; email?: string | null; phone?: string | null }>(
  existingContacts: T[],
): {
  byEmail: (email: string) => T | undefined;
  byPhone: (phone: string) => T | undefined;
  byName: (name: string) => T | undefined;
  findMatch: (incoming: { name?: string | null; email?: string | null; phone?: string | null }) => T | undefined;
} {
  const emailIndex = new Map<string, T>();
  const phoneIndex = new Map<string, T>();

  for (const c of existingContacts) {
    if (c.email) emailIndex.set(c.email.toLowerCase().trim(), c);
    if (c.phone) phoneIndex.set(c.phone.replace(/\D/g, ''), c);
  }

  const byEmail = (email: string): T | undefined =>
    emailIndex.get(email.toLowerCase().trim());

  const byPhone = (phone: string): T | undefined =>
    phoneIndex.get(phone.replace(/\D/g, ''));

  const byName = (name: string): T | undefined =>
    existingContacts.find((c) => c.name != null && namesMatch(c.name, name));

  const findMatch = (incoming: { name?: string | null; email?: string | null; phone?: string | null }): T | undefined => {
    if (incoming.email) {
      const m = byEmail(incoming.email);
      if (m) return m;
    }
    if (incoming.phone) {
      const m = byPhone(incoming.phone);
      if (m) return m;
    }
    if (incoming.name) {
      const m = byName(incoming.name);
      if (m) return m;
    }
    return undefined;
  };

  return { byEmail, byPhone, byName, findMatch };
}
