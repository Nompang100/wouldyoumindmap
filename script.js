/******************************
 * Firebase 초기화
 ******************************/
const firebaseConfig = {
  apiKey: "AIzaSyB2aQ_TfnAacGW4Q9R16zHCdoH7L7ShYX8",
  authDomain: "wouldyouomindmap.firebaseapp.com",
  projectId: "wouldyouomindmap",
  storageBucket: "wouldyouomindmap.firebasestorage.app",
  messagingSenderId: "377740724524",
  appId: "1:377740724524:web:d8f56c8c88829b1e2e0489",
  databaseURL: "https://wouldyouomindmap-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/******************************
 * 전역 변수
 ******************************/
let nodes = [];      
let lines = [];      
let selectedNode = null;
let currentMapName = "default";

/******************************
 * DOM 요소
 ******************************/
const canvas = document.getElementById("canvas");
const svg = document.getElementById("lines");

const newMapBtn = document.getElementById("newMapBtn");
const saveMapBtn = document.getElementById("saveMapBtn");
const loadMapBtn = document.getElementById("loadMapBtn");

const fileModal = document.getElementById("fileModal");
const fileList = document.getElementById("fileList");
const closeModal = document.getElementById("closeModal");

/******************************
 * 마인드맵 기본 기능
 ******************************/

function createNode(x = 200, y = 200, text = "", color = randomPastel()) {
  const div = document.createElement("div");
  div.className = "node";
  div.style.left = x + "px";
  div.style.top = y + "px";
  div.style.borderColor = color;
  div.style.color = color;

  div.contentEditable = true;
  div.innerText = text;

  canvas.appendChild(div);

  const node = { id: Date.now() + "_" + Math.random(), el: div, x, y, text, color };
  nodes.push(node);

  div.addEventListener("mousedown", () => selectNode(node));
  div.addEventListener("input", () => onNodeEdit(node));

  makeDraggable(node);
  return node;
}

function selectNode(n) {
  nodes.forEach(n => n.el.classList.remove("selected"));
  n.el.classList.add("selected");
  selectedNode = n;
}

function onNodeEdit(node) {
  node.text = node.el.innerText;
  node.el.style.borderColor = node.color;
  node.el.style.color = node.color;
}

/******************************
 * 드래그
 ******************************/
function makeDraggable(node) {
  let offsetX = 0, offsetY = 0;

  node.el.addEventListener("mousedown", (e) => {
    selectNode(node);
    offsetX = e.clientX - node.el.offsetLeft;
    offsetY = e.clientY - node.el.offsetTop;

    function move(e2) {
      node.x = e2.clientX - offsetX;
      node.y = e2.clientY - offsetY;

      node.el.style.left = node.x + "px";
      node.el.style.top = node.y + "px";

      redrawLines();
    }

    function stop() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  });
}

/******************************
 * 선 그리기
 ******************************/
function createLine(a, b) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", "#999");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "2");

  svg.appendChild(path);
  lines.push({ a, b, path });

  redrawLines();
}

function redrawLines() {
  for (let l of lines) {
    const x1 = l.a.x + 50;
    const y1 = l.a.y + 20;
    const x2 = l.b.x + 50;
    const y2 = l.b.y + 20;

    const c1x = (x1 + x2) / 2;
    const c1y = y1 - 80;

    const d = `M ${x1} ${y1} Q ${c1x} ${c1y}, ${x2} ${y2}`;
    l.path.setAttribute("d", d);
  }
}

/******************************
 * 랜덤 파스텔 색
 ******************************/
function randomPastel() {
  const r = Math.floor(Math.random() * 150 + 100);
  const g = Math.floor(Math.random() * 150 + 100);
  const b = Math.floor(Math.random() * 150 + 100);
  return `rgb(${r},${g},${b})`;
}

/******************************
 * 🔥 Firebase 저장
 ******************************/
async function saveMap(name = currentMapName) {
  const data = {
    nodes: nodes.map(n => ({
      id: n.id,
      x: n.x,
      y: n.y,
      text: n.text,
      color: n.color
    }))
  };
  await db.ref("maps/" + name).set(data);
  alert("저장 완료!");
}

async function loadMap(name) {
  const snap = await db.ref("maps/" + name).get();
  if (!snap.exists()) {
    alert("파일 없음");
    return;
  }
  const data = snap.val();
  loadMapData(data);
  currentMapName = name;
}

function loadMapData(data) {
  nodes = [];
  lines = [];
  canvas.innerHTML = "";
  svg.innerHTML = "";

  for (let n of data.nodes) {
    createNode(n.x, n.y, n.text, n.color);
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    createLine(nodes[i], nodes[i + 1]);
  }
}

/******************************
 * 파일 리스트 불러오기
 ******************************/
async function showFileList() {
  fileList.innerHTML = "";

  const snap = await db.ref("maps").get();
  const maps = snap.val() || {};

  Object.keys(maps).forEach(name => {
    const li = document.createElement("li");
    li.innerText = name;
    li.style.cursor = "pointer";
    li.onclick = () => {
      loadMap(name);
      fileModal.classList.add("hidden");
    };
    fileList.appendChild(li);
  });

  fileModal.classList.remove("hidden");
}

/******************************
 * 이벤트
 ******************************/
newMapBtn.onclick = () => {
  const name = prompt("새 파일 이름?");
  if (!name) return;
  currentMapName = name;
  nodes = [];
  lines = [];
  canvas.innerHTML = "";
  svg.innerHTML = "";
  createNode(300, 300, "새 노드");
};

saveMapBtn.onclick = () => saveMap();
loadMapBtn.onclick = () => showFileList();
closeModal.onclick = () => fileModal.classList.add("hidden");

/******************************
 * 🔥 자동 저장 (10초)
 ******************************/
setInterval(() => {
  saveMap(currentMapName);
}, 10000);

/******************************
 * 초기 첫 노드
 ******************************/
createNode(300, 300, "중심");
