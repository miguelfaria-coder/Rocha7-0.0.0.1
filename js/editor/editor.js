/* editor.js - Editor 3D Mockup com Seletor de Modelo, Controles Avançados & Exportar PNG */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { PRODUTOS, calcularPrecoUnitario } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';
import { createGarmentModel, createMugModel } from './realisticModels.js';

const THREE = window.THREE;
const OrbitControls = window.THREE?.OrbitControls || null;
const GLTFLoader = window.THREE?.GLTFLoader || null;
const TSHIRT_GLTF_DATA = window.TSHIRT_GLTF_DATA;

document.addEventListener("DOMContentLoaded", () => {
  try { renderHeader(); } catch (err) { }
  try { renderFooter(); } catch (err) { }
  initEditor3DReal();
});

/* =========================================================
   CONFIGURAÇÃO DE MODELOS DE CAMISETA
   =========================================================
   Cada modelo define:
   - label: nome exibido no título
   - path: caminho para o arquivo .glb/.gltf (null = usa fallback inline)
   - isPlaceholder: se true, mostra aviso de placeholder
   
   TODO: Substituir os paths null abaixo pelos arquivos .glb reais
         quando os modelos finais estiverem prontos.
   ========================================================= */
const MODELOS = {
  normal: {
    label: 'Camiseta Normal',
    path: 'assets/models/T_shirt_gltf.zip.gltf',  // Modelo real existente
    isPlaceholder: false
  },
  football_jersey: {
    label: 'Polo Futebol com zíper',
    path: null,
    isPlaceholder: false,
    isProcedural: true
  },
  polo: {
    label: 'Camiseta Polo',
    path: null,
    isPlaceholder: false,
    isProcedural: true
  },
  caneca: {
    label: 'Caneca',
    path: null,
    isPlaceholder: false,
    isMug: true
  },
  moletom: {
    label: 'Moletom',
    path: null,
    isPlaceholder: false,
    isProcedural: true
  }
};

