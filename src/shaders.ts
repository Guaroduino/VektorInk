// src/shaders.ts

export const vertexSrc = `
precision mediump float;

// Incluir los bloques de uniformes estándar de PixiJS
#include <global_uniforms>
#include <local_uniforms> // <-- ¡Importante!

// Atributos de entrada
attribute vec2 aPosition;
attribute vec4 aColor;

// Salida al fragment shader
varying vec4 vColor;

void main() {
    // Pasar nuestro color de vértice
    vColor = aColor;

    // ¡LÍNEA CORREGIDA!
    // Ahora multiplicamos por la matriz local del objeto Y la matriz global.
    gl_Position = global_uniforms.uProjection * local_uniforms.uTransform * vec4(aPosition, 0.0, 1.0);
}`;

export const fragmentSrc = `
precision mediump float;

varying vec4 vColor;

void main() {
    // Modular el RGB por el alfa para el efecto de "brillo" aditivo
    gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a);
}`;
