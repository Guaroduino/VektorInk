// src/shaders.ts

export const vertexSrc = `
precision mediump float;

// Incluir los bloques de uniformes estándar de PixiJS
#include <global_uniforms>
#include <local_uniforms> // <-- ¡Importante!

// Atributos de entrada
attribute vec2 aPosition;
attribute vec4 aColor;
attribute float aSide; // -1 (lado izquierdo) a +1 (lado derecho)

// Salida al fragment shader
varying vec4 vColor;
varying float vSide;

void main() {
    // Pasar nuestro color de vértice
    vColor = aColor;
    vSide = aSide;

    // ¡LÍNEA CORREGIDA!
    // Ahora multiplicamos por la matriz local del objeto Y la matriz global.
    gl_Position = global_uniforms.uProjection * local_uniforms.uTransform * vec4(aPosition, 0.0, 1.0);
}`;

export const fragmentSrc = `
precision mediump float;

varying vec4 vColor;
varying float vSide;
uniform float uFeather; // 0..1 donde 1.0 es borde muy suave

void main() {
    // Feather suave hacia los bordes del trazo usando el valor interpolado de aSide
    float d = abs(vSide);              // 0 en el centro, 1 en el borde
    float feather = 1.0 - smoothstep(uFeather, 1.0, d);
    float alpha = vColor.a * feather;
    // Premultiplicado
    gl_FragColor = vec4(vColor.rgb * alpha, alpha);
}`;
