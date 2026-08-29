import type { PointRecord, ProjectRecord } from '@/lib/db';
import { SUPPORTED_CRS, transformCoordinates } from '@/lib/crs-definitions';
import { calculatePolygonArea, calculatePolygonPerimeter, calculatePolygonCentroid } from '@/lib/survey-calculations';

export type CsvColumnField =
  | 'pointNumber'
  | 'easting'
  | 'northing'
  | 'elevation'
  | 'description'
  | 'layer'
  | 'flagged';

export interface CsvExportOptions {
  columnOrder?: CsvColumnField[];
  delimiter?: string;
  precision?: number;
  includeHeader?: boolean;
  includeCommentHeader?: boolean;
  projectName?: string;
  crsCode?: string;
  selectedPointIds?: string[];
  flaggedOnly?: boolean;
  layerFilter?: string;
}

export interface TxtReportOptions {
  projectName?: string;
  crsCode?: string;
  surveyorName?: string;
  selectedPointIds?: string[];
  flaggedOnly?: boolean;
  layerFilter?: string;
}

export interface KmlExportOptions {
  includeBoundary?: boolean;
  altitudeMode?: 'clampToGround' | 'relativeToGround' | 'absolute';
  selectedPointIds?: string[];
  flaggedOnly?: boolean;
  layerFilter?: string;
}

export interface GeoJsonExportOptions {
  includeBoundary?: boolean;
  selectedPointIds?: string[];
  flaggedOnly?: boolean;
  layerFilter?: string;
}

/**
 * Filters points based on scope criteria
 */
export function filterExportPoints(
  points: PointRecord[],
  options: {
    selectedPointIds?: string[];
    flaggedOnly?: boolean;
    layerFilter?: string;
  }
): PointRecord[] {
  let result = [...points];

  if (options.flaggedOnly) {
    result = result.filter((p) => p.flagged === true);
  }

  if (options.selectedPointIds && options.selectedPointIds.length > 0) {
    const set = new Set(options.selectedPointIds);
    result = result.filter((p) => set.has(p.id));
  }

  if (options.layerFilter && options.layerFilter !== 'ALL') {
    result = result.filter((p) => (p.layer || 'POINTS') === options.layerFilter);
  }

  return result;
}

/**
 * Deterministic CSV string generator with custom column order, delimiter, and precision
 */
export function generateCSV(points: PointRecord[], options: CsvExportOptions = {}): string {
  const {
    columnOrder = ['pointNumber', 'easting', 'northing', 'elevation', 'description'],
    delimiter = ',',
    precision = 4,
    includeHeader = true,
    includeCommentHeader = false,
    projectName = 'Survey_Project',
    crsCode = 'EPSG:32638',
  } = options;

  const filteredPoints = filterExportPoints(points, options);

  const lines: string[] = [];

  if (includeCommentHeader) {
    lines.push(`# Project: ${projectName}`);
    lines.push(`# CRS: ${crsCode}`);
    lines.push(`# Date: ${new Date().toISOString()}`);
    lines.push(`# Total Points: ${filteredPoints.length}`);
    lines.push('# ----------------------------------------');
  }

  const columnHeaders: Record<CsvColumnField, string> = {
    pointNumber: 'Point#',
    easting: 'Easting_X',
    northing: 'Northing_Y',
    elevation: 'Elevation_Z',
    description: 'Description',
    layer: 'Layer',
    flagged: 'QA_Flag',
  };

  if (includeHeader) {
    const headerRow = columnOrder.map((col) => columnHeaders[col] || col).join(delimiter);
    lines.push(headerRow);
  }

  filteredPoints.forEach((p) => {
    const rowValues = columnOrder.map((col) => {
      switch (col) {
        case 'pointNumber':
          return String(p.pointNumber);
        case 'easting':
          return p.easting.toFixed(precision);
        case 'northing':
          return p.northing.toFixed(precision);
        case 'elevation':
          return p.elevation.toFixed(precision);
        case 'description': {
          const rawDesc = p.description || '';
          return delimiter ? rawDesc.split(delimiter).join(' ') : rawDesc;
        }
        case 'layer':
          return p.layer || 'POINTS';
        case 'flagged':
          return p.flagged ? 'FLAGGED' : 'VALID';
        default:
          return '';
      }
    });
    lines.push(rowValues.join(delimiter));
  });

  return lines.join('\r\n');
}

/**
 * Deterministic Professional Surveying ASCII/TXT Report generator
 */
