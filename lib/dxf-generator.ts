import type { PointRecord } from '@/lib/db';

/**
 * Generates an AutoCAD ASCII DXF (R12 / 2000 compatible) string from survey points
 */
export function generateDXF(
  projectName: string,
  points: PointRecord[],
  options: {
    includeBoundary?: boolean;
    includeTextLabels?: boolean;
    includeElevationText?: boolean;
    includeQaqcFlags?: boolean;
    textHeight?: number;
    selectedPointIds?: string[];
    layerFilter?: string;
  } = {}
): string {
  const {
    includeBoundary = true,
    includeTextLabels = true,
    includeElevationText = true,
    includeQaqcFlags = true,
    textHeight = 1.5,
    selectedPointIds,
    layerFilter,
  } = options;

  // Filter points if criteria provided
  let exportPoints = points;
  if (selectedPointIds && selectedPointIds.length > 0) {
    const idSet = new Set(selectedPointIds);
    exportPoints = exportPoints.filter((p) => idSet.has(p.id));
  }
  if (layerFilter && layerFilter !== 'ALL') {
    exportPoints = exportPoints.filter((p) => (p.layer || 'POINTS') === layerFilter);
  }

  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
5
0
LAYER
2
POINTS
70
0
62
3
6
CONTINUOUS
0
LAYER
2
ELEVATIONS
70
0
62
4
6
CONTINUOUS
0
LAYER
2
DESCRIPTIONS
70
0
62
2
6
CONTINUOUS
0
LAYER
2
BOUNDARY
70
0
62
1
6
CONTINUOUS
0
LAYER
2
QAQC_FLAGS
70
0
62
6
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  // 1. Write Points
  exportPoints.forEach((p) => {
    const pointLayer = p.layer || 'POINTS';
    // 3D Point
    dxf += `0
POINT
8
${pointLayer}
10
${p.easting.toFixed(4)}
20
${p.northing.toFixed(4)}
30
${p.elevation.toFixed(4)}
`;

    // Point ID Text
    if (includeTextLabels) {
      dxf += `0
TEXT
8
POINTS
10
${(p.easting + textHeight * 0.5).toFixed(4)}
20
${(p.northing + textHeight * 0.5).toFixed(4)}
30
${p.elevation.toFixed(4)}
40
${textHeight.toFixed(2)}
1
P${p.pointNumber}
`;
    }

    // Elevation Text
    if (includeElevationText) {
      dxf += `0
TEXT
8
ELEVATIONS
10
${(p.easting + textHeight * 0.5).toFixed(4)}
20
${(p.northing - textHeight * 1.2).toFixed(4)}
30
${p.elevation.toFixed(4)}
40
${(textHeight * 0.8).toFixed(2)}
1
Z=${p.elevation.toFixed(2)}
`;
    }

    // Description Text
    if (p.description && includeTextLabels) {
      dxf += `0
TEXT
8
DESCRIPTIONS
10
${(p.easting + textHeight * 0.5).toFixed(4)}
20
${(p.northing - textHeight * 2.4).toFixed(4)}
30
${p.elevation.toFixed(4)}
40
${(textHeight * 0.8).toFixed(2)}
1
${p.description}
`;
    }

    // QA/QC Flag indicator in DXF
    if (includeQaqcFlags && p.flagged) {
      dxf += `0
TEXT
8
QAQC_FLAGS
10
${(p.easting - textHeight * 3.0).toFixed(4)}
20
${(p.northing + textHeight * 0.5).toFixed(4)}
30
${p.elevation.toFixed(4)}
40
${(textHeight * 0.9).toFixed(2)}
1
[FLAGGED: ${p.qaFlagReason || 'REVIEW'}]
`;
    }
  });

  // 2. Write Closed Boundary Polyline if >= 3 points
  if (includeBoundary && exportPoints.length >= 3) {
    dxf += `0
POLYLINE
8
BOUNDARY
66
1
70
1
10
0.0
20
0.0
30
0.0
`;
    exportPoints.forEach((p) => {
      dxf += `0
VERTEX
8
BOUNDARY
10
${p.easting.toFixed(4)}
20
${p.northing.toFixed(4)}
30
${p.elevation.toFixed(4)}
`;
    });
    dxf += `0
SEQEND
8
BOUNDARY
`;
  }

  // End DXF
  dxf += `0
ENDSEC
0
EOF
`;

  return dxf;
}

/**
 * Downloads a string as a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
