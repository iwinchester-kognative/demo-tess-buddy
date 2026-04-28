// ============================================================
//  DEMO MODE — fetch interceptor
//  Intercepts all /api/ calls and returns realistic fake data.
//  No real Tessitura, Melissa, or Claude connections are made.
// ============================================================

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Static fake data -----------------------------------------

const MERGE_POOL_BASE = [
  { customer_no: 11042, status: 'K', fname: 'Margaret', lname: 'Chen',       criterion: 'Email match',           keep_cust: 11042 },
  { customer_no: 11043, status: 'D', fname: 'Margaret', lname: 'Chene',      criterion: 'Email match',           keep_cust: 11042 },
  { customer_no: 22104, status: 'K', fname: 'Robert',   lname: 'Smith',      criterion: 'Phone match',           keep_cust: 22104 },
  { customer_no: 22103, status: 'D', fname: 'Robert',   lname: 'Smyth',      criterion: 'Phone match',           keep_cust: 22104 },
  { customer_no: 33201, status: 'K', fname: 'James',    lname: 'Wentworth',  criterion: 'Name + address match',  keep_cust: 33201 },
  { customer_no: 33202, status: 'D', fname: 'James H.', lname: 'Wentworth',  criterion: 'Name + address match',  keep_cust: 33201 },
  { customer_no: 44502, status: 'K', fname: 'Patricia', lname: 'Miles',      criterion: 'Address match',         keep_cust: 44502 },
  { customer_no: 44501, status: 'D', fname: 'Pat',      lname: 'Miles',      criterion: 'Address match',         keep_cust: 44502 },
  { customer_no: 55301, status: 'P', fname: 'Gerald',   lname: 'Kowalski',   criterion: 'Email match' },
  { customer_no: 55302, status: 'P', fname: 'Brenda',   lname: 'Fitzgerald', criterion: 'Email match' },
  { customer_no: 66104, status: 'P', fname: 'Marcus',   lname: 'Delacroix',  criterion: 'Phone + name match' },
  { customer_no: 66105, status: 'P', fname: 'Yuki',     lname: 'Tanaka',     criterion: 'Phone + name match' },
]

const MERGED_TODAY = [
  { customer_no: 11043, fname: 'Margaret', lname: 'Chene',    sort_name: 'Chene, Margaret',   keep_cust: 11042, criterion: 'Email match',          merged_dt: new Date().toISOString() },
  { customer_no: 22103, fname: 'Robert',   lname: 'Smyth',    sort_name: 'Smyth, Robert',     keep_cust: 22104, criterion: 'Phone match',           merged_dt: new Date().toISOString() },
  { customer_no: 33202, fname: 'James H.', lname: 'Wentworth',sort_name: 'Wentworth, James H.',keep_cust: 33201, criterion: 'Name + address match',  merged_dt: new Date().toISOString() },
  { customer_no: 44501, fname: 'Pat',      lname: 'Miles',    sort_name: 'Miles, Pat',        keep_cust: 44502, criterion: 'Address match',          merged_dt: new Date().toISOString() },
]

const AGED_RECORDS_BASE = [
  { customer_no: 77001, fname: 'Harold',    mname: 'F', lname: 'Morrison',  create_dt: '2008-03-15T00:00:00', last_activity_dt: '2017-04-20T00:00:00', last_gift_dt: null,                  last_ticket_dt: '2016-09-05T00:00:00' },
  { customer_no: 77002, fname: 'Dolores',   mname: '',  lname: 'Kwan',      create_dt: '2009-07-22T00:00:00', last_activity_dt: '2016-11-03T00:00:00', last_gift_dt: '2015-06-14T00:00:00', last_ticket_dt: '2016-11-03T00:00:00' },
  { customer_no: 77003, fname: 'Leonard',   mname: 'T', lname: 'Bauer',     create_dt: '2007-01-08T00:00:00', last_activity_dt: '2015-02-27T00:00:00', last_gift_dt: null,                  last_ticket_dt: '2013-05-18T00:00:00' },
  { customer_no: 77004, fname: 'Constance', mname: '',  lname: 'Okafor',    create_dt: '2010-05-11T00:00:00', last_activity_dt: '2016-07-14T00:00:00', last_gift_dt: '2016-02-01T00:00:00', last_ticket_dt: null                  },
  { customer_no: 77005, fname: 'Raymond',   mname: 'B', lname: 'Aldridge',  create_dt: '2006-09-30T00:00:00', last_activity_dt: '2014-12-09T00:00:00', last_gift_dt: null,                  last_ticket_dt: '2014-12-09T00:00:00' },
  { customer_no: 77006, fname: 'Theresa',   mname: '',  lname: 'Yamamoto',  create_dt: '2011-04-17T00:00:00', last_activity_dt: '2017-08-22T00:00:00', last_gift_dt: '2017-08-22T00:00:00', last_ticket_dt: null                  },
  { customer_no: 77007, fname: 'George',    mname: 'W', lname: 'Hutchinson',create_dt: '2005-12-01T00:00:00', last_activity_dt: '2013-03-31T00:00:00', last_gift_dt: null,                  last_ticket_dt: '2013-03-31T00:00:00' },
  { customer_no: 77008, fname: 'Marguerite',mname: '',  lname: 'Lefebvre',  create_dt: '2012-08-05T00:00:00', last_activity_dt: '2016-05-16T00:00:00', last_gift_dt: '2014-11-30T00:00:00', last_ticket_dt: '2016-05-16T00:00:00' },
]

