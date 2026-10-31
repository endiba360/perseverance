import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Distorsión de barril: amplía el centro y comprime los bordes, como un ojo de pez.
// Con uFisheye = 0 la imagen pasa igual. Las esquinas no se mueven, así que no
// aparecen bordes vacíos.
const FisheyeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFisheye: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFisheye;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      vec2 p = d * vec2(uAspect, 1.0);
      float r2 = dot(p, p) / dot(vec2(uAspect, 1.0) * 0.5, vec2(uAspect, 1.0) * 0.5);
      float f = 1.0 - uFisheye + uFisheye * r2;
      gl_FragColor = texture2D(tDiffuse, 0.5 + d * f);
    }
  `,
};

// Viñeta, grano de película y leve gradación cálida
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Contraste suave en S y sombras ligeramente frías / luces cálidas
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.25);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += mix(vec3(-0.01, 0.0, 0.015), vec3(0.02, 0.008, -0.01), l);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      c.rgb += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = c;
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(size, 0.3, 0.6, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fisheye = new ShaderPass(FisheyeShader);
  fisheye.enabled = false;
  composer.addPass(fisheye);
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);

  composer.userData = {
    update: (time) => {
      film.uniforms.uTime.value = time % 100;
      fisheye.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
    },
    // Cámara con la que se dibuja la escena (la orbital o una del rover)
    setCamera: (cam) => {
      renderPass.camera = cam;
    },
    // 0 = sin distorsión; 0–1 = ojo de pez cada vez más marcado
    setFisheye: (amount) => {
      fisheye.enabled = amount > 0;
      fisheye.uniforms.uFisheye.value = amount;
    },
  };
  return composer;
}