function initEditor3DReal() {
  // ---- DOM Elements ----
  const stage = document.getElementById("canvas-3d-stage");
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingText = document.getElementById("loading-text");
  const printArea2D = document.getElementById("print-area-2d");
  const printAreaTag = document.getElementById("print-area-tag");

  const btnViewFrente = document.getElementById("btn-view-frente");
  const btnViewCostas = document.getElementById("btn-view-costas");
  const btnResetCam = document.getElementById("btn-reset-cam");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");

  const textInput = document.getElementById("editor-texto-input");
  const btnAddText = document.getElementById("btn-add-texto");
  const fonteSelect = document.getElementById("editor-fonte-select");
  const corTextoInput = document.getElementById("editor-cor-texto");
  const imgUpload = document.getElementById("editor-img-upload");
  const coresContainer = document.getElementById("editor-cores-container");
  const corCustomInput = document.getElementById("editor-cor-custom");

  const controlesElemento = document.getElementById("controles-elemento-selecionado");
  const btnAumentar = document.getElementById("btn-elem-aumentar");
  const btnDiminuir = document.getElementById("btn-elem-diminuir");
  const btnRotacionar = document.getElementById("btn-elem-rotacionar");
  const btnRemover = document.getElementById("btn-elem-remover");
  const btnCenter = document.getElementById("btn-elem-center");
  const btnUp = document.getElementById("btn-elem-up");
  const btnDown = document.getElementById("btn-elem-down");
  const btnLeft = document.getElementById("btn-elem-left");
  const btnRight = document.getElementById("btn-elem-right");

  // Sliders
  const sliderPosX = document.getElementById("slider-pos-x");
  const sliderPosY = document.getElementById("slider-pos-y");
  const sliderScale = document.getElementById("slider-scale");
  const sliderRotation = document.getElementById("slider-rotation");
  const sliderValX = document.getElementById("slider-val-x");
  const sliderValY = document.getElementById("slider-val-y");
  const sliderValScale = document.getElementById("slider-val-scale");
  const sliderValRotation = document.getElementById("slider-val-rotation");

  // Model selector
  const modelSelectorGrid = document.getElementById("model-selector-grid");
  const modelPlaceholderNotice = document.getElementById("model-placeholder-notice");
  const canvasModelTitle = document.getElementById("canvas-model-title");

  // Right panel
  const selectTamanho = document.getElementById("editor-tamanho-select");
  const inputQtd = document.getElementById("editor-qtd-input");
  const precoUnitarioEl = document.getElementById("editor-preco-unitario");
  const btnSalvar = document.getElementById("btn-salvar-confirmar-design");
  const btnExportarPng = document.getElementById("btn-exportar-png");

  if (!stage) return;

  // ---- State ----
  let currentView = "front";
  let activePiece = "front"; // "front", "back", "left_sleeve", "right_sleeve", "collar"
  let currentModelId = "normal";
  let elementoSelecionado = null;
  let corTecidoAtual = "#ffffff";
  let produtoBase = PRODUTOS.find(p => p.id === "prod-3") || PRODUTOS[0];

  // 2D Print Canvas Elements by Piece
  const elementosMap = {
    front: [],
    back: [],
    left_sleeve: [],
    right_sleeve: [],
    collar: []
  };

  // Legacy compatibility aliases
  const elementosFrente = elementosMap.front;
  const elementosCostas = elementosMap.back;

  // DOM elements for 2D flat pattern stage
  const pieceTabsContainer = document.getElementById("piece-selector-tabs");
  const activePieceLabel = document.getElementById("active-piece-label");
  const uploadPieceTarget = document.getElementById("upload-piece-target");
  const svgOutlinePath = document.getElementById("svg-outline-path");
  const svgPatternTitle = document.getElementById("svg-pattern-title");
  const flatCanvasEl = document.getElementById("flat-pattern-interactive-canvas");
  let flatCanvasCtx = flatCanvasEl ? flatCanvasEl.getContext("2d") : null;

  // SVG Pattern Paths for each garment piece
  const PATTERN_PATHS = {
    front: "M 120 40 Q 250 80 380 40 L 440 100 L 410 160 L 370 160 L 370 480 L 130 480 L 130 160 L 90 160 L 60 100 Z",
    back: "M 120 50 Q 250 60 380 50 L 440 110 L 410 170 L 370 170 L 370 480 L 130 480 L 130 170 L 90 170 L 60 110 Z",
    left_sleeve: "M 60 40 C 150 10 350 10 440 40 L 480 300 L 20 300 Z",
    right_sleeve: "M 60 40 C 150 10 350 10 440 40 L 480 300 L 20 300 Z",
    collar: "M 50 120 C 150 40 350 40 450 120 C 350 180 150 180 50 120 Z"
  };

  const PATTERN_TITLES = {
    front: "MOLDE: FRENTE",
    back: "MOLDE: COSTAS",
    left_sleeve: "MOLDE: MANGA ESQUERDA",
    right_sleeve: "MOLDE: MANGA DIREITA",
    collar: "MOLDE: GOLA / ZÍPER"
  };

  const PATTERN_LABELS = {
    front: "FRENTE",
    back: "COSTAS",
    left_sleeve: "MANGA ESQUERDA",
    right_sleeve: "MANGA DIREITA",
    collar: "GOLA/ZÍPER"
  };

  // Three.js Variables
  let scene, camera, renderer, controls;
  let tshirtGroup;
  const tshirtMeshes = [];
  let decalFrontMesh, decalBackMesh, decalLeftSleeveMesh, decalRightSleeveMesh;
  let textureFront, textureBack, textureLeftSleeve, textureRightSleeve;
  let canvasMap = {};
  let ctxMap = {};

  const CANVAS_RESOLUTION = 1024;

  // ---- Initialize 3D Engine ----
  initThreeJS();

  function initThreeJS() {
    // 1. Scene setup
    scene = new THREE.Scene();

    // 2. Camera setup
    const aspect = stage.clientWidth / stage.clientHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    stage.insertBefore(renderer.domElement, stage.firstChild);

    // 4. OrbitControls setup (360° mouse rotation & zoom)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 4;
    controls.target.set(0, 0, 0);

    // Track camera angle to sync Front/Back UI
    controls.addEventListener("change", () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      if (dir.z > 0.1 && currentView !== "back") {
        currentView = "back";
      } else if (dir.z < -0.1 && currentView !== "front") {
        currentView = "front";
      }
    });

    // 5. Lighting setup for realistic fabric rendering
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(5, 8, 5);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight2.position.set(-5, 4, -5);
    scene.add(dirLight2);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
    fillLight.position.set(0, -4, 5);
    scene.add(fillLight);

    // 6. Setup 2D Texture Canvases for 3D Projection
    setup2DCanvases();

    // 7. Setup Piece Tabs & 2D Interactive Dragging
    setupPieceTabs();
    setupFlatPatternDragging();

    // 8. Load default model
    loadModel(currentModelId);

    // 9. Render loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", onWindowResize);
  }

  function onWindowResize() {
    if (!renderer || !camera || !stage) return;
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  // ---- 2D Offscreen Canvases for 3D Decal Textures ----
  function setup2DCanvases() {
    const pieces = ["front", "back", "left_sleeve", "right_sleeve", "collar"];
    pieces.forEach(p => {
      const cvs = document.createElement("canvas");
      cvs.width = CANVAS_RESOLUTION;
      cvs.height = CANVAS_RESOLUTION;
      canvasMap[p] = cvs;
      ctxMap[p] = cvs.getContext("2d");
    });

    textureFront = new THREE.CanvasTexture(canvasMap.front);
    textureFront.anisotropy = 16;

    textureBack = new THREE.CanvasTexture(canvasMap.back);
    textureBack.anisotropy = 16;

    textureLeftSleeve = new THREE.CanvasTexture(canvasMap.left_sleeve);
    textureLeftSleeve.anisotropy = 16;

    textureRightSleeve = new THREE.CanvasTexture(canvasMap.right_sleeve);
    textureRightSleeve.anisotropy = 16;

    pieces.forEach(p => update2DTexture(p));
  }

  // ---- Setup 2D Pattern Piece Tabs (Pacdora Style) ----
  function setupPieceTabs() {
    if (!pieceTabsContainer) return;

    pieceTabsContainer.querySelectorAll(".piece-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        pieceTabsContainer.querySelectorAll(".piece-tab").forEach(t => t.classList.remove("piece-tab--active"));
        tab.classList.add("piece-tab--active");
        const targetPiece = tab.getAttribute("data-piece");
        setActivePiece(targetPiece);
      });
    });
  }

  function setActivePiece(pieceId) {
    activePiece = pieceId;

    if (activePieceLabel) activePieceLabel.textContent = PATTERN_LABELS[pieceId] || pieceId.toUpperCase();
    if (uploadPieceTarget) uploadPieceTarget.textContent = PATTERN_LABELS[pieceId] || pieceId.toUpperCase();
    if (svgOutlinePath) svgOutlinePath.setAttribute("d", PATTERN_PATHS[pieceId] || PATTERN_PATHS.front);
    if (svgPatternTitle) svgPatternTitle.textContent = PATTERN_TITLES[pieceId] || pieceId.toUpperCase();

    // Rotate 3D camera to face selected piece automatically
    if (camera && controls) {
      if (pieceId === "front") camera.position.set(0, 0, 4.5);
      else if (pieceId === "back") camera.position.set(0, 0, -4.5);
      else if (pieceId === "left_sleeve") camera.position.set(4.5, 0, 0);
      else if (pieceId === "right_sleeve") camera.position.set(-4.5, 0, 0);
      else if (pieceId === "collar") camera.position.set(0, 1.2, 3.5);
      controls.target.set(0, 0, 0);
      controls.update();
    }

    renderFlatPatternCanvas();
  }

  // ---- Render Active Piece on 2D Pattern Canvas ----
  function renderFlatPatternCanvas() {
    if (!flatCanvasEl || !flatCanvasCtx) return;
    const w = flatCanvasEl.width;
    const h = flatCanvasEl.height;

    flatCanvasCtx.clearRect(0, 0, w, h);

    const items = elementosMap[activePiece] || [];
    items.forEach(item => {
      flatCanvasCtx.save();
      const x = item.x * w;
      const y = item.y * h;

      flatCanvasCtx.translate(x, y);
      flatCanvasCtx.rotate(((item.rotation || 0) * Math.PI) / 180);
      flatCanvasCtx.scale(item.scale || 1, item.scale || 1);

      if (item.type === "text") {
        flatCanvasCtx.font = `800 ${item.fontSize || 42}px ${item.fontFamily || 'Outfit'}`;
        flatCanvasCtx.fillStyle = item.color || '#f35e0e';
        flatCanvasCtx.textAlign = 'center';
        flatCanvasCtx.textBaseline = 'middle';
        flatCanvasCtx.fillText(item.text, 0, 0);
      } else if (item.type === "image" && item.imgElement) {
        const imgW = item.width || 220;
        const imgH = item.height || 220;
        flatCanvasCtx.drawImage(item.imgElement, -imgW / 2, -imgH / 2, imgW, imgH);
      }

      flatCanvasCtx.restore();
    });
  }

  // ---- 2D Interactive Dragging on Flat Pattern Stage ----
  function setupFlatPatternDragging() {
    if (!flatCanvasEl) return;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let itemStartX = 0, itemStartY = 0;

    flatCanvasEl.addEventListener("mousedown", (e) => {
      const items = elementosMap[activePiece] || [];
      if (items.length === 0) return;

      const item = items[items.length - 1]; // active item
      selecionarElemento(item, null);

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      itemStartX = item.x;
      itemStartY = item.y;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging || !elementoSelecionado) return;
      const rect = flatCanvasEl.getBoundingClientRect();
      const dx = (e.clientX - dragStartX) / rect.width;
      const dy = (e.clientY - dragStartY) / rect.height;

      elementoSelecionado.x = Math.max(0.05, Math.min(0.95, itemStartX + dx));
      elementoSelecionado.y = Math.max(0.05, Math.min(0.95, itemStartY + dy));

      renderFlatPatternCanvas();
      update2DTexture(activePiece);
      syncSlidersToElement(elementoSelecionado);
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }
  textureBack.anisotropy = 16;

  update2DTexture("front");
  update2DTexture("back");

/* =========================================================
   SISTEMA DE TROCA DE MODELO
   ========================================================= */
function loadModel(modelId) {
  const modelConfig = MODELOS[modelId];
  if (!modelConfig) return;

  currentModelId = modelId;

  // Sincroniza o produto comercial com o modelo visual selecionado.
  produtoBase = PRODUTOS.find(p => p.id === (modelConfig.isMug ? "prod-10" : "prod-3")) || produtoBase;
  if (selectTamanho) {
    selectTamanho.innerHTML = modelConfig.isMug
      ? '<option value="325ml">Caneca 325 ml</option>'
      : '<option value="P">Tamanho P</option><option value="M" selected>Tamanho M</option><option value="G">Tamanho G</option><option value="GG">Tamanho GG</option><option value="EXG">Tamanho EXG</option>';
    selectTamanho.value = modelConfig.isMug ? "325ml" : "M";
  }
  if (typeof atualizarPreco === "function") atualizarPreco();

  // UI: show loading
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
  if (loadingText) loadingText.textContent = `Carregando ${modelConfig.label}...`;

  // UI: update model title
  if (canvasModelTitle) {
    canvasModelTitle.textContent = `Modelo 3D — ${modelConfig.label}`;
  }

  // UI: placeholder notice
  if (modelPlaceholderNotice) {
    modelPlaceholderNotice.style.display = modelConfig.isPlaceholder ? 'block' : 'none';
  }

  // UI: update model selector active state
  if (modelSelectorGrid) {
    modelSelectorGrid.querySelectorAll('.model-card').forEach(card => {
      card.classList.toggle('model-card--active', card.getAttribute('data-model') === modelId);
    });
  }

  // Remove existing model from scene
  removeCurrentModel();

  // Caneca com corpo cerâmico, interior e alça lateral modelados em geometria própria.
  if (modelConfig.isMug) {
    const mug = createMugModel(THREE, corTecidoAtual);
    const printMaterial = mug.children[0].material;
    printMaterial.map = textureFront;
    printMaterial.needsUpdate = true;
    tshirtGroup = mug;
    tshirtMeshes.length = 0;
    mug.traverse(child => { if (child.isMesh) tshirtMeshes.push(child); });
    scene.add(mug);
    update2DTexture('front');
    const pieceTabs = document.querySelectorAll('#piece-selector-tabs .piece-tab');
    pieceTabs.forEach(tab => { tab.style.display = tab.dataset.piece === 'front' ? '' : 'none'; });
    const frontTabLabel = document.querySelector('#tab-piece-front span');
    if (frontTabLabel) frontTabLabel.textContent = '☕ Estampa';
    if (activePiece !== 'front') {
      activePiece = 'front';
      const frontTab = document.getElementById('tab-piece-front');
      if (frontTab) frontTab.click();
    }
    if (printAreaTag) printAreaTag.textContent = 'ÁREA DE ESTAMPA DA CANECA';
    if (svgOutlinePath) svgOutlinePath.setAttribute('d', 'M 145 95 L 355 95 L 340 420 Q 250 445 160 420 Z');
    if (svgPatternTitle) svgPatternTitle.textContent = 'MOLDE: CANECA';
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    return;
  }

  // Restaura as abas de roupa ao sair da caneca.
  document.querySelectorAll('#piece-selector-tabs .piece-tab').forEach(tab => {
    tab.style.display = '';
  });
  const frontTabLabel = document.querySelector('#tab-piece-front span');
  if (frontTabLabel) frontTabLabel.textContent = '👕 Frente';
  if (printAreaTag) printAreaTag.textContent = 'ÁREA DE ESTAMPA';
  if (svgOutlinePath && PATTERN_PATHS.front) svgOutlinePath.setAttribute('d', PATTERN_PATHS.front);
  if (svgPatternTitle && PATTERN_TITLES.front) svgPatternTitle.textContent = PATTERN_TITLES.front;

  // Modelos de roupa criados diretamente em Three.js, sem placeholders.
  if (modelConfig.isProcedural) {
    const garment = createGarmentModel(THREE, modelId, corTecidoAtual);
    const bounds = new THREE.Box3().setFromObject(garment);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    garment.position.sub(center);
    const scale = 2.1 / Math.max(size.x, size.y, size.z);
    garment.scale.setScalar(scale);

    tshirtGroup = garment;
    tshirtMeshes.length = 0;
    garment.traverse(child => {
      if (child.isMesh) tshirtMeshes.push(child);
    });
    scene.add(garment);
    setupDecalMeshes(size, scale);
    update2DTexture('front');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    return;
  }

  const gltfLoader = new GLTFLoader();

  function onModelLoaded(gltf) {
    const model = gltf.scene;

    // Centralizar e calibrar escala
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);

    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetScale = 2.1 / maxDimension;
    model.scale.set(targetScale, targetScale, targetScale);

    // Mapear malhas da camiseta
    tshirtMeshes.length = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        tshirtMeshes.push(child);
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(corTecidoAtual),
          roughness: 0.75,
          metalness: 0.02,
          side: THREE.DoubleSide
        });
      }
    });

    tshirtGroup = model;
    scene.add(model);

    // Posicionar decalques 3D
    setupDecalMeshes(size, targetScale);

    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }

  // Se é placeholder (sem arquivo .glb próprio), usa fallback do modelo normal
  const modelPath = modelConfig.path;

  if (modelPath) {
    // Tentar carregar via HTTP
    gltfLoader.load(
      modelPath,
      (gltf) => {
        console.log(`${modelConfig.label} carregado com sucesso via HTTP.`);
        onModelLoaded(gltf);
      },
      undefined,
      (error) => {
        console.warn(`Falha ao carregar ${modelPath}, usando fallback inline:`, error);
        loadFromInlineData(gltfLoader, onModelLoaded);
      }
    );
  } else {
    // Placeholder: usa o modelo inline como fallback
    console.log(`${modelConfig.label}: usando modelo placeholder (T-shirt normal).`);
    loadFromInlineData(gltfLoader, onModelLoaded);
  }
}