const EMAIL_ROWS = [
  { customer_no: 88001, sort_name: 'Abbott, Claire L.',   email: 'claire.abbott@gmail.com' },
  { customer_no: 88002, sort_name: 'Barnsworth, Theodore',email: 't.barnsworth@gmial.com' },
  { customer_no: 88003, sort_name: 'Chen, Wei',           email: 'wchen.arts@hotmail.com' },
  { customer_no: 88004, sort_name: 'Davidson, Elaine M.', email: 'elaine99@invalid-domain-xyz.io' },
  { customer_no: 88005, sort_name: 'Fletcher, James R.',  email: 'jfletcher@charlestonarts.org' },
  { customer_no: 88006, sort_name: 'Gutierrez, Sofia',    email: 'sofia.g@outloook.com' },
  { customer_no: 88007, sort_name: 'Harrison, Nathaniel', email: 'nharrison1956@yahoo.com' },
  { customer_no: 88008, sort_name: 'Ivanova, Katya',      email: 'katya.ivanova@protonmail.com' },
  { customer_no: 88009, sort_name: 'Jenkins, Marcus T.',  email: 'mjenkns@comcast.net' },
  { customer_no: 88010, sort_name: 'Kim, Susan Y.',       email: 'susankim.donate@gmail.com' },
  { customer_no: 88011, sort_name: 'Langford, Patricia',  email: 'plangfrd@earthlink.net' },
  { customer_no: 88012, sort_name: 'Martinez, Carlos E.', email: 'carlos.martinez@icloud.com' },
]

const PHONE_ROWS = [
  { customer_no: 88001, sort_name: 'Abbott, Claire L.',  phone: '8435550192' },
  { customer_no: 88003, sort_name: 'Chen, Wei',          phone: '8435550347' },
  { customer_no: 88005, sort_name: 'Fletcher, James R.', phone: '9999999999' },
  { customer_no: 88007, sort_name: 'Harrison, Nathaniel',phone: '8435550814' },
  { customer_no: 88009, sort_name: 'Jenkins, Marcus T.', phone: '0000000001' },
  { customer_no: 88011, sort_name: 'Langford, Patricia', phone: '8435550623' },
  { customer_no: 88013, sort_name: 'Nguyen, Bao T.',     phone: '8435550488' },
  { customer_no: 88015, sort_name: 'Okonkwo, Emeka',     phone: '8435550732' },
]

const ADDRESS_ROWS = [
  { customer_no: 88001, sort_name: 'Abbott, Claire L.',  street1: '42 Palmetto Blvd', street2: '',           city: 'Charleston', state: 'SC', postal_code: '29403' },
  { customer_no: 88003, sort_name: 'Chen, Wei',          street1: '1104 Church St',   street2: 'Apt 3B',     city: 'Charlston',  state: 'SC', postal_code: '29403' },
  { customer_no: 88005, sort_name: 'Fletcher, James R.', street1: '99999 Nowhere Rd', street2: '',           city: 'Gotham',     state: 'XX', postal_code: '00000' },
  { customer_no: 88007, sort_name: 'Harrison, Nathaniel',street1: '815 Meeting St',   street2: '',           city: 'Charleston', state: 'SC', postal_code: '29403' },
  { customer_no: 88009, sort_name: 'Jenkins, Marcus T.', street1: '221 King St',      street2: 'Suite 400',  city: 'Charleston', state: 'SC', postal_code: '29401' },
  { customer_no: 88011, sort_name: 'Langford, Patricia', street1: '560 E Bay St',     street2: '',           city: 'Charleston', state: 'SC', postal_code: '29403' },
]

