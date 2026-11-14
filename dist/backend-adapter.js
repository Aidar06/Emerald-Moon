export const API_BASE_URL = 'https://x8ki-letl-twmt.n7.xano.io/api:X8-e2j1w/priglosi';
export const DEFAULT_INVITATION_ID = 3;
export const SUPPORTED_LANGUAGES = ['ru', 'ky', 'kk'];

export class InvitationApiError extends Error {
  constructor(status, message = 'Invitation API error') {
    super(message);
    this.name = 'InvitationApiError';
    this.status = status;
  }
}

export function sanitizeText(value, maxLength = 1200) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function resolveInvitationId(pathname, defaultId = DEFAULT_INVITATION_ID) {
  const first = String(pathname || '').split('/').filter(Boolean)[0];
  if (!first) return String(defaultId);
  const publicId = decodeURIComponent(first).trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(publicId) ? publicId : null;
}

export function withBishkekOffset(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}+06:00`;
}

function localized(source, language, defaultLanguage, fields) {
  for (const code of [...new Set([language, defaultLanguage, 'ru'])]) {
    const entry = source?.[code];
    if (entry && fields.some((field) => sanitizeText(entry[field]))) return entry;
  }
  return {};
}

function legacyCeremony(item, language) {
  const suffix = language === 'ky' ? 'kg' : language;
  return {
    title: item?.[`ceremony_${suffix}`] ?? item?.ceremony_ru,
    text: item?.[`text_${suffix}`] ?? item?.text_ru
  };
}

export function normalizeInvitation(raw = {}, fallbackId = DEFAULT_INVITATION_ID) {
  const rawNames = raw.names || {};
  const enabled = [...new Set((raw.languages?.enabled || ['ru'])
    .filter((language) => SUPPORTED_LANGUAGES.includes(language)))];
  if (!enabled.length) enabled.push('ru');
  const defaultLanguage = enabled.includes(raw.languages?.default) ? raw.languages.default : enabled[0];

  const invitation = {};
  const wishes = {};
  const venueContent = {};
  for (const language of SUPPORTED_LANGUAGES) {
    const invitationEntry = localized(raw.invitation, language, defaultLanguage, ['title', 'text']);
    const wishEntry = localized(raw.wish_block?.content, language, defaultLanguage, ['title', 'text']);
    const venueEntry = localized(raw.venue?.content, language, defaultLanguage, ['name', 'type', 'address']);
    invitation[language] = {
      title: sanitizeText(invitationEntry.title, 180),
      text: sanitizeText(invitationEntry.text, 1600)
    };
    wishes[language] = {
      title: sanitizeText(wishEntry.title, 180),
      text: sanitizeText(wishEntry.text, 1600)
    };
    venueContent[language] = {
      name: sanitizeText(venueEntry.name ?? raw.adress?.name, 220),
      type: sanitizeText(venueEntry.type ?? raw.adress?.pl, 160),
      address: sanitizeText(venueEntry.address ?? raw.adress?.adrr, 420)
    };
  }

  const ceremonies = (Array.isArray(raw.ceremonies) ? raw.ceremonies : [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const a = Number(left.item.sort_order);
      const b = Number(right.item.sort_order);
      return (Number.isFinite(a) ? a : left.index) - (Number.isFinite(b) ? b : right.index);
    })
    .map(({ item }) => {
      const title = {};
      const text = {};
      for (const language of SUPPORTED_LANGUAGES) {
        const entry = localized(item.content, language, defaultLanguage, ['title', 'text']);
        const legacy = legacyCeremony(item, language);
        title[language] = sanitizeText(entry.title ?? legacy.title, 180);
        text[language] = sanitizeText(entry.text ?? legacy.text, 900);
      }
      return { time: sanitizeText(item.time, 20), title, text };
    });

  const maxGuests = Math.max(1, Math.min(100, Math.trunc(Number(raw.rsvp?.max_guests) || 1)));
  return {
    id: String(raw.public_id ?? fallbackId),
    names: {
      groom: sanitizeText(rawNames.groom ?? rawNames.has, 120),
      bride: sanitizeText(rawNames.bride ?? rawNames.wife, 120)
    },
    dateISO: withBishkekOffset(raw.date),
    invitation,
    wishBlock: {
      enabled: raw.wish_block?.enabled === true,
      content: wishes
    },
    ceremonies,
    venue: {
      content: venueContent,
      map: {
        enabled: raw.venue?.map?.enabled === true,
        googleUrl: String(raw.venue?.map?.google_url || ''),
        twoGisUrl: String(raw.venue?.map?.two_gis_url || '')
      }
    },
    rsvp: {
      enabled: raw.rsvp?.enabled === true,
      allowGuestWish: raw.rsvp?.allow_guest_wish === true,
      maxGuests
    },
    languages: { enabled, default: defaultLanguage },
    raw
  };
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function buildMapLinks(venue, language, defaultLanguage) {
  if (venue?.map?.enabled !== true) return { enabled: false, google: '', twoGis: '' };
  const details = venue.content?.[language]
    || venue.content?.[defaultLanguage]
    || venue.content?.ru
    || {};
  const address = String(details.address || '').trim();
  const google = safeHttpUrl(venue.map.googleUrl)
    || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
  const twoGis = safeHttpUrl(venue.map.twoGisUrl)
    || (address ? `https://2gis.kg/search/${encodeURIComponent(address)}` : '');
  return { enabled: Boolean(google || twoGis), google, twoGis };
}

export function createGuestPayload(guest, maxGuests) {
  const attending = guest?.isAttending === true || guest?.is_attending === true;
  const maximum = Math.max(1, Math.trunc(Number(maxGuests) || 1));
  const count = Math.max(1, Math.trunc(Number(guest?.guestsCount ?? guest?.guests_count) || 1));
  return {
    name: sanitizeText(guest?.name, 120),
    wish: sanitizeText(guest?.wish, 600),
    guests_count: attending ? Math.min(count, maximum) : 0,
    is_attending: attending
  };
}

export function buildPatchPayload(raw, guest, fallbackId = DEFAULT_INVITATION_ID) {
  const guests = Array.isArray(raw?.guests) ? raw.guests : [];
  const maxGuests = raw?.rsvp?.max_guests ?? 1;
  return {
    languages: raw?.languages,
    names: raw?.names,
    date: raw?.date,
    invitation: raw?.invitation,
    wish_block: raw?.wish_block,
    ceremonies: raw?.ceremonies,
    venue: raw?.venue,
    rsvp: raw?.rsvp,
    guests: [...guests, createGuestPayload(guest, maxGuests)]
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!response.ok) throw new InvitationApiError(response.status);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new InvitationApiError(response.status, 'Invalid JSON response');
  }
}

export async function fetchInvitationRaw(id, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${API_BASE_URL}/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal
  });
  return parseResponse(response);
}

export async function appendGuestToInvitation(id, guest, { fetchImpl = fetch } = {}) {
  const attendance = guest?.isAttending === true || guest?.is_attending === true;
  const payload = {
    name: sanitizeText(guest?.name, 120),
    count: Math.max(1, Math.trunc(Number(guest?.guestsCount ?? guest?.guests_count) || 1)),
    attendance,
    wish: sanitizeText(guest?.wish, 600)
  };
  const response = await fetchImpl(`${API_BASE_URL}/${encodeURIComponent(String(id))}/rsvp`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  await parseResponse(response);
  const latest = await fetchInvitationRaw(id, { fetchImpl });
  return { raw: latest, invitation: normalizeInvitation(latest, id) };
}