function loadFromInlineData(gltfLoader, callback) {
  try {
    gltfLoader.parse(
      JSON.stringify(TSHIRT_GLTF_DATA),
      '',
      (gltf) => {
        console.log("Modelo parsed a partir dos dados inline.");
        callback(gltf);
      },
      (parseErr) => {
        console.error("Erro ao parsear dados GLTF inline:", parseErr);
        if (loadingOverlay) loadingOverlay.classList.add("hidden");
      }
    );
  } catch (err) {
    console.error("Erro no fallback GLTF:", err);
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }
}

function removeCurrentModel() {
  if (tshirtGroup) {
    scene.remove(tshirtGroup);

    // Dispose geometries and materials
    tshirtGroup.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    tshirtGroup = null;
  }

  if (decalFrontMesh) {
    if (decalFrontMesh.geometry) decalFrontMesh.geometry.dispose();
    if (decalFrontMesh.material) decalFrontMesh.material.dispose();
    decalFrontMesh = null;
  }

  if (decalBackMesh) {
    if (decalBackMesh.geometry) decalBackMesh.geometry.dispose();
    if (decalBackMesh.material) decalBackMesh.material.dispose();
    decalBackMesh = null;
  }

  decalLeftSleeveMesh = null;
  decalRightSleeveMesh = null;
  tshirtMeshes.length = 0;
}

