/* editor.js - Editor 3D Mockup com Seletor de Modelo, Controles Avançados & Exportar PNG */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { PRODUTOS, calcularPrecoUnitario } from '../data/products.js';
import { cart } from '../cart.js';
import { escapeHtml, formatBRL } from '../utils.js';

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

  // ---- Estado da edição de elementos (declarado antes de initThreeJS para evitar TDZ) ----
  const printSurfaces = [];                 // superfícies 3D que recebem a estampa: { mesh, piece }
  const measureCtx = document.createElement("canvas").getContext("2d");
  const historyState = { stack: [], idx: -1 };
  const raycaster = new THREE.Raycaster();
  const ndcVec = new THREE.Vector2();
  const HANDLE_R = 22;                      // raio visual das alças (px do canvas 1024)
  const HANDLE_HIT = 36;                    // raio de clique das alças
  let dragState = null;

  const layersList = document.getElementById("layers-list");
  const layersPieceLabel = document.getElementById("layers-piece-label");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  const textProps = document.getElementById("text-props");
  const propTextContent = document.getElementById("prop-text-content");
  const propFont = document.getElementById("prop-font");
  const propColor = document.getElementById("prop-color");
  const propFontSize = document.getElementById("prop-font-size");
  const propValFontSize = document.getElementById("prop-val-font-size");
  const propBold = document.getElementById("prop-bold");
  const propItalic = document.getElementById("prop-italic");
  const propStrokeColor = document.getElementById("prop-stroke-color");
  const propStrokeWidth = document.getElementById("prop-stroke-width");
  const propValStrokeWidth = document.getElementById("prop-val-stroke-width");
  const propOpacity = document.getElementById("prop-opacity");
  const propValOpacity = document.getElementById("prop-val-opacity");
  const btnFlip = document.getElementById("btn-elem-flip");
  const btnDuplicar = document.getElementById("btn-elem-duplicar");
  const btnFrente = document.getElementById("btn-elem-frente");
  const btnTras = document.getElementById("btn-elem-tras");

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
    setupElementEditingTools();

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
      tab.addEventListener("click", () => setActivePiece(tab.getAttribute("data-piece")));
    });
  }

  function setActivePiece(pieceId, opts) {
    const moveCamera = !(opts && opts.moveCamera === false);
    activePiece = pieceId;

    if (activePieceLabel) activePieceLabel.textContent = PATTERN_LABELS[pieceId] || pieceId.toUpperCase();
    if (uploadPieceTarget) uploadPieceTarget.textContent = PATTERN_LABELS[pieceId] || pieceId.toUpperCase();
    if (svgOutlinePath) svgOutlinePath.setAttribute("d", PATTERN_PATHS[pieceId] || PATTERN_PATHS.front);
    if (svgPatternTitle) svgPatternTitle.textContent = PATTERN_TITLES[pieceId] || pieceId.toUpperCase();

    if (pieceTabsContainer) {
      pieceTabsContainer.querySelectorAll(".piece-tab").forEach(t =>
        t.classList.toggle("piece-tab--active", t.getAttribute("data-piece") === pieceId));
    }

    // Rotate 3D camera to face selected piece automatically
    if (moveCamera && camera && controls) {
      if (pieceId === "front") camera.position.set(0, 0, 4.5);
      else if (pieceId === "back") camera.position.set(0, 0, -4.5);
      else if (pieceId === "left_sleeve") camera.position.set(4.5, 0, 0);
      else if (pieceId === "right_sleeve") camera.position.set(-4.5, 0, 0);
      else if (pieceId === "collar") camera.position.set(0, 1.2, 3.5);
      controls.target.set(0, 0, 0);
      controls.update();
    }

    // A seleção só vale dentro da peça ativa
    if (elementoSelecionado && !(elementosMap[pieceId] || []).includes(elementoSelecionado)) {
      selecionarElemento(null);
    } else {
      renderLayersList();
      renderFlatPatternCanvas();
    }
  }

  // ---- Render Active Piece on 2D Pattern Canvas ----
  function renderFlatPatternCanvas() {
    if (!flatCanvasEl || !flatCanvasCtx) return;
    const w = flatCanvasEl.width;
    const h = flatCanvasEl.height;

    flatCanvasCtx.clearRect(0, 0, w, h);

    const items = elementosMap[activePiece] || [];
    items.forEach(item => drawItem(flatCanvasCtx, item, w, h, false));
    drawSelectionOverlay(flatCanvasCtx, items);
  }

  /* =========================================================
     EDIÇÃO DE ELEMENTOS — desenho, geometria e hit-test
     ========================================================= */
  function itemFont(item) {
    const weight = item.bold === false ? 400 : 800;
    return `${item.italic ? "italic " : ""}${weight} ${item.fontSize || 42}px ${item.fontFamily || "Outfit, sans-serif"}`;
  }

  /** Desenha um elemento (texto/imagem) num contexto 2D. Usado no molde plano e na textura 3D. */
  function drawItem(ctx, item, w, h, withShadow) {
    if (item.hidden) return;
    ctx.save();
    ctx.translate(item.x * w, item.y * h);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    const s = item.scale || 1;
    ctx.scale(item.flipX ? -s : s, s);
    ctx.globalAlpha = item.opacity == null ? 1 : item.opacity;

    if (item.type === "text") {
      ctx.font = itemFont(item);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const stroke = (item.strokeWidth || 0) > 0;
      if (withShadow && !stroke) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }
      if (stroke) {
        ctx.lineJoin = "round";
        ctx.lineWidth = item.strokeWidth * 2;
        ctx.strokeStyle = item.strokeColor || "#000000";
        ctx.strokeText(item.text || "", 0, 0);
      }
      ctx.fillStyle = item.color || "#f35e0e";
      ctx.fillText(item.text || "", 0, 0);
    } else if (item.type === "image" && item.imgElement) {
      const iw = item.width || 200;
      const ih = item.height || 200;
      ctx.drawImage(item.imgElement, -iw / 2, -ih / 2, iw, ih);
    }
    ctx.restore();
  }

  /** Tamanho do elemento em px do canvas (sem escala/rotação). */
  function getItemSize(item) {
    if (item.type === "text") {
      measureCtx.font = itemFont(item);
      const sw = (item.strokeWidth || 0) * 2;
      return {
        w: Math.max(40, measureCtx.measureText(item.text || "").width + sw),
        h: (item.fontSize || 42) * 1.25 + sw
      };
    }
    return { w: item.width || 200, h: item.height || 200 };
  }

  function pointToLocal(item, px, py) {
    const dx = px - item.x * CANVAS_RESOLUTION;
    const dy = py - item.y * CANVAS_RESOLUTION;
    const a = -((item.rotation || 0) * Math.PI) / 180;
    const s = item.scale || 1;
    return {
      x: (dx * Math.cos(a) - dy * Math.sin(a)) / s,
      y: (dx * Math.sin(a) + dy * Math.cos(a)) / s
    };
  }

  function localToCanvas(item, lx, ly) {
    const s = item.scale || 1;
    const a = ((item.rotation || 0) * Math.PI) / 180;
    const x = lx * s;
    const y = ly * s;
    return {
      x: item.x * CANVAS_RESOLUTION + x * Math.cos(a) - y * Math.sin(a),
      y: item.y * CANVAS_RESOLUTION + x * Math.sin(a) + y * Math.cos(a)
    };
  }

  function getHandles(item) {
    const { w, h } = getItemSize(item);
    const s = item.scale || 1;
    return {
      scale: localToCanvas(item, w / 2, h / 2),
      rotate: localToCanvas(item, 0, -h / 2 - 56 / s)
    };
  }

  function hitTestItem(item, px, py) {
    if (item.hidden) return false;
    const l = pointToLocal(item, px, py);
    const { w, h } = getItemSize(item);
    const pad = 8 / (item.scale || 1);
    return Math.abs(l.x) <= w / 2 + pad && Math.abs(l.y) <= h / 2 + pad;
  }

  /** Elemento mais acima (último desenhado) sob o ponto, ou null. */
  function pickItemAt(piece, px, py) {
    const items = elementosMap[piece] || [];
    for (let i = items.length - 1; i >= 0; i--) {
      if (hitTestItem(items[i], px, py)) return items[i];
    }
    return null;
  }

  /** Caixa de seleção + alças (girar/escalar) — só no molde 2D, nunca na textura 3D. */
  function drawSelectionOverlay(ctx, items) {
    const item = elementoSelecionado;
    if (!item || item.hidden || !items.includes(item)) return;
    const { w, h } = getItemSize(item);
    const s = item.scale || 1;

    ctx.save();
    ctx.translate(item.x * CANVAS_RESOLUTION, item.y * CANVAS_RESOLUTION);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.strokeStyle = "#f35e0e";
    ctx.lineWidth = 3 / s;
    ctx.setLineDash([10 / s, 6 / s]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    const hnd = getHandles(item);
    const top = localToCanvas(item, 0, -h / 2);
    ctx.save();
    ctx.strokeStyle = "#f35e0e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(hnd.rotate.x, hnd.rotate.y);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(hnd.rotate.x, hnd.rotate.y, HANDLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillRect(hnd.scale.x - HANDLE_R, hnd.scale.y - HANDLE_R, HANDLE_R * 2, HANDLE_R * 2);
    ctx.strokeRect(hnd.scale.x - HANDLE_R, hnd.scale.y - HANDLE_R, HANDLE_R * 2, HANDLE_R * 2);
    ctx.restore();
  }

  /* ---------- Arraste / girar / escalar (molde 2D) ---------- */
  function flatPointerToCanvas(e) {
    const r = flatCanvasEl.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * CANVAS_RESOLUTION,
      y: ((e.clientY - r.top) / r.height) * CANVAS_RESOLUTION
    };
  }

  function setupFlatPatternDragging() {
    if (!flatCanvasEl) return;
    flatCanvasEl.style.touchAction = "none";

    flatCanvasEl.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const p = flatPointerToCanvas(e);
      const items = elementosMap[activePiece] || [];
      let item = null;
      let mode = "move";

      if (elementoSelecionado && items.includes(elementoSelecionado)) {
        const hnd = getHandles(elementoSelecionado);
        if (Math.hypot(p.x - hnd.rotate.x, p.y - hnd.rotate.y) <= HANDLE_HIT) {
          item = elementoSelecionado; mode = "rotate";
        } else if (Math.hypot(p.x - hnd.scale.x, p.y - hnd.scale.y) <= HANDLE_HIT) {
          item = elementoSelecionado; mode = "scale";
        }
      }
      if (!item) item = pickItemAt(activePiece, p.x, p.y);
      if (!item) { selecionarElemento(null); return; }

      if (item !== elementoSelecionado) selecionarElemento(item);
      const cx = item.x * CANVAS_RESOLUTION;
      const cy = item.y * CANVAS_RESOLUTION;
      dragState = {
        source: "flat", mode, item,
        grabDX: p.x - cx, grabDY: p.y - cy,
        startScale: item.scale || 1,
        startDist: Math.hypot(p.x - cx, p.y - cy) || 1
      };
      if (flatCanvasEl.setPointerCapture) { try { flatCanvasEl.setPointerCapture(e.pointerId); } catch (_) { } }
      e.preventDefault();
    });
  }

  /** Aplica o movimento do ponteiro ao elemento em arraste. p está em px do canvas (0..1024). */
  function applyDrag(p, shiftKey) {
    const item = dragState.item;
    const cx = item.x * CANVAS_RESOLUTION;
    const cy = item.y * CANVAS_RESOLUTION;

    if (dragState.mode === "move") {
      item.x = Math.max(0.05, Math.min(0.95, (p.x - dragState.grabDX) / CANVAS_RESOLUTION));
      item.y = Math.max(0.05, Math.min(0.95, (p.y - dragState.grabDY) / CANVAS_RESOLUTION));
    } else if (dragState.mode === "rotate") {
      let ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      ang = ((ang % 360) + 360) % 360;
      if (shiftKey) ang = Math.round(ang / 15) * 15 % 360;
      item.rotation = Math.round(ang);
    } else if (dragState.mode === "scale") {
      const d = Math.hypot(p.x - cx, p.y - cy);
      item.scale = Math.max(0.1, Math.min(4, dragState.startScale * (d / dragState.startDist)));
    }
    syncSlidersToElement(item);
    update2DTexture(activePiece);
  }

  function finishDrag() {
    if (!dragState) return;
    dragState = null;
    if (controls) controls.enabled = true;
    if (flatCanvasEl) flatCanvasEl.style.cursor = "";
    commitHistory();
  }

  function onWindowPointerMove(e) {
    if (dragState) {
      if (dragState.source === "flat") {
        applyDrag(flatPointerToCanvas(e), e.shiftKey);
      } else if (dragState.source === "3d") {
        const hit = raycastSurfaces(e, dragState.surface);
        if (hit) {
          dragState.item.x = Math.max(0.05, Math.min(0.95, (hit.x - dragState.grabDX) / CANVAS_RESOLUTION));
          dragState.item.y = Math.max(0.05, Math.min(0.95, (hit.y - dragState.grabDY) / CANVAS_RESOLUTION));
          syncSlidersToElement(dragState.item);
          update2DTexture(activePiece);
        }
      }
      return;
    }

    // Cursor de feedback ao passar sobre elementos
    if (flatCanvasEl && e.target === flatCanvasEl) {
      const p = flatPointerToCanvas(e);
      let cursor = "";
      if (elementoSelecionado && (elementosMap[activePiece] || []).includes(elementoSelecionado)) {
        const hnd = getHandles(elementoSelecionado);
        if (Math.hypot(p.x - hnd.rotate.x, p.y - hnd.rotate.y) <= HANDLE_HIT) cursor = "alias";
        else if (Math.hypot(p.x - hnd.scale.x, p.y - hnd.scale.y) <= HANDLE_HIT) cursor = "nwse-resize";
      }
      if (!cursor && pickItemAt(activePiece, p.x, p.y)) cursor = "move";
      flatCanvasEl.style.cursor = cursor;
    } else if (renderer && e.target === renderer.domElement) {
      const hit = raycastSurfaces(e);
      renderer.domElement.style.cursor = hit && pickItemAt(hit.surface.piece, hit.x, hit.y) ? "move" : "";
    }
  }

  /* ---------- Seleção / arraste direto no modelo 3D ---------- */
  function raycastSurfaces(e, onlySurface) {
    if (!renderer || !camera) return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndcVec.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndcVec, camera);
    const targets = onlySurface ? [onlySurface.mesh] : printSurfaces.map(s => s.mesh);
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length || !hits[0].uv) return null;
    const surface = onlySurface || printSurfaces.find(s => s.mesh === hits[0].object);
    if (!surface) return null;
    return { surface, x: hits[0].uv.x * CANVAS_RESOLUTION, y: (1 - hits[0].uv.y) * CANVAS_RESOLUTION };
  }

  function setup3DPicking() {
    if (!renderer) return;
    const dom = renderer.domElement;
    let emptyClick = null;

    dom.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const hit = raycastSurfaces(e);
      const item = hit ? pickItemAt(hit.surface.piece, hit.x, hit.y) : null;
      if (!item) { emptyClick = { x: e.clientX, y: e.clientY }; return; } // deixa o OrbitControls girar

      emptyClick = null;
      if (hit.surface.piece !== activePiece) setActivePiece(hit.surface.piece, { moveCamera: false });
      selecionarElemento(item);
      if (controls) controls.enabled = false;
      dragState = {
        source: "3d", mode: "move", item, surface: hit.surface,
        grabDX: hit.x - item.x * CANVAS_RESOLUTION,
        grabDY: hit.y - item.y * CANVAS_RESOLUTION
      };
      if (dom.setPointerCapture) { try { dom.setPointerCapture(e.pointerId); } catch (_) { } }
      e.stopImmediatePropagation();
    }, true);

    // Clique simples (sem arrastar) em área vazia do 3D → desseleciona
    dom.addEventListener("pointerup", (e) => {
      if (emptyClick && Math.hypot(e.clientX - emptyClick.x, e.clientY - emptyClick.y) < 4) selecionarElemento(null);
      emptyClick = null;
    });

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
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
  printSurfaces.length = 0;

  // A caneca é gerada diretamente no Three.js, sem depender de arquivo GLB.
  if (modelConfig.isMug) {
    const mug = new THREE.Group();
    const ceramic = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const printMaterial = new THREE.MeshStandardMaterial({
      map: textureFront,
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    // Corpo cilíndrico com abertura superior e a estampa mapeada ao redor.
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 1.35, 96, 1, true),
      printMaterial
    );
    body.position.y = 0.05;
    mug.add(body);
    printSurfaces.push({ mesh: body, piece: 'front' });

    // Borda superior e fundo cerâmico.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.675, 0.035, 12, 96),
      ceramic
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.725;
    mug.add(rim);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.60, 0.60, 0.09, 64),
      ceramic
    );
    base.position.y = -0.64;
    mug.add(base);

    // Alça lateral em formato de arco.
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.105, 20, 64, Math.PI),
      ceramic
    );
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.78, 0.02, 0);
    mug.add(handle);

    // Mantém referências usadas pelo restante do editor.
    tshirtGroup = mug;
    tshirtMeshes.length = 0;
    tshirtMeshes.push(body, rim, base, handle);
    scene.add(mug);

    // Atualiza o canvas antes de usá-lo como textura do corpo cilíndrico.
    update2DTexture('front');

    // Caneca usa apenas a área de estampa da frente.
    const pieceTabs = document.querySelectorAll('#piece-selector-tabs .piece-tab');
    pieceTabs.forEach(tab => {
      const isFront = tab.dataset.piece === 'front';
      tab.style.display = isFront ? '' : 'none';
    });
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
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
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
    const garment = createGarmentModel(modelId);
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


