import proj4 from 'proj4';

export type CRSValidationLevel = 'AUTHORITATIVE_GEODETIC' | 'REQUIRES_CONTROL_VALIDATION' | 'PROJECTED_ONLY';

export type CRSDefinition = {
  code: string;
  name: string;
  nameEn: string;
  nameAr: string;
  region: string;
  category: string;
  proj4def: string;
  unit: 'meter' | 'degree' | 'us-ft';
  type: 'GEOGRAPHIC_2D' | 'PROJECTED';
  datumName: string;
  ellipsoid: string;
  validationLevel: CRSValidationLevel;
  transformationNoteAr: string;
  expectedAccuracy: string;
};

// Register key Proj4 definitions for Middle East & Global standard surveying datums
// Datum shifts (+towgs84) are documented with authoritative geodetic source references.
export const SUPPORTED_CRS: CRSDefinition[] = [
  {
    code: 'EPSG:4326',
    name: 'WGS 84 (Geographic 2D)',
    nameEn: 'WGS 84 (Latitude / Longitude)',
    nameAr: 'نظام WGS 84 الجغرافي (درجات خط الطول والعرض)',
    region: 'Global / عالمي',
    category: 'عالمي (Global)',
    proj4def: '+proj=longlat +datum=WGS84 +no_defs',
    unit: 'degree',
    type: 'GEOGRAPHIC_2D',
    datumName: 'World Geodetic System 1984',
    ellipsoid: 'WGS 84 (a=6378137.0, 1/f=298.257223563)',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'المرجع الجيوديسي العالمي القياسي (GNSS / GPS).',
    expectedAccuracy: 'Millimeter level (Mathematical identity / Base geodetic frame)',
  },
  {
    code: 'EPSG:3857',
    name: 'WGS 84 / Pseudo-Mercator',
    nameEn: 'WGS 84 / Web Mercator',
    nameAr: 'نظام ويب ميركاتور (Web Mercator)',
    region: 'Global / خرائط الويب',
    category: 'عالمي (Global)',
    proj4def:
      '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84 (Spherical)',
    ellipsoid: 'WGS 84 Major Axis Sphere',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط كروي مخصص لخرائط الويب والبلاطات الرقمية (Google/OSM).',
    expectedAccuracy: 'Sub-millimeter conformal conversion to spherical Web Mercator',
  },
  {
    code: 'EPSG:32636',
    name: 'WGS 84 / UTM Zone 36N',
    nameEn: 'UTM Zone 36N',
    nameAr: 'UTM زون 36 شمالاً (مصر الغربية، السودان)',
    region: 'Egypt / Sudan',
    category: 'UTM Zones',
    proj4def: '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84',
    ellipsoid: 'WGS 84',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط ميركاتور المستعرض العالمي UTM لنطاق خط طول 30° إلى 36° شرقاً.',
    expectedAccuracy: 'Exact mathematical Transverse Mercator mapping',
  },
  {
    code: 'EPSG:32637',
    name: 'WGS 84 / UTM Zone 37N',
    nameEn: 'UTM Zone 37N',
    nameAr: 'UTM زون 37 شمالاً (مصر الشرقية، غرب السعودية، الأردن)',
    region: 'KSA West / Egypt East / Jordan',
    category: 'UTM Zones',
    proj4def: '+proj=utm +zone=37 +datum=WGS84 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84',
    ellipsoid: 'WGS 84',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط UTM لنطاق خط طول 36° إلى 42° شرقاً.',
    expectedAccuracy: 'Exact mathematical Transverse Mercator mapping',
  },
  {
    code: 'EPSG:32638',
    name: 'WGS 84 / UTM Zone 38N',
    nameEn: 'UTM Zone 38N',
    nameAr: 'UTM زون 38 شمالاً (وسط وشرق السعودية، العراق، الكويت)',
    region: 'KSA Central / Iraq / Kuwait',
    category: 'UTM Zones',
    proj4def: '+proj=utm +zone=38 +datum=WGS84 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84',
    ellipsoid: 'WGS 84',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط UTM لنطاق خط طول 42° إلى 48° شرقاً.',
    expectedAccuracy: 'Exact mathematical Transverse Mercator mapping',
  },
  {
    code: 'EPSG:32639',
    name: 'WGS 84 / UTM Zone 39N',
    nameEn: 'UTM Zone 39N',
    nameAr: 'UTM زون 39 شمالاً (الإمارات، قطر، شرق السعودية، عمان)',
    region: 'UAE / Qatar / Oman / KSA East',
    category: 'UTM Zones',
    proj4def: '+proj=utm +zone=39 +datum=WGS84 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84',
    ellipsoid: 'WGS 84',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط UTM لنطاق خط طول 48° إلى 54° شرقاً.',
    expectedAccuracy: 'Exact mathematical Transverse Mercator mapping',
  },
  {
    code: 'EPSG:32640',
    name: 'WGS 84 / UTM Zone 40N',
    nameEn: 'UTM Zone 40N',
    nameAr: 'UTM زون 40 شمالاً (شرق عمان، الخليج العربي)',
    region: 'Oman East / Arabian Sea',
    category: 'UTM Zones',
    proj4def: '+proj=utm +zone=40 +datum=WGS84 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'WGS 84',
    ellipsoid: 'WGS 84',
    validationLevel: 'AUTHORITATIVE_GEODETIC',
    transformationNoteAr: 'إسقاط UTM لنطاق خط طول 54° إلى 60° شرقاً.',
    expectedAccuracy: 'Exact mathematical Transverse Mercator mapping',
  },
  {
    code: 'EPSG:20438',
    name: 'Ain el Abd 1970 / UTM Zone 38N',
    nameEn: 'Ain el Abd 1970 / UTM Zone 38N',
    nameAr: 'عين العبد 1970 / UTM زون 38 شمالاً (السعودية، الكويت)',
    region: 'Saudi Arabia / Kuwait',
    category: 'المملكة العربية السعودية',
    proj4def:
      '+proj=utm +zone=38 +ellps=intl +towgs84=-143,-236,7,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Ain el Abd 1970',
    ellipsoid: 'International 1924 (Hayford 1909)',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط UTM مع إزاحة عين العبد الإقليمية المعيارية (+towgs84=-143,-236,7). يتطلب تدقيق مع نقاط تحكم محلية (GCPs).',
    expectedAccuracy: 'Regional datum shift ~5m-10m without local site calibration',
  },
  {
    code: 'EPSG:20439',
    name: 'Ain el Abd 1970 / UTM Zone 39N',
    nameEn: 'Ain el Abd 1970 / UTM Zone 39N',
    nameAr: 'عين العبد 1970 / UTM زون 39 شمالاً (السعودية الشرقية، قطر)',
    region: 'Saudi Arabia East / Qatar',
    category: 'المملكة العربية السعودية',
    proj4def:
      '+proj=utm +zone=39 +ellps=intl +towgs84=-143,-236,7,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Ain el Abd 1970',
    ellipsoid: 'International 1924 (Hayford 1909)',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط UTM زون 39 مع إزاحة عين العبد الإقليمية المعيارية (+towgs84=-143,-236,7).',
    expectedAccuracy: 'Regional datum shift ~5m-10m without local site calibration',
  },
  {
    code: 'EPSG:20499',
    name: 'Ain el Abd 1970 / Aramco Lambert',
    nameEn: 'Ain el Abd 1970 / Aramco Lambert',
    nameAr: 'عين العبد 1970 (النظام السعودي القديم / أرامكو)',
    region: 'Saudi Arabia / KSA',
    category: 'المملكة العربية السعودية',
    proj4def:
      '+proj=lcc +lat_1=17 +lat_2=32 +lat_0=24.5 +lon_0=45 +x_0=2000000 +y_0=2000000 +ellps=intl +towgs84=-143,-236,7,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Ain el Abd 1970',
    ellipsoid: 'International 1924 (Hayford 1909)',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط لامبرت المخروطي مع إزاحة عين العبد الإقليمية المعيارية (+towgs84=-143,-236,7). يتطلب تدقيق مع نقاط تحكم محلية للرفع المساحي عالي الدقة.',
    expectedAccuracy: 'Regional datum shift ~5m-10m without local site calibration',
  },
  {
    code: 'EPSG:22992',
    name: 'Egypt 1907 / Red Belt',
    nameEn: 'Egypt 1907 / Red Belt',
    nameAr: 'مصر 1907 / الحزام الأحمر (القاهرة، الدلتا، الصعيد)',
    region: 'Egypt / مصر',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=31 +k=1 +x_0=615000 +y_0=810000 +ellps=helmert +towgs84=-130,110,-13,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Egypt 1907',
    ellipsoid: 'Helmert 1906 (a=6378200.0, 1/f=298.3)',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط ميركاتور المستعرض للحزام الأحمر المصري (خط الزوال 31°E) مع تحويل إزاحة الهيئة المصرية للمساحة / DMA (+towgs84=-130,110,-13). يلزم التحقق من نقاط الثوابت الأرضية (GCPs).',
    expectedAccuracy: 'Regional transformation ~3m-5m without local site calibration',
  },
  {
    code: 'EPSG:22993',
    name: 'Egypt 1907 / Purple Belt',
    nameEn: 'Egypt 1907 / Purple Belt',
    nameAr: 'مصر 1907 / الحزام البنفسجي (سيناء، البحر الأحمر)',
    region: 'Egypt / سيناء',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=35 +k=1 +x_0=300000 +y_0=1100000 +ellps=helmert +towgs84=-130,110,-13,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Egypt 1907',
    ellipsoid: 'Helmert 1906',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط الحزام البنفسجي لسيناء والبحر الأحمر (خط الزوال 35°E) مع إزاحة مصر 1907 (+towgs84=-130,110,-13).',
    expectedAccuracy: 'Regional transformation ~3m-5m without local site calibration',
  },
  {
    code: 'EPSG:22994',
    name: 'Egypt 1907 / Blue Belt',
    nameEn: 'Egypt 1907 / Blue Belt',
    nameAr: 'مصر 1907 / الحزام الأزرق (الصحراء الغربية)',
    region: 'Egypt / الصحراء الغربية',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=27 +k=1 +x_0=300000 +y_0=1100000 +ellps=helmert +towgs84=-130,110,-13,0,0,0,0 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Egypt 1907',
    ellipsoid: 'Helmert 1906',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط الحزام الأزرق للصحراء الغربية ومطروح (خط الزوال 27°E) مع إزاحة مصر 1907 (+towgs84=-130,110,-13).',
    expectedAccuracy: 'Regional transformation ~3m-5m without local site calibration',
  },
  {
    code: 'EPSG:28191',
    name: 'Palestine 1923 / Palestine Grid / JTM',
    nameEn: 'Palestine 1923 / JTM Grid',
    nameAr: 'فلسطين 1923 / الشبكة الأردنية والفلسطينية',
    region: 'Jordan / Palestine',
    category: 'بلاد الشام',
    proj4def:
      '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=1126867.909 +a=6378300.789 +b=6356566.435 +towgs84=-275.7,94.7,340.5,8.001,-4.42,-11.82,1 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
    datumName: 'Palestine 1923',
    ellipsoid: 'Clarke 1880 (Benoit)',
    validationLevel: 'REQUIRES_CONTROL_VALIDATION',
    transformationNoteAr:
      'إسقاط كاسيني-سولدز مع تحويل سباعي البارامترات. يتطلب تدقيق مع شبكة المثلثات الوطنية.',
    expectedAccuracy: 'Regional transformation ~1m-3m without local site calibration',
  },
];