// ---- Model Selector Events ----
if (modelSelectorGrid) {
  modelSelectorGrid.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      const modelId = card.getAttribute('data-model');
      if (modelId && modelId !== currentModelId) {
        loadModel(modelId);
      }
    });
  });
}

// ---- Position 3D Decal Quads attached to the T-Shirt Surface ----
function setupDecalMeshes(size, scale) {
  const decalWidth = 0.82;
  const decalHeight = 1.05;
  const planeGeo = new THREE.PlaneGeometry(decalWidth, decalHeight);

  // Decalque da Frente
  const frontMat = new THREE.MeshBasicMaterial({
    map: textureFront,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  decalFrontMesh = new THREE.Mesh(planeGeo, frontMat);
  const decalCenterY = currentModelId === 'moletom' ? -0.04 : 0.02;
  const decalFrontZ = MODELOS[currentModelId]?.isProcedural ? 0.205 : 0.38;
  decalFrontMesh.position.set(0, decalCenterY, decalFrontZ);
  if (tshirtGroup) tshirtGroup.add(decalFrontMesh);

  // Decalque das Costas
  const backMat = new THREE.MeshBasicMaterial({
    map: textureBack,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  decalBackMesh = new THREE.Mesh(planeGeo, backMat);
  decalBackMesh.position.set(0, decalCenterY, -decalFrontZ);
  decalBackMesh.rotation.y = Math.PI;
  if (tshirtGroup) tshirtGroup.add(decalBackMesh);

  // Decalque Manga Esquerda
  const sleeveGeo = new THREE.PlaneGeometry(0.4, 0.4);
  const leftSleeveMat = new THREE.MeshBasicMaterial({
    map: textureLeftSleeve,
    transparent: true,
    depthTest: true,
    depthWrite: false
  });
  decalLeftSleeveMesh = new THREE.Mesh(sleeveGeo, leftSleeveMat);
  decalLeftSleeveMesh.position.set(0.65, 0.1, 0.05);
  decalLeftSleeveMesh.rotation.y = Math.PI / 2;
  if (tshirtGroup) tshirtGroup.add(decalLeftSleeveMesh);

  // Decalque Manga Direita
  const rightSleeveMat = new THREE.MeshBasicMaterial({
    map: textureRightSleeve,
    transparent: true,
    depthTest: true,
    depthWrite: false
  });
  decalRightSleeveMesh = new THREE.Mesh(sleeveGeo, rightSleeveMat);
  decalRightSleeveMesh.position.set(-0.65, 0.1, 0.05);
  decalRightSleeveMesh.rotation.y = -Math.PI / 2;
  if (tshirtGroup) tshirtGroup.add(decalRightSleeveMesh);
}

// ---- Update 2D Texture for 3D Decals ----
function update2DTexture(piece) {
  const pieceKey = piece || activePiece;
  const ctx = ctxMap[pieceKey];
  const elementos = elementosMap[pieceKey] || [];
  let texture = null;

  if (pieceKey === "front") texture = textureFront;
  else if (pieceKey === "back") texture = textureBack;
  else if (pieceKey === "left_sleeve") texture = textureLeftSleeve;
  else if (pieceKey === "right_sleeve") texture = textureRightSleeve;

  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_RESOLUTION, CANVAS_RESOLUTION);
  // A textura da caneca cobre todo o cilindro; o fundo acompanha a cor selecionada.
  if (currentModelId === 'caneca' && pieceKey === 'front') {
    ctx.fillStyle = corTecidoAtual || '#ffffff';
    ctx.fillRect(0, 0, CANVAS_RESOLUTION, CANVAS_RESOLUTION);
  }

  elementos.forEach(item => {
    ctx.save();

    const x = item.x * CANVAS_RESOLUTION;
    const y = item.y * CANVAS_RESOLUTION;

    ctx.translate(x, y);
    ctx.rotate((item.rotation || 0) * Math.PI / 180);
    ctx.scale(item.scale || 1, item.scale || 1);

    if (item.type === "text") {
      ctx.font = `800 ${item.fontSize || 42}px ${item.fontFamily || 'Outfit'}`;
      ctx.fillStyle = item.color || '#f35e0e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.fillText(item.text, 0, 0);
    } else if (item.type === "image" && item.imgElement) {
      const w = item.width || 200;
      const h = item.height || 200;
      ctx.drawImage(item.imgElement, -w / 2, -h / 2, w, h);
    }

    ctx.restore();
  });

  if (texture) texture.needsUpdate = true;
  renderFlatPatternCanvas();
}

// ---- Change Fabric Color dynamically in 3D ----
function setFabricColor(colorHex) {
  corTecidoAtual = colorHex;
  tshirtMeshes.forEach(mesh => {
    if (mesh.userData.fabricPart !== false && mesh.material && mesh.material.color) {
      mesh.material.color.set(colorHex);
      mesh.material.needsUpdate = true;
    }
  });
}

// Color Swatches Events
if (coresContainer) {
  coresContainer.querySelectorAll(".color-option").forEach(swatch => {
    swatch.addEventListener("click", (e) => {
      coresContainer.querySelectorAll(".color-option").forEach(s => s.classList.remove("selecionado"));
      e.currentTarget.classList.add("selecionado");
      const hex = e.currentTarget.getAttribute("data-cor");
      setFabricColor(hex);
      if (corCustomInput) corCustomInput.value = hex;
    });
  });
}

if (corCustomInput) {
  corCustomInput.addEventListener("input", (e) => {
    setFabricColor(e.target.value);
  });
}

// ---- Camera View Toggle (Frente / Costas) ----
function setCameraView(view) {
  currentView = view;
  updateViewUI();

  if (!camera || !controls) return;

  const dist = 4.5;
  const targetZ = view === "front" ? dist : -dist;

  let frame = 0;
  const totalFrames = 25;
  const startPos = camera.position.clone();
  const endPos = new THREE.Vector3(0, 0, targetZ);

  function animateCam() {
    frame++;
    const progress = frame / totalFrames;
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

    camera.position.lerpVectors(startPos, endPos, ease);
    controls.update();

    if (frame < totalFrames) {
      requestAnimationFrame(animateCam);
    }
  }
  animateCam();
}

function updateViewUI() {
  if (btnViewFrente && btnViewCostas) {
    btnViewFrente.classList.toggle("btn-primario", currentView === "front");
    btnViewFrente.classList.toggle("btn-ghost", currentView !== "front");
    btnViewFrente.classList.toggle("view-active", currentView === "front");

    btnViewCostas.classList.toggle("btn-primario", currentView === "back");
    btnViewCostas.classList.toggle("btn-ghost", currentView !== "back");
    btnViewCostas.classList.toggle("view-active", currentView === "back");
  }

  if (printAreaTag) {
    printAreaTag.textContent = currentView === "front" ? "FRENTE" : "COSTAS";
  }

  render2DOverlayElements();
}

if (btnViewFrente) btnViewFrente.addEventListener("click", () => setCameraView("front"));
if (btnViewCostas) btnViewCostas.addEventListener("click", () => setCameraView("back"));

if (btnResetCam) {
  btnResetCam.addEventListener("click", () => {
    camera.position.set(0, 0, 4.5);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}

if (btnZoomIn) {
  btnZoomIn.addEventListener("click", () => {
    camera.position.multiplyScalar(0.85);
    controls.update();
  });
}

if (btnZoomOut) {
  btnZoomOut.addEventListener("click", () => {
    camera.position.multiplyScalar(1.15);
    controls.update();
  });
}

// ---- 2D Overlay Sync (Interatividade em Tela) ----
function render2DOverlayElements() {
  if (!printArea2D) return;
  printArea2D.innerHTML = `<span class="print-area-tag" id="print-area-tag">${currentView === "front" ? "FRENTE" : "COSTAS"}</span>`;

  const elementos = currentView === "front" ? elementosFrente : elementosCostas;

  elementos.forEach(item => {
    const elem = document.createElement("div");
    elem.className = "editor-print-element";

    const rect = printArea2D.getBoundingClientRect();
    const leftPx = (item.x * rect.width) - 20;
    const topPx = (item.y * rect.height) - 20;

    elem.style.left = `${leftPx}px`;
    elem.style.top = `${topPx}px`;
    elem.style.transform = `scale(${item.scale || 1}) rotate(${item.rotation || 0}deg)`;

    if (item.type === "text") {
      elem.style.fontSize = "16px";
      elem.style.fontFamily = item.fontFamily || 'Outfit';
      elem.style.color = item.color || '#f35e0e';
      elem.style.fontWeight = "800";
      elem.innerHTML = `<span>${item.text}</span>`;
    } else if (item.type === "image") {
      elem.innerHTML = `<img src="${item.src}" style="max-width: 70px; height: auto; pointer-events: none;">`;
    }

    if (elementoSelecionado === item) {
      elem.classList.add("selected");
    }

    makeElementInteractive(elem, item);
    printArea2D.appendChild(elem);
  });
}

function makeElementInteractive(domElem, itemObj) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  domElem.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    selecionarElemento(itemObj, domElem);
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = itemObj.x;
    initialY = itemObj.y;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging || elementoSelecionado !== itemObj) return;
    const rect = printArea2D.getBoundingClientRect();
    const dx = (e.clientX - startX) / rect.width;
    const dy = (e.clientY - startY) / rect.height;

    itemObj.x = Math.max(0.1, Math.min(0.9, initialX + dx));
    itemObj.y = Math.max(0.1, Math.min(0.9, initialY + dy));

    domElem.style.left = `${(itemObj.x * rect.width) - 20}px`;
    domElem.style.top = `${(itemObj.y * rect.height) - 20}px`;

    update2DTexture(currentView);
    syncSlidersToElement(itemObj);
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function selecionarElemento(itemObj, domElem) {
  if (!printArea2D) return;
  printArea2D.querySelectorAll(".editor-print-element").forEach(e => e.classList.remove("selected"));

  elementoSelecionado = itemObj;

  if (domElem) domElem.classList.add("selected");
  if (controlesElemento) controlesElemento.style.display = itemObj ? "block" : "none";

  // Sync sliders to selected element
  if (itemObj) {
    syncSlidersToElement(itemObj);
  }
}

/* =========================================================
   SLIDER CONTROLS — SYNC
   ========================================================= */
function syncSlidersToElement(item) {
  if (!item) return;

  if (sliderPosX) {
    sliderPosX.value = Math.round(item.x * 100);
    updateRangeProgress(sliderPosX);
  }
  if (sliderPosY) {
    sliderPosY.value = Math.round(item.y * 100);
    updateRangeProgress(sliderPosY);
  }
  if (sliderScale) {
    sliderScale.value = Math.round((item.scale || 1) * 100);
    updateRangeProgress(sliderScale);
  }
  if (sliderRotation) {
    sliderRotation.value = item.rotation || 0;
    updateRangeProgress(sliderRotation);
  }

  updateSliderLabels();
}

function updateSliderLabels() {
  if (sliderValX && sliderPosX) sliderValX.textContent = `${sliderPosX.value}%`;
  if (sliderValY && sliderPosY) sliderValY.textContent = `${sliderPosY.value}%`;
  if (sliderValScale && sliderScale) sliderValScale.textContent = `${sliderScale.value}%`;
  if (sliderValRotation && sliderRotation) sliderValRotation.textContent = `${sliderRotation.value}°`;
}

function updateRangeProgress(rangeInput) {
  if (!rangeInput) return;
  const min = parseFloat(rangeInput.min);
  const max = parseFloat(rangeInput.max);
  const val = parseFloat(rangeInput.value);
  const percent = ((val - min) / (max - min)) * 100;
  rangeInput.style.setProperty('--range-progress', `${percent}%`);
}

// Initialize all range progress indicators
function initAllRangeProgress() {
  document.querySelectorAll('.styled-range').forEach(updateRangeProgress);
}

// Slider event listeners
if (sliderPosX) {
  sliderPosX.addEventListener("input", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.x = parseInt(sliderPosX.value) / 100;
    updateRangeProgress(sliderPosX);
    updateSliderLabels();
    update2DTexture(activePiece);
  });
}

if (sliderPosY) {
  sliderPosY.addEventListener("input", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.y = parseInt(sliderPosY.value) / 100;
    updateRangeProgress(sliderPosY);
    updateSliderLabels();
    update2DTexture(activePiece);
  });
}

if (sliderScale) {
  sliderScale.addEventListener("input", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.scale = parseInt(sliderScale.value) / 100;
    updateRangeProgress(sliderScale);
    updateSliderLabels();
    update2DTexture(activePiece);
  });
}

if (sliderRotation) {
  sliderRotation.addEventListener("input", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.rotation = parseInt(sliderRotation.value);
    updateRangeProgress(sliderRotation);
    updateSliderLabels();
    update2DTexture(activePiece);
  });
}

