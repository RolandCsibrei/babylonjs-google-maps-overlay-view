import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Scene } from "@babylonjs/core/scene";
import type { IndicesArray, Nullable } from "@babylonjs/core";

export type LatLngTypes =
  | google.maps.LatLngLiteral
  | google.maps.LatLng
  | google.maps.LatLngAltitudeLiteral
  | google.maps.LatLngAltitude;

// shorthands for math-functions, makes equations more readable
const { atan, cos, exp, log, tan, PI } = Math;

import {
  importLibrary,
  type APIOptions,
  setOptions,
} from "@googlemaps/js-api-loader";
import { BabylonJSWebGLOverlayView } from "./BabylonJSWebGLOverlayView";

export const EARTH_RADIUS = 6371010.0;
export const WORLD_SIZE = Math.PI * EARTH_RADIUS;

/**
 * Initializes and returns a Google Map instance.
 * @param {APIOptions} apiOptions - Options for loading the Google Maps API.
 * @param {google.maps.MapOptions} mapOptions - Configuration options for the map.
 * @param {string} [htlmDivElement="map"] - The ID of the HTML div element to attach the map.
 * @returns {Promise<google.maps.Map | undefined>} The initialized Google Map object or undefined if div not found.
 */
export async function initMap(
  apiOptions: APIOptions,
  mapOptions: google.maps.MapOptions,
  htlmDivElement = "map"
): Promise<google.maps.Map | undefined> {
  const mapDiv = document.getElementById(htlmDivElement) as HTMLDivElement;
  if (!mapDiv) {
    return;
  }

  setOptions(apiOptions);
  await importLibrary("maps");

  const map = new google.maps.Map(mapDiv, mapOptions);
  return map;
}

/**
 * Converts various supported LatLng formats to a uniform LatLngAltitudeLiteral format.
 * Ensures altitude is present and defaults to 0 if not available.
 * @param {LatLngTypes} point - The input point in any supported LatLng format.
 * @returns {google.maps.LatLngAltitudeLiteral} The point converted to LatLngAltitudeLiteral format.
 */
export function toLatLngAltitudeLiteral(
  point: LatLngTypes
): google.maps.LatLngAltitudeLiteral {
  if (
    window.google &&
    google.maps?.LatLng &&
    (point instanceof google.maps.LatLng ||
      point instanceof google.maps.LatLngAltitude)
  ) {
    return { altitude: 0, ...point.toJSON() };
  }

  return { altitude: 0, ...(point as google.maps.LatLngLiteral) };
}

/**
 * Converts a geographic coordinate (latitude, longitude, altitude) to a Babylon.js Vector3
 * relative to a given reference point, accounting for spherical mercator projection and altitude.
 * @param {google.maps.LatLngAltitudeLiteral} point - The geographic point to convert.
 * @param {google.maps.LatLngAltitudeLiteral} reference - The reference point for relative positioning.
 * @param {Vector3} [target=new Vector3()] - Optional target Vector3 to store the result.
 * @returns {Vector3} The relative Vector3 coordinates with y-up orientation.
 */
export function latLngToVector3Relative(
  point: google.maps.LatLngAltitudeLiteral,
  reference: google.maps.LatLngAltitudeLiteral,
  target = new Vector3()
): Vector3 {
  const [px, py] = latLngToXY(point);
  const [rx, ry] = latLngToXY(reference);

  target.set(px - rx, py - ry, 0);

  // apply the spherical mercator scale-factor for the reference latitude
  const val = cos(Tools.ToRadians(reference.lat));
  const vector = new Vector3(val, val, val);
  target.multiplyInPlace(vector);

  target.z = point.altitude - reference.altitude;

  return target;
}

/**
 * Converts latitude and longitude coordinates (WGS84) to WebMercator meters.
 * This is an uncorrected projection conversion (EPSG:4326 to EPSG:3857).
 * @param {google.maps.LatLngLiteral} position - The latitude/longitude position.
 * @returns {[number, number]} The position in WebMercator meters [x, y].
 */
