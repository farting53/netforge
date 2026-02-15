/**
 * NetForge - Network Topology & Floorplan Designer
 * Core Application Script
 */

// Configuration & Constants
const GRID_SIZE = 40;
const CANVAS_BG_COLOR = '#020617'; // slate-950
const SNAP_DEFAULT = true;

// Component Library Data
const COMPONENT_LIBRARY = [
    {
        category: "Core Network",
        items: [
            { id: 'router', name: 'Router', icon: 'radio-tower' },
            { id: 'core-switch', name: 'Core Switch', icon: 'server' },
            { id: 'access-switch', name: 'Access Switch', icon: 'network' },
            { id: 'firewall', name: 'Firewall', icon: 'shield' },
            { id: 'load-balancer', name: 'Load Balancer', icon: 'scale' }
        ]
    },
    {
        category: "Wireless",
        items: [
            { id: 'wap', name: 'WAP', icon: 'wifi' },
            { id: 'wlc', name: 'Wireless Controller', icon: 'router' },
            { id: 'mesh-node', name: 'Mesh Node', icon: 'radio' }
        ]
    },
    {
        category: "Servers",
        items: [
            { id: 'file-server', name: 'File Server', icon: 'hard-drive' },
            { id: 'print-server', name: 'Print Server', icon: 'printer' },
            { id: 'web-server', name: 'Web Server', icon: 'globe' },
            { id: 'db-server', name: 'Database Server', icon: 'database' },
            { id: 'dns-server', name: 'DNS Server', icon: 'server-cog' }
        ]
    },
    {
        category: "End Devices",
        items: [
            { id: 'desktop', name: 'Desktop PC', icon: 'monitor' },
            { id: 'laptop', name: 'Laptop', icon: 'laptop-2' },
            { id: 'tablet', name: 'Tablet', icon: 'tablet' },
            { id: 'smartphone', name: 'Smartphone', icon: 'smartphone' },
            { id: 'ip-phone', name: 'IP Phone', icon: 'phone' },
            { id: 'pos', name: 'POS Terminal', icon: 'credit-card' },
            { id: 'printer', name: 'Printer', icon: 'printer' },
            { id: 'camera', name: 'Camera', icon: 'video' }
        ]
    },
    {
        category: "Industrial",
        items: [
            { id: 'plc', name: 'PLC', icon: 'cpu' },
            { id: 'rtu', name: 'RTU', icon: 'circuit-board' },
            { id: 'scada', name: 'SCADA Server', icon: 'database' },
            { id: 'hmi', name: 'HMI Panel', icon: 'monitor-cog' },
            { id: 'meter', name: 'Power Meter', icon: 'gauge' },
            { id: 'sensor-hub', name: 'Sensor Hub', icon: 'radio-receiver' }
        ]
    }
];

// Application State
const State = {
    selectedTool: 'select', // select, connect, wall, room, door
    drawing: {
        isDrawing: false,
        startPoint: null,
        tempShape: null,
    },
    connection: {
        isConnecting: false,
        startAnchor: null,
        tempLine: null
    },
    snapToGrid: SNAP_DEFAULT,
    isPanning: false,
    history: [],
    historyIndex: -1,
    zoomLevel: 1,
    dragItem: null,
    isSpacePressed: false,
    stage: null,
    layers: {
        grid: null,
        background: null,
        links: null,
        devices: null,
        overlay: null
    }
};

// UI Elements
const UI = {
    leftSidebar: document.getElementById('left-sidebar'),
    rightSidebar: document.getElementById('right-sidebar'),
    libraryContent: document.getElementById('library-content'),
    propertiesContent: document.getElementById('properties-content'),
    canvasContainer: document.getElementById('canvas-container'),
    zoomDisplay: document.getElementById('zoom-level'),
    snapToggle: document.getElementById('snap-toggle'),
    snapIndicator: document.getElementById('snap-indicator'),
    statNodes: document.getElementById('stat-nodes'),
    statLinks: document.getElementById('stat-links'),
    coordDisplay: document.getElementById('coord-display'),
    toolHint: document.getElementById('tool-hint'),
    toolButtons: {
        select: document.getElementById('tool-select'),
        connect: document.getElementById('tool-connect'),
        wall: document.getElementById('tool-wall'),
        room: document.getElementById('tool-room'),
        door: document.getElementById('tool-door')
    }
};

// Initialization
function init() {
    console.log("NetForge initializing...");
    lucide.createIcons();
    renderLibrary();
    initKonva();
    setupUIEventListeners();
    updateZoomDisplay();
    console.log("NetForge ready.");
}