// Desselecionar ao clicar na área livre
document.addEventListener("click", (e) => {
  if (!e.target.closest(".editor-print-element") && !e.target.closest("#controles-elemento-selecionado")) {
    selecionarElemento(null, null);
  }
});

// ---- Adicionar Texto ----
if (btnAddText && textInput) {
  btnAddText.addEventListener("click", () => {
    const txt = textInput.value.trim();
    if (!txt) return;

    const fonte = fonteSelect ? fonteSelect.value : "Outfit, sans-serif";
    const corTexto = corTextoInput ? corTextoInput.value : "#f35e0e";

    const novoItem = {
      id: "item-" + Date.now(),
      type: "text",
      text: txt,
      fontFamily: fonte,
      fontSize: 48,
      color: corTexto,
      x: 0.5,
      y: 0.4,
      scale: 1,
      rotation: 0
    };

    if (!elementosMap[activePiece]) elementosMap[activePiece] = [];
    elementosMap[activePiece].push(novoItem);

    update2DTexture(activePiece);
    selecionarElemento(novoItem, null);
    textInput.value = "";
  });
}

// ---- Upload de Imagem (PNG / JPG) ----
if (imgUpload) {
  imgUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        const targetW = 240;
        const targetH = targetW / aspect;

        const novoItem = {
          id: "img-" + Date.now(),
          type: "image",
          src: event.target.result,
          imgElement: img,
          width: targetW,
          height: targetH,
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0
        };

        if (!elementosMap[activePiece]) elementosMap[activePiece] = [];
        elementosMap[activePiece].push(novoItem);

        update2DTexture(activePiece);
        selecionarElemento(novoItem, null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---- Manipulação do Elemento Selecionado ----
const MOVE_STEP = 0.03;

if (btnUp) {
  btnUp.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.y = Math.max(0.05, elementoSelecionado.y - MOVE_STEP);
    afterElementChange();
  });
}

