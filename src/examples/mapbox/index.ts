import "./style.css";
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl, { type MapOptions } from "mapbox-gl";

import { MapBoxWebGLCustomLayer } from "../../mapbox/MapBoxWebGLCustomLayer";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";

async function start() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="map"></div>
`;

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const mapOptions: MapOptions = {
    container: "map",
    // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
    style: "mapbox://styles/mapbox/standard",
    config: {
      basemap: {
        theme: "monochrome",
      },
    },
    zoom: 18,
    center: [148.9819, -35.3981],
    pitch: 60,
    antialias: true, // create the gl context with MSAA antialiasing, so custom layers are antialiased
  };

  const map = new mapboxgl.Map(mapOptions);
  const anchor = {
    lat: -35.39847,
    lng: 148.9819,
  };

  const overlay = new MapBoxWebGLCustomLayer({
    map,
    anchor,
    antialias: true,
    adaptToDeviceRatio: true,
    addDefaultLighting: true,
    upAxis: "Z",
  });

  await overlay.waitForSceneInit();

  const scene = overlay.scene;

  const sphere = CreateSphere("sphere", { diameter: 10 }, scene);
  const sphereMaterial = new StandardMaterial("sphere-material", scene);
  sphereMaterial.diffuseColor = new Color3(0, 0, 1);
  sphere.material = sphereMaterial;
  sphere.position = new Vector3(50, 0, 0);

  const box = CreateBox("box", { size: 10 }, scene);
  const material = new StandardMaterial("box-material", scene);
  material.diffuseColor = new Color3(1, 0, 0);
  box.material = material;
  box.position = new Vector3(0, 30, 0);
  box.rotation = new Vector3(Math.PI / 4, Math.PI / 4, 0);

  // animate the sphere
  let i = 0;
  scene.onBeforeRenderObservable.add(() => {
    sphere.position.x = Math.sin(i) * 50;
    sphere.position.z = Math.cos(i) * 50;
    i += 0.1 * scene.getAnimationRatio();

    overlay.requestRedraw(); // or use animationMode: "always" when in overlay options
  });
}

start();
