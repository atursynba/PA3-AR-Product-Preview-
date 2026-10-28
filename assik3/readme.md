# PA3 — AR Web Application (Hit-Testing & Anchors)

* **Student ID**: 243121
* **Variant**: Bar stool, multi-placement, 12° tolerance, keep hit pose.

## Porting notes (Three.js 0.186.1 fixes)
In this assignment, Three.js was upgraded to version `0.186.1`, which introduced breaking changes resolved as follows:
1. **WebGLRenderer constructor**: Updated initialization parameters to match the strict requirements of version 0.186.1.
2. **Geometry constructors**: Replaced outdated or deprecated geometry definitions with valid constructors (e.g., `RingGeometry`).
3. **Hit-test source management**: Fixed the request loop so that a new hit-test source is no longer requested on every frame, preventing memory leaks and performance drops.

## Features
* **Hit-testing & Reticle**: Uses WebXR session with `hit-test` features. The reticle changes color based on surface angle tolerance (12°).
* **Product Model**: Bar stool built from primitives inside a `THREE.Group`, verified within ±2 cm of the variant specification.
* **Anchors & Placement**: Multi-placement mode supporting surface anchors with fallback handling.
* **DOM Overlay**: Real-time monitoring panel displaying student ID, session state, reticle status, and product count.
