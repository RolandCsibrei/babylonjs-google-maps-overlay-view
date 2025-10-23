// https:playground.babylonjs.com/#5B9HC9#62

import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Tools } from "@babylonjs/core/Misc/tools";
import { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo";
import type { MeshPredicate } from "@babylonjs/core/Culling/ray.core";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { IVector2Like } from "@babylonjs/core/Maths/math.like";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

import { latLngToVector3Relative, toLatLngAltitudeLiteral } from "./util";

import type { LatLngTypes } from "./util";

const DEFAULT_UP = new Vector3(0, 1, 0);
const CAMERA_NAME = "gmaps-camera";

export interface RaycastOptions {
  /**
   * Set to true to also test children of the specified objects for
   * intersections.
   *
   * @default false
   */
  recursive?: boolean;

  /**
   * Update the inverse-projection-matrix before casting the ray (set this
   * to false if you need to run multiple raycasts for the same frame).
   *
   * @default true
   */
  updateMatrix?: boolean;
}

export interface GoogleMapsWebGLOverlayViewOptions {
  /**
   * The anchor for the scene.
   *
   * @default {lat: 0, lng: 0, altitude: 0}
   */
  anchor?: LatLngTypes;

  /**
   * The axis pointing up in the scene. Can be specified as "Z", "Y" or a
   * Vector3, in which case the normalized vector will become the up-axis.
   *
   * @default "Z"
   */
  upAxis?: "Z" | "Y" | Vector3;

  /**
   * The map the overlay will be added to.
   * Can be set at initialization or by calling `setMap(map)`.
   */
  map?: google.maps.Map;

  /**
   * The animation mode controls when the overlay will redraw, either
   * continuously (`always`) or on demand (`ondemand`). When using the
   * on demand mode, the overlay will re-render whenever the map renders
   * (camera movements) or when `requestRedraw()` is called.
   *
   * To achieve animations in this mode, you can either use an outside
   * animation-loop that calls `requestRedraw()` as long as needed or call
   * `requestRedraw()` from within the `onBeforeRender` function to
   *
   * @default "ondemand"
   */
  animationMode?: "always" | "ondemand";

  /**
   * Add default lighting to the scene.
   * @default true
   */
  addDefaultLighting?: boolean;

  /**
   * Specify the camera to be used to render the overlayed scene.
   * If not specified a new FreeCamera will be created.
   * The camera matrix will be synced with the google maps view.
   */
  camera?: Camera;

  /**
   * Whether to use a right-handed coordinate system.
   */
  useRightHandedSystem?: boolean;

  /**
   * Whether to adapt the device ratio.
   * @default false
   */
  adaptToDeviceRatio?: boolean;

  /**
   * Whether to enable antialiasing for the babylon.js engine.
   * @default false
   */
  antialias?: boolean;
}

/**
 * babylon.js wrapper for Google Maps WebGLOverlayView
 */
export class BabylonJSWebGLOverlayView implements google.maps.WebGLOverlayView {
  public animationMode: "always" | "ondemand" = "ondemand";

  protected readonly rotationArray: Float32Array = new Float32Array(3);
  public readonly rotationInverse: Quaternion = new Quaternion();
  protected readonly projectionMatrixInverse = new Matrix();

  protected anchor!: google.maps.LatLngAltitudeLiteral;
  protected readonly overlay: google.maps.WebGLOverlayView;

  private _engine!: Engine;
  private _scene!: Scene;
  private _camera!: Camera;

  /**
   * The current rotation matrix
   */
  public get rotationMatrix() {
    return Matrix.FromQuaternionToRef(this.rotationInverse, Matrix.Zero());
  }

  /**
   * The scene
   */
  public get scene() {
    return this._scene;
  }

  /**
   * The camera
   */
  public get camera() {
    return this._camera;
  }

  constructor(
    protected readonly options: GoogleMapsWebGLOverlayViewOptions = {}
  ) {
    const {
      anchor = { lat: 0, lng: 0, altitude: 0 },
      upAxis = "Y",
      map,
      animationMode = "ondemand",
      addDefaultLighting = true,
    } = options;

    this.options = {
      ...this.options,
      anchor,
      upAxis,
      animationMode,
      addDefaultLighting,
    };

    options.camera && (this._camera = options.camera);

    this.overlay = new google.maps.WebGLOverlayView();
    this.animationMode = animationMode;

    this.setAnchor(anchor);
    this.setUpAxis(upAxis);

    this.overlay.onAdd = this.onAdd.bind(this);
    this.overlay.onRemove = this.onRemove.bind(this);
    this.overlay.onContextLost = this.onContextLost.bind(this);
    this.overlay.onContextRestored = this.onContextRestored.bind(this);
    this.overlay.onStateUpdate = this.onStateUpdate.bind(this);
    this.overlay.onDraw = this.onDraw.bind(this);

    if (map) {
      this.setMap(map);
    }
  }

  public async waitForSceneInit(): Promise<void> {
    return new Promise((resolve) => {
      const checkScene = () => {
        if (this._scene) {
          resolve();
        } else {
          setTimeout(checkScene, 100); // Check every 100ms
        }
      };
      checkScene();
    });
  }

  /**
   * Sets the anchor-point.
   * @param anchor
   */
  public setAnchor(anchor: LatLngTypes) {
    this.anchor = toLatLngAltitudeLiteral(anchor);
  }

  /**
   * Setup axis
   */
  public setUpAxis(axis: "Y" | "Z" | Vector3): void {
    const upVector = new Vector3(0, 1, 0); // Y up

    if (typeof axis !== "string") {
      upVector.copyFrom(axis);
    } else {
      if (axis.toLowerCase() === "z") {
        upVector.set(0, 0, 1);
      } else if (axis.toLowerCase() !== "y") {
        console.warn(`invalid value '${axis}' specified as upAxis`);
      }
    }

    upVector.normalize();

    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(upVector, DEFAULT_UP, q);

    // inverse rotation is needed in latLngAltitudeToVector3()
    this.rotationInverse.copyFrom(q).invert();

    // copy to rotationArray for transformer.fromLatLngAltitude()
    const euler = q.toEulerAngles();
    this.rotationArray[0] = Tools.ToDegrees(euler.x);
    this.rotationArray[1] = Tools.ToDegrees(euler.y);
    this.rotationArray[2] = Tools.ToDegrees(euler.z);
  }

  /**
   * Runs raycasting for the specified screen-coordinates against all objects
   * in the scene.
   *
   * @param p screenspace coordinates of the
   * @param options raycasting options. In this case the `recursive` option
   *   has no effect as it is always recursive.
   * @return the list of intersections
   */
  public raycast(p: IVector2Like, options?: RaycastOptions): PickingInfo[];

  /**
   * Runs raycasting for the specified screen-coordinates against the specified
   * list of objects.
   *
   * Note for typescript users: the returned Intersection objects can only be
   * properly typed for non-recursive lookups (this is handled by the internal
   * signature below).
   *
   * @param p normalized screenspace coordinates of the
   *   mouse-cursor. x/y are in range [-1, 1], y is pointing up.
   * @param objects list of objects to test
   * @param options raycasting options.
   */
  public raycast(
    p: IVector2Like,
    predicate: MeshPredicate,
    options?: RaycastOptions & { recursive: false }
  ): PickingInfo[];

  // implemetation
  public raycast(
    p: IVector2Like,
    optionsOrPredicate?: MeshPredicate | RaycastOptions,
    options: RaycastOptions = {}
  ): PickingInfo[] {
    let objects: AbstractMesh[];
    if (Array.isArray(optionsOrPredicate)) {
      objects = optionsOrPredicate || null;
    } else {
      objects = this._scene.meshes;
      options = { ...optionsOrPredicate, recursive: false };
    }

    const { updateMatrix = true, recursive = false } = options;

    if (updateMatrix) {
      this.projectionMatrixInverse
        .copyFrom(this._camera.getProjectionMatrix())
        .invert();
    }

    const pickingRay = this._scene.createPickingRay(
      p.x,
      p.y,
      Matrix.Identity(),
      this._camera
    );

    if (recursive) {
      return pickingRay.intersectsMeshes(objects);
    }

    const result = this._scene.pickWithRay(pickingRay);
    if (!result) {
      return [];
    }

    return [result];
  }

  /**
   * Overwrite this method to handle any GL state updates outside the
   * render animation frame.
   * @param options
   */
  public onStateUpdate(options: google.maps.WebGLStateOptions): void;
  public onStateUpdate(): void {}

  /**
   * Overwrite this method to fetch or create intermediate data structures
   * before the overlay is drawn that don’t require immediate access to the
   * WebGL rendering context.
   */
  public onAdd(): void {}

  /**
   * Overwrite this method to update your scene just before a new frame is
   * drawn.
   */
  public onBeforeDraw(): void {}

  /**
   * This method is called when the overlay is removed from the map with
   * `overlay.setMap(null)`, and is where you can remove all intermediate
   * objects created in onAdd.
   */
  public onRemove(): void {}

  /**
   * Triggers the map to update GL state.
   */
  public requestStateUpdate(): void {
    this.overlay.requestStateUpdate();
  }

  /**
   * Triggers the map to redraw a frame.
   */
  public requestRedraw(): void {
    this.overlay.requestRedraw();
  }

  /**
   * Returns the map the overlay is added to.
   */
  public getMap(): google.maps.Map | null | undefined {
    return this.overlay.getMap();
  }

  /**
   * Adds the overlay to the map.
   * @param map The map to access the div, model and view state.
   */
  public setMap(map: google.maps.Map): void {
    this.overlay.setMap(map);
  }

  /**
   * Adds the given listener function to the given event name. Returns an
   * identifier for this listener that can be used with
   * <code>google.maps.event.removeListener</code>.
   * @param eventName The name of the event to listen for.
   * @param handler The function to call when the event occurs.
   * @returns An identifier for this listener that can be used with
   */
  public addListener(
    eventName: string,
    handler: (...args: unknown[]) => void
  ): google.maps.MapsEventListener {
    return this.overlay.addListener(eventName, handler);
  }

  /**
   * This method is called once the rendering context is available. Use it to
   * initialize or bind any WebGL state such as shaders or buffer objects.
   * @param options that allow developers to restore the GL context.
   * @param options.gl The WebGL context to used for rendering.
   */
  public onContextRestored({ gl }: google.maps.WebGLStateOptions) {
    // dispose existing engine and scene
    if (this._scene) {
      this._scene.dispose();
    }

    if (this._engine) {
      this._engine.dispose();
    }

    // create new engine and scene with and inject the GL context
    this._engine = new Engine(gl, this.options.antialias, {
      ...gl.getContextAttributes(),
      adaptToDeviceRatio: this.options.adaptToDeviceRatio ?? false,
    });

    this._engine.stopRenderLoop();

    // setup the scene
    this._scene = new Scene(this._engine);
    this._scene.clearColor = new Color4(0, 0, 0, 0);
    this._scene.autoClear = false;
    this._scene.autoClearDepthAndStencil = false;
    this._scene.useRightHandedSystem =
      this.options.useRightHandedSystem ?? false;

    if (this.options.addDefaultLighting) {
      this.initSceneLighting();
    }

    // setup the camera if not specified in the options
    this._camera = this._camera ?? this._createCamera();
  }

  /**
   * This method is called when the rendering context is lost for any reason,
   * and is where you should clean up any pre-existing GL state, since it is
   * no longer needed.
   */
  public onContextLost() {
    this._engine?.dispose();
  }

  /**
   * Implement this method to draw WebGL content directly on the map. Note
   * that if the overlay needs a new frame drawn then call {@link
   * BabylonJSWebGLOverlayView.requestRedraw}.
   * @param drawOptions containing the GL context and the transformer to convert
   *   between lat/lng and screen coordinates.
   * @param drawOptions.gl The WebGL context to used for rendering.
   * @param drawOptions.transformer The transformer to convert between lat/lng
   */
  public onDraw(drawOptions: google.maps.WebGLDrawOptions): void {
    const { transformer } = drawOptions;

    if (
      typeof this._engine === undefined ||
      this._engine.isDisposed ||
      this._scene.isDisposed ||
      !this._scene.activeCamera
    ) {
      this.overlay.requestRedraw();
      return;
    }

    // transfrom the babylonjs camera to the correct position and
    // orientation in the scene
    const projectionMatrix = this._camera.getProjectionMatrix();
    projectionMatrix.copyFrom(
      Matrix.FromArray(
        transformer.fromLatLngAltitude(
          {
            lat: this.anchor.lat,
            lng: this.anchor.lng,
            altitude: this.anchor.altitude,
          },
          this.rotationArray
        )
      )
    );

    // drawOptions.gl.disable(drawOptions.gl.SCISSOR_TEST); //you might want to enable this if you experience issues

    this._engine.wipeCaches(true);
    this._scene.render();
    this._engine.wipeCaches(true);
    this._engine.depthCullingState.apply(this._engine._gl);

    // if the animation mode is set to "always", we need to
    // request a redraw to keep the scene updated
    if (this.animationMode === "always") {
      this.requestRedraw();
    }
  }

  /**
   * Convert coordinates from WGS84 Latitude Longitude to world-space
   * coordinates while taking the origin and orientation into account.
   * @param position the position to convert
   * @param target the target vector to write the result to
   * @returns the target vector
   */
  public latLngAltitudeToVector3Ref(
    position: LatLngTypes,
    target = new Vector3()
  ) {
    latLngToVector3Relative(
      toLatLngAltitudeLiteral(position),
      this.anchor,
      target
    );

    target.applyRotationQuaternion(this.rotationInverse);

    return target;
  }

  /**
   * Binds a View to a Model.
   * @param key The name of the property to bind.
   * @param target The target object to bind to.
   * @param targetKey The name of the property to bind to.
   * @param noNotify If true, the target will not be notified of the change.
   */
  public bindTo(
    key: string,
    target: google.maps.MVCObject,
    targetKey?: string,
    noNotify?: boolean
  ): void {
    this.overlay.bindTo(key, target, targetKey, noNotify);
  }

  /**
   * Gets a value.
   * @param key The name of the property to get.
   */
  public get(key: string) {
    return this.overlay.get(key);
  }

  /**
   * Sets a value.
   * @param key The name of the property to set.
   * @param value The value to set.
   */
  public set(key: string, value: unknown): void {
    this.overlay.set(key, value);
  }

  /**
   * Notify all observers of a change on this property. This notifies both
   * objects that are bound to the object's property as well as the object
   * that it is bound to.
   */
  public notify(key: string): void {
    this.overlay.notify(key);
  }

  /**
   * Sets a collection of key-value pairs.
   * @param values The object containing the key-value pairs.
   */
  public setValues(values?: object): void {
    this.overlay.setValues(values);
  }

  /**
   * Removes a binding. Unbinding will set the unbound property to the current
   * value. The object will not be notified, as the value has not changed.
   * @param key The name of the property to unbind.
   */
  public unbind(key: string): void {
    this.overlay.unbind(key);
  }

  /**
   * Removes all bindings.
   */
  public unbindAll(): void {
    this.overlay.unbindAll();
  }

  private _createCamera() {
    const camera = new FreeCamera(CAMERA_NAME, new Vector3(), this._scene);
    camera.minZ = 0.01;
    return camera;
  }

  /**
   * Creates a hemispheric light to illuminate the model
   * (roughly approximates the lighting of buildings in maps)
   */
  private initSceneLighting() {
    const light = new HemisphericLight(
      "gmaps-light",
      new Vector3(0, -0.2, 1).normalize(),
      this._scene
    );
    light.intensity = 0.7;
    light.groundColor = new Color3(1, 1, 1);
    light.diffuse = new Color3(0.27, 0.27, 0.27);
  }
}