const LIST_CATEGORIES = [
  { Id: 10, Description: 'Annual Fund' },
  { Id: 11, Description: 'Board & Major Donors' },
  { Id: 12, Description: 'Event Invitees' },
  { Id: 13, Description: 'Marketing' },
  { Id: 31, Description: 'Tess Buddy' },
]

const TESSITURA_LISTS = [
  { Id: 2201, Description: 'Annual Fund Appeal 2024 — Lapsed Donors',   Category: { Id: 10 }, LastGeneratedDate: '2024-11-14T10:30:00', RecordCount: 1847 },
  { Id: 2202, Description: 'Board Prospects Q4 2024',                   Category: { Id: 11 }, LastGeneratedDate: '2024-12-01T09:00:00', RecordCount: 84   },
  { Id: 2203, Description: 'Opening Night Gala Invitees',               Category: { Id: 12 }, LastGeneratedDate: '2024-10-28T14:15:00', RecordCount: 412  },
  { Id: 2204, Description: 'Spring Appeal — Under-40 Donors',           Category: { Id: 10 }, LastGeneratedDate: '2025-01-07T11:45:00', RecordCount: 633  },
  { Id: 2205, Description: 'Email Opt-In Reachout — Unverified',        Category: { Id: 13 }, LastGeneratedDate: '2024-09-19T08:30:00', RecordCount: 2910 },
  { Id: 2206, Description: '5+ Year Ticket Buyers No Recent Gift',      Category: { Id: 12 }, LastGeneratedDate: '2025-02-03T15:00:00', RecordCount: 782  },
]

const TB_LISTS_BASE = [
  { id: 4201, name: 'Donors >$500 last 12 months — no 2024 subscription',        recordCount: 847,  createdDate: '2025-03-10T09:22:00', generatedDate: '2025-03-10T09:23:00' },
  { id: 4202, name: 'Lapsed subscribers — attended 3+ shows in prior 3 seasons', recordCount: 312,  createdDate: '2025-02-18T14:55:00', generatedDate: '2025-02-18T14:56:00' },
  { id: 4203, name: 'First-time buyers 2024 season — no follow-up gift',         recordCount: 1204, createdDate: '2025-01-29T11:10:00', generatedDate: '2025-01-29T11:11:00' },
]

const SEGMENT_CONSTITUENTS = [
  { customer_no: '88001', sort_name: 'Abbott, Claire L.'   },
  { customer_no: '88002', sort_name: 'Barnsworth, Theodore'},
  { customer_no: '88003', sort_name: 'Chen, Wei'           },
  { customer_no: '88005', sort_name: 'Fletcher, James R.'  },
  { customer_no: '88007', sort_name: 'Harrison, Nathaniel' },
  { customer_no: '88009', sort_name: 'Jenkins, Marcus T.'  },
  { customer_no: '88010', sort_name: 'Kim, Susan Y.'       },
  { customer_no: '88012', sort_name: 'Martinez, Carlos E.' },
]

const DEMO_DISCLAIMER = `Full disclosure: I am running in demo mode, which means I have zero access to your actual database, no idea who your donors are, and I am essentially a golden retriever wearing a data analyst costume. That said, I can absolutely conjure a segment with complete confidence. What are you looking for?`

const CLAUDE_TEMPLATES = [
  {
    summary: 'People Who Clap Between Movements (Lapsed Donors, Last Gift 12–24 Months)',
    sql: "SELECT DISTINCT c.customer_no FROM T_CUSTOMER c JOIN T_DONATION d ON c.customer_no = d.customer_no WHERE d.don_dt BETWEEN DATEADD(year,-2,GETDATE()) AND DATEADD(year,-1,GETDATE()) AND c.customer_no NOT IN (SELECT customer_no FROM T_DONATION WHERE don_dt >= DATEADD(year,-1,GETDATE()))"
  },
  {
    summary: 'Season Ticket Holders Who Always Take the Aisle Seat (3+ Shows, No Current Season)',
    sql: "SELECT customer_no FROM T_ORDER_LINE WHERE season_no < (SELECT MAX(season_no) FROM T_SEASON) GROUP BY customer_no HAVING COUNT(DISTINCT perf_no) >= 3"
  },
  {
    summary: 'Donors Who Definitely Attended That One Chekhov Play But Won\'t Admit It (First-Time Buyers, No Follow-Up Gift)',
    sql: "SELECT DISTINCT c.customer_no FROM T_CUSTOMER c JOIN T_ORDER_LINE ol ON c.customer_no = ol.customer_no WHERE ol.season_no = 2024 AND c.customer_no NOT IN (SELECT customer_no FROM T_DONATION WHERE don_dt >= '2024-01-01')"
  },
]

