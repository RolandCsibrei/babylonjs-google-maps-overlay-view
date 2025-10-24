# babylon.js Maps Overlay GL

Render babylon.js scenes directly into the GL context of the map!

Currently supports Google Maps and Mapbox.

## Features

- Render babylon.js scenes into the GL context of the map
- Synchronize 3D objects with map movements and zoom

## Installation - only if you are going to use this in your own project

Copy the `src/google-maps` or `src/mapbox` directory to your project.

Google maps dependencies:

```bash
npm i @googlemaps/js-api-loader @types/google.maps
```

Mapbox dependecies:

```bash
npm i mapbox-gl
```

## Development and demo

1. Clone the repo
2. Install dependencies: `npm install`
3. Run the examples page `npm run dev`

## API KEYS

Create an `.env` file in the root of the project and add `VITE_GMAPS_KEY=your-gmaps-key` and/or `VITE_MAPBOX_TOKEN=mapbox-token`.

See the example code: [src/examples](src/examples)

### Issues

The Google Maps Overlay View WebGL implementation uses the right handed coordinate system. When setting the babylon.js scene to use the right handed system the roads disappear on the map.

#### Temporary solution

Use the left handed coordinate system for your scene and apply the `fixMesh` function to your meshes. This converts the mesh as if it was created with the right handed coordinate system.

## License

Apache License 2.0.

## Credits

- [babylon.js](https://www.babylonjs.com/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)
- Inspired by Google and Mapbox examples

## Thanks to

[tibotiber](https://github.com/tibotiber) for the idea to implement Mapbox and for providing a sample project!

## Link to babylon.js forum

<https://forum.babylonjs.com/t/babylon-js-meets-google-maps-new-mapbox-support/60923>