export function latLngToXY(position: google.maps.LatLngLiteral): number[] {
  return [
    EARTH_RADIUS * Tools.ToRadians(position.lng),
    EARTH_RADIUS * log(tan(0.25 * PI + 0.5 * Tools.ToRadians(position.lat))),
  ];
}

/**
 * Converts WebMercator meters to latitude and longitude coordinates (WGS84).
 * (EPSG:3857 to EPSG:4326 conversion)
 * @param {number} x - The X coordinate in WebMercator meters.
 * @param {number} y - The Y coordinate in WebMercator meters.
 * @returns {google.maps.LatLngLiteral} The geographic coordinates.
 */
export function xyToLatLng(x: number, y: number): google.maps.LatLngLiteral {
  return {
    lat: Tools.ToDegrees(PI * 0.5 - 2.0 * atan(exp(-y / EARTH_RADIUS))),
    lng: Tools.ToDegrees(x) / EARTH_RADIUS,
  };
}

/**
 * Sets the mouse cursor style on the Google Map.
 * When a building is picked, cursor is set to pointer; otherwise, default.
 * @param {google.maps.Map} map - The Google Map instance.
 * @param {boolean} [isBuildingPicked=false] - Whether a building is currently picked.
 */
export function setCursor(map: google.maps.Map, isBuildingPicked = false) {
  map.setOptions({
    draggableCursor: isBuildingPicked ? "pointer" : null,
  });
}

/**
 * Retrieves the indices of a mesh with the winding order of each triangle reversed.
 * This reverses the face direction of the mesh.
 * @param {Mesh} mesh - The Babylon.js mesh whose indices will be reversed.
 * @returns {Nullable<IndicesArray>} The reversed indices array or undefined if no indices.
 */
export function getReversedIndices(mesh: Mesh): Nullable<IndicesArray> {
  const indices = mesh.getIndices(false, true);

  if (indices) {
    // Reverse the order of vertices in each triangle (3 indices per face)
    for (let i = 0; i < indices.length; i += 3) {
      // Swap the second and third index to reverse the winding order
      const temp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = temp;
    }
  }

  return indices;
}

/**
 * Reverses the winding order of triangles in a Babylon.js mesh by modifying its indices.
 * @param {Mesh} mesh - The mesh whose indices will be reversed.
 */
export function reverseMeshIndices(mesh: Mesh) {
  const indices = getReversedIndices(mesh);
  if (indices) {
    mesh.setIndices(indices);
  }
}

/**
 * Sets the visibility of the Google Map by changing the display style of its container.
 * @param {google.maps.Map} map - The Google Map instance.
 * @param {boolean} visible - Whether the map should be visible.
 */
export function setMapVisibility(map: google.maps.Map, visible: boolean) {
  const div = map.getDiv();
  div.style.display = visible ? "absolute" : "none";
}

/**
 * Sets the opacity of the Google Map container element.
 * @param {google.maps.Map} map - The Google Map instance.
 * @param {number | string} opacity - The opacity value (0 to 1 or CSS string).
 */
export function setMapOpacity(map: google.maps.Map, opacity: number | string) {
  const div = map.getDiv();
  div.style.opacity = `${opacity}`;
}

/**
 * Sets the opacity of a given HTMLDivElement.
 * @param {HTMLDivElement} div - The div element.
 * @param {number | string} opacity - The opacity value (0 to 1 or CSS string).
 */
export function setMapDivOpacity(
  div: HTMLDivElement,
  opacity: number | string
) {
  div.style.opacity = `${opacity}`;
}

/**
 * Performs a fade-out animation on the Google Map by gradually decreasing its opacity.
 * Once fully faded out, destroys the map instance and removes its DOM element.
 * @param {google.maps.Map} map - The Google Map instance to fade out and destroy.
 */
export function fadeOutMap(map: google.maps.Map) {
  const div = map.getDiv();
  let opacity = parseFloat(div.style.opacity || "1");
  const doFade = () => {
    div.style.opacity = `${opacity}`;
    opacity -= 0.01;
    if (opacity > 0) {
      requestAnimationFrame(doFade);
    } else {
      destroyMap(map);
    }
  };
  requestAnimationFrame(doFade);
}