function initKonva() {
    const container = UI.canvasContainer;
    State.stage = new Konva.Stage({
        container: 'canvas-container',
        width: container.offsetWidth,
        height: container.offsetHeight,
        draggable: false
    });

    State.layers.grid = new Konva.Layer({ id: 'grid-layer' });
    State.layers.background = new Konva.Layer({ id: 'background-layer' });
    State.layers.links = new Konva.Layer({ id: 'links-layer' });
    State.layers.devices = new Konva.Layer({ id: 'devices-layer' });
    State.layers.overlay = new Konva.Layer({ id: 'overlay-layer' });

    State.stage.add(State.layers.grid);
    State.stage.add(State.layers.background);
    State.stage.add(State.layers.links);
    State.stage.add(State.layers.devices);
    State.stage.add(State.layers.overlay);

    drawGrid();
    setupStageEvents();
}

function drawGrid() {
    const layer = State.layers.grid;
    layer.destroyChildren();
    const GRID_EXTENT = 10000;
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_SIZE) {
        layer.add(new Konva.Line({ points: [i, -GRID_EXTENT, i, GRID_EXTENT], stroke: '#0f172a', strokeWidth: 1, listening: false }));
        layer.add(new Konva.Line({ points: [-GRID_EXTENT, i, GRID_EXTENT, i], stroke: '#0f172a', strokeWidth: 1, listening: false }));
    }
    layer.batchDraw();
}

function setupStageEvents() {
    const stage = State.stage;
    const container = UI.canvasContainer;

    // Context Menu
    const cm = document.getElementById('context-menu');
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (State.selectedTool === 'wall' && State.drawing.isDrawing) return; // Allow right click to cancel wall

        const pos = stage.getPointerPosition();
        const target = stage.getIntersection(pos);

        if (target && target !== stage) {
            let item = target.getParent();
            if (target.name() === 'link' || target.name() === 'wall' || target.name() === 'room') item = target;

            selectItem(item);
            cm.style.top = e.clientY + 'px';
            cm.style.left = e.clientX + 'px';
            cm.classList.remove('hidden');
        } else {
            cm.classList.add('hidden');
        }
    });

    window.addEventListener('click', () => cm.classList.add('hidden'));
    document.getElementById('cm-delete').addEventListener('click', () => {
        const selected = State.stage.find('.selection-rect')[0];
        if (selected) {
            selected.getParent().destroy();
            State.layers.devices.batchDraw();
            State.layers.links.batchDraw();
            State.layers.background.batchDraw();
            hideProperties();
            updateStats();
            saveToHistory();
        }
    });
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        stage.setPointersPositions(e);
        const pos = stage.getRelativePointerPosition();
        if (State.dragItem) {
            addDeviceToCanvas(State.dragItem, pos);
            State.dragItem = null;
        }
    });

    stage.on('wheel', (e) => {
        e.evt.preventDefault();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        const zoomSpeed = 1.1;
        const newScale = e.evt.deltaY > 0 ? oldScale / zoomSpeed : oldScale * zoomSpeed;
        if (newScale < 0.1 || newScale > 5) return;
        State.zoomLevel = newScale;
        stage.scale({ x: newScale, y: newScale });
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
        stage.position(newPos);
        updateZoomDisplay();
        stage.batchDraw();
    });

    stage.on('mousedown', (e) => {
        if (State.isSpacePressed || e.evt.button === 1) {
            State.isPanning = true;
            UI.canvasContainer.style.cursor = 'grabbing';
            stage.startDrag();
            return;
        }
        const pos = stage.getRelativePointerPosition();
        const snappedPos = State.snapToGrid ? {
            x: Math.round(pos.x / (GRID_SIZE / 2)) * (GRID_SIZE / 2),
            y: Math.round(pos.y / (GRID_SIZE / 2)) * (GRID_SIZE / 2)
        } : pos;

        if (State.selectedTool === 'wall') {
            handleWallClick(snappedPos, e.evt.button);
        } else if (State.selectedTool === 'room') {
            startRoomDrawing(snappedPos);
        } else if (State.selectedTool === 'door') {
            placeDoor(snappedPos);
        } else if (State.selectedTool === 'select' && e.target === stage) {
            selectItem(null);
        }
    });

    stage.on('mouseup mouseleave', () => {
        State.isPanning = false;
        if (!State.isSpacePressed) UI.canvasContainer.style.cursor = 'default';
        if (State.selectedTool === 'room' && State.drawing.isDrawing) finishRoomDrawing();
    });

    stage.on('mousemove', () => {
        const pos = stage.getRelativePointerPosition();
        UI.coordDisplay.textContent = `X: ${Math.round(pos.x)} Y: ${Math.round(pos.y)}`;
        const snappedPos = State.snapToGrid ? {
            x: Math.round(pos.x / (GRID_SIZE / 2)) * (GRID_SIZE / 2),
            y: Math.round(pos.y / (GRID_SIZE / 2)) * (GRID_SIZE / 2)
        } : pos;

        if (State.drawing.isDrawing) updateDrawingPreview(snappedPos);
        if (State.connection.isConnecting) updateConnectionPreview(pos);
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !State.isSpacePressed) {
            State.isSpacePressed = true;
            UI.canvasContainer.style.cursor = 'grab';
            stage.draggable(true);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const selected = State.stage.find('.selection-rect')[0];
            if (selected) {
                const parent = selected.getParent();
                parent.destroy();
                State.layers.devices.batchDraw();
                State.layers.links.batchDraw();
                State.layers.background.batchDraw();
                hideProperties();
                updateStats();
                saveToHistory();
            }
        }
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            State.isSpacePressed = false;
            UI.canvasContainer.style.cursor = 'default';
            stage.draggable(false);
        }
    });
}

