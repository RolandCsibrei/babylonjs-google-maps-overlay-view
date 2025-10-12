import { LatLngTypes } from "./util";

/**
 * Cache for route calculations
 */
interface RouteCache {
  path: google.maps.LatLng[];
  distances: number[]; // Cumulative distance at each point
  totalDistance: number;
}

// let directionsRenderer: google.maps.DirectionsRenderer;
const routeCaches = new Map<string, RouteCache>();

type StepStyle = {
  strokeColor: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  dashed?: boolean;
  dashPattern?: string;
  dashRepeat?: string;
};

type ModeStyleMap = {
  [key in google.maps.TravelMode]?: StepStyle;
};

let polylines: google.maps.Polyline[];
function renderCustomRoute(
  map: google.maps.Map,
  directionsResult: google.maps.DirectionsResult,
  styleMap: ModeStyleMap
) {
  polylines = [];

  for (const leg of directionsResult.routes[0].legs) {
    for (const step of leg.steps) {
      const mode = step.travel_mode;
      const style = styleMap[mode] ?? {
        strokeColor: "black",
        strokeWeight: 8,
        strokeOpacity: 0.8,
      };

      const {
        strokeColor,
        strokeWeight = 8,
        strokeOpacity = 0.8,
        dashed = false,
        dashPattern = "M 0,-1 0,1",
        dashRepeat = "15px",
      } = style;

      const polyline = new google.maps.Polyline({
        path: step.path,
        map,
        strokeColor: dashed ? undefined : strokeColor,
        strokeWeight: dashed ? undefined : strokeWeight,
        strokeOpacity: dashed ? 0 : strokeOpacity,
        icons: dashed
          ? [
              {
                icon: {
                  path: dashPattern,
                  strokeColor,
                  strokeOpacity: 1,
                  scale: 4,
                },
                offset: "0",
                repeat: dashRepeat,
              },
            ]
          : [],
      });

      polylines.push(polyline);
    }
  }
}

export function deleteCurrentRoute() {
  if (!polylines) {
    return;
  }
  for (const pl of polylines) {
    pl.setMap(null);
  }
  polylines.length = 0;
}

export function drawRoute(
  map: google.maps.Map,
  directions: google.maps.DirectionsResult | null
  // travelMode: google.maps.TravelMode = google.maps.TravelMode.DRIVING
) {
  if (!directions) {
    return;
  }

  const styleMap: ModeStyleMap = {
    DRIVING: {
      strokeColor: "black",
    },
    WALKING: {
      strokeColor: "black",
      strokeOpacity: 1,
      dashed: true,
      dashRepeat: "20px",
    },
    BICYCLING: {
      strokeColor: "black",
    },
    TRANSIT: {
      strokeColor: "black",
      dashed: true,
      dashPattern: "M0,0m-1,0a1,1 0 1,0 2,0a1,1 0 1,0 -2,0",
    },
  };

  renderCustomRoute(map, directions, styleMap);

  // if (!directionsRenderer) {
  //   directionsRenderer = new google.maps.DirectionsRenderer({
  //     // panel: document.getElementById("map-panel"),
  //     suppressMarkers: true,
  //     polylineOptions: {
  //       strokeColor:
  //         travelMode === google.maps.TravelMode.DRIVING ? "black" : "black",
  //       strokeWeight: 8,
  //       strokeOpacity: 0.7,
  //       icons: [],
  //     },
  //   });
  //   directionsRenderer.setMap(map);
  // }

  // directionsRenderer.setDirections(directions);

  // return directionsRenderer;
}

export async function getRoute(
  origin: LatLngTypes,
  destination: LatLngTypes,
  travelMode: google.maps.TravelMode = google.maps.TravelMode.DRIVING
): Promise<google.maps.DirectionsResult | null> {
  return new Promise((resolve, reject) => {
    // direction
    const directionsService = new google.maps.DirectionsService();
    const request: google.maps.DirectionsRequest = {
      origin,
      destination,
      travelMode,
    };

    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        resolve(result);
      } else if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
        console.warn("No route found for the given origin and destination.");
        resolve(null);
      } else {
        reject(new Error(`Directions request failed: ${status}`));
      }
    });
  });
}

// export function getGpsPositionsOnRoute(route: google.maps.DirectionsRoute) {
//   const gpsPositionsOnPath: google.maps.LatLngLiteral[] = [];
//   route.legs.forEach((leg) => {
//     leg.steps.forEach((step) => {
//       for (const p of step.path) {
//         const lat = p.lat();
//         const lng = p.lng();
//         gpsPositionsOnPath.push({
//           lat,
//           lng,
//         });
//       }
//     });
//   });

//   return gpsPositionsOnPath;
// }

/**
 * Gets a position on a route based on a percentage of the route's total distance
 * @param route The DirectionsResult containing the route information
 * @param percent A value between 0 and 100 representing the percentage along the route
 * @returns The LatLng position at the specified percentage of the route
 */