// ---- Session state (resets on page reload) --------------------

let _pool      = JSON.parse(JSON.stringify(MERGE_POOL_BASE))
let _aged      = JSON.parse(JSON.stringify(AGED_RECORDS_BASE))
let _agedRpt   = []
let _tbLists   = JSON.parse(JSON.stringify(TB_LISTS_BASE))
let _nextId    = 4300
let _claudeIdx = 0

// ---- Helpers --------------------------------------------------

const json = (data, status) =>
  new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } })
const ok = () =>
  new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
const param = (params, name) =>
  ((params || []).find(p => p.Name === name) || {}).Value

// ---- Melissa mocks --------------------------------------------

function melissaEmail(email) {
  const e = (email || '').toLowerCase()
  if (e.includes('gmial.com'))
    return { Records: [{ Results: 'ES01', DeliverabilityConfidenceScore: 70, EmailAddress: e.replace('gmial.com', 'gmail.com') }] }
  if (e.includes('outloook.com'))
    return { Records: [{ Results: 'ES01', DeliverabilityConfidenceScore: 71, EmailAddress: e.replace('outloook.com', 'outlook.com') }] }
  if (e.includes('plangfrd'))
    return { Records: [{ Results: 'ES01', DeliverabilityConfidenceScore: 72, EmailAddress: e.replace('plangfrd', 'plangford') }] }
  if (e.includes('invalid-domain') || e.includes('noreply'))
    return { Records: [{ Results: 'ES04', DeliverabilityConfidenceScore: 8, EmailAddress: '' }] }
  return { Records: [{ Results: 'ES01', DeliverabilityConfidenceScore: 95, EmailAddress: e }] }
}