// ---- Geometria procedural dos três modelos novos ----
function createGarmentModel(modelId) {
  const group = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: new THREE.Color(corTecidoAtual), roughness: 0.84, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0x263445, roughness: 0.72, side: THREE.DoubleSide });
  const lightTrim = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.55, side: THREE.DoubleSide });
  const pocketMat = new THREE.MeshStandardMaterial({ color: 0xaeb6c0, roughness: 0.88, side: THREE.DoubleSide });

  function polygon(points, depth, material, z = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 2, steps: 1,
      bevelSize: 0.018, bevelThickness: 0.018, curveSegments: 12
    });
    geometry.translate(0, 0, z - depth / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.fabricPart = material === fabric;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function detailBox(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.userData.fabricPart = material === fabric;
    group.add(mesh);
    return mesh;
  }

  function button(x, y, z = 0.405) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 16), trim);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.fabricPart = false;
    group.add(mesh);
  }

  const torso = [
    [-0.68,0.78],[-0.38,0.98],[-0.18,0.91],[-0.12,0.73],
    [0.12,0.73],[0.18,0.91],[0.38,0.98],[0.68,0.78],
    [0.91,0.38],[0.68,0.24],[0.52,0.48],[0.52,-1],
    [-0.52,-1],[-0.52,0.48],[-0.68,0.24],[-0.91,0.38]
  ];

  if (modelId === 'polo' || modelId === 'football_jersey') {
    polygon(torso, 0.72, fabric);
    polygon([[-0.62,0.78],[-0.91,0.42],[-1.02,0.12],[-0.73,0.02],[-0.48,0.48]],0.68,fabric);
    polygon([[0.62,0.78],[0.48,0.48],[0.73,0.02],[1.02,0.12],[0.91,0.42]],0.68,fabric);

    if (modelId === 'polo') {
      polygon([[-0.22,0.91],[0,0.77],[0.22,0.91],[0.13,0.62],[0,0.69],[-0.13,0.62]],0.76,trim);
      polygon([[-0.10,0.70],[0.10,0.70],[0.085,0.27],[-0.085,0.27]],0.75,lightTrim,0.01);
      [0.60,0.48,0.36].forEach(y => button(0,y));
    } else {
      polygon([[-0.24,0.91],[0,0.77],[0.24,0.91],[0.13,0.64],[0,0.69],[-0.13,0.64]],0.76,trim);
      detailBox(0.035,0.48,0.025,0,0.39,0.395,lightTrim);
      for (let i=0;i<12;i++) detailBox(0.055,0.012,0.028,0,0.59-i*0.036,0.414,trim);
      detailBox(0.09,0.045,0.05,0,0.64,0.42,lightTrim);
    }
  } else if (modelId === 'moletom') {
    polygon([
      [-0.70,0.76],[-0.40,0.98],[-0.18,0.90],[-0.12,0.72],
      [0.12,0.72],[0.18,0.90],[0.40,0.98],[0.70,0.76],
      [0.88,0.34],[0.66,0.20],[0.52,0.46],[0.52,-1],
      [-0.52,-1],[-0.52,0.46],[-0.66,0.20],[-0.88,0.34]
    ],0.78,fabric);
    polygon([[-0.58,0.78],[-0.86,0.42],[-0.95,-0.50],[-0.68,-0.58],[-0.47,0.42]],0.72,fabric);
    polygon([[0.58,0.78],[0.47,0.42],[0.68,-0.58],[0.95,-0.50],[0.86,0.42]],0.72,fabric);
    polygon([[-0.34,0.91],[-0.28,1.18],[-0.16,1.34],[0,1.39],[0.16,1.34],[0.28,1.18],[0.34,0.91],[0.20,0.78],[0,0.84],[-0.20,0.78]],0.60,trim,-0.28);
    polygon([[-0.39,-0.28],[-0.32,-0.62],[-0.22,-0.70],[0.22,-0.70],[0.32,-0.62],[0.39,-0.28],[0.27,-0.20],[-0.27,-0.20]],0.035,pocketMat,0.405);
    detailBox(0.024,0.46,0.024,-0.12,0.61,0.405,lightTrim);
    detailBox(0.024,0.46,0.024,0.12,0.61,0.405,lightTrim);
  }
  return group;
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

  // Decalques vivem na cena (não no grupo da roupa): remove e libera todos
  ['decalFrontMesh', 'decalBackMesh', 'decalLeftSleeveMesh', 'decalRightSleeveMesh'].forEach(name => {
    const m = { decalFrontMesh, decalBackMesh, decalLeftSleeveMesh, decalRightSleeveMesh }[name];
    if (!m) return;
    scene.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
  decalFrontMesh = decalBackMesh = decalLeftSleeveMesh = decalRightSleeveMesh = null;

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

// ---- Decalques 3D que acompanham a malha da roupa ----
/**
 * Cria um plano subdividido cujos vértices são "projetados" (raycast) sobre a malha da roupa,
 * então a estampa cola no tecido em vez de ficar flutuando ou escondida dentro/atrás dele.
 * axis 'z' = frente/costas (dir +1 / -1); axis 'x' = mangas (dir +1 = lado +x, -1 = lado -x).
 * center, w, h estão em coordenadas de mundo.
 */
function createConformedDecal({ map, axis, dir, center, w, h, segX, segY }) {
  const FAR = 8;       // distância de onde o raio parte
  const LIFT = 0.008;  // folga acima do tecido para evitar z-fighting
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = geo.attributes.position;
  const ray = new THREE.Raycaster();

  const depthAt = (a, b) => {
    const origin = axis === "z" ? new THREE.Vector3(a, b, dir * FAR) : new THREE.Vector3(dir * FAR, b, a);
    const direction = axis === "z" ? new THREE.Vector3(0, 0, -dir) : new THREE.Vector3(-dir, 0, 0);
    ray.set(origin, direction);
    const hits = ray.intersectObjects(tshirtMeshes, false);
    if (!hits.length) return null;
    return axis === "z" ? hits[0].point.z : hits[0].point.x;
  };

  const hSign = axis === "z" ? dir : -dir;                 // sentido do eixo U do plano no mundo
  const cH = axis === "z" ? center.x : center.z;           // centro horizontal
  const fallback = axis === "z" ? center.z : center.x;     // profundidade de segurança
  const centerHit = depthAt(cH, center.y);
  const base = centerHit != null ? centerHit : fallback;

  for (let i = 0; i < pos.count; i++) {
    const a = cH + hSign * pos.getX(i);
    const b = center.y + pos.getY(i);
    let d = depthAt(a, b);
    if (d == null || Math.abs(d - base) > 0.3) d = base;   // fora do tecido: mantém a profundidade central
    const depth = d + dir * LIFT;
    if (axis === "z") pos.setXYZ(i, a, b, depth);
    else pos.setXYZ(i, depth, b, a);
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}

function setupDecalMeshes() {
  if (!tshirtGroup) return;
  tshirtGroup.updateMatrixWorld(true);
  const s = tshirtGroup.scale.x || 1;
  const toWorld = (x, y, z) => tshirtGroup.localToWorld(new THREE.Vector3(x, y, z));

  const decalCenterY = currentModelId === 'moletom' ? -0.18 : 0.02;
  const decalFrontZ = currentModelId === 'moletom' ? 0.35 : 0.38;

  decalFrontMesh = createConformedDecal({
    map: textureFront, axis: "z", dir: 1,
    center: toWorld(0, decalCenterY, decalFrontZ), w: 0.82 * s, h: 1.05 * s, segX: 28, segY: 34
  });
  decalBackMesh = createConformedDecal({
    map: textureBack, axis: "z", dir: -1,
    center: toWorld(0, decalCenterY, -decalFrontZ), w: 0.82 * s, h: 1.05 * s, segX: 28, segY: 34
  });
  decalLeftSleeveMesh = createConformedDecal({
    map: textureLeftSleeve, axis: "x", dir: 1,
    center: toWorld(0.65, 0.1, 0.05), w: 0.4 * s, h: 0.4 * s, segX: 14, segY: 14
  });
  decalRightSleeveMesh = createConformedDecal({
    map: textureRightSleeve, axis: "x", dir: -1,
    center: toWorld(-0.65, 0.1, 0.05), w: 0.4 * s, h: 0.4 * s, segX: 14, segY: 14
  });

  printSurfaces.push(
    { mesh: decalFrontMesh, piece: 'front' },
    { mesh: decalBackMesh, piece: 'back' },
    { mesh: decalLeftSleeveMesh, piece: 'left_sleeve' },
    { mesh: decalRightSleeveMesh, piece: 'right_sleeve' }
  );
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

  elementos.forEach(item => drawItem(ctx, item, CANVAS_RESOLUTION, CANVAS_RESOLUTION, true));

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

/* =========================================================
   EDIÇÃO DE ELEMENTOS — seleção, camadas, propriedades, histórico
   ========================================================= */
function selecionarElemento(itemObj) {
  elementoSelecionado = itemObj || null;
  if (controlesElemento) controlesElemento.style.display = elementoSelecionado ? "block" : "none";
  if (elementoSelecionado) {
    syncSlidersToElement(elementoSelecionado);
    syncPropsToElement(elementoSelecionado);
  }
  renderLayersList();
  renderFlatPatternCanvas();
}

/** Redesenha tudo após mudança estrutural (adicionar/remover/reordenar/ocultar). */
function refreshAfterStructureChange() {
  update2DTexture(activePiece);
  renderLayersList();
  if (elementoSelecionado) syncPropsToElement(elementoSelecionado);
}

function addItem(novoItem) {
  if (!elementosMap[activePiece]) elementosMap[activePiece] = [];
  elementosMap[activePiece].push(novoItem);
  selecionarElemento(novoItem);
  refreshAfterStructureChange();
  commitHistory();
}

function removeItem(item) {
  if (!item) return;
  const arr = elementosMap[activePiece] || [];
  const idx = arr.indexOf(item);
  if (idx === -1) return;
  arr.splice(idx, 1);
  if (elementoSelecionado === item) selecionarElemento(null);
  refreshAfterStructureChange();
  commitHistory();
}

function duplicateItem(item) {
  if (!item) return;
  const arr = elementosMap[activePiece] || [];
  if (!arr.includes(item)) return;
  const copia = Object.assign({}, item, {
    id: "dup-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    x: Math.min(0.95, item.x + 0.04),
    y: Math.min(0.95, item.y + 0.04)
  });
  arr.splice(arr.indexOf(item) + 1, 0, copia);
  selecionarElemento(copia);
  refreshAfterStructureChange();
  commitHistory();
}

function moveLayer(item, dir) {
  const arr = elementosMap[activePiece] || [];
  const i = arr.indexOf(item);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  refreshAfterStructureChange();
  commitHistory();
}

function toggleHidden(item) {
  item.hidden = !item.hidden;
  refreshAfterStructureChange();
  commitHistory();
}

function layerLabel(item) {
  if (item.type === "text") return `“${item.text || "(vazio)"}”`;
  return item.name || "Imagem";
}

function renderLayersList() {
  if (layersPieceLabel) layersPieceLabel.textContent = PATTERN_LABELS[activePiece] || activePiece.toUpperCase();
  if (!layersList) return;
  layersList.innerHTML = "";
  const items = elementosMap[activePiece] || [];

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "layers-list__empty";
    li.textContent = "Nenhum elemento nesta peça";
    layersList.appendChild(li);
    return;
  }

  // topo da lista = camada mais acima
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const li = document.createElement("li");
    li.className = "layer-row" + (item === elementoSelecionado ? " is-selected" : "") + (item.hidden ? " is-hidden" : "");
    li.addEventListener("click", () => selecionarElemento(item));

    const icon = document.createElement("span");
    icon.className = "layer-row__icon";
    icon.textContent = item.type === "text" ? "T" : "🖼";
    li.appendChild(icon);

    const name = document.createElement("span");
    name.className = "layer-row__name";
    name.textContent = layerLabel(item);
    li.appendChild(name);

    const mkBtn = (label, title, fn, disabled) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "layer-row__btn";
      b.textContent = label;
      b.title = title;
      if (disabled) { b.disabled = true; b.style.opacity = ".3"; }
      b.addEventListener("click", (ev) => { ev.stopPropagation(); fn(); });
      li.appendChild(b);
    };
    mkBtn(item.hidden ? "🚫" : "👁", item.hidden ? "Mostrar" : "Ocultar", () => toggleHidden(item));
    mkBtn("▲", "Camada acima", () => moveLayer(item, 1), i === items.length - 1);
    mkBtn("▼", "Camada abaixo", () => moveLayer(item, -1), i === 0);
    mkBtn("🗑", "Remover", () => removeItem(item));

    layersList.appendChild(li);
  }
}

/* ---------- Painel de propriedades do elemento ---------- */
function syncPropsToElement(item) {
  if (!item) return;
  const isText = item.type === "text";
  if (textProps) textProps.style.display = isText ? "block" : "none";

  if (isText) {
    if (propTextContent && document.activeElement !== propTextContent) propTextContent.value = item.text || "";
    if (propFont) {
      const wanted = item.fontFamily || "Outfit, sans-serif";
      if (![...propFont.options].some(o => o.value === wanted)) {
        propFont.add(new Option(wanted.split(",")[0], wanted));
      }
      propFont.value = wanted;
    }
    if (propColor) propColor.value = item.color || "#f35e0e";
    if (propFontSize) { propFontSize.value = item.fontSize || 48; updateRangeProgress(propFontSize); }
    if (propValFontSize) propValFontSize.textContent = item.fontSize || 48;
    if (propBold) propBold.setAttribute("aria-pressed", item.bold === false ? "false" : "true");
    if (propItalic) propItalic.setAttribute("aria-pressed", item.italic ? "true" : "false");
    if (propStrokeColor) propStrokeColor.value = item.strokeColor || "#000000";
    if (propStrokeWidth) { propStrokeWidth.value = item.strokeWidth || 0; updateRangeProgress(propStrokeWidth); }
    if (propValStrokeWidth) propValStrokeWidth.textContent = item.strokeWidth || 0;
  }

  const op = Math.round((item.opacity == null ? 1 : item.opacity) * 100);
  if (propOpacity) { propOpacity.value = op; updateRangeProgress(propOpacity); }
  if (propValOpacity) propValOpacity.textContent = `${op}%`;
  if (btnFlip) btnFlip.setAttribute("aria-pressed", item.flipX ? "true" : "false");
}

/* ---------- Histórico (desfazer / refazer) ---------- */
function snapshotState() {
  const out = {};
  Object.keys(elementosMap).forEach(k => { out[k] = elementosMap[k].map(it => Object.assign({}, it)); });
  return out;
}

function snapshotSignature(snap) {
  return JSON.stringify(snap, (key, val) => (key === "imgElement" || key === "src" ? undefined : val));
}

function commitHistory() {
  const snap = snapshotState();
  const sig = snapshotSignature(snap);
  const last = historyState.stack[historyState.idx];
  if (last && last.sig === sig) { updateUndoButtons(); return; }
  historyState.stack.length = historyState.idx + 1;
  historyState.stack.push({ snap, sig });
  if (historyState.stack.length > 80) historyState.stack.shift();
  historyState.idx = historyState.stack.length - 1;
  updateUndoButtons();
}

function restoreHistory(index) {
  const entry = historyState.stack[index];
  if (!entry) return;
  const selId = elementoSelecionado ? elementoSelecionado.id : null;
  Object.keys(elementosMap).forEach(k => {
    const arr = elementosMap[k];
    arr.length = 0;
    (entry.snap[k] || []).forEach(it => arr.push(Object.assign({}, it)));
  });
  historyState.idx = index;
  Object.keys(elementosMap).forEach(k => update2DTexture(k));
  const sel = (elementosMap[activePiece] || []).find(it => it.id === selId) || null;
  selecionarElemento(sel);
  updateUndoButtons();
}

function undo() { if (historyState.idx > 0) restoreHistory(historyState.idx - 1); }
function redo() { if (historyState.idx < historyState.stack.length - 1) restoreHistory(historyState.idx + 1); }

function updateUndoButtons() {
  if (btnUndo) btnUndo.disabled = historyState.idx <= 0;
  if (btnRedo) btnRedo.disabled = historyState.idx >= historyState.stack.length - 1;
}

/* ---------- Sliders: sincronização ---------- */
function syncSlidersToElement(item) {
  if (!item) return;
  if (sliderPosX) { sliderPosX.value = Math.round(item.x * 100); updateRangeProgress(sliderPosX); }
  if (sliderPosY) { sliderPosY.value = Math.round(item.y * 100); updateRangeProgress(sliderPosY); }
  if (sliderScale) { sliderScale.value = Math.round((item.scale || 1) * 100); updateRangeProgress(sliderScale); }
  if (sliderRotation) { sliderRotation.value = Math.round(item.rotation || 0); updateRangeProgress(sliderRotation); }
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

function initAllRangeProgress() {
  document.querySelectorAll('.styled-range').forEach(updateRangeProgress);
}

/** Após uma alteração numérica no elemento selecionado. */
function afterElementChange(commit) {
  syncSlidersToElement(elementoSelecionado);
  update2DTexture(activePiece);
  if (commit) commitHistory();
}

/* ---------- Ligação de todos os controles de edição ---------- */
function setupElementEditingTools() {
  setupFlatPatternDragging();
  setup3DPicking();

  // Sliders de posição / escala / rotação
  [
    [sliderPosX, (it, v) => { it.x = v / 100; }],
    [sliderPosY, (it, v) => { it.y = v / 100; }],
    [sliderScale, (it, v) => { it.scale = v / 100; }],
    [sliderRotation, (it, v) => { it.rotation = v; }]
  ].forEach(([el, apply]) => {
    if (!el) return;
    el.addEventListener("input", () => {
      if (!elementoSelecionado) return;
      apply(elementoSelecionado, parseInt(el.value, 10));
      updateRangeProgress(el);
      updateSliderLabels();
      update2DTexture(activePiece);
    });
    el.addEventListener("change", commitHistory);
  });

  // Botões direcionais e de tamanho
  const nudge = (dx, dy) => () => {
    const it = elementoSelecionado;
    if (!it) return;
    it.x = Math.max(0.05, Math.min(0.95, it.x + dx));
    it.y = Math.max(0.05, Math.min(0.95, it.y + dy));
    afterElementChange(true);
  };
  if (btnUp) btnUp.addEventListener("click", nudge(0, -0.03));
  if (btnDown) btnDown.addEventListener("click", nudge(0, 0.03));
  if (btnLeft) btnLeft.addEventListener("click", nudge(-0.03, 0));
  if (btnRight) btnRight.addEventListener("click", nudge(0.03, 0));
  if (btnCenter) btnCenter.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.x = 0.5;
    elementoSelecionado.y = 0.45;
    afterElementChange(true);
  });
  if (btnAumentar) btnAumentar.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.scale = Math.min(4, (elementoSelecionado.scale || 1) + 0.15);
    afterElementChange(true);
  });
  if (btnDiminuir) btnDiminuir.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.scale = Math.max(0.1, (elementoSelecionado.scale || 1) - 0.15);
    afterElementChange(true);
  });
  if (btnRotacionar) btnRotacionar.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.rotation = ((elementoSelecionado.rotation || 0) + 15) % 360;
    afterElementChange(true);
  });
  if (btnRemover) btnRemover.addEventListener("click", () => removeItem(elementoSelecionado));
  if (btnDuplicar) btnDuplicar.addEventListener("click", () => duplicateItem(elementoSelecionado));
  if (btnFrente) btnFrente.addEventListener("click", () => elementoSelecionado && moveLayer(elementoSelecionado, 1));
  if (btnTras) btnTras.addEventListener("click", () => elementoSelecionado && moveLayer(elementoSelecionado, -1));
  if (btnFlip) btnFlip.addEventListener("click", () => {
    if (!elementoSelecionado) return;
    elementoSelecionado.flipX = !elementoSelecionado.flipX;
    syncPropsToElement(elementoSelecionado);
    update2DTexture(activePiece);
    commitHistory();
  });
  if (btnUndo) btnUndo.addEventListener("click", undo);
  if (btnRedo) btnRedo.addEventListener("click", redo);

  // Propriedades do elemento selecionado
  const onSel = (fn, type) => () => {
    const it = elementoSelecionado;
    if (!it || (type && it.type !== type)) return;
    fn(it);
    update2DTexture(activePiece);
  };
  const bind = (el, ev, fn, commit) => {
    if (!el) return;
    el.addEventListener(ev, fn);
    if (commit) el.addEventListener("change", commitHistory);
  };

  bind(propTextContent, "input", onSel(it => { it.text = propTextContent.value; renderLayersList(); }, "text"), true);
  bind(propFont, "change", onSel(it => { it.fontFamily = propFont.value; }, "text"), true);
  bind(propColor, "input", onSel(it => { it.color = propColor.value; }, "text"), true);
  bind(propFontSize, "input", onSel(it => {
    it.fontSize = parseInt(propFontSize.value, 10);
    if (propValFontSize) propValFontSize.textContent = it.fontSize;
    updateRangeProgress(propFontSize);
  }, "text"), true);
  bind(propStrokeColor, "input", onSel(it => { it.strokeColor = propStrokeColor.value; }, "text"), true);
  bind(propStrokeWidth, "input", onSel(it => {
    it.strokeWidth = parseInt(propStrokeWidth.value, 10);
    if (propValStrokeWidth) propValStrokeWidth.textContent = it.strokeWidth;
    updateRangeProgress(propStrokeWidth);
  }, "text"), true);
  bind(propOpacity, "input", onSel(it => {
    it.opacity = parseInt(propOpacity.value, 10) / 100;
    if (propValOpacity) propValOpacity.textContent = `${propOpacity.value}%`;
    updateRangeProgress(propOpacity);
  }), true);
  bind(propBold, "click", () => {
    const it = elementoSelecionado;
    if (!it || it.type !== "text") return;
    it.bold = it.bold === false;
    syncPropsToElement(it);
    update2DTexture(activePiece);
    commitHistory();
  });
  bind(propItalic, "click", () => {
    const it = elementoSelecionado;
    if (!it || it.type !== "text") return;
    it.italic = !it.italic;
    syncPropsToElement(it);
    update2DTexture(activePiece);
    commitHistory();
  });

  // Adicionar texto (botão ou Enter)
  const inserirTexto = () => {
    if (!textInput) return;
    const txt = textInput.value.trim();
    if (!txt) return;
    addItem({
      id: "item-" + Date.now(),
      type: "text",
      text: txt,
      fontFamily: fonteSelect ? fonteSelect.value : "Outfit, sans-serif",
      fontSize: 48,
      color: corTextoInput ? corTextoInput.value : "#f35e0e",
      bold: true,
      italic: false,
      strokeColor: "#000000",
      strokeWidth: 0,
      opacity: 1,
      flipX: false,
      hidden: false,
      x: 0.5,
      y: 0.4,
      scale: 1,
      rotation: 0
    });
    textInput.value = "";
  };
  if (btnAddText) btnAddText.addEventListener("click", inserirTexto);
  if (textInput) textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inserirTexto(); } });

  // Upload de imagem
  if (imgUpload) {
    imgUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const targetW = 240;
          addItem({
            id: "img-" + Date.now(),
            type: "image",
            name: (file.name || "Imagem").slice(0, 28),
            src: event.target.result,
            imgElement: img,
            width: targetW,
            height: targetW / (img.width / img.height),
            opacity: 1,
            flipX: false,
            hidden: false,
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0
          });
          imgUpload.value = ""; // permite reenviar o mesmo arquivo
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Atalhos de teclado
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const tag = t && t.tagName;
    const isRange = tag === "INPUT" && t.type === "range";
    const typing = tag === "TEXTAREA" || tag === "SELECT" ||
      (tag === "INPUT" && !["range", "color", "checkbox", "button", "file"].includes(t.type));
    if (typing) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && key === "y") { e.preventDefault(); redo(); return; }
    if (!elementoSelecionado) return;

    if (mod && key === "d") { e.preventDefault(); duplicateItem(elementoSelecionado); return; }
    if (key === "delete" || key === "backspace") { e.preventDefault(); removeItem(elementoSelecionado); return; }
    if (key === "escape") { selecionarElemento(null); return; }

    if (key.startsWith("arrow") && !isRange) {
      e.preventDefault();
      const step = e.shiftKey ? 0.02 : 0.005;
      const it = elementoSelecionado;
      if (key === "arrowleft") it.x = Math.max(0.05, it.x - step);
      if (key === "arrowright") it.x = Math.min(0.95, it.x + step);
      if (key === "arrowup") it.y = Math.max(0.05, it.y - step);
      if (key === "arrowdown") it.y = Math.min(0.95, it.y + step);
      afterElementChange(false);
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key.startsWith("Arrow") && elementoSelecionado) commitHistory();
  });

  commitHistory();        // estado inicial (vazio) para o desfazer
  renderLayersList();
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
