import type { APIOptions } from "@googlemaps/js-api-loader";
import { initMap, reverseMeshIndices } from "./overlay/util";
import { BabylonJSWebGLOverlayView } from "./overlay/BabylonJSWebGLOverlayView";
import {
  Color3,
  CreateBox,
  CreateSphere,
  StandardMaterial,
} from "@babylonjs/core";

async function start() {
  const apiOptions: APIOptions = {
    key: import.meta.env.VITE_GMAPS_KEY,
  };

  const mapOptions: google.maps.MapOptions = {
    zoom: 14,
    center: { lat: 35.6594945, lng: 139.6999859 },
    mapId: "15431d2b469f209e",
  };

  const map = await initMap(apiOptions, mapOptions);

  const overlay = new BabylonJSWebGLOverlayView({
    map,
    anchor: mapOptions.center!,
  });

  await overlay.waitForSceneInit();

  const scene = overlay.scene;

  // Create a huge sphere
  const sphere = CreateSphere(
    "sphere",
    {
      diameter: 200,
    },
    scene
  );
  reverseMeshIndices(sphere);

  const material = new StandardMaterial("sphere", scene);
  material.emissiveColor = Color3.Red();
  sphere.material = material;

  // create a box
  const box = CreateBox("box", { size: 400 }, scene);
  box.position.y = 500;
  box.position.z = 250;
  reverseMeshIndices(box);

  // animate the sphere
  let i = 0;
  scene.onBeforeRenderObservable.add(() => {
    sphere.position.x = Math.sin(i) * 500;
    i += 0.1 * scene.getAnimationRatio();

    overlay.requestRedraw(); // or use animationMode: "always" when in overlay options
  });
}

window.addEventListener("DOMContentLoaded", start);
