function getContrastColor(bg) {
  const rgb = bg.match(/\d+/g).map(Number);
  const yiq = ((rgb[0]*299)+(rgb[1]*587)+(rgb[2]*114))/1000;
  return yiq >= 128 ? "#000" : "#fff";
}
const canvas = document.getElementById("canvas");
const lineLayer = document.getElementById("lines");

let nodes = [];
let connections = [];
let selectedNode = null;
let lastSelectedNode = null;
let selectedLine = null;

let undoStack = [];
let redoStack = [];

// --------------------- 파스텔톤 랜덤 색 ---------------------
function getRandomPastelColor() {
  const r = Math.floor((Math.random() * 127) + 127);
  const g = Math.floor((Math.random() * 127) + 127);
  const b = Math.floor((Math.random() * 127) + 127);
  return `rgb(${r},${g},${b})`;
}

// --------------------- 노드 생성 ---------------------
function createNode(x, y, text = "편집을 하려면 클릭하세요.") {
  const safePos = findNonOverlappingPosition(x, y, 120);
  const node = document.createElement("div");
  node.className = "node";
  node.innerText = text;
  node.style.left = safePos.x + "px";
  node.style.top = safePos.y + "px";
  node.style.color = "#888";
  node.style.borderColor = "#aaa";

  let color;
  let attempts = 0;
  do {
    color = getRandomPastelColor();
    attempts++;
  } while (nodes.some(n => n.style.background === color) && attempts < 100);

  node.style.background = color;
  node.dataset.id = Math.random();

  canvas.appendChild(node);
  nodes.push(node);

  makeDraggable(node);
  enableNodeEditing(node);
  enableSelect(node);

  saveState();
  return node;
}

// --------------------- 겹치지 않게 위치 계산 ---------------------
function findNonOverlappingPosition(x, y, minDist) {
  let safe = false;
  let attempts = 0;

  while (!safe && attempts < 1000) {
    safe = nodes.every(n => {
      const dx = n.offsetLeft - x;
      const dy = n.offsetTop - y;
      return Math.sqrt(dx*dx + dy*dy) > minDist;
    });
    if (!safe) {
      x += (Math.random() - 0.5) * 100;
      y += (Math.random() - 0.5) * 100;
    }
    attempts++;
  }

  return {x, y};
}

// --------------------- 노드 편집 ---------------------
function enableNodeEditing(node) {
  node.addEventListener("dblclick", () => {
    if(node.innerText === "편집을 하려면 클릭하세요.") node.innerText = "";
    node.style.color = "#000";
    node.style.borderColor = "#000";
    node.contentEditable = true;
    node.focus();
  });

  node.addEventListener("blur", () => {
    node.contentEditable = false;
    if(node.innerText.trim() === "") {
      node.innerText = "편집을 하려면 클릭하세요.";
      node.style.color = "#888";
      node.style.borderColor = "#aaa";
    } else {
     const bg = node.style.background;

// 배경색 밝기 계산 (YIQ)
function getContrastColor(bg) {
  const rgb = bg.match(/\d+/g).map(Number);
  const yiq = ((rgb[0]*299)+(rgb[1]*587)+(rgb[2]*114))/1000;
  return yiq >= 128 ? "#000" : "#fff"; // 밝으면 검정, 어두우면 흰색
}

node.style.borderColor = bg;
node.style.color = getContrastColor(bg);

    }
    updateLines();
    saveState();
  });

  node.addEventListener("keydown", e => {
    if(e.key === "Enter") {
      e.preventDefault();
      node.blur();
    }
  });
}

// --------------------- 노드 선택 ---------------------
function enableSelect(node) {
  node.addEventListener("click", e => {
    e.stopPropagation();
    selectNode(node);
  });
}

function selectNode(node) {
  nodes.forEach(n => n.classList.remove("selected"));
  node.classList.add("selected");
  selectedNode = node;
  lastSelectedNode = node;
  selectedLine = null;
  updateLineSelection();
}

document.body.addEventListener("click", () => {
  nodes.forEach(n => n.classList.remove("selected"));
  selectedNode = null;
  selectedLine = null;
  updateLineSelection();
});

// --------------------- 드래그 & 합치기 ---------------------
let draggingNode = null;
let offsetX = 0, offsetY = 0;
let hoveredForMerge = null;

