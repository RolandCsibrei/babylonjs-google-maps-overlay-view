import "./style.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { type MapOptions } from "mapbox-gl";

import { MapboxWebGLCustomLayer } from "../../mapbox/MapboxWebGLCustomLayer";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateCylinder } from "@babylonjs/core";
import { initMap, latLngToVector3Relative } from "../../mapbox/util";

async function start() {
  const apiOptions = {
    accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  };

  const mapOptions: MapOptions = {
    container: "map",
    style: "mapbox://styles/mapbox/standard",
    config: {
      basemap: {
        theme: "monochrome",
      },
    },
    zoom: 15,
    center: [31.12054933420165, 29.9759456565051],
    pitch: 60,
    antialias: true,
  };

  const map = await initMap(apiOptions, mapOptions, "map");

  const anchor = {
    lng: 31.12054933420165,
    lat: 29.97597456565051,
  };

  const overlay = new MapboxWebGLCustomLayer({
    map,
    anchor,
    antialias: true,
    adaptToDeviceRatio: true,
    addDefaultLighting: true,
    upAxis: "Z",
  });

  await overlay.waitForSceneInit();
  const scene = overlay.scene;

  const pyramidPosition = latLngToVector3Relative(
    { lng: 31.13084933520165, lat: 29.97597456565051, altitude: 0 },
    { ...anchor, altitude: 0 }
  );

  const pyramid = CreateCylinder(
    "pyramid",
    {
      diameterTop: 0,
      diameterBottom: 215.5,
      height: 143.5,
      tessellation: 4,
    },
    scene
  );
  pyramid.position = pyramidPosition;
  pyramid.position.y += 143.5 / 2;
  pyramid.rotation = new Vector3(0, Math.PI / 4, 0);

  const pyramidMaterial = new StandardMaterial("pyramid-material", scene);
  pyramidMaterial.diffuseColor = new Color3(0, 1, 0);
  pyramidMaterial.alpha = 0.5;
  pyramid.material = pyramidMaterial;

  const sphere = CreateSphere("sphere", { diameter: 40 }, scene);
  const sphereMaterial = new StandardMaterial("sphere-material", scene);
  sphereMaterial.diffuseColor = new Color3(0, 0, 1);
  sphere.material = sphereMaterial;
  sphere.position = new Vector3(0, 0, 0);
}

start();