// Initialize all custom proj4 definitions once
SUPPORTED_CRS.forEach((crs) => {
  try {
    proj4.defs(crs.code, crs.proj4def);
  } catch (e) {
    console.error(`Failed to register CRS ${crs.code}:`, e);
  }
});

/**
 * Automatically calculates the appropriate UTM zone for a given Longitude / Latitude
 */
export function getAutoUtmZone(
  lng: number,
  lat: number
): { zone: number; epsg: string; name: string } {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const isNorth = lat >= 0;
  const epsgCode = isNorth ? 32600 + zone : 32700 + zone;
  const epsg = `EPSG:${epsgCode}`;

  const projDef = `+proj=utm +zone=${zone} ${
    isNorth ? '' : '+south '
  }+datum=WGS84 +units=m +no_defs`;
  try {
    proj4.defs(epsg, projDef);
  } catch {}

  return {
    zone,
    epsg,
    name: `WGS 84 / UTM Zone ${zone}${isNorth ? 'N' : 'S'}`,
  };
}

/**
 * Transforms coordinates between any two registered CRSs (2D)
 */
export function transformCoordinate(
  x: number,
  y: number,
  fromEpsg: string,
  toEpsg: string
): { x: number; y: number } {
  if (fromEpsg === toEpsg) {
    return { x, y };
  }
  const result = proj4(fromEpsg, toEpsg, [x, y]);
  return { x: result[0], y: result[1] };
}

/**
 * Transforms coordinates with optional 3D elevation retention
 */
export function transformCoordinates(
  x: number,
  y: number,
  z: number = 0,
  fromEpsg: string,
  toEpsg: string
): { x: number; y: number; z: number } {
  if (fromEpsg === toEpsg) {
    return { x, y, z };
  }
  const result = proj4(fromEpsg, toEpsg, [x, y]);
  return { x: result[0], y: result[1], z };
}