function makeDraggable(node) {
  node.addEventListener("mousedown", e => {
    draggingNode = node;
    offsetX = e.clientX - node.offsetLeft;
    offsetY = e.clientY - node.offsetTop;
  });

  document.addEventListener("mousemove", e => {
    if(!draggingNode) return;

    draggingNode.style.left = (e.clientX - offsetX) + "px";
    draggingNode.style.top = (e.clientY - offsetY) + "px";

    hoveredForMerge = null;
    nodes.forEach(other => {
      if(other !== draggingNode){
        const dx = (other.offsetLeft + other.offsetWidth/2) - (draggingNode.offsetLeft + draggingNode.offsetWidth/2);
        const dy = (other.offsetTop + other.offsetHeight/2) - (draggingNode.offsetTop + draggingNode.offsetHeight/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < 30){
          hoveredForMerge = other;
          other.style.borderColor = "#ff0000"; // 합치기 가능 표시
        } else {
          other.style.borderColor = other === selectedNode ? "#0070f3" : other.style.background;
        }
      }
    });

    updateLines();
  });

  document.addEventListener("mouseup", e => {
    if(draggingNode){
      if(hoveredForMerge){
        mergeNodes(hoveredForMerge, draggingNode);
        hoveredForMerge.style.borderColor = hoveredForMerge.style.background;
        hoveredForMerge = null;
      }
      saveState();
      draggingNode = null;
    }
  });
}

// --------------------- 색 혼합 ---------------------
function mixColors(color1, color2){
  const rgb1 = color1.match(/\d+/g).map(Number);
  const rgb2 = color2.match(/\d+/g).map(Number);
  const r = Math.floor((rgb1[0]+rgb2[0])/2);
  const g = Math.floor((rgb1[1]+rgb2[1])/2);
  const b = Math.floor((rgb1[2]+rgb2[2])/2);
  return `rgb(${r},${g},${b})`;
}

// --------------------- 노드 합치기 ---------------------
function mergeNodes(target, moving){
  target.style.background = mixColors(target.style.background, moving.style.background);

  if(moving.innerText.trim() === target.innerText.trim()){
    // 같으면 유지
  } else {
    target.innerText = "편집을 하려면 클릭하세요.";
    target.style.color = "#888";
    target.style.borderColor = target.style.background;
  }

  connections.forEach(c => {
    if(c.parent === moving) c.parent = target;
    if(c.child === moving) c.child = target;
  });

  moving.remove();
  nodes = nodes.filter(n => n !== moving);

  updateLines();
}

// --------------------- 선 생성 ---------------------
function connect(parent, child) {
  const path = document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("stroke","#555");
  path.setAttribute("stroke-width", 4);
  path.setAttribute("fill","none");
  path.setAttribute("pointer-events","stroke"); 
  lineLayer.appendChild(path);

  const conn = { parent, child, path };
  connections.push(conn);

  enableLineSelection(conn);
  updateLines();

  return conn;
}

// --------------------- 선 선택 ---------------------
function enableLineSelection(conn) {
  conn.path.addEventListener("click", e => {
    e.stopPropagation();
    selectedLine = conn;
    selectedNode = null;
    updateLineSelection();
  });
}

function updateLineSelection() {
  connections.forEach(c => {
    if(c===selectedLine){
      c.path.setAttribute("stroke","#0070f3");
      c.path.setAttribute("stroke-width",5);
    } else {
      c.path.setAttribute("stroke","#555");
      c.path.setAttribute("stroke-width",4);
    }
  });
}

// --------------------- 선 업데이트 ---------------------
function updateLines() {
  connections.forEach(c => {
    const startX = c.parent.offsetLeft + c.parent.offsetWidth/2;
    const startY = c.parent.offsetTop + c.parent.offsetHeight/2;
    const endX = c.child.offsetLeft + c.child.offsetWidth/2;
    const endY = c.child.offsetTop + c.child.offsetHeight/2;

    const ctrlX = (startX + endX)/2;
    const ctrlY = (startY + endY)/2 - 50; 
    c.path.setAttribute("d", `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`);
  });
}

// --------------------- 버튼: 자식 노드 ---------------------
document.getElementById("addChildBtn").onclick = () => {
  let parent = selectedNode || lastSelectedNode || nodes[0];
  if(!parent) return alert("부모 노드가 없습니다!");

  for(let i=0;i<1;i++){ // 필요 시 반복해서 여러 자식 가능
    const angle = Math.random() * Math.PI*2;
    const radius = 200;
    const px = parent.offsetLeft + Math.cos(angle)*radius;
    const py = parent.offsetTop + Math.sin(angle)*radius;

    const newNode = createNode(px, py);
    connect(parent,newNode);
  }

  selectNode(parent);
  updateLines();
  saveState();
};

// --------------------- 삭제 ---------------------
document.getElementById("deleteBtn").onclick = () => {
  if(selectedNode){
    connections = connections.filter(c=>{
      if(c.parent===selectedNode || c.child===selectedNode){
        c.path.remove();
        return false;
      }
      return true;
    });
    selectedNode.remove();
    nodes = nodes.filter(n=>n!==selectedNode);
    selectedNode=null;
    updateLines();
    saveState();
  } else if(selectedLine){
    selectedLine.path.remove();
    connections = connections.filter(c=>c!==selectedLine);
    selectedLine=null;
    updateLines();
    saveState();
  }
};

