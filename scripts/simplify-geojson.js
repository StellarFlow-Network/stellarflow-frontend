/**
 * Vector Map Simplification Tool
 * Implements Douglas-Peucker algorithm for GeoJSON coordinate simplification
 */

const fs = require('fs');
const path = require('path');

/**
 * Calculate the perpendicular distance from a point to a line segment
 * @param {Array} point - [x, y] coordinates
 * @param {Array} lineStart - [x, y] coordinates of line start
 * @param {Array} lineEnd - [x, y] coordinates of line end
 * @returns {number} perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  
  // Calculate the area of the triangle formed by the three points
  const area = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
  
  // Calculate the length of the line segment
  const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  
  // Return the perpendicular distance
  return lineLength === 0 ? 0 : area / lineLength;
}

/**
 * Douglas-Peucker algorithm for line simplification
 * @param {Array} points - Array of [x, y] coordinate pairs
 * @param {number} epsilon - Maximum distance tolerance
 * @returns {Array} Simplified array of points
 */
function douglasPeucker(points, epsilon) {
  if (points.length <= 2) {
    return points;
  }
  
  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxDistanceIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxDistanceIndex = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const leftPart = douglasPeucker(points.slice(0, maxDistanceIndex + 1), epsilon);
    const rightPart = douglasPeucker(points.slice(maxDistanceIndex), epsilon);
    
    // Combine the results, removing the duplicate point
    return leftPart.slice(0, -1).concat(rightPart);
  } else {
    // Return only the start and end points
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Simplify a GeoJSON geometry
 * @param {Object} geometry - GeoJSON geometry object
 * @param {number} epsilon - Simplification tolerance
 * @returns {Object} Simplified geometry
 */
function simplifyGeometry(geometry, epsilon) {
  switch (geometry.type) {
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map(ring => 
          douglasPeucker(ring, epsilon)
        )
      };
    
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(polygon =>
          polygon.map(ring => 
            douglasPeucker(ring, epsilon)
          )
        )
      };
    
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: douglasPeucker(geometry.coordinates, epsilon)
      };
    
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geometry.coordinates.map(line =>
          douglasPeucker(line, epsilon)
        )
      };
    
    case 'Point':
    case 'MultiPoint':
      // Points are not simplified
      return geometry;
    
    default:
      return geometry;
  }
}

/**
 * Simplify a GeoJSON FeatureCollection
 * @param {Object} geoJson - Input GeoJSON FeatureCollection
 * @param {number} epsilon - Simplification tolerance (in degrees)
 * @returns {Object} Simplified GeoJSON FeatureCollection
 */
function simplifyGeoJSON(geoJson, epsilon = 0.01) {
  if (!geoJson || geoJson.type !== 'FeatureCollection') {
    throw new Error('Input must be a GeoJSON FeatureCollection');
  }
  
  return {
    type: 'FeatureCollection',
    features: geoJson.features.map(feature => ({
      type: 'Feature',
      properties: feature.properties,
      geometry: simplifyGeometry(feature.geometry, epsilon)
    }))
  };
}

/**
 * Convert GeoJSON to TopoJSON for better compression
 * @param {Object} geoJson - Input GeoJSON
 * @returns {Object} TopoJSON object
 */
function geoToTopoJSON(geoJson) {
  // Simple TopoJSON conversion - for production use, consider using topojson-client library
  const arcs = [];
  const objects = {};
  
  geoJson.features.forEach((feature, index) => {
    const featureName = feature.properties.name || `feature_${index}`;
    objects[featureName] = {
      type: feature.geometry.type,
      arcs: []
    };
    
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring, ringIndex) => {
        const arcIndex = arcs.length;
        arcs.push(ring);
        objects[featureName].arcs.push(ringIndex === 0 ? [arcIndex] : [-arcIndex]);
      });
    }
  });
  
  return {
    type: 'Topology',
    arcs: arcs,
    objects: objects,
    transform: {
      scale: [1, 1],
      translate: [0, 0]
    }
  };
}

// Main execution
if (require.main === module) {
  const inputFile = path.join(__dirname, '../public/africa-network.geojson');
  const outputFile = path.join(__dirname, '../public/africa-network-simplified.geojson');
  const topoFile = path.join(__dirname, '../public/africa-network.topojson');
  
  try {
    // Read the original GeoJSON
    const originalData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`Original file size: ${fs.statSync(inputFile).size} bytes`);
    
    // Simplify with different epsilon values to find optimal balance
    const epsilonValues = [0.1, 0.05, 0.01, 0.005];
    
    epsilonValues.forEach(epsilon => {
      const simplified = simplifyGeoJSON(originalData, epsilon);
      const simplifiedFile = path.join(__dirname, `../public/africa-network-simplified-${epsilon}.geojson`);
      
      fs.writeFileSync(simplifiedFile, JSON.stringify(simplified, null, 2));
      const size = fs.statSync(simplifiedFile).size;
      console.log(`Epsilon ${epsilon}: ${size} bytes (${((size / fs.statSync(inputFile).size) * 100).toFixed(1)}% of original)`);
    });
    
    // Use epsilon = 0.01 for the main simplified file
    const bestSimplified = simplifyGeoJSON(originalData, 0.01);
    fs.writeFileSync(outputFile, JSON.stringify(bestSimplified, null, 2));
    
    // Convert to TopoJSON
    const topoData = geoToTopoJSON(bestSimplified);
    fs.writeFileSync(topoFile, JSON.stringify(topoData, null, 2));
    
    console.log(`\nSimplified file size: ${fs.statSync(outputFile).size} bytes`);
    console.log(`TopoJSON file size: ${fs.statSync(topoFile).size} bytes`);
    console.log(`Reduction: ${((1 - fs.statSync(topoFile).size / fs.statSync(inputFile).size) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  simplifyGeoJSON,
  douglasPeucker,
  perpendicularDistance,
  geoToTopoJSON
};
