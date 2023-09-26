// Inicializa a visão da camera
var canvas = document.getElementById("canvas")
var cameraRotation = [0, 0];
var previousMouseX = 0;
var previousMouseY = 0;
var isMouseOverCanvas = false;

var canvasRect = canvas.getBoundingClientRect(); // Retornar o retângulo que descreve a posição do canvas na janela

function degToRad(d) {
    return d * Math.PI / 180;
}

// Função para quando o mouse entrar no canvas
canvas.addEventListener("mouseover", function (event) {
    isMouseOverCanvas = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
});

// Atualiza a rotação da camera, de acordo como mouse
canvas.addEventListener("mousemove", function (event) {
    if (isMouseOverCanvas) {
        var x = event.clientX - canvasRect.left; // Coordenada X relativa ao canvas
        var y = event.clientY - canvasRect.top;  // Coordenada Y relativa ao canvas

        // Verifique se o cursor está dentro dos limites do canvas
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            var deltaX = x - previousMouseX;
            var deltaY = y - previousMouseY;

            previousMouseX = x;
            previousMouseY = y;

            // Atualiza a rotação da câmera com base no movimento do mouse
            cameraRotation[0] -= degToRad(deltaY * 0.5); // Pitch
            cameraRotation[1] -= degToRad(deltaX * 0.5); // Yaw

            // Limita o pitch para evitar que a câmera gire demais
            cameraRotation[0] = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation[0]));

            // Calcula a nova posição do alvo com base na rotação da câmera e em uma distância fixa
            var distance = 100000;
            target[0] = cameraPosition[0] + Math.sin(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
            target[1] = cameraPosition[1] + Math.sin(cameraRotation[0]) * distance;
            target[2] = cameraPosition[2] + Math.cos(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
        }
    }
});

// Verifica quando o mouse sai do canvas
canvas.addEventListener("mouseout", function () {
    isMouseOverCanvas = false;
});

canvas.addEventListener("mouseleave", function () {
    isMouseDragging = false;
});

// Pontos de controle para a movimentação da camera
const points = {
    P0: [-30, 6, 15], // controle
    P1: [-15, 3, 25],
    P2: [30, 6, 30],
    P3: [40, 12, 20], // controle
    P4: [50, 15, 10],
    P5: [40, 12, -10],
    P6: [30, 9, -15], // controle
    P7: [15, 6, -25],
    P8: [-5, 9, -30],
    P9: [-20, 12, -20], // controle
    P10: [-35, 15, -10],
    P11: [-45, 12, 5],
    P12: [-30, 6, 15], // controle
};

// Calcula a posição da camera
function calculatePoint(points, t) {
    if (t <= 0.25) {
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 0;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else if (t > 0.25 && t <= 0.5) {
        t -= 0.25;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 3;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else if (t > 0.5 && t <= 0.75) {
        t -= 0.5;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 6;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else {
        t -= 0.75;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 9;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    }
}

// Configuração padrão da camera
var cameraPosition = [0, 25, -10];
var target = [0, 10, 0];
var up = [0, 1, 0];
var camera = m4.lookAt(cameraPosition, target, up);
var view = m4.inverse(camera);

// Função para animar a camera
function animateCamera() {
    var currentTime = Date.now();
    var animationDuration = 60000;
    var t = (currentTime % animationDuration) / animationDuration;

    // Calculo da posição da camera
    cameraPosition = calculatePoint(points, t);

    camera = m4.lookAt(cameraPosition, target, up);
    view = m4.inverse(camera);

    requestAnimationFrame(animateCamera);
}

animateCamera();