// Device & Icon Management
const iconCache = {};
async function getIconImage(iconName, color = '#22d3ee') {
    const cacheKey = `${iconName}-${color}`;
    if (iconCache[cacheKey]) return iconCache[cacheKey];
    const temp = document.createElement('div');
    temp.innerHTML = `<i data-lucide="${iconName}"></i>`;
    document.body.appendChild(temp);
    lucide.createIcons({ attrs: { stroke: color, 'stroke-width': 2 }, nameAttr: 'data-lucide', icons: lucide.icons, root: temp });
    const svg = temp.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    document.body.removeChild(temp);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { iconCache[cacheKey] = img; resolve(img); };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    });
}

async function addDeviceToCanvas(item, pos) {
    const snappedPos = State.snapToGrid ? { x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE, y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE } : pos;
    const group = new Konva.Group({
        x: snappedPos.x,
        y: snappedPos.y,
        draggable: true,
        name: 'device',
        id: 'device-' + Date.now(),
        metadata: { ...item, ip: '192.168.1.' + (Math.floor(Math.random() * 254) + 1), status: 'Online', notes: '' }
    });

    const iconImg = await getIconImage(item.icon);
    const icon = new Konva.Image({ image: iconImg, x: -20, y: -20, width: 40, height: 40 });
    const label = new Konva.Text({ text: item.name, fontSize: 10, fontFamily: 'Inter, sans-serif', fill: '#94a3b8', align: 'center', width: 100, x: -50, y: 25 });

    group.add(icon);
    group.add(label);

    const anchors = [{ x: 0, y: -20 }, { x: 20, y: 0 }, { x: 0, y: 20 }, { x: -20, y: 0 }];
    anchors.forEach((a) => {
        const anchor = new Konva.Circle({ x: a.x, y: a.y, radius: 4, fill: '#06b2d2', stroke: '#000', strokeWidth: 1, name: 'anchor', visible: false, opacity: 0.8 });
        anchor.on('mousedown', (e) => { if (State.selectedTool === 'connect') { e.cancelBubble = true; startConnection(anchor); } });
        anchor.on('mouseup', (e) => { if (State.selectedTool === 'connect' && State.connection.isConnecting) { e.cancelBubble = true; finishConnection(anchor); } });
        group.add(anchor);
    });

    group.on('mouseover', () => {
        if (State.selectedTool === 'connect') { group.find('.anchor').forEach(a => a.visible(true)); State.layers.devices.batchDraw(); }
        document.body.style.cursor = 'pointer';
    });
    group.on('mouseout', () => {
        group.find('.anchor').forEach(a => a.visible(false)); State.layers.devices.batchDraw();
        document.body.style.cursor = 'default';
    });
    group.on('dragmove', () => {
        if (State.snapToGrid) {
            group.position({ x: Math.round(group.x() / GRID_SIZE) * GRID_SIZE, y: Math.round(group.y() / GRID_SIZE) * GRID_SIZE });
        }
        updateLinks();
    });
    group.on('click', (e) => { e.cancelBubble = true; selectItem(group); });

    State.layers.devices.add(group);
    State.layers.devices.batchDraw();
    updateStats();
    saveToHistory();
}

// Building Handlers
function handleWallClick(pos, button) {
    if (button === 2) { cancelDrawing(); return; }
    if (!State.drawing.isDrawing) {
        State.drawing.isDrawing = true;
        State.drawing.startPoint = pos;
        State.drawing.tempShape = new Konva.Line({ points: [pos.x, pos.y, pos.x, pos.y], stroke: '#475569', strokeWidth: 16, lineCap: 'round', opacity: 0.5, dash: [10, 5] });
        State.layers.background.add(State.drawing.tempShape);
    } else {
        const wall = new Konva.Line({ points: [State.drawing.startPoint.x, State.drawing.startPoint.y, pos.x, pos.y], stroke: '#475569', strokeWidth: 16, lineCap: 'round', name: 'wall', id: 'wall-' + Date.now() });
        wall.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(wall); } });
        State.layers.background.add(wall);
        cancelDrawing();
        State.layers.background.batchDraw();
        saveToHistory();
    }
}

