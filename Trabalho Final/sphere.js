"use strict";

var totalShots = 5; // Número total de tiros permitidos

// Atualiza o contador de tiros
function updateShotCounter() {
    var shotCountElement = document.getElementById("shot-count");
    if (shotCountElement) {
        shotCountElement.textContent = totalShots;
    }
}

function main() {
    // Obtém o contexto WebGL de um elemento canvas no documento.
    /** @type {HTMLCanvasElement} */
    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    // Define os shaders (vertex e fragment) para o objeto esférico.
    const vs = `
    attribute vec4 a_position;
    attribute vec4 a_color;
    
    uniform mat4 u_matrix;
    
    varying vec4 v_color;
    
    void main() {
        // Multiply the position by the matrix.
        gl_Position = u_matrix * a_position;
    
        // Pass the color to the fragment shader.
        v_color = a_color;
    }
    `;

    const fs = `
    precision mediump float;

    // Passed in from the vertex shader.
    varying vec4 v_color;
    
    uniform vec4 u_colorMult;
    
    void main() {
        gl_FragColor = v_color * u_colorMult;
    }`;

    // Cria um buffer de vértices para a esfera.
    const sphereBufferInfo = primitives.createSphereWithVertexColorsBufferInfo(gl, 1, 15, 15);

    // Cria um programa WebGL para renderizar a esfera.
    var programInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    var fieldOfViewRadians = degToRad(60);

    // Uniforms for each object.
    var sphereUniforms = {
        u_colorMult: [1, 0, 5, 1],
        u_matrix: m4.identity(),
    };

    // Array para armazenar informações sobre as bolas lançadas
    var spheres = [];   

    // Adicione um ouvinte de evento de clique ao canvas
    canvas.addEventListener("click", onCanvasClick);

    function onCanvasClick(event) {
        if (totalShots > 0) {
            var rayOrigin = cameraPosition.slice(); // Posição da câmera é o ponto de partida
            var rayDirection = m4.normalize(m4.subtractVectors(target, cameraPosition)); // Direção do olhar

            // Determine a velocidade desejada
            var speed = 5.0; // Ajuste este valor para a velocidade desejada

            // Configure a esfera com base na posição e direção do clique
            var newSphere = {
                position: rayOrigin.slice(),
                velocity: [rayDirection[0] * speed, rayDirection[1] * speed, rayDirection[2] * speed] // Direção do olhar é multiplicada pela velocidade
            };

            spheres.push(newSphere);
            totalShots -= 1; // Reduza o número total de tiros
            updateShotCounter(); // Atualize o contador de tiros
        }
    }

    window.addEventListener("keydown", function (event) {
        if (event.key === "r" || event.key === "R") {
            // Recarregue as esferas
            totalShots = 5;
            spheres = [];
            updateShotCounter(); // Atualize o contador de tiros
        }
    });

    // Função para verificar a colisão entre esferas e objetos
    function checkCollisions() {
        for (var i = 0; i < spheres.length; i++) {
            for (var j = 0; j < objs.length; j++) {
                if (objs[j].visible) {
                    var sphere = spheres[i];
                    var obj = objs[j];

                    var dist = m4.distance(sphere.position, obj.position);

                    if (dist < 20) {
                        // Colisão detectada, remova o objeto e a esfera
                        obj.visible = false;
                        spheres.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }
        }
    }

    var objectsToDraw = [
        {
            programInfo: programInfo,
            bufferInfo: sphereBufferInfo,
            uniforms: sphereUniforms,
        }
    ];

    // Função para calcular a matriz de transformação do objeto.
    function computeMatrix(viewProjectionMatrix, translation, xRotation, yRotation) {
        var matrix = m4.translate(viewProjectionMatrix,
            translation[0],
            translation[1],
            translation[2]);
        matrix = m4.xRotate(matrix, xRotation);
        return m4.yRotate(matrix, yRotation);
    }

    requestAnimationFrame(drawScene);

    // Função de animação principal.
    function drawScene(time) {
        time *= 0.0005;

        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, 0.1, 2000);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, view);

        // Verifique colisões
        checkCollisions();

        // Iterate over the array of spheres and update their positions
        spheres.forEach(function (sphere) {
            var position = sphere.position;
            var velocity = sphere.velocity;

            // Atualize a posição da esfera com base na velocidade
            position[0] += velocity[0];
            position[1] += velocity[1];
            position[2] += velocity[2];

            // Compute a matriz de transformação para a esfera
            var sphereXRotation = time;
            var sphereYRotation = time;

            sphereUniforms.u_matrix = computeMatrix(
                viewProjectionMatrix,
                position, // Use a posição da esfera atual
                sphereXRotation,
                sphereYRotation);

            // Draw the sphere
            objectsToDraw.forEach(function (object) {
                var programInfo = object.programInfo;
                var bufferInfo = object.bufferInfo;

                gl.useProgram(programInfo.program);

                // Setup all the needed attributes.
                webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);

                // Set the uniforms.
                webglUtils.setUniforms(programInfo, object.uniforms);

                // Draw
                gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
            });
        });

        requestAnimationFrame(drawScene);
    }
}

main();