// --------------------- 노드 색 변경 ---------------------
document.getElementById("applyNodeColor").onclick = () => {
  if(!selectedNode) {
    alert("노드를 선택하세요!");
    return;
  }
  const newColor = document.getElementById("nodeColorPicker").value;
  selectedNode.style.background = newColor;
 const textColor = getContrastColor(newColor);
  selectedNode.style.color = textColor;
  selectedNode.style.borderColor = newColor;


  connections.forEach(c => {
    if(c.child === selectedNode || c.parent === selectedNode){
      c.path.setAttribute("stroke", newColor);
    }
  });

  updateLines();
  saveState();
};

// --------------------- Delete 키 ---------------------
document.addEventListener("keydown", e=>{
  if(e.key==="Delete") document.getElementById("deleteBtn").click();
});

// --------------------- Undo/Redo ---------------------
function saveState(){
  const state = {
    nodes: nodes.map(n=>({
      id:n.dataset.id,
      text:n.innerText,
      left:n.offsetLeft,
      top:n.offsetTop,
      bg:n.style.background
    })),
    connections: connections.map(c=>({
      parentId:c.parent.dataset.id,
      childId:c.child.dataset.id
    }))
  };
  undoStack.push(JSON.parse(JSON.stringify(state)));
  if(undoStack.length>50) undoStack.shift();
  redoStack=[];
}

function restoreState(state){
  nodes.forEach(n=>n.remove());
  nodes=[];
  lineLayer.innerHTML="";
  connections=[];
  const nodeMap = {};
  state.nodes.forEach(n=>{
    const node=createNode(n.left,n.top,n.text);
    node.style.background=n.bg;
    node.dataset.id=n.id;
    nodeMap[n.id]=node;
  });
  state.connections.forEach(c=>{
    connect(nodeMap[c.parentId],nodeMap[c.childId]);
  });
  updateLines();
}

document.addEventListener("keydown", e=>{
  if(e.ctrlKey && e.key.toLowerCase()==="z"){
    if(undoStack.length>1){
      const state=undoStack.pop();
      redoStack.push(state);
      restoreState(undoStack[undoStack.length-1]);
    }
  } else if(e.ctrlKey && e.key.toLowerCase()==="x"){
    if(redoStack.length>0){
      const state=redoStack.pop();
      restoreState(state);
      undoStack.push(state);
    }
  }
});

// --------------------- 초기 루트 노드 ---------------------
const root = createNode(300,200,"편집을 하려면 클릭하세요.");
selectNode(root);
saveState();
updateLines();

/* ------------------------------
    🧠 LocalStorage 저장/불러오기
--------------------------------*/

// 현재 mindmap 상태를 JSON으로 변환하는 함수
function exportMindmapData() {
  return {
    nodes: Object.values(nodes).map(n => ({
      id: n.id,
      x: n.x,
      y: n.y,
      text: n.text,
      color: n.color
    })),
    lines: lines.map(l => ({
      from: l.from.id,
      to: l.to.id
    }))
  };
}

// 데이터를 현재 mindmap에 반영하는 함수
function importMindmapData(data) {
  // 기존 내용 초기화
  Object.values(nodes).forEach(n => n.element.remove());
  nodes = {};
  lines.forEach(l => l.svg.remove());
  lines = [];

  // 노드 복원
  data.nodes.forEach(n => {
    createNode(n.x, n.y, n.text, n.color, n.id);
  });

  // 라인 복원
  data.lines.forEach(l => {
    const from = nodes[l.from];
    const to = nodes[l.to];
    if (from && to) connectNodes(from, to);
  });
}

/* -----------------------------------
     저장 버튼 (수동 저장)
------------------------------------ */

function saveMindmapToLocal() {
  const data = exportMindmapData();
  localStorage.setItem("mindmapData", JSON.stringify(data));
  console.log("💾 저장 완료");
}

function loadMindmapFromLocal() {
  const raw = localStorage.getItem("mindmapData");
  if (!raw) {
    console.log("저장된 데이터 없음");
    return;
  }

  try {
    const data = JSON.parse(raw);
    importMindmapData(data);
    console.log("📂 불러오기 완료");
  } catch (e) {
    console.error("데이터 손상됨");
  }
}

/* -----------------------------------
      ⏱ 자동저장 기능 (10초마다)
------------------------------------ */

setInterval(() => {
  saveMindmapToLocal();
}, 10000); // 10초

/* -----------------------------------
      페이지 로드 시 자동 불러오기
------------------------------------ */

window.addEventListener("load", () => {
  loadMindmapFromLocal();
});

/* -----------------------------------
      UI 버튼 연결 (원하면)
------------------------------------ */

// HTML에 아래 버튼을 추가해도 됨:
// <button id="saveBtn">저장</button>
// <button id="loadBtn">불러오기</button>

document.getElementById("saveBtn")?.addEventListener("click", saveMindmapToLocal);
document.getElementById("loadBtn")?.addEventListener("click", loadMindmapFromLocal);