function startRoomDrawing(pos) {
    State.drawing.isDrawing = true;
    State.drawing.startPoint = pos;
    State.drawing.tempShape = new Konva.Rect({ x: pos.x, y: pos.y, width: 0, height: 0, stroke: '#475569', strokeWidth: 2, dash: [5, 5], cornerRadius: 8, fill: 'rgba(71, 85, 105, 0.1)' });
    State.layers.background.add(State.drawing.tempShape);
}

function finishRoomDrawing() {
    const rect = State.drawing.tempShape;
    const room = new Konva.Rect({ x: rect.x(), y: rect.y(), width: rect.width(), height: rect.height(), stroke: '#475569', strokeWidth: 2, dash: [5, 5], cornerRadius: 8, fill: 'transparent', name: 'room', id: 'room-' + Date.now() });
    room.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(room); } });
    State.layers.background.add(room);
    cancelDrawing();
    State.layers.background.batchDraw();
    saveToHistory();
}

function placeDoor(pos) {
    const doorGroup = new Konva.Group({ x: pos.x, y: pos.y, draggable: true, name: 'door', id: 'door-' + Date.now() });
    doorGroup.add(new Konva.Rect({ x: -15, y: -5, width: 30, height: 10, fill: '#94a3b8', cornerRadius: 2 }));
    doorGroup.add(new Konva.Text({ text: '🚪', fontSize: 16, x: -8, y: -10 }));
    doorGroup.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(doorGroup); } });
    doorGroup.on('dragmove', () => {
        if (State.snapToGrid) doorGroup.position({ x: Math.round(doorGroup.x() / (GRID_SIZE / 2)) * (GRID_SIZE / 2), y: Math.round(doorGroup.y() / (GRID_SIZE / 2)) * (GRID_SIZE / 2) });
    });
    State.layers.background.add(doorGroup);
    State.layers.background.batchDraw();
    saveToHistory();
}

function updateDrawingPreview(pos) {
    if (State.selectedTool === 'wall') State.drawing.tempShape.points([State.drawing.startPoint.x, State.drawing.startPoint.y, pos.x, pos.y]);
    else if (State.selectedTool === 'room') { State.drawing.tempShape.width(pos.x - State.drawing.startPoint.x); State.drawing.tempShape.height(pos.y - State.drawing.startPoint.y); }
    State.layers.background.batchDraw();
}

function cancelDrawing() {
    if (State.drawing.tempShape) { State.drawing.tempShape.destroy(); State.drawing.tempShape = null; }
    State.drawing.isDrawing = false;
    State.drawing.startPoint = null;
    if (State.connection.tempLine) { State.connection.tempLine.destroy(); State.connection.tempLine = null; }
    State.connection.isConnecting = false;
    State.connection.startAnchor = null;
    State.layers.background.batchDraw();
    State.layers.overlay.batchDraw();
}

// Connection Handlers
function startConnection(anchor) {
    State.connection.isConnecting = true;
    State.connection.startAnchor = anchor;
    const stage = State.stage;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const startPoint = transform.point(anchor.getAbsolutePosition());
    State.connection.tempLine = new Konva.Line({ points: [startPoint.x, startPoint.y, startPoint.x, startPoint.y], stroke: '#22d3ee', strokeWidth: 2, dash: [4, 4], listening: false });
    State.layers.overlay.add(State.connection.tempLine);
}

function updateConnectionPreview(pos) {
    const anchor = State.connection.startAnchor;
    const stage = State.stage;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const startPoint = transform.point(anchor.getAbsolutePosition());
    State.connection.tempLine.points([startPoint.x, startPoint.y, pos.x, pos.y]);
    State.layers.overlay.batchDraw();
}

function finishConnection(endAnchor) {
    if (endAnchor === State.connection.startAnchor) { cancelDrawing(); return; }
    const startGroup = State.connection.startAnchor.getParent();
    const endGroup = endAnchor.getParent();
    if (startGroup === endGroup) { cancelDrawing(); return; }

    const link = new Konva.Line({
        stroke: '#22d3ee', strokeWidth: 2, name: 'link', id: 'link-' + Date.now(),
        metadata: { type: 'ethernet', startNodeId: startGroup.id(), endNodeId: endGroup.id(),
                    startAnchorIndex: startGroup.find('.anchor').indexOf(State.connection.startAnchor),
                    endAnchorIndex: endGroup.find('.anchor').indexOf(endAnchor) }
    });
    link.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(link); } });
    link.on('dblclick', () => {
        const color = prompt('Enter link color (hex):', link.stroke());
        if (color) { link.stroke(color); State.layers.links.batchDraw(); saveToHistory(); }
    });
    State.layers.links.add(link);
    updateLinkPosition(link);
    cancelDrawing();
    State.layers.links.batchDraw();
    updateStats();
    saveToHistory();
}

