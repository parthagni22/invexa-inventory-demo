/* ==========================================================================
   Invexa — Demo workspace generator
   Builds a realistic plant-protein foods business and simulates ~60 days of
   operations through the real Store operations, so every module (stock,
   batches, production, purchasing, sales, returns, cold chain) reconciles.
   ========================================================================== */
const Seed = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() < p;
  const roundTo = (n, m) => Math.max(m, Math.round(n / m) * m);

  /* ---------- Catalog ---------- */
  // sku, code, name, category, pack, mrp, price, gst, hsn, shelfLife, storage, kg/unit, demand/day, conv cost, color
  const FG = [
    ['FG-TOF-PL200', 'TPL2', 'Premium Tofu – Plain 200 g', 'Tofu', '200 g vacuum pack', 90, 72, 5, '21069099', 20, 'Chilled 0–4°C', 0.2, 600, 4, '#2f6fed'],
    ['FG-TOF-PL500', 'TPL5', 'Premium Tofu – Plain 500 g', 'Tofu', '500 g vacuum pack', 199, 160, 5, '21069099', 20, 'Chilled 0–4°C', 0.5, 180, 7, '#2459cc'],
    ['FG-TOF-MC200', 'TMC2', 'Mint & Chilli Tofu 200 g', 'Tofu', '200 g vacuum pack', 110, 88, 5, '21069099', 18, 'Chilled 0–4°C', 0.2, 220, 5, '#12a46b'],
    ['FG-TOF-SM200', 'TSM2', 'Smoked Tofu 200 g', 'Tofu', '200 g vacuum pack', 140, 112, 5, '21069099', 30, 'Chilled 0–4°C', 0.2, 160, 7, '#8a5a2b'],
    ['FG-CHP-CL250', 'CHP2', 'Soya Chaap 250 g', 'Soya Chaap', '250 g tray pack', 120, 96, 5, '21069099', 12, 'Chilled 0–4°C', 0.25, 300, 6, '#d97706'],
    ['FG-PKL-HS200', 'PHS2', 'Tofu Pickle – Hot & Sour 200 g', 'Tofu Pickle', '200 g glass jar', 180, 145, 12, '20019000', 180, 'Ambient (<30°C)', 0.2, 60, 9, '#e5484d'],
    ['FG-PKL-PA200', 'PPA2', 'Tofu Pickle – Panchamrit 200 g', 'Tofu Pickle', '200 g glass jar', 180, 145, 12, '20019000', 180, 'Ambient (<30°C)', 0.2, 45, 9, '#b4235f'],
    ['FG-YGT-MG100', 'YMG1', 'Plant Yogurt – Mango 100 g', 'Plant Yogurt', '100 g cup', 60, 48, 5, '21069099', 21, 'Chilled 0–4°C', 0.1, 320, 3, '#f59e0b'],
    ['FG-YGT-AC100', 'YAC1', 'Plant Yogurt – Apple Cinnamon 100 g', 'Plant Yogurt', '100 g cup', 60, 48, 5, '21069099', 21, 'Chilled 0–4°C', 0.1, 200, 3, '#a16207'],
    ['FG-YGT-BB100', 'YBB1', 'Plant Yogurt – Berry Blast 100 g', 'Plant Yogurt', '100 g cup', 60, 48, 5, '21069099', 21, 'Chilled 0–4°C', 0.1, 260, 3, '#7c3aed'],
    ['FG-SPR-GA150', 'SGA1', 'Plant Cheesy Spread – Garlic 150 g', 'Cheesy Spread', '150 g tub', 175, 140, 12, '21069099', 60, 'Chilled 0–4°C', 0.15, 90, 8, '#0b9bd8'],
    ['FG-SPR-IH150', 'SIH1', 'Plant Cheesy Spread – Italian Herbs 150 g', 'Cheesy Spread', '150 g tub', 175, 140, 12, '21069099', 60, 'Chilled 0–4°C', 0.15, 80, 8, '#0f766e'],
  ];
  // sku, code, name, category, type, uom, cost, gst, shelfLife, cold?, vendorKey
  const RM = [
    ['RM-SOY-NG', 'SOY', 'Soybean – Non-GMO (Grade A)', 'Grains & Pulses', 'raw', 'kg', 52, 5, 365, false, 'soy'],
    ['RM-NIG-01', 'NIG', 'Nigari Coagulant (MgCl₂)', 'Additives', 'raw', 'kg', 180, 18, 730, false, 'chem'],
    ['RM-SLT-01', 'SLT', 'Iodised Salt', 'Additives', 'raw', 'kg', 22, 0, 730, false, 'chem'],
    ['RM-SMK-01', 'SMK', 'Natural Liquid Smoke', 'Flavours', 'raw', 'L', 650, 18, 365, false, 'chem'],
    ['RM-MNT-FR', 'MNT', 'Fresh Mint Leaves', 'Fresh Produce', 'raw', 'kg', 120, 0, 7, true, 'fresh'],
    ['RM-CHL-FR', 'CHL', 'Green Chilli', 'Fresh Produce', 'raw', 'kg', 80, 0, 10, true, 'fresh'],
    ['RM-GRL-PS', 'GRL', 'Garlic Paste', 'Fresh Produce', 'raw', 'kg', 160, 5, 60, true, 'fresh'],
    ['RM-WGL-01', 'WGL', 'Vital Wheat Gluten', 'Grains & Pulses', 'raw', 'kg', 210, 5, 365, false, 'ingr'],
    ['RM-OIL-MS', 'OIL', 'Cold-pressed Mustard Oil', 'Oils', 'raw', 'L', 165, 5, 270, false, 'ingr'],
    ['RM-SPC-PK', 'SPC', 'Pickle Spice Blend', 'Spices', 'raw', 'kg', 320, 5, 180, false, 'ingr'],
    ['RM-SGR-01', 'SGR', 'Cane Sugar', 'Additives', 'raw', 'kg', 46, 5, 730, false, 'ingr'],
    ['RM-HRB-IT', 'HRB', 'Italian Herb Mix', 'Spices', 'raw', 'kg', 900, 5, 365, false, 'ingr'],
    ['RM-CUL-VG', 'CUL', 'Vegan Yogurt Culture', 'Cultures', 'raw', 'g', 4.5, 18, 365, true, 'ingr'],
    ['RM-MNG-PL', 'MNG', 'Alphonso Mango Pulp', 'Fruit Bases', 'raw', 'kg', 140, 12, 120, true, 'fruit'],
    ['RM-APC-BS', 'APC', 'Apple Cinnamon Fruit Base', 'Fruit Bases', 'raw', 'kg', 230, 12, 120, true, 'fruit'],
    ['RM-BRY-CP', 'BRY', 'Mixed Berry Compote', 'Fruit Bases', 'raw', 'kg', 380, 12, 120, true, 'fruit'],
    ['RM-CSH-W3', 'CSH', 'Cashew Kernels W320', 'Nuts', 'raw', 'kg', 820, 5, 180, false, 'cashew'],
    ['PK-VAC-200', 'PV2', 'Vacuum Pouch 200 g (printed)', 'Packaging', 'packaging', 'pcs', 3.2, 18, 720, false, 'pack'],
    ['PK-VAC-500', 'PV5', 'Vacuum Pouch 500 g (printed)', 'Packaging', 'packaging', 'pcs', 4.8, 18, 720, false, 'pack'],
    ['PK-TRY-250', 'PTR', 'Chaap Tray + Film 250 g', 'Packaging', 'packaging', 'pcs', 5.5, 18, 720, false, 'pack'],
    ['PK-JAR-200', 'PJR', 'Glass Jar 200 g + Lug Cap', 'Packaging', 'packaging', 'pcs', 14, 18, 1095, false, 'glass'],
    ['PK-CUP-100', 'PCP', 'Yogurt Cup 100 g + Foil Lid', 'Packaging', 'packaging', 'pcs', 3.6, 18, 720, false, 'pack'],
    ['PK-TUB-150', 'PTB', 'Spread Tub 150 g + Lid', 'Packaging', 'packaging', 'pcs', 6.5, 18, 720, false, 'pack'],
    ['PK-LBL-01', 'LBL', 'Printed Product Label', 'Packaging', 'packaging', 'pcs', 0.8, 18, 1095, false, 'pack'],
  ];
  const BOMS = {
    TPL2: [['SOY', 0.11], ['NIG', 0.003], ['PV2', 1], ['LBL', 1]],
    TPL5: [['SOY', 0.27], ['NIG', 0.007], ['PV5', 1], ['LBL', 1]],
    TMC2: [['SOY', 0.11], ['NIG', 0.003], ['MNT', 0.01], ['CHL', 0.006], ['SLT', 0.002], ['PV2', 1], ['LBL', 1]],
    TSM2: [['SOY', 0.11], ['NIG', 0.003], ['SMK', 0.002], ['SLT', 0.002], ['PV2', 1], ['LBL', 1]],
    CHP2: [['WGL', 0.09], ['SOY', 0.06], ['SLT', 0.003], ['PTR', 1], ['LBL', 1]],
    PHS2: [['SOY', 0.08], ['NIG', 0.002], ['OIL', 0.05], ['SPC', 0.02], ['SLT', 0.006], ['PJR', 1], ['LBL', 1]],
    PPA2: [['SOY', 0.08], ['NIG', 0.002], ['OIL', 0.04], ['SPC', 0.015], ['SGR', 0.02], ['PJR', 1], ['LBL', 1]],
    YMG1: [['SOY', 0.07], ['CUL', 0.2], ['MNG', 0.02], ['SGR', 0.006], ['PCP', 1], ['LBL', 1]],
    YAC1: [['SOY', 0.07], ['CUL', 0.2], ['APC', 0.02], ['SGR', 0.005], ['PCP', 1], ['LBL', 1]],
    YBB1: [['SOY', 0.07], ['CUL', 0.2], ['BRY', 0.02], ['SGR', 0.006], ['PCP', 1], ['LBL', 1]],
    SGA1: [['CSH', 0.06], ['SOY', 0.03], ['GRL', 0.008], ['SLT', 0.002], ['PTB', 1], ['LBL', 1]],
    SIH1: [['CSH', 0.06], ['SOY', 0.03], ['HRB', 0.003], ['SLT', 0.002], ['PTB', 1], ['LBL', 1]],
  };
  const WAREHOUSES = [
    { key: 'PUN', code: 'PUN-CR1', name: 'Pune Plant · Cold Room A', type: 'Cold Storage', city: 'Pune', state: 'Maharashtra', tempMin: 0, tempMax: 4, capacity: 45000, isPlant: true, manager: 'Sneha Patil', share: 0.55, address: 'Plot 14, MIDC Bhosari, Pune 411026' },
    { key: 'DRY', code: 'PUN-DS1', name: 'Pune Plant · Dry Store', type: 'Dry Store', city: 'Pune', state: 'Maharashtra', tempMin: 12, tempMax: 30, capacity: 60000, isPlant: true, manager: 'Sneha Patil', share: 0, address: 'Plot 14, MIDC Bhosari, Pune 411026' },
    { key: 'MUM', code: 'MUM-HB1', name: 'Mumbai Cold Hub · Bhiwandi', type: 'Cold Storage', city: 'Mumbai', state: 'Maharashtra', tempMin: 0, tempMax: 4, capacity: 25000, isPlant: false, manager: 'Imran Shaikh', share: 0.3, address: 'Gala 7, Rahnal Logistics Park, Bhiwandi 421302' },
    { key: 'BLR', code: 'BLR-HB1', name: 'Bengaluru Cold Hub · Hoskote', type: 'Cold Storage', city: 'Bengaluru', state: 'Karnataka', tempMin: 0, tempMax: 4, capacity: 18000, isPlant: false, manager: 'Kavya Reddy', share: 0.15, address: 'Unit 3, KIADB Industrial Area, Hoskote 562114' },
  ];
  const VENDORS = {
    soy: ['Malwa Agro Commodities', 'Indore', 'Madhya Pradesh', 'Grains & Pulses', 3, 'Rakesh Jain', 4.6],
    chem: ['Deccan Food Additives', 'Pune', 'Maharashtra', 'Additives & Flavours', 2, 'Anil Deshpande', 4.4],
    fresh: ['Sahyadri Fresh Farms', 'Nashik', 'Maharashtra', 'Fresh Produce', 1, 'Pooja Gaikwad', 4.2],
    fruit: ['Konkan Fruit Processors', 'Ratnagiri', 'Maharashtra', 'Fruit Bases', 3, 'Sameer Sawant', 4.5],
    ingr: ['Nutriworld Ingredients', 'Mumbai', 'Maharashtra', 'Ingredients & Cultures', 3, 'Farah Merchant', 4.7],
    cashew: ['Coastal Cashew Exports', 'Mangaluru', 'Karnataka', 'Nuts', 4, 'Prakash Shetty', 4.3],
    pack: ['PackRight Flexibles', 'Pune', 'Maharashtra', 'Packaging', 4, 'Nitin Kale', 4.1],
    glass: ['Shreeji Glass & Closures', 'Vapi', 'Gujarat', 'Glass Packaging', 5, 'Hemant Patel', 4.0],
  };
  // name, type, region(wh key), city, state, creditDays, creditLimit, contact
  const CUSTOMERS = [
    ['Pune Fresh Distributors', 'Distributor', 'PUN', 'Pune', 'Maharashtra', 21, 1500000, 'Amit Bhosale'],
    ['FreshMart Hypermarkets – Pune', 'Modern Trade', 'PUN', 'Pune', 'Maharashtra', 30, 1200000, 'Neha Kapoor'],
    ['QuickCart Instant Delivery', 'E-commerce', 'PUN', 'Pune', 'Maharashtra', 15, 800000, 'Rahul Verma'],
    ['The Green Bowl Café', 'HoReCa', 'PUN', 'Pune', 'Maharashtra', 7, 150000, 'Tanvi Joshi'],
    ['Hotel Sahyadri Grand', 'HoReCa', 'PUN', 'Pune', 'Maharashtra', 15, 300000, 'Chef Mahesh Rao'],
    ['Organic Corner – Koregaon Park', 'Retailer', 'PUN', 'Pune', 'Maharashtra', 7, 120000, 'Shruti Nair'],
    ['Healthy Harvest – Baner', 'Retailer', 'PUN', 'Pune', 'Maharashtra', 7, 100000, 'Kunal Shah'],
    ['FitFuel Nutrition Store', 'Retailer', 'PUN', 'Pune', 'Maharashtra', 7, 90000, 'Aditya Pawar'],
    ['Mumbai Chilled Logistics', 'Distributor', 'MUM', 'Mumbai', 'Maharashtra', 21, 1800000, 'Javed Ansari'],
    ['Daily Basket Supermarkets', 'Modern Trade', 'MUM', 'Mumbai', 'Maharashtra', 30, 1000000, 'Priya Menon'],
    ['VeggieBox Online', 'E-commerce', 'MUM', 'Mumbai', 'Maharashtra', 15, 600000, 'Karan Malhotra'],
    ['Zen Asian Kitchen – Bandra', 'HoReCa', 'MUM', 'Mumbai', 'Maharashtra', 10, 200000, 'Chef Lin Wong'],
    ['Bengaluru Green Distributors', 'Distributor', 'BLR', 'Bengaluru', 'Karnataka', 21, 1200000, 'Suresh Gowda'],
    ['Namma Organic Mart', 'Retailer', 'BLR', 'Bengaluru', 'Karnataka', 10, 150000, 'Deepa Rao'],
    ['Koramangala Vegan Kitchen', 'HoReCa', 'BLR', 'Bengaluru', 'Karnataka', 10, 180000, 'Arjun Iyer'],
  ];
  const TYPE_W = { Distributor: 6, 'Modern Trade': 4, 'E-commerce': 3, HoReCa: 1.4, Retailer: 1 };
  const TYPE_P = { Distributor: 0.9, 'Modern Trade': 0.75, 'E-commerce': 0.7, HoReCa: 0.45, Retailer: 0.5 };
  const TYPE_DISC = { Distributor: 12, 'Modern Trade': 8, 'E-commerce': 6, HoReCa: 0, Retailer: 0 };
  const RETURN_REASONS = [['Damaged in transit', 'Scrap'], ['Seal / leakage issue', 'Scrap'], ['Near expiry – customer rejected', 'Scrap'], ['Excess quantity supplied', 'Restock'], ['Wrong SKU delivered', 'Restock']];
  const VEHICLES = ['MH12 RT 4471 (Reefer)', 'MH14 KL 2290 (Reefer)', 'MH04 GH 7812 (Reefer)', 'KA03 MN 5521 (Reefer)'];

  function baseDb() {
    return {
      meta: { version: 1, createdAt: Date.now(), updatedAt: Date.now(), demo: true },
      company: {
        name: 'Verdant Soy Foods Pvt. Ltd.', short: 'VS', industry: 'Plant-protein & dairy-alternative foods',
        gstin: '27AAKCV4821M1Z6', fssai: '11524035000871', pan: 'AAKCV4821M', state: 'Maharashtra',
        address: 'Plot 14, MIDC Bhosari, Pune 411026, Maharashtra', phone: '+91 20 4000 1234', email: 'ops@verdant-demo.in',
        currency: 'INR', fyStart: 'April', capacityKg: 1000, plan: 'Business · Annual',
      },
      settings: { fefo: true, negativeStock: false, autoBatch: true, nearExpiryAlerts: true, tempAlerts: true, lowStockAlerts: true },
      counters: {}, items: [], warehouses: [], vendors: [], customers: [], boms: [], batches: [], movements: [],
      productions: [], purchaseOrders: [], salesOrders: [], returns: [], adjustments: [], transfers: [], tempLogs: [], activity: [],
    };
  }

  function catalog(db) {
    const whId = {};
    for (const w of WAREHOUSES) {
      const rec = { id: Store.uid('wh'), code: w.code, name: w.name, type: w.type, city: w.city, state: w.state, tempMin: w.tempMin, tempMax: w.tempMax, capacity: w.capacity, isPlant: w.isPlant, manager: w.manager, address: w.address, active: true, key: w.key };
      db.warehouses.push(rec); whId[w.key] = rec.id;
    }
    const vId = {};
    let vi = 1;
    for (const [k, v] of Object.entries(VENDORS)) {
      const rec = { id: Store.uid('ve'), name: v[0], city: v[1], state: v[2], category: v[3], leadDays: v[4], contact: v[5], rating: v[6], phone: `+91 9${rint(100000000, 999999999)}`, email: `sales@${v[0].toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}.example`, gstin: `${v[2] === 'Karnataka' ? 29 : v[2] === 'Gujarat' ? 24 : v[2] === 'Madhya Pradesh' ? 23 : 27}AAB${String.fromCharCode(64 + vi)}${rint(1000, 9999)}Q1Z${vi}`, paymentTerms: pick(['Net 15', 'Net 30', 'Net 30', 'Net 45']), active: true, key: k };
      db.vendors.push(rec); vId[k] = rec.id; vi++;
    }
    const code2id = {};
    for (const f of FG) {
      const [sku, code, name, category, pack, mrp, price, gst, hsn, shelf, storage, kg, demand, conv, color] = f;
      const rec = { id: Store.uid('it'), sku, code, name, type: 'finished', category, uom: 'pcs', packSize: pack, mrp, price, cost: 0, gst, hsn, shelfLife: shelf, storage, weightKg: kg, demand, convCost: conv, reorderLevel: Math.round(demand * 2), color, active: true, barcode: '890' + rint(1000000000, 9999999999) };
      db.items.push(rec); code2id[code] = rec.id;
    }
    // compute daily raw usage from recipes
    const usage = {};
    for (const [fg, lines] of Object.entries(BOMS)) {
      const d = FG.find(x => x[1] === fg)[12];
      for (const [rc, q] of lines) usage[rc] = (usage[rc] || 0) + d * q;
    }
    for (const r of RM) {
      const [sku, code, name, category, type, uom, cost, gst, shelf, cold, vk] = r;
      const lead = VENDORS[vk][4];
      const u = usage[code] || 1;
      const fresh = shelf <= 10;
      const rec = { id: Store.uid('it'), sku, code, name, type, category, uom, cost, price: 0, gst, hsn: type === 'packaging' ? '39232990' : '', shelfLife: shelf, storage: cold ? 'Chilled 0–4°C' : 'Ambient (<30°C)', cold, vendorId: vId[vk], dailyUse: u,
        reorderLevel: nice(u * (lead + (fresh ? 4 : 5))), orderQty: nice(u * (fresh ? Math.max(6, shelf - 2) : 16)), active: true, color: type === 'packaging' ? '#64748b' : '#0f766e' };
      db.items.push(rec); code2id[code] = rec.id;
    }
    for (const [fg, lines] of Object.entries(BOMS)) {
      db.boms.push({ id: Store.uid('bom'), itemId: code2id[fg], outputQty: 1, yieldPct: 98, lines: lines.map(([c, q]) => ({ itemId: code2id[c], qty: q })), notes: 'Standard recipe v1.2' });
    }
    // standard cost of finished goods from recipe
    for (const it of db.items.filter(i => i.type === 'finished')) {
      const bom = db.boms.find(b => b.itemId === it.id);
      it.cost = Store.round(bom.lines.reduce((s, l) => s + l.qty * db.items.find(x => x.id === l.itemId).cost, 0) + it.convCost, 2);
    }
    for (const c of CUSTOMERS) {
      const [name, type, region, city, state, creditDays, creditLimit, contact] = c;
      db.customers.push({ id: Store.uid('cu'), name, type, regionWh: whId[region], city, state, creditDays, creditLimit, contact, phone: `+91 9${rint(100000000, 999999999)}`, email: `purchase@${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}.example`, gstin: type === 'HoReCa' && chance(0.3) ? '' : `${state === 'Karnataka' ? 29 : 27}AAC${name[0]}${rint(1000, 9999)}R1Z${rint(1, 9)}`, route: `${city} – ${pick(['North', 'South', 'East', 'West', 'Central'])}`, discount: TYPE_DISC[type], active: true });
    }
    return { whId, code2id };
  }
  function nice(n) {
    if (n < 1) return Math.ceil(n * 10) / 10;
    if (n < 20) return Math.ceil(n);
    if (n < 200) return Math.ceil(n / 5) * 5;
    if (n < 2000) return Math.ceil(n / 50) * 50;
    return Math.ceil(n / 500) * 500;
  }

  /* ---------- Simulation ---------- */
  async function build(onProgress) {
    const db = baseDb();
    Store.setDb(db);
    Store.setSilent(true);
    Store.setUser({ id: 'sys', name: 'System' });
    const { whId } = catalog(db);
    const S = Store;
    const DAYS = 60;
    const realNow = Date.now();
    const todayIso = S.isoOf(realNow);
    const start = S.addDays(todayIso, -DAYS);
    const at = (iso, h, m = 0) => Math.min(new Date(iso + 'T00:00:00').getTime() + h * 3600000 + m * 60000 + rint(0, 3000) * 1000, realNow - rint(2, 40) * 60000);
    const fgs = db.items.filter(i => i.type === 'finished');
    const raws = db.items.filter(i => i.type !== 'finished');
    const regionWh = { PUN: whId.PUN, MUM: whId.MUM, BLR: whId.BLR };
    const share = { PUN: 0.55, MUM: 0.3, BLR: 0.15 };
    const users = ['Sneha Patil', 'Vikram Joshi', 'Rohan Kulkarni', 'Imran Shaikh', 'Kavya Reddy'];
    const asUser = n => S.setUser({ id: 'u_' + n, name: n });

    // Opening balances
    S.setClock(at(S.addDays(start, -1), 10));
    asUser('Rohan Kulkarni');
    for (const r of raws) {
      const qty = nice(r.dailyUse * (r.shelfLife <= 10 ? 3 : 18));
      const b = S.newBatch({ itemId: r.id, whId: r.cold ? whId.PUN : whId.DRY, qty, cost: r.cost, mfg: S.addDays(start, -rint(2, 8)), batchNo: `OPN-${r.code}-01`, source: 'Opening', ref: 'Opening balance' });
      S.move('OPENING', b, qty, 'Opening balance');
    }
    for (const f of fgs) {
      for (const [k, w] of Object.entries(regionWh)) {
        const qty = roundTo(f.demand * share[k] * 3, 12);
        const mfg = S.addDays(start, -rint(1, 3));
        const b = S.newBatch({ itemId: f.id, whId: w, qty, cost: f.cost, mfg, batchNo: `${f.code}-${mfg.slice(2).replace(/-/g, '')}`, source: 'Opening', ref: 'Opening balance' });
        S.move('OPENING', b, qty, 'Opening balance');
      }
    }
    S.log('Imported', 'Opening Stock', 'Migration', `${db.batches.length} batches loaded`);

    const inTransit = (itemId, to) => db.transfers.filter(t => t.status === 'In Transit' && t.to === to).reduce((s, t) => s + t.lines.filter(l => l.itemId === itemId).reduce((a, l) => a + l.qty, 0), 0);
    const pendingMOs = [];

    for (let d = 0; d <= DAYS; d++) {
      const iso = S.addDays(start, d);
      const age = DAYS - d; // 0 = today
      const dow = new Date(iso + 'T00:00:00').getDay();
      if (onProgress && d % 6 === 0) { onProgress(d / DAYS); await new Promise(r => setTimeout(r, 0)); }

      // 06:00 — complete yesterday's night-shift production
      asUser('Sneha Patil');
      for (const mo of pendingMOs.splice(0)) {
        S.setClock(at(iso, 6, rint(0, 50)));
        const rej = Math.round(mo.qty * rnd(0, 0.025));
        S.completeMO(mo.id, { good: mo.qty - rej, rejected: rej, qc: { ph: +rnd(5.6, 6.4).toFixed(1), coreTemp: +rnd(2, 4).toFixed(1), moisture: +rnd(78, 84).toFixed(1), appearance: 'OK', micro: 'Pass', inspector: 'QA – Meera Kulkarni' } });
      }

      // 08:30 — receive POs that are due
      for (const po of db.purchaseOrders.filter(p => ['Issued', 'Partially Received'].includes(p.status) && p.expected <= iso)) {
        if (age === 0 && chance(0.6)) continue;
        if (age <= 1 && chance(0.25)) continue; // a few overdue POs
        S.setClock(at(iso, 8, rint(10, 59)));
        const partial = po.status === 'Issued' && chance(0.08);
        const receipts = po.lines.map((l, idx) => ({ idx, qty: S.round(partial && idx === 0 ? Math.round((l.qty - l.received) * 0.6) : l.qty - l.received), lot: `V${S.isoOf(S.now()).slice(2).replace(/-/g, '')}${rint(10, 99)}`, whId: S.item(l.itemId).cold ? whId.PUN : whId.DRY }));
        S.receivePO(po.id, receipts, { date: iso });
        if (age > 18) { po.billStatus = 'Paid'; po.paidAt = S.now() + 86400000 * rint(10, 18); }
      }

      // 09:00 — replenishment: raise POs per vendor for items below reorder level
      asUser('Sneha Patil');
      const byVendor = {};
      for (const r of raws) {
        const pos = S.stock(r.id) + S.onOrder(r.id);
        if (pos < r.reorderLevel) (byVendor[r.vendorId] = byVendor[r.vendorId] || []).push(r);
      }
      for (const [vid, list] of Object.entries(byVendor)) {
        S.setClock(at(iso, 9, rint(0, 50)));
        const v = S.vendor(vid);
        const po = S.savePO({ vendorId: vid, date: iso, expected: S.addDays(iso, v.leadDays), whId: whId.DRY, notes: 'Auto-replenishment (reorder point)', lines: list.map(r => ({ itemId: r.id, qty: r.orderQty, rate: S.round(r.cost * rnd(0.97, 1.04), 2), gst: r.gst })) });
        if (!(age === 0 && chance(0.4))) { S.setClock(S.now() + 1800000); S.issuePO(po.id); }
      }

      // 10:00 — replenish hubs from plant cold room
      asUser('Imran Shaikh');
      for (const hub of ['MUM', 'BLR']) {
        const lines = [];
        for (const f of fgs) {
          const hd = f.demand * share[hub];
          const have = S.stock(f.id, regionWh[hub]) + inTransit(f.id, regionWh[hub]);
          if (have < hd * 2.5) {
            let want = roundTo(hd * 4, 12);
            const spare = S.stock(f.id, whId.PUN) - f.demand * share.PUN * 1.2;
            want = Math.min(want, Math.floor(Math.max(0, spare) / 12) * 12);
            if (want <= 0) continue;
            for (const p of S.allocate(f.id, whId.PUN, Math.min(want, S.stock(f.id, whId.PUN)))) lines.push({ batchId: p.batch.id, qty: p.qty });
          }
        }
        if (lines.length) {
          S.setClock(at(iso, 10, rint(0, 40)));
          const tr = S.createTransfer({ from: whId.PUN, to: regionWh[hub], date: iso, vehicle: pick(VEHICLES), lines, notes: 'Hub replenishment' });
          tr.recvDue = hub === 'MUM' ? 0 : 1;
          if (hub === 'MUM' && age > 0) { S.setClock(at(iso, 15, rint(0, 50))); asUser('Imran Shaikh'); S.receiveTransfer(tr.id); }
        }
      }
      // receive BLR transfers from yesterday
      asUser('Kavya Reddy');
      for (const tr of db.transfers.filter(t => t.status === 'In Transit' && t.date < iso)) {
        if (age === 0 && chance(0.5)) continue;
        S.setClock(at(iso, 8, rint(0, 50)));
        S.receiveTransfer(tr.id);
      }

      // 11:00–17:00 — sales orders per region
      for (const [region, w] of Object.entries(regionWh)) {
        const pool = db.customers.filter(c => c.regionWh === w);
        const n = region === 'PUN' ? rint(3, 5) : region === 'MUM' ? rint(2, 3) : rint(1, 2);
        const todays = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
        const orderLines = todays.map(() => []);
        const dayFactor = dow === 0 ? 0.55 : dow === 6 ? 1.15 : 1;
        for (const f of fgs) {
          const D = f.demand * share[region] * rnd(0.8, 1.2) * dayFactor * (0.82 + 0.3 * d / DAYS); // steady growth trend
          const takers = todays.map((c, i) => ({ c, i })).filter(({ c }) => chance(TYPE_P[c.type]) && !(c.type === 'HoReCa' && f.category === 'Tofu Pickle'));
          if (!takers.length) continue;
          const wsum = takers.reduce((s, t) => s + TYPE_W[t.c.type], 0);
          for (const t of takers) {
            const q = roundTo(D * TYPE_W[t.c.type] / wsum, 6);
            orderLines[t.i].push({ itemId: f.id, qty: q, rate: f.price, gst: f.gst, disc: TYPE_DISC[t.c.type] });
          }
        }
        todays.forEach((c, i) => {
          let lines = orderLines[i];
          if (!lines.length) return;
          S.setClock(at(iso, rint(11, 16), rint(0, 59)));
          asUser(pick(['Vikram Joshi', 'Vikram Joshi', 'Rohan Kulkarni']));
          // fit to available stock (sales team won't book what isn't there)
          lines = lines.map(l => ({ ...l, qty: Math.min(l.qty, Math.floor(S.stock(l.itemId, w) * 0.9 / 6) * 6) })).filter(l => l.qty > 0);
          if (!lines.length) return;
          const so = S.saveSO({ customerId: c.id, date: iso, whId: w, lines, notes: '', ref: `PO/${c.name.split(' ')[0].toUpperCase()}/${rint(1000, 9999)}` });
          let target;
          if (age >= 3) target = 'Delivered';
          else if (age === 2) target = chance(0.7) ? 'Delivered' : 'Dispatched';
          else if (age === 1) target = pick(['Delivered', 'Dispatched', 'Dispatched', 'Confirmed']);
          else target = pick(['Draft', 'Confirmed', 'Confirmed', 'Dispatched']);
          if (target === 'Draft') return;
          S.setClock(S.now() + rint(10, 60) * 60000); S.confirmSO(so.id);
          if (target === 'Confirmed') return;
          asUser('Imran Shaikh');
          S.setClock(S.now() + rint(30, 120) * 60000);
          try { S.dispatchSO(so.id, { vehicle: pick(VEHICLES), driver: pick(['Ramesh', 'Santosh', 'Ganesh', 'Manjunath']) }); } catch { return; }
          if (target === 'Dispatched') return;
          const back = S.now();
          S.setClock(Math.min(back + rint(4, 20) * 3600000, realNow - 3600000)); S.deliverSO(so.id);
          // payments
          const t = S.soTotals(so);
          const due = so.dueDate <= todayIso;
          const r = Math.random();
          asUser('Rohan Kulkarni');
          if ((due && r < 0.9) || (!due && r < 0.35)) {
            const payDay = Math.min(new Date(so.dueDate + 'T12:00:00').getTime() - rint(0, 5) * 86400000, realNow - 7200000);
            S.setClock(Math.max(payDay, S.now() + 3600000));
            S.recordPayment(so.id, { amount: S.round(t.total, 2), mode: pick(['NEFT', 'RTGS', 'UPI', 'Cheque', 'NEFT']), ref: `UTR${rint(10000000, 99999999)}` });
          } else if (due && r < 0.95) {
            S.setClock(S.now() + 86400000 * 3);
            S.recordPayment(so.id, { amount: S.round(t.total * 0.5, 2), mode: 'NEFT', ref: `UTR${rint(10000000, 99999999)}` });
          }
          S.setClock(back);
        });
      }

      // 16:00 — plan & start production for tomorrow (night shift)
      asUser('Sneha Patil');
      for (const f of fgs) {
        const total = S.stock(f.id);
        if (total < f.demand * 3.2) {
          const qty = roundTo(f.demand * rnd(3.5, 4.5), 50);
          if (S.requirements(f.id, qty).some(r => !r.ok)) continue;
          S.setClock(at(iso, 16, rint(0, 50)));
          const mo = S.createMO({ itemId: f.id, qty, whId: whId.PUN, date: S.addDays(iso, age === 0 ? 0 : 1), shift: 'Night' });
          if (age === 0 && chance(0.45)) continue; // leave a few planned
          S.setClock(S.now() + rint(4, 6) * 3600000 > realNow ? realNow - 600000 : S.now() + rint(4, 6) * 3600000);
          S.startMO(mo.id);
          if (age > 0) pendingMOs.push(mo);
        }
      }

      // returns
      if (age >= 1 && chance(0.28)) {
        const cands = db.salesOrders.filter(s => s.status === 'Delivered' && s.date >= S.addDays(iso, -8) && s.date < iso && !db.returns.some(r => r.soId === s.id));
        if (cands.length) {
          const so = pick(cands); const a = pick(so.allocations);
          const [reason, action] = pick(RETURN_REASONS);
          S.setClock(at(iso, 17, rint(0, 50))); asUser('Vikram Joshi');
          S.createReturn({ soId: so.id, date: iso, reason, lines: [{ batchId: a.batchId, qty: Math.max(1, Math.round(a.qty * rnd(0.04, 0.15))), action }] });
        }
      }
      // adjustments: weekly expired write-off (not in the last week, so alerts remain visible) + occasional damage
      if (d % 7 === 6 && age > 6) {
        S.setClock(at(iso, 18, 30)); asUser('Sneha Patil');
        try { S.writeOffExpired(); } catch { /* none */ }
      }
      if (chance(0.16)) {
        const b = pick(db.batches.filter(x => x.qty > 24 && S.item(x.itemId).type === 'finished'));
        if (b) {
          S.setClock(at(iso, 19, rint(0, 50))); asUser(pick(['Sneha Patil', 'Imran Shaikh', 'Kavya Reddy']));
          S.createAdjustment({ whId: b.whId, type: pick(['Damage', 'Damage', 'Pest / Leakage', 'QC Sample']), reason: pick(['Pouch puncture during handling', 'Dropped carton at loading bay', 'Retained QC sample', 'Seal failure found in inspection']), lines: [{ batchId: b.id, qty: -rint(2, 12) }] });
        }
      }
      if (age > 0 && age % 15 === 0) {
        const b = pick(db.batches.filter(x => x.qty > 50 && S.item(x.itemId).type !== 'finished'));
        if (b) { S.setClock(at(iso, 19, 40)); asUser('Sneha Patil'); S.createAdjustment({ whId: b.whId, type: 'Cycle Count', reason: 'Monthly cycle count variance', lines: [{ batchId: b.id, qty: S.round(-b.qty * rnd(0.003, 0.012), 2) }] }); }
      }
      // temperature logs (last 21 days)
      if (age <= 21) {
        for (const w of db.warehouses) {
          const hours = w.type === 'Cold Storage' ? [6, 14, 22] : [10];
          for (const h of hours) {
            const ts = new Date(iso + 'T00:00:00').getTime() + h * 3600000 + rint(0, 20) * 60000;
            if (ts > realNow) continue;
            S.setClock(ts);
            const exc = w.type === 'Cold Storage' && chance(0.025);
            const temp = w.type === 'Cold Storage' ? (exc ? rnd(4.6, 6.8) : rnd(1.4, 3.7)) : rnd(22, 29);
            S.setUser({ id: 'iot', name: 'IoT Sensor' });
            S.logTemp({ whId: w.id, temp: S.round(temp, 1), note: exc ? 'Door left ajar during loading' : '' });
          }
        }
      }
    }

    // Final touches to make the demo state rich
    S.setClock(realNow - 5 * 3600000); S.setUser({ id: 'iot', name: 'IoT Sensor' });
    S.logTemp({ whId: whId.BLR, temp: 5.8, note: 'Compressor defrost cycle overrun' });
    S.setClock(realNow - 4 * 3600000);
    S.logTemp({ whId: whId.BLR, temp: 3.1, note: 'Recovered' });
    const mint = db.items.find(i => i.code === 'TMC2');
    const old = S.addDays(todayIso, -19);
    S.setClock(realNow - 9 * 86400000); asUser('Imran Shaikh');
    const eb = S.newBatch({ itemId: mint.id, whId: whId.MUM, qty: 36, cost: mint.cost, mfg: old, batchNo: `${mint.code}-${old.slice(2).replace(/-/g, '')}-R`, source: 'Return', ref: 'Quarantine release' });
    S.move('ADJ', eb, 36, 'Quarantine release', 'Released from QC hold');

    // "Work in flight" so every workflow can be demonstrated immediately
    S.setClock(realNow - 3 * 3600000); asUser('Sneha Patil');
    const byCover = fgs.filter(f => !db.productions.some(m => m.itemId === f.id && ['Planned', 'In Progress'].includes(m.status)))
      .sort((a, b) => S.stock(a.id) / a.demand - S.stock(b.id) / b.demand);
    const wip = byCover.find(f => !S.requirements(f.id, roundTo(f.demand * 2, 50)).some(r => !r.ok));
    if (wip) { const m1 = S.createMO({ itemId: wip.id, qty: roundTo(wip.demand * 2, 50), whId: whId.PUN, date: todayIso, shift: 'Morning', notes: 'Day-shift run' }); S.setClock(realNow - 2 * 3600000); S.startMO(m1.id); }
    S.setClock(realNow - 100 * 60000);
    const nxt = byCover.find(f => f !== wip);
    if (nxt) S.createMO({ itemId: nxt.id, qty: roundTo(nxt.demand * 3, 50), whId: whId.PUN, date: S.addDays(todayIso, 1), shift: 'Night', notes: 'Planned for tonight' });
    const jar = db.items.find(i => i.code === 'PJR');
    const target = Math.round(jar.reorderLevel * 0.45);
    let excess = S.stock(jar.id) - target;
    if (excess > 0) {
      db.purchaseOrders.filter(p => p.status === 'Issued' && p.lines.some(l => l.itemId === jar.id)).forEach(p => S.receivePO(p.id, p.lines.map((l, idx) => ({ idx, qty: l.qty - l.received, whId: whId.DRY }))));
      excess = S.stock(jar.id) - target;
      const jarBatches = db.batches.filter(b => b.itemId === jar.id && b.qty > 0);
      S.setClock(realNow - 80 * 60000); asUser('Sneha Patil');
      const lines = [];
      for (const b of jarBatches) { if (excess <= 0) break; const q = Math.min(b.qty, excess); lines.push({ batchId: b.id, qty: -q }); excess -= q; }
      if (lines.length) S.createAdjustment({ whId: whId.DRY, type: 'Damage', reason: 'Pallet collapse during unloading — glass breakage', lines });
    }
    const fresh = db.vendors.find(v => v.key === 'fresh'), pack = db.vendors.find(v => v.key === 'pack');
    S.setClock(realNow - 60 * 60000);
    const p1 = S.savePO({ vendorId: fresh.id, date: todayIso, expected: S.addDays(todayIso, 1), whId: whId.DRY, notes: 'Weekly fresh produce', lines: db.items.filter(i => i.vendorId === fresh.id).map(i => ({ itemId: i.id, qty: i.orderQty, rate: i.cost, gst: i.gst })) });
    S.issuePO(p1.id);
    S.savePO({ vendorId: pack.id, date: todayIso, expected: S.addDays(todayIso, 4), whId: whId.DRY, notes: 'Draft — awaiting price confirmation', lines: db.items.filter(i => i.vendorId === pack.id).slice(0, 3).map(i => ({ itemId: i.id, qty: i.orderQty, rate: i.cost, gst: i.gst })) });

    db.movements.sort((a, b) => a.ts - b.ts);
    db.activity.sort((a, b) => b.ts - a.ts);
    db.activity.length = Math.min(db.activity.length, 500);
    db.tempLogs.sort((a, b) => a.ts - b.ts);
    S.setClock(null);
    S.setSilent(false);
    if (onProgress) onProgress(1);
    return db;
  }

  /* ---------- On-demand sample generators (per module) ---------- */
  const EXTRA_ITEMS = [
    ['FG-TOF-SL300', 'TSL3', 'Silken Tofu 300 g', 'Tofu', 'Aseptic carton', 130, 104, 5, 45, '#475569'],
    ['FG-TOF-TK200', 'TTK2', 'Tikka Tofu Cubes 200 g', 'Tofu', '200 g vacuum pack', 150, 120, 5, 20, '#c2410c'],
    ['FG-TMP-PL200', 'TMP2', 'Tempeh – Classic 200 g', 'Tempeh', '200 g vacuum pack', 160, 128, 5, 25, '#78350f'],
    ['FG-SMK-UN1L', 'SMU1', 'Soya Milk – Unsweetened 1 L', 'Soya Milk', '1 L Tetra pack', 110, 88, 5, 120, '#0369a1'],
    ['FG-YGT-VN100', 'YVN1', 'Plant Yogurt – Vanilla 100 g', 'Plant Yogurt', '100 g cup', 60, 48, 5, 21, '#ca8a04'],
    ['FG-CHP-AF250', 'CAF2', 'Afghani Soya Chaap 250 g', 'Soya Chaap', '250 g tray pack', 150, 120, 5, 12, '#9a3412'],
    ['FG-SPR-CH150', 'SCH1', 'Plant Cheesy Spread – Chipotle 150 g', 'Cheesy Spread', '150 g tub', 185, 148, 12, 60, '#b91c1c'],
    ['FG-NUG-SY250', 'NUG2', 'Soya Protein Nuggets 250 g', 'Soya Snacks', '250 g pouch', 95, 76, 12, 270, '#a16207'],
  ];
  const EXTRA_CUSTOMERS = [
    ['Nashik Fresh Traders', 'Distributor', 'PUN', 'Nashik', 'Maharashtra'], ['Urban Pantry – Viman Nagar', 'Retailer', 'PUN', 'Pune', 'Maharashtra'],
    ['Bowl & Basil Cloud Kitchen', 'HoReCa', 'PUN', 'Pune', 'Maharashtra'], ['GreenCart Grocery App', 'E-commerce', 'MUM', 'Mumbai', 'Maharashtra'],
    ['Powai Organics', 'Retailer', 'MUM', 'Mumbai', 'Maharashtra'], ['Indiranagar Health Store', 'Retailer', 'BLR', 'Bengaluru', 'Karnataka'],
    ['Metro Value Mart', 'Modern Trade', 'MUM', 'Thane', 'Maharashtra'], ['Whitefield Vegan Bistro', 'HoReCa', 'BLR', 'Bengaluru', 'Karnataka'],
  ];
  const EXTRA_VENDORS = [
    ['Vidarbha Soy Growers FPO', 'Nagpur', 'Maharashtra', 'Grains & Pulses', 3], ['EcoPack Solutions', 'Chakan', 'Maharashtra', 'Packaging', 5],
    ['Kerala Spice Board Traders', 'Kochi', 'Kerala', 'Spices', 6], ['Himalayan Fruit Co.', 'Shimla', 'Himachal Pradesh', 'Fruit Bases', 6],
  ];

  function wrap(fn) {
    Store.setSilent(true);
    let n = 0;
    try { n = fn(); } finally { Store.setSilent(false); Store.commit('sample'); }
    return n;
  }
  const regionOf = c => c.regionWh;

  const Sample = {
    items: (k = 2) => wrap(() => {
      const db = Store.db; let n = 0;
      for (const e of EXTRA_ITEMS) {
        if (n >= k) break;
        if (db.items.some(i => i.sku === e[0])) continue;
        const [sku, code, name, category, pack, mrp, price, gst, shelf, color] = e;
        Store.saveItem({ sku, code, name, type: 'finished', category, uom: 'pcs', packSize: pack, mrp, price, cost: Math.round(price * 0.52), gst, hsn: '21069099', shelfLife: shelf, storage: shelf > 100 ? 'Ambient (<30°C)' : 'Chilled 0–4°C', weightKg: 0.2, demand: 60, convCost: 5, reorderLevel: 120, color, barcode: '890' + rint(1000000000, 9999999999) });
        n++;
      }
      if (!n) throw new Error('All sample products are already in the catalog');
      return n;
    }),
    customers: (k = 2) => wrap(() => {
      const db = Store.db; let n = 0;
      for (const c of EXTRA_CUSTOMERS.sort(() => Math.random() - 0.5)) {
        if (n >= k) break;
        if (db.customers.some(x => x.name === c[0])) continue;
        const w = db.warehouses.find(x => x.key === c[2]);
        Store.saveCustomer({ name: c[0], type: c[1], regionWh: w?.id || db.warehouses[0].id, city: c[3], state: c[4], creditDays: c[1] === 'Distributor' ? 21 : 10, creditLimit: c[1] === 'Distributor' ? 1000000 : 150000, contact: pick(['Rohit Kale', 'Anjali Desai', 'Manoj Pillai', 'Sana Qureshi']), phone: `+91 9${rint(100000000, 999999999)}`, email: `buy@${c[0].toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.example`, gstin: `${c[4] === 'Karnataka' ? 29 : 27}AAD${c[0][0]}${rint(1000, 9999)}R1Z${rint(1, 9)}`, route: `${c[3]} – Central`, discount: TYPE_DISC[c[1]] });
        n++;
      }
      if (!n) throw new Error('All sample customers already exist');
      return n;
    }),
    vendors: (k = 2) => wrap(() => {
      const db = Store.db; let n = 0;
      for (const v of EXTRA_VENDORS) {
        if (n >= k) break;
        if (db.vendors.some(x => x.name === v[0])) continue;
        Store.saveVendor({ name: v[0], city: v[1], state: v[2], category: v[3], leadDays: v[4], contact: pick(['Sunil Rane', 'Lata Iyer', 'George Mathew']), rating: +rnd(3.8, 4.8).toFixed(1), phone: `+91 9${rint(100000000, 999999999)}`, email: `sales@${v[0].toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.example`, gstin: `27AAE${v[0][0]}${rint(1000, 9999)}Q1Z${rint(1, 9)}`, paymentTerms: 'Net 30' });
        n++;
      }
      if (!n) throw new Error('All sample vendors already exist');
      return n;
    }),
    salesOrders: (k = 4) => wrap(() => {
      const db = Store.db; let n = 0;
      const fgs = db.items.filter(i => i.type === 'finished' && i.active);
      for (let i = 0; i < k * 3 && n < k; i++) {
        const c = pick(db.customers.filter(x => x.active !== false));
        const w = regionOf(c);
        const lines = fgs.filter(() => chance(TYPE_P[c.type] * 0.6)).slice(0, 5).map(f => {
          const avail = Store.stock(f.id, w);
          const q = Math.min(roundTo((f.demand || 60) * 0.3 * TYPE_W[c.type] / 3, 6), Math.floor(avail * 0.5 / 6) * 6);
          return { itemId: f.id, qty: q, rate: f.price, gst: f.gst, disc: TYPE_DISC[c.type] };
        }).filter(l => l.qty > 0);
        if (!lines.length) continue;
        const so = Store.saveSO({ customerId: c.id, date: Store.today(), whId: w, lines, ref: `PO/${rint(1000, 9999)}` });
        if (chance(0.6)) Store.confirmSO(so.id);
        n++;
      }
      if (!n) throw new Error('Not enough stock to create sample orders — run production first');
      return n;
    }),
    purchaseOrders: (k = 2) => wrap(() => {
      const db = Store.db; let n = 0;
      const vs = [...db.vendors].sort(() => Math.random() - 0.5);
      for (const v of vs) {
        if (n >= k) break;
        const its = db.items.filter(i => i.vendorId === v.id);
        if (!its.length) continue;
        const dry = db.warehouses.find(w => w.type === 'Dry Store') || db.warehouses[0];
        const po = Store.savePO({ vendorId: v.id, date: Store.today(), expected: Store.addDays(Store.today(), v.leadDays || 3), whId: dry.id, notes: 'Sample purchase order', lines: its.map(i => ({ itemId: i.id, qty: i.orderQty || 100, rate: i.cost, gst: i.gst })) });
        if (chance(0.6)) Store.issuePO(po.id);
        n++;
      }
      return n;
    }),
    production: (k = 2) => wrap(() => {
      const db = Store.db; let n = 0;
      const plant = db.warehouses.find(w => w.isPlant && w.type === 'Cold Storage') || db.warehouses[0];
      const fgs = db.items.filter(i => i.type === 'finished' && Store.bomFor(i.id)).sort((a, b) => Store.stock(a.id) / (a.demand || 1) - Store.stock(b.id) / (b.demand || 1));
      for (const f of fgs) {
        if (n >= k) break;
        const qty = roundTo((f.demand || 100) * 2, 50);
        Store.createMO({ itemId: f.id, qty, whId: plant.id, date: Store.today(), shift: pick(['Morning', 'Evening']), notes: 'Sample production plan' });
        n++;
      }
      return n;
    }),
    transfers: (k = 1) => wrap(() => {
      const db = Store.db; let n = 0;
      const src = db.warehouses.find(w => w.isPlant && w.type === 'Cold Storage');
      const hubs = db.warehouses.filter(w => w.type === 'Cold Storage' && w.id !== src.id);
      for (const hub of hubs.sort(() => Math.random() - 0.5)) {
        if (n >= k) break;
        const lines = [];
        for (const f of db.items.filter(i => i.type === 'finished').sort(() => Math.random() - 0.5).slice(0, 4)) {
          const s = Store.stock(f.id, src.id);
          const q = Math.floor(s * 0.15 / 12) * 12;
          if (q > 0) for (const p of Store.allocate(f.id, src.id, q)) lines.push({ batchId: p.batch.id, qty: p.qty });
        }
        if (!lines.length) continue;
        Store.createTransfer({ from: src.id, to: hub.id, date: Store.today(), vehicle: pick(VEHICLES), lines, notes: 'Sample hub replenishment' });
        n++;
      }
      if (!n) throw new Error('Not enough stock at the plant to transfer');
      return n;
    }),
    adjustments: (k = 1) => wrap(() => {
      const db = Store.db; let n = 0;
      for (let i = 0; i < k; i++) {
        const b = pick(db.batches.filter(x => x.qty > 20 && Store.isUsable(x)));
        if (!b) break;
        Store.createAdjustment({ whId: b.whId, type: pick(['Damage', 'Cycle Count', 'QC Sample']), reason: pick(['Damaged packs found during put-away', 'Physical count variance', 'Retained for lab testing']), lines: [{ batchId: b.id, qty: -Math.min(b.qty, rint(2, 10)) }] });
        n++;
      }
      return n;
    }),
    returns: (k = 1) => wrap(() => {
      const db = Store.db; let n = 0;
      const cands = db.salesOrders.filter(s => ['Delivered', 'Dispatched'].includes(s.status) && s.allocations.length).slice(0, 40);
      for (let i = 0; i < k && cands.length; i++) {
        const so = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
        const a = so.allocations.find(x => x.qty - Store.returnedQty(so.id, x.batchId) > 2);
        if (!a) continue;
        const [reason, action] = pick(RETURN_REASONS);
        Store.createReturn({ soId: so.id, reason, lines: [{ batchId: a.batchId, qty: Math.max(1, Math.round(a.qty * 0.08)), action }] });
        n++;
      }
      if (!n) throw new Error('No eligible delivered orders found');
      return n;
    }),
    temps: () => wrap(() => {
      const db = Store.db; let n = 0;
      for (const w of db.warehouses) {
        const cold = w.type === 'Cold Storage';
        Store.logTemp({ whId: w.id, temp: Store.round(cold ? (chance(0.12) ? rnd(4.4, 6) : rnd(1.5, 3.6)) : rnd(22, 29), 1), note: 'Manual reading' });
        n++;
      }
      return n;
    }),
    receipts: () => wrap(() => {
      const db = Store.db;
      const po = db.purchaseOrders.find(p => p.status === 'Issued');
      if (!po) throw new Error('No issued purchase orders to receive — create one first');
      Store.receivePO(po.id, po.lines.map((l, idx) => ({ idx, qty: l.qty - l.received, lot: `V${rint(100000, 999999)}`, whId: Store.item(l.itemId).cold ? (db.warehouses.find(w => w.isPlant && w.type === 'Cold Storage')?.id) : po.whId })));
      return po.lines.length;
    }),
  };

  return { build, Sample };
})();