export function generateSurveyReportTXT(
  project: Partial<ProjectRecord>,
  points: PointRecord[],
  options: TxtReportOptions = {}
): string {
  const filteredPoints = filterExportPoints(points, options);
  const projName = options.projectName || project.name || 'مشروع رفع مساحي هندسي';
  const crs = options.crsCode || project.crsCode || 'EPSG:32638';
  const surveyor = options.surveyorName || 'مساح معتمد';

  const crsDef = SUPPORTED_CRS.find((c) => c.code === crs);
  const validationText =
    crsDef?.validationLevel === 'AUTHORITATIVE_GEODETIC'
      ? 'تحويل جيوديسي مباشر ومعتمد رياضياً'
      : 'يتطلب ربط وضبط نقاط تحكم أرضية (GCP) للمطابقة المساحية';

  let areaM2 = 0;
  let perimeterM = 0;
  let centroidE = 0;
  let centroidN = 0;

  if (filteredPoints.length >= 3) {
    areaM2 = calculatePolygonArea(filteredPoints);
    perimeterM = calculatePolygonPerimeter(filteredPoints);
    const c = calculatePolygonCentroid(filteredPoints);
    centroidE = c.easting;
    centroidN = c.northing;
  }

  const flaggedCount = filteredPoints.filter((p) => p.flagged).length;

  const sepLine = '='.repeat(84);
  const subSepLine = '-'.repeat(84);

  const lines: string[] = [
    sepLine,
    `تقرير الرفع المساحي والتدقيق الهندسي - SURVEY ENGINEERING REPORT`,
    sepLine,
    `اسم المشروع:       ${projName}`,
    `تاريخ التقرير:     ${new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}`,
    `المساح المسئول:    ${surveyor}`,
    `نظام الإحداثيات:  ${crsDef ? `${crsDef.name} (${crsDef.code})` : crs}`,
    `مرجع الإسناد:      ${crsDef?.datumName || 'WGS84 / Local Grid'}`,
    `ملاحظة الدقة:      ${validationText}`,
    subSepLine,
    `ملخص إحصائيات المشروع:`,
    `  * عدد النقاط:              ${filteredPoints.length} نقطة`,
    `  * نقاط التدقيق والملاحظات: ${flaggedCount} نقطة معلمة`,
    `  * المساحة السطحية (2D):     ${areaM2 > 0 ? `${areaM2.toFixed(3)} م² (${(areaM2 / 4200.833).toFixed(4)} فدان)` : 'غير متوفر (أقل من 3 نقاط)'}`,
    `  * محيط المضلع الخارجي:     ${perimeterM > 0 ? `${perimeterM.toFixed(3)} م` : 'غير متوفر'}`,
    `  * مركز الثقل الهندسي:      ${centroidE > 0 ? `E: ${centroidE.toFixed(3)}, N: ${centroidN.toFixed(3)}` : 'غير متوفر'}`,
    sepLine,
    `جدول إحداثيات النقاط (COORDINATE SCHEDULE):`,
    subSepLine,
    `رقم النقطة   | الإحداثي الشرقي (E)  | الإحداثي الشمالي (N) | المنسوب (Z)  | الطبقة   | كود الوصف / الملاحظة`,
    subSepLine,
  ];

  filteredPoints.forEach((p) => {
    const ptStr = `P${p.pointNumber}`.padEnd(12, ' ');
    const eStr = p.easting.toFixed(4).padStart(20, ' ');
    const nStr = p.northing.toFixed(4).padStart(20, ' ');
    const zStr = p.elevation.toFixed(3).padStart(12, ' ');
    const lyrStr = (p.layer || 'POINTS').padEnd(9, ' ');
    const flagTag = p.flagged ? ` [FLAG: ${p.qaFlagReason || 'REVIEW'}]` : '';
    const descStr = (p.description || '') + flagTag;

    lines.push(`${ptStr}|${eStr}|${nStr}|${zStr}| ${lyrStr}| ${descStr}`);
  });

  lines.push(subSepLine);
  lines.push(`نهاية التقرير الهندسي - تم التوليد آلياً بواسطة محرك SurveyPro الهندسـي`);
  lines.push(sepLine);

  return lines.join('\r\n');
}

/**
 * Deterministic Google Earth KML string generator with CRS coordinate transformation
 */