function updateLinkPosition(link) {
    const meta = link.getAttr('metadata');
    const startNode = State.stage.findOne('#' + meta.startNodeId);
    const endNode = State.stage.findOne('#' + meta.endNodeId);
    if (!startNode || !endNode) { link.destroy(); return; }
    const startAnchor = startNode.find('.anchor')[meta.startAnchorIndex];
    const endAnchor = endNode.find('.anchor')[meta.endAnchorIndex];
    link.points([startNode.x() + startAnchor.x(), startNode.y() + startAnchor.y(), endNode.x() + endAnchor.x(), endNode.y() + endAnchor.y()]);
    if (meta.type === 'fiber') link.dash([10, 5]);
    else if (meta.type === 'wifi') { link.dash([2, 4]); link.stroke('#f59e0b'); }
    else link.dash(null);
}

function updateLinks() {
    State.layers.links.find('.link').forEach(link => updateLinkPosition(link));
    State.layers.links.batchDraw();
}

// UI Helpers
function renderLibrary() {
    UI.libraryContent.innerHTML = '';
    COMPONENT_LIBRARY.forEach(cat => {
        const catEl = document.createElement('div');
        catEl.className = 'category-container mb-4';
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span>${cat.category}</span><i data-lucide="chevron-down" class="w-3 h-3"></i>`;
        const itemsList = document.createElement('div');
        itemsList.className = 'items-list mt-1 space-y-1';
        cat.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'component-item';
            itemEl.setAttribute('draggable', 'true');
            itemEl.dataset.id = item.id;
            itemEl.dataset.icon = item.icon;
            itemEl.dataset.name = item.name;
            itemEl.innerHTML = `<div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-cyan-400 group-hover:bg-slate-700 transition-colors"><i data-lucide="${item.icon}" class="w-5 h-5"></i></div><span class="text-xs font-medium text-slate-300">${item.name}</span>`;
            itemEl.addEventListener('dragstart', (e) => { State.dragItem = { ...item }; e.dataTransfer.setData('application/json', JSON.stringify(item)); });
            itemsList.appendChild(itemEl);
        });
        header.addEventListener('click', () => { itemsList.classList.toggle('hidden'); header.querySelector('i').style.transform = itemsList.classList.contains('hidden') ? 'rotate(-90deg)' : ''; });
        catEl.appendChild(header);
        catEl.appendChild(itemsList);
        UI.libraryContent.appendChild(catEl);
    });
    lucide.createIcons();
}

function setupUIEventListeners() {
    Object.keys(UI.toolButtons).forEach(tool => UI.toolButtons[tool].addEventListener('click', () => setTool(tool)));
    document.getElementById('toggle-left-sidebar').addEventListener('click', () => { State.isLeftSidebarCollapsed = !State.isLeftSidebarCollapsed; UI.leftSidebar.classList.toggle('sidebar-collapsed-left'); document.getElementById('toggle-left-sidebar').querySelector('i').style.transform = State.isLeftSidebarCollapsed ? 'rotate(180deg)' : ''; });
    document.getElementById('toggle-right-sidebar').addEventListener('click', () => { State.isRightSidebarCollapsed = !State.isRightSidebarCollapsed; UI.rightSidebar.classList.toggle('sidebar-collapsed-right'); document.getElementById('toggle-right-sidebar').querySelector('i').style.transform = State.isRightSidebarCollapsed ? 'rotate(180deg)' : ''; });
    UI.snapToggle.addEventListener('click', () => { State.snapToGrid = !State.snapToGrid; UI.snapIndicator.classList.toggle('bg-cyan-400', State.snapToGrid); UI.snapIndicator.classList.toggle('bg-slate-600', !State.snapToGrid); UI.snapIndicator.classList.toggle('shadow-[0_0_8px_rgba(34,211,238,0.8)]', State.snapToGrid); });
    document.getElementById('zoom-in').addEventListener('click', () => zoom(1.2));
    document.getElementById('zoom-out').addEventListener('click', () => zoom(0.8));
    document.getElementById('center-view').addEventListener('click', centerView);
    document.getElementById('library-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.component-item').forEach(item => { item.classList.toggle('hidden', !item.dataset.name.toLowerCase().includes(query)); });
        document.querySelectorAll('.category-container').forEach(cat => { cat.classList.toggle('hidden', cat.querySelectorAll('.component-item:not(.hidden)').length === 0); });
    });
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    document.getElementById('btn-export').addEventListener('click', exportPNG);
    document.getElementById('btn-save').addEventListener('click', saveJSON);
    document.getElementById('btn-load').addEventListener('click', () => document.getElementById('json-input').click());
    document.getElementById('json-input').addEventListener('change', loadJSON);
    document.querySelectorAll('.template-item').forEach(item => item.addEventListener('click', () => loadTemplate(item.dataset.template)));
}

function setTool(tool) {
    State.selectedTool = tool;
    cancelDrawing();
    Object.keys(UI.toolButtons).forEach(t => UI.toolButtons[t].classList.toggle('active', t === tool));
    if (tool === 'wall') showToolHint('Click to place wall point. Right-click to cancel.');
    else if (tool === 'room') showToolHint('Click and drag to draw a room.');
    else if (tool === 'connect') showToolHint('Select a device anchor to start connection.');
    else if (tool === 'door') showToolHint('Click on canvas to place a door.');
    else hideToolHint();
}