if (btnDown) {
  btnDown.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.y = Math.min(0.95, elementoSelecionado.y + MOVE_STEP);
    afterElementChange();
  });
}

if (btnLeft) {
  btnLeft.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.x = Math.max(0.05, elementoSelecionado.x - MOVE_STEP);
    afterElementChange();
  });
}

if (btnRight) {
  btnRight.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.x = Math.min(0.95, elementoSelecionado.x + MOVE_STEP);
    afterElementChange();
  });
}

if (btnCenter) {
  btnCenter.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.x = 0.5;
    elementoSelecionado.y = 0.45;
    afterElementChange();
  });
}

if (btnAumentar) {
  btnAumentar.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.scale = (elementoSelecionado.scale || 1) + 0.15;
    afterElementChange();
  });
}

if (btnDiminuir) {
  btnDiminuir.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.scale = Math.max(0.3, (elementoSelecionado.scale || 1) - 0.15);
    afterElementChange();
  });
}

if (btnRotacionar) {
  btnRotacionar.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.rotation = ((elementoSelecionado.rotation || 0) + 15) % 360;
    afterElementChange();
  });
}

if (btnRemover) {
  btnRemover.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    const arr = elementosMap[activePiece] || [];
    const idx = arr.indexOf(elementoSelecionado);
    if (idx !== -1) arr.splice(idx, 1);

    selecionarElemento(null, null);
    update2DTexture(activePiece);
  });
}

