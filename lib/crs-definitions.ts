import proj4 from 'proj4';

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
};

// Register key Proj4 definitions for Middle East & Global standard surveying datums
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
  },
  {
    code: 'EPSG:20499',
    name: 'Ain el Abd 1970 / Aramco Lambert',
    nameEn: 'Ain el Abd 1970 / Aramco Lambert',
    nameAr: 'عين العبد 1970 (النظام السعودي القديم / أرامكو)',
    region: 'Saudi Arabia / KSA',
    category: 'المملكة العربية السعودية',
    proj4def:
      '+proj=lcc +lat_1=17 +lat_2=32 +lat_0=24.5 +lon_0=45 +x_0=2000000 +y_0=2000000 +ellps=intl +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
  },
  {
    code: 'EPSG:22992',
    name: 'Egypt 1907 / Red Belt',
    nameEn: 'Egypt 1907 / Red Belt',
    nameAr: 'مصر 1907 / الحزام الأحمر (القاهرة، الدلتا، الصعيد)',
    region: 'Egypt / مصر',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=31 +k=1 +x_0=615000 +y_0=810000 +ellps=helmert +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
  },
  {
    code: 'EPSG:22993',
    name: 'Egypt 1907 / Purple Belt',
    nameEn: 'Egypt 1907 / Purple Belt',
    nameAr: 'مصر 1907 / الحزام البنفسجي (سيناء، البحر الأحمر)',
    region: 'Egypt / سيناء',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=35 +k=1 +x_0=300000 +y_0=1100000 +ellps=helmert +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
  },
  {
    code: 'EPSG:22994',
    name: 'Egypt 1907 / Blue Belt',
    nameEn: 'Egypt 1907 / Blue Belt',
    nameAr: 'مصر 1907 / الحزام الأزرق (الصحراء الغربية)',
    region: 'Egypt / الصحراء الغربية',
    category: 'جمهورية مصر العربية',
    proj4def:
      '+proj=tmerc +lat_0=30 +lon_0=27 +k=1 +x_0=300000 +y_0=1100000 +ellps=helmert +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
  },
  {
    code: 'EPSG:28191',
    name: 'Palestine 1923 / Palestine Grid / JTM',
    nameEn: 'Palestine 1923 / JTM Grid',
    nameAr: 'فلسطين 1923 / الشبكة الأردنية والفلسطينية',
    region: 'Jordan / Palestine',
    category: 'بلاد الشام',
    proj4def:
      '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=1126867.909 +a=6378300.789 +b=6356566.435 +units=m +no_defs',
    unit: 'meter',
    type: 'PROJECTED',
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