function showToolHint(text) { UI.toolHint.textContent = text; UI.toolHint.style.opacity = '1'; }
function hideToolHint() { UI.toolHint.style.opacity = '0'; }
function updateZoomDisplay() { UI.zoomDisplay.textContent = `${Math.round(State.zoomLevel * 100)}%`; }

function zoom(factor) {
    const stage = State.stage;
    const oldScale = stage.scaleX();
    const newScale = oldScale * factor;
    if (newScale < 0.1 || newScale > 5) return;
    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;
    const mousePointTo = { x: (centerX - stage.x()) / oldScale, y: (centerY - stage.y()) / oldScale };
    State.zoomLevel = newScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: centerX - mousePointTo.x * newScale, y: centerY - mousePointTo.y * newScale });
    updateZoomDisplay();
    stage.batchDraw();
}

function centerView() {
    State.zoomLevel = 1;
    State.stage.scale({ x: 1, y: 1 });
    State.stage.position({ x: 0, y: 0 });
    updateZoomDisplay();
    State.stage.batchDraw();
}

// Selection & Properties
function selectItem(item) {
    State.stage.find('.selection-rect').forEach(r => r.destroy());
    if (item) {
        const bounds = item.getClientRect({ relativeTo: item });
        const rect = new Konva.Rect({
            x: bounds.x - 5, y: bounds.y - 5, width: bounds.width + 10, height: bounds.height + 10,
            stroke: '#22d3ee', strokeWidth: 2, dash: [4, 4], name: 'selection-rect'
        });
        item.add(rect);
        showProperties(item);
    } else {
        hideProperties();
    }
    State.layers.devices.batchDraw();
    State.layers.background.batchDraw();
    State.layers.links.batchDraw();
}

function showProperties(item) {
    const meta = item.getAttr('metadata') || {};
    const type = item.name();
    let html = `<div class="space-y-4">
        <div class="prop-group">
            <label class="prop-label">Type</label>
            <div class="text-xs text-slate-400 capitalize">${type}</div>
        </div>
        <div class="prop-group">
            <label class="prop-label">Name</label>
            <input type="text" class="prop-input" value="${item.id()}" onchange="updateItemProp('${item.id()}', 'id', this.value)">
        </div>`;

    if (type === 'device') {
        html += `
        <div class="prop-group">
            <label class="prop-label">IP Address</label>
            <input type="text" class="prop-input" value="${meta.ip || ''}" onchange="updateItemProp('${item.id()}', 'ip', this.value)">
        </div>
        <div class="prop-group">
            <label class="prop-label">Status</label>
            <select class="prop-select" onchange="updateItemProp('${item.id()}', 'status', this.value)">
                <option value="Online" ${meta.status === 'Online' ? 'selected' : ''}>Online</option>
                <option value="Offline" ${meta.status === 'Offline' ? 'selected' : ''}>Offline</option>
                <option value="Warning" ${meta.status === 'Warning' ? 'selected' : ''}>Warning</option>
            </select>
        </div>
        <div class="prop-group">
            <label class="prop-label">Notes</label>
            <textarea class="prop-input h-20" onchange="updateItemProp('${item.id()}', 'notes', this.value)">${meta.notes || ''}</textarea>
        </div>`;
    }

    if (type === 'link') {
        html += `
        <div class="prop-group">
            <label class="prop-label">Link Type</label>
            <select class="prop-select" onchange="updateItemProp('${item.id()}', 'type', this.value)">
                <option value="ethernet" ${meta.type === 'ethernet' ? 'selected' : ''}>Ethernet (Solid)</option>
                <option value="fiber" ${meta.type === 'fiber' ? 'selected' : ''}>Fiber (Dashed)</option>
                <option value="wifi" ${meta.type === 'wifi' ? 'selected' : ''}>Wi-Fi (Dotted)</option>
            </select>
        </div>
        <div class="prop-group">
            <label class="prop-label">Color</label>
            <input type="color" class="w-full h-8 bg-slate-950 border border-slate-800 rounded" value="${item.stroke()}" onchange="updateItemProp('${item.id()}', 'stroke', this.value)">
        </div>`;
    }

    html += `</div>`;
    UI.propertiesContent.innerHTML = html;
}

function updateItemProp(id, prop, value) {
    const item = State.stage.findOne('#' + id);
    if (!item) return;
    if (prop === 'id') item.id(value);
    else if (prop === 'stroke') item.stroke(value);
    else {
        const meta = item.getAttr('metadata') || {};
        meta[prop] = value;
        item.setAttr('metadata', meta);
        if (item.name() === 'link') updateLinkPosition(item);
    }
    if (item.name() === 'device' && prop === 'id') {
        item.findOne('Text').text(value);
    }
    State.layers.devices.batchDraw();
    State.layers.links.batchDraw();
    State.layers.background.batchDraw();
    saveToHistory();
}

