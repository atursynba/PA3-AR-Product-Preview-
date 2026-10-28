import * as THREE from "three";

let camera, scene, renderer, controller, reticle;
let xrSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let placeRequested = false;

const placedProducts = []; // Массив для хранения размещенных стульев (multi-mode до 5 штук)
const MAX_PRODUCTS = 5;

// Элементы интерфейса
const statusDiv = document.getElementById("status");
const startBtn = document.getElementById("start-btn");
const clearBtn = document.getElementById("clear");
const fallbackDiv = document.getElementById("fallback");

init();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // Освещение для MeshStandardMaterial (требование Task C)
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  hemisphereLight.position.set(0.5, 1, 0.2);
  scene.add(hemisphereLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Исправленный конструктор рендерера для Three.js 0.186.1 (передаем canvas вместо параметров)
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  // Создание прицела (Reticle)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Контроллер для отслеживания тапов по экрану (select)
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", () => {
    placeRequested = true;
  });
  scene.add(controller);

  // Кнопка очистки сцены
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearAllProducts();
  });

  // Проверка поддержки WebXR immersive-ar
  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (supported) {
        startBtn.style.display = "block";
        startBtn.addEventListener("click", toggleARSession);
        statusDiv.textContent = "Status: Ready to start AR";
      } else {
        fallbackDiv.textContent = "WebXR immersive-ar not supported on this device/browser.";
        statusDiv.textContent = "Status: AR Unsupported";
      }
    });
  } else {
    fallbackDiv.textContent = "WebXR API not available in this browser.";
    statusDiv.textContent = "Status: WebXR Missing";
  }

  window.addEventListener("resize", onWindowResize);
}

function toggleARSession() {
  if (xrSession === null) {
    const sessionInit = {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["anchors", "dom-overlay"],
      domOverlay: { root: document.body }
    };

    navigator.xr.requestSession("immersive-ar", sessionInit).then(onSessionStarted).catch((err) => {
      console.error("Failed to start AR session:", err);
      statusDiv.textContent = "Status: AR Start Failed";
    });
  } else {
    xrSession.end();
  }
}

function onSessionStarted(session) {
  xrSession = session;
  startBtn.textContent = "STOP AR";
  clearBtn.style.display = "block";
  statusDiv.textContent = "Status: AR Running";

  session.addEventListener("end", onSessionEnd);

  renderer.xr.setReferenceSpaceType("local");
  renderer.xr.setSession(session);
  renderer.setAnimationLoop(render);
}

function onSessionEnd() {
  xrSession = sessionEndCleanup;
  startBtn.textContent = "START AR";
  clearBtn.style.display = "none";
  statusDiv.textContent = "Status: AR Stopped";

  hitTestSource = null;
  hitTestSourceRequested = false;
  xrSession = null;

  clearAllProducts();
  reticle.visible = false;
  renderer.setAnimationLoop(null);
}

function sessionEndCleanup() {
  xrSession = null;
}

// Построение продукта: Барный стул (Bar Stool) из примитивов, origin в центре основания
function buildProduct() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.4 }); // Деревянные элементы
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });

  // 1. Сиденье (Seat Ø 0.35м, толщина 0.05м, высота центра 0.75м)
  const seatGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.05, 32);
  const seat = new THREE.Mesh(seatGeo, mat);
  seat.position.y = 0.75;
  group.add(seat);

  // 2. Четыре ножки (4 legs, высота 0.75м)
  const legGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.75, 16);
  const legOffsets = [
    [ 0.12,  0.12],
    [-0.12,  0.12],
    [ 0.12, -0.12],
    [-0.12, -0.12]
  ];

легОффсетс = legOffsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(x, 0.375, z);
    // Легкий наклон ножек наружу для устойчивости
    leg.rotation.z = x > 0 ? -0.1 : 0.1;
    leg.rotation.x = z > 0 ? 0.1 : -0.1;
    group.add(leg);
  });

  return group;
}

function render(timestamp, frame) {
  if (!frame) return;

  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();

  // Запрос источника Hit-Test один раз
  if (!hitTestSourceRequested) {
    session.requestReferenceSpace("viewer").then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSource = source;
      });
    });
    hitTestSourceRequested = true;
  }

  if (hitTestSource) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(referenceSpace);

      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);

      // Проверка угла наклона поверхности (Surface Tolerance = 12° для вашего ID)
      const hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const normal = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(hitMatrix));
      const up = new THREE.Vector3(0, 1, 0);
      const angleDeg = THREE.MathUtils.radToDeg(normal.angleTo(up));

      const maxTolerance = 12; // Из вашего варианта (1 mod 3 = 1 -> 12°)
      const isValidSurface = angleDeg <= maxTolerance;

      // Изменение цвета прицела: зеленый — можно ставить, красный — слишком наклонено
      reticle.material.color.setHex(isValidSurface ? 0x00ff00 : 0xff0000);
      statusDiv.textContent = `Status: Surface tilt: ${angleDeg.toFixed(1)}° (${isValidSurface ? "Valid" : "Too tilted"})`;

      // Обработка тапа по экрану (placement)
      if (placeRequested) {
        placeRequested = false;

        if (isValidSurface) {
          const product = buildProduct();
          
          // Применяем матрицу позы попадания (Facing rule = keep hit pose, без доворота к камере)
          product.matrix.fromArray(pose.transform.matrix);
          product.matrixAutoUpdate = false;
          scene.add(product);

          // Логика multi-mode (до 5 предметов, 6-й удаляет самый старый)
          const anchorPromise = session.enabledFeatures && session.enabledFeatures.includes("anchors") && hit.createAnchor 
            ? hit.createAnchor(pose.transform) 
            : Promise.resolve(null);

          anchorPromise.then((anchor) => {
            placedProducts.push({ object: product, anchor: anchor });

            if (placedProducts.length > MAX_PRODUCTS) {
              const oldest = placedProducts.shift();
              scene.remove(oldest.object);
              if (oldest.anchor) oldest.anchor.delete();
            }
          }).catch((err) => {
            console.error("Anchor creation failed:", err);
            placedProducts.push({ object: product, anchor: null });
          });
        }
      }
    } else {
      reticle.visible = false;
      statusDiv.textContent = "Status: Searching for surface...";
    }
  }

  // Обновление позиций через анкоры, если они поддерживаются
  for (let i = 0; i < placedProducts.length; i++) {
    const item = placedProducts[i];
    if (item.anchor) {
      const anchorPose = frame.getPose(item.anchor.anchorSpace, referenceSpace);
      if (anchorPose) {
        item.object.matrix.fromArray(anchorPose.transform.matrix);
      }
    }
  }

  renderer.render(scene, camera);
}

function clearAllProducts() {
  for (let i = 0; i < placedProducts.length; i++) {
    const item = placedProducts[i];
    scene.remove(item.object);
    if (item.anchor) {
      item.anchor.delete();
    }
  }
  placedProducts.length = 0;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