function melissaPhone(phone) {
  const d = (phone || '').replace(/\D/g, '')
  if (d === '9999999999' || d === '0000000001')
    return { Records: [{ Results: 'PE02', PhoneNumber: '' }] }
  const f = d.length >= 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}` : d
  return { Records: [{ Results: 'PS01', PhoneNumber: f }] }
}

function melissaAddress(street1, city, state) {
  if ((street1 || '').toLowerCase().includes('nowhere') || state === 'XX')
    return { Records: [{ Results: 'AE01', AddressLine1: '' }] }
  if ((city || '').toLowerCase() === 'charlston')
    return { Records: [{ Results: 'AV24,AC01', AddressLine1: street1, Locality: 'Charleston', AdministrativeArea: state || 'SC', PostalCode: '29403' }] }
  return { Records: [{ Results: 'AV25', AddressLine1: street1, Locality: city, AdministrativeArea: state, PostalCode: '29403' }] }
}

// ---- Custom/Execute dispatcher --------------------------------

async function handleExec(body) {
  const proc   = (body && body.ProcedureName) || ''
  const params = (body && body.ParameterValues) || []
  const mode   = param(params, '@mode')

  await delay(350 + Math.random() * 250)

  // ---- Constituent Merge ----
  if (proc === 'kognative_MANAGE_MERGE_PAIR') {
    if (mode === 'get_pool')     return json(_pool)
    if (mode === 'merged_today') return json(MERGED_TODAY)
    if (mode === 'swap') {
      const n1 = Number(param(params, '@customer_no_1'))
      const n2 = Number(param(params, '@customer_no_2'))
      _pool = _pool.map(r =>
        r.customer_no === n1 ? { ...r, status: 'K', keep_cust: n1 } :
        r.customer_no === n2 ? { ...r, status: 'D', keep_cust: n1 } : r
      )
      return ok()
    }
    if (mode === 'unschedule') {
      const n1   = Number(param(params, '@customer_no_1'))
      const crit = (_pool.find(r => r.customer_no === n1) || {}).criterion
      _pool = _pool.map(r => r.criterion === crit ? { ...r, status: 'P', keep_cust: null } : r)
      return ok()
    }
    if (mode === 'schedule') {
      const n1 = Number(param(params, '@customer_no_1'))
      const n2 = Number(param(params, '@customer_no_2'))
      _pool = _pool.map(r =>
        r.customer_no === n1 ? { ...r, status: 'K', keep_cust: n1 } :
        r.customer_no === n2 ? { ...r, status: 'D', keep_cust: n1 } : r
      )
      return ok()
    }
    if (mode === 'unmerge') {
      await delay(900)
      return ok()
    }
    if (mode === 'convert_to_household') {
      const n1   = Number(param(params, '@customer_no_1'))
      const crit = (_pool.find(r => r.customer_no === n1) || {}).criterion
      _pool = _pool.filter(r => r.criterion !== crit)
      return json([{ household_customer_no: 99900 + crit }])
    }
    return ok()
  }

  if (proc === 'AP_IDENTIFY_DUPLICATES') {
    await delay(700)
    _pool = JSON.parse(JSON.stringify(MERGE_POOL_BASE))
    return ok()
  }
  if (proc === 'kognative_LP_UPDATE_POSSIBLE_MERGES') { await delay(400); return ok() }
  if (proc === 'kognative_MERGE_CUSTOMER') {
    await delay(1000)
    _pool = []
    return ok()
  }

  // ---- Aged Record Removal ----
  if (proc === 'kognative_AGED_RECORD_REMOVAL') {
    if (mode === 'FIND') {
      _aged = JSON.parse(JSON.stringify(AGED_RECORDS_BASE))
      return json(_aged)
    }
    if (mode === 'MODIFY') {
      const cn = Number(param(params, '@customer_no'))
      _aged = _aged.filter(r => r.customer_no !== cn)
      return json(_aged)
    }
    if (mode === 'INACTIVATE') {
      const count = _aged.length
      _agedRpt = _aged.map(r => ({ ...r, inactivated_dt: new Date().toISOString(), inactivated_by: 'demo.user' }))
      _aged = []
      return json([{ records_inactivated: count }])
    }
    if (mode === 'REPORT') {
      if (_agedRpt.length === 0)
        _agedRpt = AGED_RECORDS_BASE.slice(0, 4).map(r => ({ ...r, inactivated_dt: '2024-09-12T14:22:00', inactivated_by: 'demo.user' }))
      return json(_agedRpt)
    }
    if (mode === 'REACTIVATE') {
      const cn = Number(param(params, '@customer_no'))
      _agedRpt = _agedRpt.filter(r => r.customer_no !== cn)
      return ok()
    }
    if (mode === 'UNDO') {
      const count = _agedRpt.length
      _agedRpt = []
      return json([{ records_reverted: count }])
    }
    return ok()
  }

  // ---- Contact Screening ----
  if (proc === 'kognative_CONTACT_SCREEN') {
    const custNo = param(params, '@customer_no')

    // For singular lookups, fall back to a generated record if the customer_no
    // isn't in our seed data — so any number typed in the demo works end-to-end.
    function fakeSortName(cn) {
      const FAKE_NAMES = [
        'Williams, Arthur J.', 'Patel, Priya', 'O\'Brien, Kathleen',
        'Nakamura, Hideo', 'Rosenberg, David', 'Torres, Carmen',
        'Blackwell, George', 'Osei, Abena', 'Ferreira, Lucas',
        'Gustafsson, Lena'
      ]
      return FAKE_NAMES[Number(cn) % FAKE_NAMES.length]
    }

    if (mode === 'EMAIL_PULL') {
      if (custNo) {
        const found = EMAIL_ROWS.filter(r => String(r.customer_no) === String(custNo))
        if (found.length > 0) return json(found)
        // generate a plausible record for any other customer_no
        const FAKE_EMAILS = [
          'a.williams@gmail.com', 'ppatel@hotmail.com', 'k.obrien@gmial.com',
          'h.nakamura@yahoo.com', 'drosenberg@invalid-domain-xyz.io',
          'carmen.t@gmail.com', 'gblackwell@outloook.com',
          'abena.osei@protonmail.com', 'lferreira@icloud.com', 'lgustafsson@comcast.net'
        ]
        const idx = Number(custNo) % FAKE_EMAILS.length
        return json([{ customer_no: Number(custNo), sort_name: fakeSortName(custNo), email: FAKE_EMAILS[idx] }])
      }
      return json(EMAIL_ROWS)
    }
    if (mode === 'EMAIL_WRITE') {
      const cn  = Number(custNo)
      const row = EMAIL_ROWS.find(r => r.customer_no === cn) || { sort_name: fakeSortName(cn) }
      return json([{ customer_no: cn, sort_name: row.sort_name || '', action_taken: param(params, '@result') }])
    }
    if (mode === 'PHONE_PULL') {
      if (custNo) {
        const found = PHONE_ROWS.filter(r => String(r.customer_no) === String(custNo))
        if (found.length > 0) return json(found)
        const FAKE_PHONES = [
          '8435550192', '9999999999', '8435550347', '0000000001',
          '8435550814', '8435550623', '8435550488', '8435550732',
          '8435551047', '8435550965'
        ]
        const idx = Number(custNo) % FAKE_PHONES.length
        return json([{ customer_no: Number(custNo), sort_name: fakeSortName(custNo), phone: FAKE_PHONES[idx] }])
      }
      return json(PHONE_ROWS)
    }
    if (mode === 'PHONE_WRITE') {
      const cn  = Number(custNo)
      const row = PHONE_ROWS.find(r => r.customer_no === cn) || { sort_name: fakeSortName(cn) }
      return json([{ customer_no: cn, sort_name: row.sort_name || '', action_taken: param(params, '@result') }])
    }
    if (mode === 'ADDRESS_PULL') {
      if (custNo) {
        const found = ADDRESS_ROWS.filter(r => String(r.customer_no) === String(custNo))
        if (found.length > 0) return json(found)
        const FAKE_ADDRS = [
          { street1: '42 Palmetto Blvd', street2: '',          city: 'Charleston', state: 'SC', postal_code: '29403' },
          { street1: '99999 Nowhere Rd', street2: '',          city: 'Gotham',     state: 'XX', postal_code: '00000' },
          { street1: '1104 Churh St',    street2: 'Apt 3B',    city: 'Charlston',  state: 'SC', postal_code: '29403' },
          { street1: '815 Meeting St',   street2: '',          city: 'Charleston', state: 'SC', postal_code: '29403' },
          { street1: '221 King St',      street2: 'Suite 400', city: 'Charleston', state: 'SC', postal_code: '29401' },
          { street1: '560 E Bay St',     street2: '',          city: 'Charleston', state: 'SC', postal_code: '29403' },
          { street1: '77 Wentworth St',  street2: '',          city: 'Charleston', state: 'SC', postal_code: '29403' },
          { street1: '300 Calhoun St',   street2: 'Apt 1C',    city: 'Charleston', state: 'SC', postal_code: '29403' },
          { street1: '1 Broad St',       street2: '',          city: 'Chrleston',  state: 'SC', postal_code: '29401' },
          { street1: '48 Line St',       street2: '',          city: 'Charleston', state: 'SC', postal_code: '29403' },
        ]
        const addr = FAKE_ADDRS[Number(custNo) % FAKE_ADDRS.length]
        return json([{ customer_no: Number(custNo), sort_name: fakeSortName(custNo), ...addr }])
      }
      return json(ADDRESS_ROWS)
    }
    if (mode === 'ADDRESS_WRITE') {
      const cn  = Number(custNo)
      const row = ADDRESS_ROWS.find(r => r.customer_no === cn) || { sort_name: fakeSortName(cn) }
      return json([{ customer_no: cn, sort_name: row.sort_name || '', action_taken: param(params, '@result') }])
    }
    return ok()
  }

  // ---- Segment creation ----
  if (proc === 'usp_tessbuddy_create_list') {
    await delay(600)
    const desc  = param(params, '@description') || 'Tess Buddy Segment'
    const newId = _nextId++
    _tbLists.unshift({ id: newId, name: desc, recordCount: Math.floor(200 + Math.random() * 1800), createdDate: new Date().toISOString(), generatedDate: new Date().toISOString() })
    return json([{ Id: newId, Description: desc }])
  }

  return ok()
}

// ---- Main interceptor -----------------------------------------

const _realFetch = window.fetch.bind(window)

window.fetch = async function demoFetch(input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || ''
  if (!url.startsWith('/api/')) return _realFetch(input, init)

  const urlObj   = new URL(url, window.location.origin)
  const path     = urlObj.pathname
  const endpoint = decodeURIComponent(urlObj.searchParams.get('endpoint') || '')
  const method   = ((init && init.method) || 'GET').toUpperCase()
  let   body     = null
  if (init && init.body) { try { body = JSON.parse(init.body) } catch (e) {} }

  // ---- Tessitura proxy ----------------------------------------
  if (path === '/api/tessitura') {

    if (endpoint === 'Diagnostics/Status') {
      await delay(200)
      return json({ Status: 'OK', Version: '20' })
    }

    if (endpoint === 'Custom/Execute') return handleExec(body)

    if (endpoint.startsWith('ReferenceData/ListCategories')) {
      await delay(250); return json(LIST_CATEGORIES)
    }

    if (endpoint.startsWith('Reporting/Lists/Search')) {
      await delay(350)
      const catId = body && body.CategoryId
      if (catId === 31) return json(_tbLists)
      let results = catId ? TESSITURA_LISTS.filter(l => l.Category.Id === catId) : TESSITURA_LISTS
      if (body && body.SearchText) {
        const q = body.SearchText.toLowerCase()
        results = results.filter(l => l.Description.toLowerCase().includes(q))
      }
      return json(results)
    }

    const mSummary = endpoint.match(/^Reporting\/Lists\/Summary\/(\d+)$/)
    if (mSummary) {
      await delay(200)
      const found = _tbLists.find(l => l.id === Number(mSummary[1])) || { recordCount: 847 }
      return json({ ConstituentCount: found.recordCount })
    }

    if (endpoint.match(/^Reporting\/Lists\/\d+\/Generate$/)) {
      await delay(350); return ok()
    }

    if (endpoint.match(/^Reporting\/Lists\/\d+\/Contents$/)) {
      await delay(300)
      return json(SEGMENT_CONSTITUENTS.map(c => Number(c.customer_no)))
    }

    const mDelete = endpoint.match(/^Reporting\/Lists\/(\d+)$/)
    if (mDelete && method === 'DELETE') {
      _tbLists = _tbLists.filter(l => l.id !== Number(mDelete[1]))
      await delay(250); return ok()
    }

    if (endpoint.startsWith('CRM/Constituents/Search')) {
      await delay(400)
      return json(SEGMENT_CONSTITUENTS.map(c => ({ Id: Number(c.customer_no), SortName: c.sort_name })))
    }

    const mConstituent = endpoint.match(/^CRM\/Constituents\/(\d+)$/)
    if (mConstituent) {
      await delay(150)
      const cid   = String(mConstituent[1])
      const found = SEGMENT_CONSTITUENTS.find(c => c.customer_no === cid)
      return json({ Id: Number(cid), SortName: found ? found.sort_name : `Customer #${cid}` })
    }

    await delay(200); return ok()
  }

  // ---- Melissa ------------------------------------------------
  if (path === '/api/melissa') {
    await delay(280 + Math.random() * 150)
    return json(melissaEmail(body && body.email))
  }
  if (path === '/api/melissa-phone') {
    await delay(280 + Math.random() * 150)
    return json(melissaPhone(body && body.phone))
  }
  if (path === '/api/melissa-address') {
    await delay(280 + Math.random() * 150)
    return json(melissaAddress(body && body.street1, body && body.city, body && body.state))
  }

  // ---- Claude -------------------------------------------------
  if (path === '/api/claude') {
    await delay(1100 + Math.random() * 500)
    const msg = ((body && body.userMessage) || '').toLowerCase()
    if (_claudeIdx === 0) {
      _claudeIdx++
      return json({ content: [{ text: JSON.stringify({ refinement_question: DEMO_DISCLAIMER }) }] })
    }
    if (msg.length < 20) {
      return json({ content: [{ text: JSON.stringify({ refinement_question: "I admire the brevity, but I'm going to need slightly more to work with. A time range, a dollar amount, a vibe — anything, really. I'm very suggestible." }) }] })
    }
    const tmpl = CLAUDE_TEMPLATES[_claudeIdx % CLAUDE_TEMPLATES.length]
    _claudeIdx++
    return json({ content: [{ text: JSON.stringify({ summary: tmpl.summary, sql: tmpl.sql }) }] })
  }

  return _realFetch(input, init)
}

export {}