/** Shared helper: after any element property change, sync everything */
function afterElementChange() {
  syncSlidersToElement(elementoSelecionado);
  update2DTexture(activePiece);
}

/* =========================================================
   EXPORTAR PNG — Captura da cena 3D renderizada
   ========================================================= */
if (btnExportarPng) {
  btnExportarPng.addEventListener("click", () => {
    exportarPNG();
  });
}

function exportarPNG() {
  if (!renderer) return;

  // Force a fresh render
  renderer.render(scene, camera);

  // Capture canvas to data URL
  const dataURL = renderer.domElement.toDataURL("image/png");

  // Create download link
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const modelLabel = MODELOS[currentModelId]?.label || 'mockup';
  link.download = `mockup-${modelLabel.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.png`;
  link.href = dataURL;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Show success toast
  showExportToast("✅ Mockup exportado com sucesso!");
}

function showExportToast(message) {
  // Remove existing toast if any
  const existing = document.querySelector('.export-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'export-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ---- Preço Dinâmico ----
function atualizarPreco() {
  const qtd = Math.max(1, parseInt(inputQtd.value) || 1);
  const precoUnitario = calcularPrecoUnitario(produtoBase, qtd);
  if (precoUnitarioEl) {
    precoUnitarioEl.textContent = `R$ ${precoUnitario.toFixed(2).replace('.', ',')}`;
  }
}

if (inputQtd) {
  inputQtd.addEventListener("input", atualizarPreco);
}

// ---- Adicionar ao Carrinho ----
if (btnSalvar) {
  btnSalvar.addEventListener("click", () => {
    const qtd = Math.max(1, parseInt(inputQtd.value) || 1);
    const tam = selectTamanho ? selectTamanho.value : "M";
    const precoUnitario = calcularPrecoUnitario(produtoBase, qtd);

    const hasFront = elementosFrente.length > 0;
    const hasBack = elementosCostas.length > 0;

    if (!hasFront && !hasBack) {
      cart.showToast("Adicione pelo menos um texto ou imagem no modelo 3D!", "erro");
      return;
    }

    // Capture mockup image for the cart
    renderer.render(scene, camera);
    const mockupImageDataURL = renderer.domElement.toDataURL("image/png");

    cart.addItem(produtoBase, qtd, {
      tamanho: tam,
      cor: corTecidoAtual,
      modelo: currentModelId,
      precoUnitarioCalculado: precoUnitario,
      customDesign: true,
      designFrente: hasFront,
      designCostas: hasBack,
      mockupImage: mockupImageDataURL
    });

    cart.showToast("Design 3D adicionado ao carrinho com sucesso!", "sucesso");
  });
}

// ---- Initialize Pacdora Studio Bindings ----
setupPacdoraStudioBindings();

function setupPacdoraStudioBindings() {
  // Mode Switcher (3D View vs 2D Flat Pattern)
  const btnMode3D = document.getElementById("btn-mode-3d");
  const btnMode2D = document.getElementById("btn-mode-2d");

  if (btnMode3D && btnMode2D) {
    btnMode3D.addEventListener("click", () => {
      btnMode3D.classList.add("active");
      btnMode2D.classList.remove("active");
      activateSidebarTab("colors");
    });
    btnMode2D.addEventListener("click", () => {
      btnMode2D.classList.add("active");
      btnMode3D.classList.remove("active");
      activateSidebarTab("pieces");
    });
  }

  // Sidebar Tab Buttons
  document.querySelectorAll(".pacdora-tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      const tabKey = tab.getAttribute("data-tab");
      activateSidebarTab(tabKey);
    });
  });

  function activateSidebarTab(tabKey) {
    document.querySelectorAll(".pacdora-tab-btn").forEach(t => {
      t.classList.toggle("active", t.getAttribute("data-tab") === tabKey);
    });
    document.querySelectorAll(".pacdora-tab-content").forEach(content => {
      content.style.display = content.id === `tab-content-${tabKey}` ? "flex" : "none";
    });
  }

  // Color Pickers by Garment Part (Body, Sleeves, Collar, Zipper)
  const colBody = document.getElementById("color-part-body");
  const colSleeves = document.getElementById("color-part-sleeves");
  const colCollar = document.getElementById("color-part-collar");
  const colZipper = document.getElementById("color-part-zipper");

  if (colBody) {
    colBody.addEventListener("input", (e) => setFabricColor(e.target.value));
  }
  if (colSleeves) {
    colSleeves.addEventListener("input", (e) => {
      tshirtMeshes.forEach(mesh => {
        if (mesh.name && mesh.name.toLowerCase().includes("sleeve")) {
          if (mesh.material && mesh.material.color) mesh.material.color.set(e.target.value);
        }
      });
    });
  }
  if (colCollar) {
    colCollar.addEventListener("input", (e) => {
      tshirtMeshes.forEach(mesh => {
        if (mesh.name && mesh.name.toLowerCase().includes("collar")) {
          if (mesh.material && mesh.material.color) mesh.material.color.set(e.target.value);
        }
      });
    });
  }

  // Swatches
  const swatchesContainer = document.getElementById("pacdora-swatches-container");
  if (swatchesContainer) {
    swatchesContainer.querySelectorAll(".color-option").forEach(swatch => {
      swatch.addEventListener("click", (e) => {
        swatchesContainer.querySelectorAll(".color-option").forEach(s => s.classList.remove("selecionado"));
        e.currentTarget.classList.add("selecionado");
        const hex = e.currentTarget.getAttribute("data-cor");
        setFabricColor(hex);
        if (colBody) colBody.value = hex;
      });
    });
  }

  // Piece Select in Graphics Tab
  const pieceSelect = document.getElementById("pacdora-piece-select");
  if (pieceSelect) {
    pieceSelect.addEventListener("change", (e) => {
      setActivePiece(e.target.value);
    });
  }

  // Graphic Text Input & Button
  const btnText = document.getElementById("pacdora-btn-text");
  const txtInput = document.getElementById("pacdora-text-input");
  if (btnText && txtInput) {
    btnText.addEventListener("click", () => {
      const val = txtInput.value.trim();
      if (!val) return;
      const newItem = {
        id: "txt-" + Date.now(),
        type: "text",
        text: val,
        fontSize: 48,
        color: "#f35e0e",
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0
      };
      if (!elementosMap[activePiece]) elementosMap[activePiece] = [];
      elementosMap[activePiece].push(newItem);
      update2DTexture(activePiece);
      txtInput.value = "";
    });
  }

  // Image File Input
  const imgInput = document.getElementById("pacdora-img-input");
  if (imgInput) {
    imgInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          const aspect = img.width / img.height;
          const targetW = 240;
          const targetH = targetW / aspect;
          const newItem = {
            id: "img-" + Date.now(),
            type: "image",
            src: evt.target.result,
            imgElement: img,
            width: targetW,
            height: targetH,
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0
          };
          if (!elementosMap[activePiece]) elementosMap[activePiece] = [];
          elementosMap[activePiece].push(newItem);
          update2DTexture(activePiece);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Viewport Controls Overlay
  const btnVFront = document.getElementById("btn-view-front-3d");
  const btnVBack = document.getElementById("btn-view-back-3d");
  const btnVLeft = document.getElementById("btn-view-left-3d");
  const btnVRight = document.getElementById("btn-view-right-3d");
  const btnVReset = document.getElementById("btn-reset-view-3d");

  if (btnVFront) btnVFront.addEventListener("click", () => setCameraView("front"));
  if (btnVBack) btnVBack.addEventListener("click", () => setCameraView("back"));
  if (btnVLeft) btnVLeft.addEventListener("click", () => {
    if (camera && controls) { camera.position.set(4.5, 0, 0); controls.update(); }
  });
  if (btnVRight) btnVRight.addEventListener("click", () => {
    if (camera && controls) { camera.position.set(-4.5, 0, 0); controls.update(); }
  });
  if (btnVReset) btnVReset.addEventListener("click", () => {
    if (camera && controls) { camera.position.set(0, 0, 4.5); controls.target.set(0, 0, 0); controls.update(); }
  });

  // Export HD Button
  const btnExpHD = document.getElementById("btn-export-hd");
  if (btnExpHD) btnExpHD.addEventListener("click", exportarPNG);

  // Quantity and Price Display
  const qtyInput = document.getElementById("pacdora-qty-input");
  const priceDisplay = document.getElementById("pacdora-price-display");

  function updatePacdoraPrice() {
    const q = Math.max(1, parseInt(qtyInput?.value) || 1);
    const unit = calcularPrecoUnitario(produtoBase, q);
    if (priceDisplay) priceDisplay.textContent = `R$ ${unit.toFixed(2).replace('.', ',')}`;
  }

  if (qtyInput) qtyInput.addEventListener("input", updatePacdoraPrice);
  updatePacdoraPrice();

  // Add to Cart
  const btnAddCart = document.getElementById("pacdora-btn-add-cart");
  if (btnAddCart) {
    btnAddCart.addEventListener("click", () => {
      const q = Math.max(1, parseInt(qtyInput?.value) || 1);
      const sz = document.getElementById("pacdora-size-select")?.value || "M";
      const unit = calcularPrecoUnitario(produtoBase, q);
      renderer.render(scene, camera);
      const imgData = renderer.domElement.toDataURL("image/png");

      cart.addItem(produtoBase, q, {
        tamanho: sz,
        cor: corTecidoAtual,
        modelo: "football_jersey",
        precoUnitarioCalculado: unit,
        customDesign: true,
        mockupImage: imgData
      });
      cart.showToast("Mockup Polo Futebol Zíper adicionado ao carrinho!", "sucesso");
    });
  }
}

  atualizarPreco();
  initAllRangeProgress();
}