export function generateKML(
  projectName: string,
  points: PointRecord[],
  crsCode: string,
  options: KmlExportOptions = {}
): { kml: string; warnings: string[]; pointCount: number } {
  const { includeBoundary = true, altitudeMode = 'clampToGround' } = options;
  const filteredPoints = filterExportPoints(points, options);

  const warnings: string[] = [];
  const crsDef = SUPPORTED_CRS.find((c) => c.code === crsCode);
  if (crsDef && crsDef.validationLevel === 'REQUIRES_CONTROL_VALIDATION') {
    warnings.push(
      `النظام ${crsDef.code} يتطلب ضبط جيوديسي محلي (GCP). تم استخدام التحويل التقريبي المعياري لـ Google Earth WGS84.`
    );
  }

  // Transform all points to WGS84 (lng, lat, z)
  const transformedPoints = filteredPoints
    .map((p) => {
      try {
        const wgs84 = transformCoordinates(p.easting, p.northing, p.elevation, crsCode, 'EPSG:4326');
        return {
          ...p,
          lng: wgs84.x,
          lat: wgs84.y,
          elev: wgs84.z ?? p.elevation,
        };
      } catch {
        warnings.push(`تعذر تحويل إحداثيات النقطة P${p.pointNumber} إلى WGS84.`);
        return null;
      }
    })
    .filter((pt): pt is NonNullable<typeof pt> => pt !== null);

  let placemarksXml = '';
  transformedPoints.forEach((p) => {
    placemarksXml += `    <Placemark>
      <name>P${p.pointNumber}</name>
      <description><![CDATA[
        <b>رقم النقطة:</b> P${p.pointNumber}<br/>
        <b>الوصف:</b> ${p.description || '—'}<br/>
        <b>الشرق (Easting):</b> ${p.easting.toFixed(3)} م<br/>
        <b>الشمال (Northing):</b> ${p.northing.toFixed(3)} م<br/>
        <b>المنسوب (Z):</b> ${p.elevation.toFixed(3)} م<br/>
        <b>نظام الإسناد:</b> ${crsCode}<br/>
        ${p.flagged ? `<b>حالة الجودة:</b> <span style="color:red;">معلمة للتدقيق: ${p.qaFlagReason || ''}</span>` : ''}
      ]]></description>
      <styleUrl>#surveyPointStyle</styleUrl>
      <Point>
        <altitudeMode>${altitudeMode}</altitudeMode>
        <coordinates>${p.lng.toFixed(8)},${p.lat.toFixed(8)},${p.elev.toFixed(3)}</coordinates>
      </Point>
    </Placemark>\n`;
  });

  let boundaryXml = '';
  if (includeBoundary && transformedPoints.length >= 3) {
    const coordsStr = [
      ...transformedPoints.map((p) => `${p.lng.toFixed(8)},${p.lat.toFixed(8)},${p.elev.toFixed(3)}`),
      `${transformedPoints[0].lng.toFixed(8)},${transformedPoints[0].lat.toFixed(8)},${transformedPoints[0].elev.toFixed(3)}`,
    ].join(' ');

    boundaryXml = `    <Placemark>
      <name>حدود المشروع - ${projectName}</name>
      <description>المضلع الخارجي المغلق لحدود رفع المشروع</description>
      <styleUrl>#boundaryStyle</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>${altitudeMode}</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>\n`;
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${projectName}</name>
    <description>تصدير بيانات الرفع المساحي من SurveyPro - CRS: ${crsCode}</description>
    <Style id="surveyPointStyle">
      <IconStyle>
        <color>ff00aaff</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>
    <Style id="boundaryStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>4400ffff</color>
      </PolyStyle>
    </Style>
${boundaryXml}${placemarksXml}  </Document>
</kml>`;

  return {
    kml,
    warnings,
    pointCount: transformedPoints.length,
  };
}

/**
 * Deterministic GeoJSON FeatureCollection generator (RFC 7946)
 */
export function generateGeoJSON(
  projectName: string,
  points: PointRecord[],
  crsCode: string,
  options: GeoJsonExportOptions = {}
): { geojson: string; warnings: string[]; pointCount: number } {
  const { includeBoundary = true } = options;
  const filteredPoints = filterExportPoints(points, options);
  const warnings: string[] = [];

  const features: any[] = [];
  const transformedPoints: Array<{ p: PointRecord; lng: number; lat: number }> = [];

  filteredPoints.forEach((p) => {
    try {
      const wgs84 = transformCoordinates(p.easting, p.northing, p.elevation, crsCode, 'EPSG:4326');
      transformedPoints.push({ p, lng: wgs84.x, lat: wgs84.y });

      features.push({
        type: 'Feature',
        id: p.id,
        geometry: {
          type: 'Point',
          coordinates: [wgs84.x, wgs84.y, p.elevation],
        },
        properties: {
          pointNumber: p.pointNumber,
          description: p.description || '',
          elevation: p.elevation,
          layer: p.layer || 'POINTS',
          flagged: Boolean(p.flagged),
          qaFlagReason: p.qaFlagReason || null,
          projectCrs: crsCode,
          gridEasting: p.easting,
          gridNorthing: p.northing,
        },
      });
    } catch {
      warnings.push(`تعذر تحويل إحداثيات النقطة P${p.pointNumber} إلى WGS84.`);
    }
  });

  if (includeBoundary && transformedPoints.length >= 3) {
    const polygonCoords = [
      ...transformedPoints.map((pt) => [pt.lng, pt.lat, pt.p.elevation]),
      [transformedPoints[0].lng, transformedPoints[0].lat, transformedPoints[0].p.elevation],
    ];

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoords],
      },
      properties: {
        name: `حدود المشروع - ${projectName}`,
        featureType: 'PROJECT_BOUNDARY',
        pointCount: transformedPoints.length,
        crsCode,
      },
    });
  }

  const featureCollection = {
    type: 'FeatureCollection',
    name: projectName,
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features,
  };

  return {
    geojson: JSON.stringify(featureCollection, null, 2),
    warnings,
    pointCount: transformedPoints.length,
  };
}