function hideProperties() {
    UI.propertiesContent.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-slate-600 space-y-3"><i data-lucide="mouse-pointer-2" class="w-8 h-8 opacity-20"></i><p class="text-xs text-center px-6">Select an item on the canvas to view and edit its properties.</p></div>`;
    lucide.createIcons({ root: UI.propertiesContent });
}

// History & Export
function saveToHistory() {
    const json = State.stage.toJSON();
    if (State.history[State.historyIndex] === json) return;
    State.history = State.history.slice(0, State.historyIndex + 1);
    State.history.push(json);
    State.historyIndex++;
    updateUndoRedoButtons();
}

function undo() {
    if (State.historyIndex > 0) {
        State.historyIndex--;
        loadState(State.history[State.historyIndex]);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (State.historyIndex < State.history.length - 1) {
        State.historyIndex++;
        loadState(State.history[State.historyIndex]);
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = State.historyIndex <= 0;
    document.getElementById('redo-btn').disabled = State.historyIndex >= State.history.length - 1;
}

function loadState(json) {
    const stage = State.stage;
    // We can't just stage.destroyChildren() because we have layers.
    // Instead we clear layers.
    Object.values(State.layers).forEach(layer => {
        if (layer.id() !== 'grid-layer') layer.destroyChildren();
    });

    const tempStage = Konva.Node.create(json);
    tempStage.getChildren().forEach(tempLayer => {
        const targetLayer = State.layers[tempLayer.id().split('-')[0]];
        if (targetLayer && targetLayer.id() !== 'grid-layer') {
            tempLayer.getChildren().forEach(child => {
                const clone = child.clone();
                // Re-bind events to clones
                rebindEvents(clone);
                targetLayer.add(clone);
            });
        }
    });
    State.stage.batchDraw();
    updateStats();
}

function rebindEvents(node) {
    const type = node.name();
    if (type === 'device') {
        node.on('mouseover', () => { if (State.selectedTool === 'connect') { node.find('.anchor').forEach(a => a.visible(true)); State.layers.devices.batchDraw(); } document.body.style.cursor = 'pointer'; });
        node.on('mouseout', () => { node.find('.anchor').forEach(a => a.visible(false)); State.layers.devices.batchDraw(); document.body.style.cursor = 'default'; });
        node.on('dragmove', () => { if (State.snapToGrid) node.position({ x: Math.round(node.x() / GRID_SIZE) * GRID_SIZE, y: Math.round(node.y() / GRID_SIZE) * GRID_SIZE }); updateLinks(); });
        node.on('click', (e) => { e.cancelBubble = true; selectItem(node); });
        node.find('.anchor').forEach(anchor => {
            anchor.on('mousedown', (e) => { if (State.selectedTool === 'connect') { e.cancelBubble = true; startConnection(anchor); } });
            anchor.on('mouseup', (e) => { if (State.selectedTool === 'connect' && State.connection.isConnecting) { e.cancelBubble = true; finishConnection(anchor); } });
        });
    } else if (type === 'link') {
        node.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(node); } });
    } else if (type === 'wall' || type === 'room' || type === 'door') {
        node.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(node); } });
        if (type === 'door') node.on('dragmove', () => { if (State.snapToGrid) node.position({ x: Math.round(node.x() / (GRID_SIZE/2)) * (GRID_SIZE/2), y: Math.round(node.y() / (GRID_SIZE/2)) * (GRID_SIZE/2) }); });
    }
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
        Object.values(State.layers).forEach(layer => { if (layer.id() !== 'grid-layer') layer.destroyChildren(); });
        State.stage.batchDraw();
        State.history = [];
        State.historyIndex = -1;
        saveToHistory();
        updateStats();
    }
}

function exportPNG() {
    const dataURL = State.stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'netforge-export.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function saveJSON() {
    const json = State.stage.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'netforge-project.json';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { loadState(e.target.result); saveToHistory(); };
    reader.readAsText(file);
}