export function getPositionOnRoute(
  route: google.maps.DirectionsResult,
  percent: number
): google.maps.LatLng {
  // Validate percentage value
  if (percent < 0 || percent > 100) {
    percent = Math.max(0, Math.min(100, percent));
  }

  // Get or create cache for this route
  const routeId = getRouteId(route);
  let cache = routeCaches.get(routeId);

  if (!cache) {
    cache = createRouteCache(route);
    routeCaches.set(routeId, cache);
  }

  // store this value somewhere if you need the total distance of the route - cache.totalDistance;

  // Now use the cache to find the position
  return findPositionAtPercentage(cache, percent);
}

/**
 * Creates a unique ID for a route
 */
function getRouteId(route: google.maps.DirectionsResult): string {
  const path = route.routes[0].overview_path;
  // Use the first, middle and last point to create a unique ID
  const first = path[0];
  const middle = path[Math.floor(path.length / 2)];
  const last = path[path.length - 1];

  return `${first.lat()},${first.lng()}_${middle.lat()},${middle.lng()}_${last.lat()},${last.lng()}`;
}

/**
 * Creates a cache for a route including precalculated distances
 */
function createRouteCache(route: google.maps.DirectionsResult): RouteCache {
  const path = route.routes[0].overview_path;
  const distances: number[] = [0]; // Start with 0 distance
  let totalDistance = 0;

  // Pre-calculate distances along the path
  for (let i = 1; i < path.length; i++) {
    const segmentDistance =
      google.maps.geometry.spherical.computeDistanceBetween(
        path[i - 1],
        path[i]
      );
    totalDistance += segmentDistance;
    distances.push(totalDistance);
  }

  return { path, distances, totalDistance };
}

/**
 * Finds the position at a specific percentage along a cached route
 * Uses binary search for efficient segment finding
 */
function findPositionAtPercentage(
  cache: RouteCache,
  percent: number
): google.maps.LatLng {
  const { path, distances, totalDistance } = cache;
  const targetDistance = totalDistance * (percent / 100);

  // Binary search to find the right segment
  let low = 0;
  let high = distances.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (distances[mid] < targetDistance) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // If we've found an exact match or we're at the start
  if (distances[low] === targetDistance || low === 0) {
    return path[low];
  }

  // We need to interpolate between two points
  const prevIndex = low - 1;
  const prevDistance = distances[prevIndex];
  const nextDistance = distances[low];

  // Calculate how far along the segment we are
  const segmentLength = nextDistance - prevDistance;
  const segmentProgress = (targetDistance - prevDistance) / segmentLength;

  // Interpolate between the two points
  return google.maps.geometry.spherical.interpolate(
    path[prevIndex],
    path[low],
    segmentProgress
  );
}

export function getRouteTotalDistanceAndDuration(
  directionsResult: google.maps.DirectionsResult
) {
  const route = directionsResult.routes[0];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  route.legs.forEach((leg) => {
    totalDistanceMeters += leg.distance?.value ?? 0; // in meters
    totalDurationSeconds += leg.duration?.value ?? 0; // in seconds
  });

  return {
    distanceMeters: totalDistanceMeters,
    durationSeconds: totalDurationSeconds,
  };
}

export function getRemainingDistanceAndTime(
  currentPos: google.maps.LatLngLiteral,
  directionsResult: google.maps.DirectionsResult
) {
  const route = directionsResult.routes[0];
  const path = getFullRoutePath(route);

  const {
    closestIndex,
    distanceMeters: distanceInMetersToClosestPointOnRoute,
  } = findClosestPointOnRoute(currentPos, path);

  // From closest point, approximate remaining distance along the polyline
  let distanceToEnd = 0;
  for (let i = closestIndex; i < path.length - 1; i++) {
    distanceToEnd += google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(path[i]),
      new google.maps.LatLng(path[i + 1])
    );
  }

  // Estimate remaining time by linear interpolation:
  const { distanceMeters, durationSeconds } =
    getRouteTotalDistanceAndDuration(directionsResult);
  const time = (distanceToEnd / distanceMeters) * durationSeconds;

  return {
    distanceInMetersToClosestPointOnRoute,
    distanceToEnd,
    time,
  };
}

function findClosestPointOnRoute(
  currentPos: google.maps.LatLngLiteral,
  routePath: google.maps.LatLngLiteral[]
): {
  closestPoint: google.maps.LatLngLiteral;
  closestIndex: number;
  distanceMeters: number;
} {
  let minDistance = Infinity;
  let closestIndex = -1;

  const currentLatLng = new google.maps.LatLng(currentPos);

  routePath.forEach((point, index) => {
    const pathLatLng = new google.maps.LatLng(point);
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      currentLatLng,
      pathLatLng
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  return {
    closestPoint: routePath[closestIndex],
    closestIndex,
    distanceMeters: minDistance,
  };
}

function getFullRoutePath(
  route: google.maps.DirectionsRoute
): google.maps.LatLngLiteral[] {
  const path: google.maps.LatLngLiteral[] = [];
  route.legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      step.path.forEach((latLng) => {
        path.push({ lat: latLng.lat(), lng: latLng.lng() });
      });
    });
  });
  return path;
}