/**
 * Destroys the Google Map instance by clearing event listeners and removing its container from the DOM.
 * @param {google.maps.Map} map - The Google Map instance to destroy.
 */
export function destroyMap(map: google.maps.Map) {
  const div = map.getDiv();
  google.maps.event.clearInstanceListeners(map); // Remove all event listeners
  (map as unknown) = null; // Nullify the map reference
  div.remove();
}

/**
 * Creates and fades in a default skybox in the given Babylon.js scene using the environment texture.
 * The skybox fades in by gradually increasing its material alpha.
 * @param {Scene} scene - The Babylon.js scene instance.
 * @returns {Nullable<Mesh>} skybox - The skybox mesh
 */
export function fadeInSkyBox(scene: Scene) {
  if (!scene.environmentTexture) {
    return;
  }
  const skybox = scene.createDefaultSkybox(
    scene.environmentTexture,
    true,
    3000,
    0.38,
    true
  );

  const material = skybox?.material;
  if (!material) {
    return;
  }

  let alpha = 0;

  const doFade = () => {
    material.alpha = alpha;
    alpha += 0.01;
    if (alpha > 1) {
      scene.onBeforeRenderObservable.removeCallback(doFade);
    }
  };
  scene.onBeforeRenderObservable.add(doFade);

  return skybox;
}

/**
 * Computes the position and angle transform between two GPS bounds relative to a BabylonJSWebGLOverlayView.
 * Useful for positioning overlays or models between two latitude/longitude points.
 * @param {BabylonJSWebGLOverlayView} overlay - The overlay view instance.
 * @param {google.maps.LatLngLiteral} leftLowerCorner - The southwest corner of the bounds.
 * @param {google.maps.LatLngLiteral} rightLowerCorner - The southeast corner of the bounds.
 * @returns {{ position: Vector3; angle: number }} The computed position (Vector3) and angle in radians.
 */
export function getTransformFromGpsBounds(
  overlay: BabylonJSWebGLOverlayView,
  leftLowerCorner: google.maps.LatLngLiteral,
  rightLowerCorner: google.maps.LatLngLiteral
): { position: Vector3; angle: number } {
  const p1Position = overlay.latLngAltitudeToVector3Ref(leftLowerCorner);
  const p2Position = overlay.latLngAltitudeToVector3Ref(rightLowerCorner);

  if (p1Position && p2Position) {
    const angle = Math.atan2(
      p2Position.y - p1Position.y,
      p2Position.x - p1Position.x
    );

    return {
      position: p1Position,
      angle,
    };
  }

  return {
    position: new Vector3(),
    angle: 0,
  };
}

/**
 * Converts Babylon.js Vector3 coordinates back to latitude and longitude,
 * relative to an origin GPS coordinate.
 * Only the x and z components are used (y is ignored).
 * @param {number} x - The X coordinate in meters (Babylon.js).
 * @param {number} z - The Z coordinate in meters (Babylon.js).
 * @param {LatLngTypes} originLatLng - The origin geographic coordinate.
 * @returns {LatLngTypes} The geographic coordinate corresponding to the vector.
 */
export function vector3ToLatLng(
  x: number,
  z: number,
  originLatLng: LatLngTypes
): LatLngTypes {
  const originLiteral = toLatLngAltitudeLiteral(originLatLng);
  // Define meters per degree conversion
  const latPerMeter = 1 / ((Math.PI * EARTH_RADIUS) / 180);
  const lngPerMeter =
    1 /
    (((Math.PI * EARTH_RADIUS) / 180) *
      Math.cos(originLiteral.lat * (Math.PI / 180)));

  // Convert Babylon.js X/Z to lat/lng (Y is ignored)
  const lat = originLiteral.lat + z * latPerMeter;
  const lng = originLiteral.lng + x * lngPerMeter;

  return { lat, lng };
}