async function loadTemplate(name) {
    if (!confirm('Loading a template will replace your current work. Continue?')) return;

    // Clear all layers
    Object.values(State.layers).forEach(l => {
        if (l.id() !== 'grid-layer') l.destroyChildren();
    });

    centerView();

    console.log('Loading template:', name);

    switch(name) {
        case 'home':
        case 'basic-home':
            // Walls for a simple house
            addWall({x: 100, y: 100}, {x: 700, y: 100});
            addWall({x: 700, y: 100}, {x: 700, y: 500});
            addWall({x: 700, y: 500}, {x: 100, y: 500});
            addWall({x: 100, y: 500}, {x: 100, y: 100});
            addWall({x: 400, y: 100}, {x: 400, y: 500}); // Center wall

            // Devices
            await addDeviceToCanvas({ name: 'ISP Router', icon: 'radio-tower' }, { x: 400, y: 300 });
            await addDeviceToCanvas({ name: 'Living Room PC', icon: 'monitor' }, { x: 200, y: 200 });
            await addDeviceToCanvas({ name: 'Bedroom Laptop', icon: 'laptop-2' }, { x: 550, y: 250 });
            await addDeviceToCanvas({ name: 'Smartphone', icon: 'smartphone' }, { x: 250, y: 400 });
            await addDeviceToCanvas({ name: 'Home Printer', icon: 'printer' }, { x: 600, y: 450 });
            break;

        case 'small-office':
            addWall({x: 50, y: 50}, {x: 950, y: 50});
            addWall({x: 950, y: 50}, {x: 950, y: 650});
            addWall({x: 950, y: 650}, {x: 50, y: 650});
            addWall({x: 50, y: 650}, {x: 50, y: 50});

            await addDeviceToCanvas({ name: 'Core Switch', icon: 'server' }, { x: 500, y: 100 });
            await addDeviceToCanvas({ name: 'WAP North', icon: 'wifi' }, { x: 300, y: 100 });
            await addDeviceToCanvas({ name: 'WAP South', icon: 'wifi' }, { x: 700, y: 100 });

            for(let i=0; i<4; i++) {
                await addDeviceToCanvas({ name: 'Workstation '+(i+1), icon: 'monitor' }, { x: 200 + i*200, y: 400 });
            }
            break;

        case 'office-lan':
            const fw = await addDeviceToCanvas({ name: 'Firewall', icon: 'shield' }, { x: 500, y: 50 });
            const core = await addDeviceToCanvas({ name: 'Core Switch', icon: 'server' }, { x: 500, y: 200 });
            const srv1 = await addDeviceToCanvas({ name: 'File Server', icon: 'hard-drive' }, { x: 300, y: 200 });
            const srv2 = await addDeviceToCanvas({ name: 'Web Server', icon: 'globe' }, { x: 700, y: 200 });

            for(let i=0; i<3; i++) {
                await addDeviceToCanvas({ name: 'Access Switch '+(i+1), icon: 'network' }, { x: 250 + i*250, y: 400 });
            }
            break;

        case 'data-center':
            await addDeviceToCanvas({ name: 'Edge Router', icon: 'radio-tower' }, { x: 500, y: 50 });
            await addDeviceToCanvas({ name: 'Load Balancer', icon: 'scale' }, { x: 500, y: 150 });
            for(let i=0; i<4; i++) {
                await addDeviceToCanvas({ name: 'Rack Server '+(i+1), icon: 'database' }, { x: 200 + i*200, y: 350 });
            }
            break;

        case 'school':
            addWall({x: 50, y: 50}, {x: 950, y: 50});
            addWall({x: 950, y: 50}, {x: 950, y: 650});
            addWall({x: 50, y: 650}, {x: 50, y: 50});
            for(let i=1; i<4; i++) addWall({x: 50, y: i*160+50}, {x: 950, y: i*160+50}); // Floors/Rooms
            await addDeviceToCanvas({ name: 'Main Server', icon: 'server' }, { x: 150, y: 100 });
            for(let i=0; i<5; i++) await addDeviceToCanvas({ name: 'Campus AP '+(i+1), icon: 'wifi' }, { x: 200+i*150, y: 100 });
            break;

        case 'campus-net':
            await addDeviceToCanvas({ name: 'Core Router 1', icon: 'radio-tower' }, { x: 400, y: 50 });
            await addDeviceToCanvas({ name: 'Core Router 2', icon: 'radio-tower' }, { x: 600, y: 50 });
            await addDeviceToCanvas({ name: 'Distribution 1', icon: 'server' }, { x: 300, y: 200 });
            await addDeviceToCanvas({ name: 'Distribution 2', icon: 'server' }, { x: 700, y: 200 });
            break;

        default:
            // For others, just add a router
            await addDeviceToCanvas({ name: 'Main Router', icon: 'radio-tower' }, { x: 500, y: 300 });
            break;
    }

    State.stage.batchDraw();
    saveToHistory();
}

function addWall(start, end) {
    const wall = new Konva.Line({
        points: [start.x, start.y, end.x, end.y],
        stroke: '#475569',
        strokeWidth: 16,
        lineCap: 'round',
        name: 'wall',
        id: 'wall-' + Date.now() + Math.random()
    });
    wall.on('click', (e) => { if (State.selectedTool === 'select') { e.cancelBubble = true; selectItem(wall); } });
    State.layers.background.add(wall);
}

function updateStats() {
    UI.statNodes.textContent = State.layers.devices.find('.device').length;
    UI.statLinks.textContent = State.layers.links.find('.link').length;
}

window.addEventListener('DOMContentLoaded', init);
