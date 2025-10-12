# babylon.js Google Maps Overlay View

A library for integrating [babylon.js](https://www.babylonjs.com/) 3D rendering with [Google Maps OverlayView](https://developers.google.com/maps/documentation/javascript/reference/overlay-view), enabling seamless 3D overlays on Google Maps.

## Features

- Render babylon.js scenes as overlays on Google Maps
- Synchronize 3D objects with map movements and zoom
- Easy integration with existing Google Maps projects

## Installation

Copy the `src/overlay` directory to your project.

```bash
npm i @googlemaps/js-api-loader @types/google.maps
```

## Usage

Create `.env` file in the root of the project and add `VITE_GMAPS_KEY=your-gmaps-key`

See the example code: [src/main.ts](src/main.ts)

## Requirements

- [babylon.js](https://www.npmjs.com/package/babylonjs)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)

## Development

1. Clone the repo
2. Install dependencies: `npm install`
3. Run the demo or tests as needed `npm run dev`

### Issues

The Google Maps Overlay View WebGL implementation uses the right handed coordinate system. When setting the babylon.js scene to use the right handed system the roads disappear on the map.

#### Temporary solution

Use the left handed coordinate system for your scene and apply the `fixMesh` method to your meshes. This converts the mesh as if it was created with the right handed coordinate system.

## License

MIT

## Credits

- [babylon.js](https://www.babylonjs.com/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)
- Inspired by Google examples
